import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, AuthError, unauthorizedResponse } from '@/lib/auth';
import { getDB } from '@/lib/db/data-source';
import { TwilioCredentials } from '@/lib/db/entities/twilio-credentials';
import { encrypt } from '@/lib/crypto';

export const runtime = 'nodejs';

const twilioCredentialsSchema = z.object({
  accountSid: z.string().min(1, 'Account SID is required'),
  authToken: z.string().min(1, 'Auth Token is required'),
  phoneNumber: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    if (!user.businessId) {
      return NextResponse.json({ error: 'No associated business found for this account' }, { status: 400 });
    }

    const database = await getDB();
    const credentialsRepository = database.getRepository(TwilioCredentials);
    const credentials = await credentialsRepository.findOne({ where: { businessId: user.businessId } });

    if (!credentials) {
      return NextResponse.json({ accountSid: '', phoneNumber: '', hasAuthToken: false });
    }

    return NextResponse.json({
      accountSid: credentials.accountSid,
      phoneNumber: credentials.phoneNumber || '',
      hasAuthToken: true,
    });
  } catch (error: unknown) {
    if (error instanceof AuthError) return unauthorizedResponse();
    const errorMessage = error instanceof Error ? error.message : 'Unknown exception';
    console.error('Error fetching Twilio credentials:', errorMessage);
    return NextResponse.json({ error: 'An unexpected error occurred while retrieving configuration.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    if (!user.businessId) {
      return NextResponse.json({ error: 'No associated business found for this account' }, { status: 400 });
    }

    const requestBody = await request.json();
    const validatedData = twilioCredentialsSchema.parse(requestBody);

    // Validate credentials with the live Twilio API
    const authorizationHeader = 'Basic ' + Buffer.from(`${validatedData.accountSid}:${validatedData.authToken}`).toString('base64');
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${validatedData.accountSid}.json`;

    try {
      const response = await fetch(twilioUrl, {
        headers: { Authorization: authorizationHeader },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Twilio validation error:', errorText);
        return NextResponse.json(
          { error: 'Failed to validate Twilio account credentials. Please check your Account SID and Auth Token.' },
          { status: 400 }
        );
      }
    } catch (networkError: unknown) {
      const errorMessage = networkError instanceof Error ? networkError.message : 'Network error';
      console.error('Network error validating with Twilio API:', errorMessage);
      return NextResponse.json(
        { error: `Could not connect to Twilio API for verification: ${errorMessage}` },
        { status: 502 }
      );
    }

    // Encrypt the auth token before storing
    const encryptedAuthToken = encrypt(validatedData.authToken);

    const database = await getDB();
    const credentialsRepository = database.getRepository(TwilioCredentials);

    let credentials = await credentialsRepository.findOne({ where: { businessId: user.businessId } });

    if (credentials) {
      credentials.accountSid = validatedData.accountSid;
      credentials.authToken = encryptedAuthToken;
      credentials.phoneNumber = validatedData.phoneNumber || undefined;
      await credentialsRepository.save(credentials);
    } else {
      credentials = credentialsRepository.create({
        businessId: user.businessId,
        accountSid: validatedData.accountSid,
        authToken: encryptedAuthToken,
        phoneNumber: validatedData.phoneNumber || undefined,
      });
      await credentialsRepository.save(credentials);
    }

    return NextResponse.json({
      success: true,
      message: 'Twilio account configurations successfully verified and updated.',
    });
  } catch (error: unknown) {
    if (error instanceof AuthError) return unauthorizedResponse();
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.errors }, { status: 400 });
    }
    const errorMessage = error instanceof Error ? error.message : 'Unknown exception';
    console.error('Error saving Twilio credentials:', errorMessage);
    return NextResponse.json({ error: 'An unexpected error occurred while saving configuration.' }, { status: 500 });
  }
}
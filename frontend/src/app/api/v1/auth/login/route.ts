import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDB } from '@/lib/db/data-source';
import { User } from '@/lib/db/entities/User';
import { Business } from '@/lib/db/entities/Business';
import { comparePassword, signToken, setAuthCookie } from '@/lib/auth';

export const runtime = 'nodejs';

const loginSchema = z.object({ 
  email: z.string().email(), 
  password: z.string().min(1) 
});

export async function POST(request: NextRequest) {
  try {
    const requestBody = await request.json();
    const validatedData = loginSchema.parse(requestBody);
    const database = await getDB();
    
    const user = await database.getRepository(User).findOne({ 
      where: { email: validatedData.email.toLowerCase() } 
    });
    
    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }
    
    const isPasswordValid = await comparePassword(validatedData.password, user.passwordHash);
    if (!isPasswordValid) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    let business: Business | null = null;
    if (user.businessId) {
      business = await database.getRepository(Business).findOne({ where: { id: user.businessId } });
    }

    const token = signToken({ userId: user.id, email: user.email, businessId: user.businessId || null });
    await setAuthCookie(token);

    return NextResponse.json({
      user: { id: user.id, email: user.email, ownerName: user.ownerName },
      business: business ? { 
        id: business.id, 
        name: business.name, 
        callCredits: business.callCredits, 
        planTier: business.planTier 
      } : null,
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.errors }, { status: 400 });
    }
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown exception';
    console.error(`[AuthLoginAPIError] Login failed: ${errorMessage}`);
    
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
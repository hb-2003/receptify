import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthError, unauthorizedResponse } from '@/lib/auth';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';

export const runtime = 'nodejs';

// Request schema validation
const requestSchema = z.object({
  purpose: z.string().min(1, 'Purpose is required'),
  business_name: z.string().optional().default('our business'),
  business_type: z.string().optional().default('SME'),
  customer_type: z.string().optional().default('customer'),
  language: z.enum(['en', 'hi', 'gu']).optional().default('en'),
  tone: z.enum(['professional', 'friendly', 'polite']).optional().default('professional'),
  call_goal: z.string().optional().default(''),
  important_details: z.string().optional().default(''),
  cta: z.string().optional().default(''),
  custom_fields: z.array(z.string()).optional().default([]),
});

export async function POST(request: NextRequest) {
  try {
    // Authenticate the user
    await requireAuth(request);

    // Validate the incoming JSON body
    const requestBody = await request.json();
    const validatedData = requestSchema.parse(requestBody);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('[GeminiLLM] GEMINI_API_KEY is not configured. Falling back to dummy structured response.');
      return NextResponse.json(getFallbackTemplate(validatedData), { status: 200 });
    }

    const generativeAI = new GoogleGenerativeAI(apiKey);
    const model = generativeAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
      },
    });

    const prompt = `You are a professional, polite, India-focused, compliance-aware outbound phone calling script generation AI.
Your target audience is Indian small-to-medium businesses (SMEs) like clinics, NBFCs, gyms, ed-techs, and D2C brands.

Create a highly personalized, natural, and friendly outbound calling script using the details below:
- Business Name: ${validatedData.business_name}
- Business Type/Industry: ${validatedData.business_type}
- Customer Persona: ${validatedData.customer_type}
- Primary Call Purpose/Scenario: ${validatedData.purpose}
- Primary Goal of the Call: ${validatedData.call_goal}
- Crucial Details to Mention: ${validatedData.important_details}
- Call to Action (CTA): ${validatedData.cta}
- Target Language: ${validatedData.language} (English, Hindi, or Gujarati - WRITE the text using the actual script of the language. For Hindi, use Devanagari script. For Gujarati, use Gujarati script. For English, use standard English.)
- Tone of the Voice Agent: ${validatedData.tone}
- Available Placeholders/Custom Fields: ${validatedData.custom_fields.join(', ') || 'none'} (Include these in double curly braces, e.g. {{name}}, {{amount}}, inside the text where appropriate.)

You MUST return a JSON object with exactly the following 9 string keys. Do not add markdown or backticks around the raw JSON output.
The 9 keys:
1. "full_script": The complete, cohesive phone call script representing a natural, bidirectional conversation outline.
2. "opening": The polite, warm greeting and introduction, verifying the identity of the person answering.
3. "main_message": The central pitch, reminder, or follow-up reason for the call.
4. "response_handling": Concrete guidelines/examples on how the voice agent should handle common customer questions, objections, or callback requests.
5. "closing": A polite, friendly farewell.
6. "cta": Clear, actionable next steps for the customer to take (e.g. paying via a UPI link, confirming an appointment time).
7. "short_version": A highly condensed version of the call script (under 30 seconds) for busy customers.
8. "polite_version": An exceptionally soft, polite, and service-oriented variation of the script.
9. "professional_version": A formal, standard, business-like variation of the script.

JSON Structure:
{
  "full_script": "...",
  "opening": "...",
  "main_message": "...",
  "response_handling": "...",
  "closing": "...",
  "cta": "...",
  "short_version": "...",
  "polite_version": "...",
  "professional_version": "..."
}`;

    const generationResult = await model.generateContent(prompt);
    const responseText = generationResult.response.text();
    const parsedResult = JSON.parse(responseText);

    return NextResponse.json(parsedResult);

  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return unauthorizedResponse();
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.errors }, { status: 400 });
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown exception';
    console.error('[GeminiScriptGeneratorAPIError] Failed to generate script:', errorMessage);
    return NextResponse.json({ error: 'Failed to generate calling script' }, { status: 500 });
  }
}

// Graceful deterministic fallback matching the 9-field schema if API key is missing
function getFallbackTemplate(data: z.infer<typeof requestSchema>) {
  const language = data.language;
  const business = data.business_name;
  const purpose = data.purpose;

  const intro = language === 'hi'
    ? `नमस्ते {{name}} जी, मैं ${business} से बात कर रहा हूँ। क्या मैं आपकी २ मिनट ले सकता हूँ?`
    : language === 'gu'
      ? `નમસ્તે {{name}}, હું ${business} thi vaat karu chu.\nCustomer: Haan, kahevu chhu.`
      : `Hello {{name}}, this is a call from ${business}. I hope you are doing well today.`;

  const bodyLine = {
    payment_reminder: language === 'hi' ? 'यह आपके आगामी भुगतान के संबंध में एक सौम्य अनुस्मारक है।' : 'This is a gentle reminder regarding your upcoming payment due soon.',
    appointment_reminder: language === 'hi' ? 'मैं हमारे साथ आपकी आगामी नियुक्ति की पुष्टि करने के लिए कॉल कर रहा हूँ।' : 'I am calling to confirm your upcoming appointment with us.',
    lead_followup: 'I wanted to follow up on your recent enquiry with us.',
    feedback: 'We would love to get your valuable feedback on our services.',
    event_reminder: 'This is a reminder for the upcoming event you registered for.',
    service_renewal: 'Your service is due for renewal soon.',
    cod_confirmation: 'I am calling to confirm your Cash on Delivery order before dispatch.',
    renewal_reminder: 'Your subscription is due for renewal.',
    reactivation: 'We have exciting updates and a special offer for you.',
    custom: 'I am calling to share some important updates with you.',
  }[purpose] || 'This is a call to share some important details with you.';

  const closeLine = language === 'hi' ? 'समय देने के लिए धन्यवाद, आपका दिन शुभ हो।' : 'Thank you for your time. Have a wonderful day ahead!';

  const fullScript = `${intro}\n\n${bodyLine}\n\n${closeLine}`;

  return {
    full_script: fullScript,
    opening: intro,
    main_message: bodyLine,
    response_handling: language === 'hi' ? 'यदि ग्राहक व्यस्त है, तो कहें: "कोई बात नहीं, मैं बाद में कॉल करूँगा।"' : 'If busy: "No problem, I will call back later." If questions: Provide helpline details.',
    closing: closeLine,
    cta: data.cta || 'Kindly take action as soon as possible.',
    short_version: `${intro} ${bodyLine} Thank you.`,
    polite_version: `Greetings. ${intro} We hope we aren't disturbing you. ${bodyLine} ${closeLine}`,
    professional_version: `${intro} ${bodyLine} ${closeLine}`,
  };
}
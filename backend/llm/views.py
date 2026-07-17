import os
import uuid
import json
import logging
import httpx
from decouple import config
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny

log = logging.getLogger("receptify.llm")


# Robust dynamic check for platform emergentintegrations package
try:
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    EMERGENT_INTEGRATIONS_AVAILABLE = True
except ImportError:
    EMERGENT_INTEGRATIONS_AVAILABLE = False


def build_fallback_script(purpose, business_name, business_type=None, customer_type=None, language='en', tone='professional', call_goal=None, important_details=None, cta=None, objection_handling=None, dynamic_variables=None, include_opt_out=False):
    purpose_human = purpose.replace('_', ' ')
    # Establish default English dynamic placeholder variables
    name_placeholder = "[Customer Name]" if dynamic_variables and "customer_name" in dynamic_variables else "{{name}}"
    due_date_placeholder = " [Due Date]" if dynamic_variables and "due_date" in dynamic_variables else ""
    amount_placeholder = " of [Amount Due]" if dynamic_variables and "amount_due" in dynamic_variables else ""
    appointment_placeholder = " on [Appointment Date]" if dynamic_variables and "appointment_date" in dynamic_variables else ""

    opening = f"Hello {name_placeholder}, this is {business_name} calling regarding your {purpose_human}{appointment_placeholder}."
    main_message = f"We wanted to share an important update with you. We have a scheduled {purpose_human}{amount_placeholder}{due_date_placeholder}."
    
    # Incorporate custom objections handling instructions if provided by the user
    if objection_handling:
        response_handling = f"Objection Handling Guidelines: {objection_handling}. Otherwise, if busy, offer to call back at a convenient time."
    else:
        response_handling = "If the customer is busy, politely offer to call back at a convenient time."
        
    # Append TRAI compliance opt-out statement strictly in English if toggled
    closing = "Thank you for your time. Have a wonderful day!"
    if include_opt_out:
        closing = f"{closing} This call was made in compliance with TRAI guidelines. To stop receiving these promotional alerts, please press 9 to opt-out."
    cta_line = cta if cta else "Please reply to confirm or call us back at your convenience."
    full = f"{opening} {main_message} {cta_line} {closing}"
    
    return {
        "opening": opening,
        "mainMessage": main_message,
        "responseHandling": response_handling,
        "closing": closing,
        "cta": cta_line,
        "shortVersion": f"{opening} {cta_line} Thank you!",
        "politeVersion": f"{opening} Hope this is a good time. {main_message} {cta_line} Thank you so much for your time!",
        "professionalVersion": f"{opening} {main_message} {cta_line} Regards, {business_name} team.",
        "fullScript": full
    }


class GenerateScriptView(APIView):
    # Support both public and authenticated generation requests
    permission_classes = [AllowAny]

    def post(self, request):
        purpose = request.data.get('purpose', 'custom').strip()
        business_name = request.data.get('business_name', '').strip()
        business_type = request.data.get('business_type', '').strip()
        customer_type = request.data.get('customer_type', '').strip()
        language = request.data.get('language', 'en').strip()
        tone = request.data.get('tone', 'professional').strip()
        call_goal = request.data.get('call_goal', '').strip()
        important_details = request.data.get('important_details', '').strip()
        cta = request.data.get('cta', '').strip()
        
        # Capture the three new AI Script Generator input parameters
        objection_handling = request.data.get('objection_handling', '').strip()
        dynamic_variables = request.data.get('dynamic_variables', [])
        include_opt_out = request.data.get('include_opt_out', False)

        if not business_name:
            return Response({'error': 'business_name is required'}, status=status.HTTP_400_BAD_REQUEST)

        # 1. Check for Gemini API Key first
        gemini_api_key = os.environ.get("GEMINI_API_KEY", "") or config('GEMINI_API_KEY', default="")
        if gemini_api_key:
            try:
                gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={gemini_api_key}"
                prompt = (
                    "You are an expert AI script writer for Indian small businesses generating professional customer calling scripts.\n"
                    f"Generate a calling script with parameters:\n"
                    f"- Purpose: {purpose}\n"
                    f"- Business Name: {business_name}\n"
                    f"- Business Type: {business_type}\n"
                    f"- Language: {language}\n"
                    f"- Tone: {tone}\n"
                    f"- Call Goal: {call_goal}\n"
                    f"- Call CTA: {cta}\n\n"
                    "Since this is for Indian telecommunications (TRAI compliance), you MUST include a clear opt-out message at the end of the script "
                    "(must contain keywords like 'opt-out' or 'press 9', e.g. 'To opt-out of future calls, please press 9').\n\n"
                    "Return ONLY a raw JSON object with the exact keys: "
                    '"opening", "main_message", "response_handling", "closing", "cta", "short_version", "polite_version", "professional_version", "full_script". '
                    "Do not enclose it in any markdown backticks or triple backticks. The values should be strings."
                )
                
                payload = {
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {
                        "responseMimeType": "application/json"
                    }
                }
                
                with httpx.Client() as client:
                    response = client.post(gemini_url, json=payload, timeout=15.0)
                    if response.status_code == 200:
                        response_data = response.json()
                        text_response = response_data['candidates'][0]['content']['parts'][0]['text']
                        parsed_json = json.loads(text_response.strip())
                        return Response(parsed_json, status=status.HTTP_200_OK)
                    else:
                        log.error(f"Gemini API returned status {response.status_code}: {response.text}")
            except Exception as exception:
                log.exception("Gemini API generation failed")

        # 2. Retrieve Emergent LLM Key if available (Claude fallback)
        emergent_llm_key = os.environ.get("EMERGENT_LLM_KEY", "") or config("EMERGENT_LLM_KEY", default="")

        # 3. Check if we should run LLM generation or return fallback script
        if not EMERGENT_INTEGRATIONS_AVAILABLE or not emergent_llm_key:
            # Fallback keeps local development and sandboxes completely functional
            log.warning("emergentintegrations unavailable or key missing — returning fallback script")
            fallback_data = build_fallback_script(
                purpose=purpose,
                business_name=business_name,
                business_type=business_type,
                customer_type=customer_type,
                language=language,
                tone=tone,
                call_goal=call_goal,
                important_details=important_details,
                cta=cta,
                objection_handling=objection_handling,
                dynamic_variables=dynamic_variables,
                include_opt_out=include_opt_out
            )
            return Response(fallback_data, status=status.HTTP_200_OK)

        # 3. LLM Generation via Emergent Integrations (Claude Sonnet 4.5)
        try:
            session_id = f"script-{uuid.uuid4()}"
            chat = LlmChat(
                api_key=emergent_llm_key,
                session_id=session_id,
                system_message=(
                    "You are an expert AI script writer for Indian small businesses generating professional customer calling scripts. "
                    "For TRAI compliance, you MUST include a clear, compliant opt-out option at the end of the script (such as 'To opt-out, please press 9'). "
                    "Return a JSON object containing keys: opening, main_message, response_handling, closing, cta, short_version, "
                    "polite_version, professional_version, full_script."
                ),
            ).with_model("anthropic", "claude-sonnet-4-5-20250929")

            # Build highly descriptive prompt
            prompt_parts = [
                f"Purpose: {purpose}",
                f"Business name: {business_name}",
            ]
            if business_type:
                prompt_parts.append(f"Business type: {business_type}")
            if customer_type:
                prompt_parts.append(f"Customer type: {customer_type}")
            prompt_parts.append(f"Language: {language}")
            prompt_parts.append(f"Tone: {tone}")
            if call_goal:
                prompt_parts.append(f"Call goal: {call_goal}")
            if important_details:
                prompt_parts.append(f"Important Details: {important_details}")
            if cta:
                prompt_parts.append(f"CTA: {cta}")
                
            # Add strict instructions for objection handling
            if objection_handling:
                prompt_parts.append(f"Objection & Response Handling Guidelines: {objection_handling}")
                
            # Add strict formatting rules for the dynamic placeholder variables
            if dynamic_variables:
                vars_list = []
                if "customer_name" in dynamic_variables:
                    vars_list.append("[Customer Name]")
                if "amount_due" in dynamic_variables:
                    vars_list.append("[Amount Due]")
                if "due_date" in dynamic_variables:
                    vars_list.append("[Due Date]")
                if "appointment_date" in dynamic_variables:
                    vars_list.append("[Appointment Date]")
                
                if vars_list:
                    prompt_parts.append(
                        f"You MUST use exactly these uppercase bracketed placeholder variable(s) "
                        f"where they naturally fit in the script segments: {', '.join(vars_list)}. "
                        "Do NOT use curly braces, lower case brackets, or invent any other placeholder formats."
                    )
                    
            # Add TRAI opt-out compliance instruction
            if include_opt_out:
                prompt_parts.append(
                    "To satisfy Indian TRAI compliance guidelines, you MUST append this exact legal opt-out instruction "
                    "at the end of the closing script segment: 'This call was made in compliance with TRAI guidelines. "
                    "To stop receiving these promotional alerts, please press 9 to opt-out.'"
                )

            user_msg = UserMessage(text="\n".join(prompt_parts))
            
            # Execute LLM call
            response_json = chat.send(user_msg)
            
            # DRF expected JSON response
            return Response(response_json, status=status.HTTP_200_OK)

        except Exception as e:
            log.error(f"LLM Generation failed: {str(e)}")
            # Gracefully fallback on LLM API exception to keep app running
            fallback_data = build_fallback_script(
                purpose=purpose,
                business_name=business_name,
                business_type=business_type,
                customer_type=customer_type,
                language=language,
                tone=tone,
                call_goal=call_goal,
                important_details=important_details,
                cta=cta,
                objection_handling=objection_handling,
                dynamic_variables=dynamic_variables,
                include_opt_out=include_opt_out
            )
            return Response(fallback_data, status=status.HTTP_200_OK)

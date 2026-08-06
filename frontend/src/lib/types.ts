export interface Customer {
  id: string;
  fullName: string;
  phone: string;
  customerType?: string;
  city?: string;
  language?: string;
  consentStatus?: string;
}

export interface Campaign {
  id: string;
  name: string;
  purpose: string;
  status: string;
  language: string;
  voiceType: string;
  scriptText?: string;
}

export interface CallRecording {
  id: string;
  recordingSid?: string;
  audioUrl: string;
  durationSec: number;
}

export interface CallTranscript {
  id: string;
  text: string;
  summary?: string;
}

export interface CallDetail {
  id: string;
  twilioSid?: string;
  status: string;
  outcome: string;
  attemptNumber: number;
  durationSec: number;
  startedAt?: string;
  notes?: string;
}

export interface CallDetailResponse {
  call: CallDetail;
  customer?: Customer;
  campaign?: Campaign;
  transcript?: CallTranscript;
  recording?: CallRecording;
}

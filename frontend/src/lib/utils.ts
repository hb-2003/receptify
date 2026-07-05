import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPhone(phone: string): string {
  // Normalize to +91XXXXXXXXXX
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  if (phone.startsWith('+')) return phone;
  return `+${digits}`;
}

export function isValidIndianPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return /^[6-9]/.test(digits);
  if (digits.length === 12 && digits.startsWith('91')) return /^91[6-9]/.test(digits);
  return false;
}

export const PURPOSE_LABEL: Record<string, string> = {
  payment_reminder: 'Payment Reminder',
  appointment_reminder: 'Appointment Reminder',
  lead_followup: 'Lead Follow-up',
  feedback: 'Feedback Call',
  event_reminder: 'Event Reminder',
  service_renewal: 'Service Renewal',
  cod_confirmation: 'COD Confirmation',
  renewal_reminder: 'Renewal Reminder',
  reactivation: 'Reactivation Call',
  custom: 'Custom Campaign',
};

export const LANGUAGE_LABEL: Record<string, string> = {
  en: 'English',
  hi: 'Hindi',
  gu: 'Gujarati',
};

export function formatDate(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  try {
    return format(date, 'dd MMM yyyy, hh:mm a');
  } catch {
    return '—';
  }
}

export function formatDuration(sec: number): string {
  if (!sec) return '0s';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

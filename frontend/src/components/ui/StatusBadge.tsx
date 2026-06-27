import { cn } from '@/lib/utils';
import { CheckCircle2, Clock, PhoneOff, PhoneMissed, AlertCircle, PhoneCall as PhoneIcon, Calendar, Wallet, RefreshCw, UserX } from 'lucide-react';

const STATUS_MAP: Record<string, { label: string; cls: string; icon: any }> = {
  queued:      { label: 'Queued',      cls: 'badge-neutral',   icon: Clock },
  ringing:     { label: 'Ringing',     cls: 'badge-active',    icon: PhoneIcon },
  in_progress: { label: 'In Progress', cls: 'badge-warning',   icon: PhoneIcon },
  completed:   { label: 'Completed',   cls: 'badge-completed', icon: CheckCircle2 },
  failed:      { label: 'Failed',      cls: 'badge-failed',    icon: AlertCircle },
  no_answer:   { label: 'No Answer',   cls: 'badge-neutral',   icon: PhoneMissed },
  draft:       { label: 'Draft',       cls: 'badge-draft',     icon: Clock },
  scheduled:   { label: 'Scheduled',   cls: 'badge-active',    icon: Calendar },
  running:     { label: 'Active',      cls: 'badge-active',    icon: PhoneIcon },
  paused:      { label: 'Paused',      cls: 'badge-paused',    icon: Clock },
};

const OUTCOME_MAP: Record<string, { label: string; cls: string; icon: any }> = {
  interested:            { label: 'Interested',            cls: 'badge-answered', icon: CheckCircle2 },
  not_interested:        { label: 'Not Interested',        cls: 'badge-failed',   icon: PhoneOff },
  callback_requested:    { label: 'Callback Requested',    cls: 'badge-callback', icon: RefreshCw },
  payment_promised:      { label: 'Payment Promised',      cls: 'badge-answered', icon: Wallet },
  appointment_confirmed: { label: 'Appointment Confirmed', cls: 'badge-answered', icon: Calendar },
  wrong_number:          { label: 'Wrong Number',          cls: 'badge-warning',  icon: UserX },
  no_answer:             { label: 'No Answer',             cls: 'badge-neutral',  icon: PhoneMissed },
  failed:                { label: 'Failed',                cls: 'badge-failed',   icon: AlertCircle },
  pending:               { label: 'Pending',               cls: 'badge-neutral',  icon: Clock },
};

export function StatusBadge({ status, type = 'status', className }: { status: string; type?: 'status' | 'outcome'; className?: string }) {
  const map = type === 'outcome' ? OUTCOME_MAP : STATUS_MAP;
  const conf = map[status] || { label: status, cls: 'badge-neutral', icon: Clock };
  const Icon = conf.icon;
  return (
    <span className={cn('badge', conf.cls, className)} data-testid={`badge-${type}-${status}`}>
      <Icon className="w-3 h-3" />
      {conf.label}
    </span>
  );
}

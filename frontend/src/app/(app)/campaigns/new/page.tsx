'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Wallet, Calendar, MessageSquareHeart, Bell, RefreshCw, PackageCheck,
  ArrowLeft, ArrowRight, Sparkles, ShieldCheck, CheckCircle2, Users, Megaphone, FileText, Mic,
} from 'lucide-react';
import { PURPOSE_LABEL, LANGUAGE_LABEL } from '@/lib/utils';
import { toast } from 'sonner';

const PURPOSES = [
  { value: 'payment_reminder', label: 'Payment Reminder', icon: Wallet, desc: 'Polite EMI / invoice / due-date reminders' },
  { value: 'appointment_reminder', label: 'Appointment Reminder', icon: Calendar, desc: 'Confirm bookings and reduce no-shows' },
  { value: 'lead_followup', label: 'Lead Follow-up', icon: MessageSquareHeart, desc: 'Re-engage warm enquiries automatically' },
  { value: 'feedback', label: 'Feedback Call', icon: Bell, desc: 'Capture quick customer feedback' },
  { value: 'event_reminder', label: 'Event Reminder', icon: Calendar, desc: 'Remind attendees a day before' },
  { value: 'service_renewal', label: 'Service Renewal', icon: RefreshCw, desc: 'Renewal reminders that convert' },
  { value: 'cod_confirmation', label: 'COD Confirmation', icon: PackageCheck, desc: 'Confirm order before dispatch' },
  { value: 'renewal_reminder', label: 'Subscription Renewal', icon: RefreshCw, desc: 'Subscription renewal reminders' },
  { value: 'reactivation', label: 'Reactivation Call', icon: RefreshCw, desc: 'Win back inactive customers' },
  { value: 'custom', label: 'Custom Campaign', icon: Megaphone, desc: 'Define your own purpose and script' },
];

const STEPS = [
  { id: 1, label: 'Purpose' },
  { id: 2, label: 'Audience' },
  { id: 3, label: 'Script' },
  { id: 4, label: 'Voice' },
  { id: 5, label: 'Schedule' },
  { id: 6, label: 'Compliance' },
  { id: 7, label: 'Review' },
];

export default function NewCampaignPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [customers, setCustomers] = useState<any[]>([]);
  const [business, setBusiness] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [data, setData] = useState({
    name: '',
    purpose: '',
    customerIds: [] as string[],
    scriptText: '',
    language: 'en' as 'en' | 'hi' | 'gu',
    voiceType: 'female_professional',
    scheduledAt: '',
    callingWindowStart: '09:00',
    callingWindowEnd: '19:00',
    retryAttempts: 2,
    delayBetweenCalls: 5,
    isComplianceConfirmed: false,
  });
  const [compliance, setCompliance] = useState({ hasConsent: false, isNotSpam: false, willFollowRules: false, isListValid: false });

  useEffect(() => {
    fetch('/api/customers').then((r) => r.json()).then((d) => setCustomers(d.customers || []));
    fetch('/api/auth/me').then((r) => r.json()).then((d) => setBusiness(d.business));
  }, []);

  const next = () => setStep((s) => Math.min(7, s + 1));
  const back = () => setStep((s) => Math.max(1, s - 1));

  const canNext = () => {
    if (step === 1) return !!data.purpose;
    if (step === 2) return data.customerIds.length > 0 && !!data.name;
    if (step === 3) return data.scriptText.trim().length > 30;
    if (step === 6) return compliance.hasConsent && compliance.isNotSpam && compliance.willFollowRules && compliance.isListValid;
    return true;
  };

  const generateScript = async () => {
    if (!data.purpose) return;
    setIsGenerating(true);
    try {
      const res = await fetch('/api/scripts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purpose: data.purpose,
          business_name: business?.name || 'our team',
          business_type: business?.businessType,
          language: data.language,
          tone: 'professional',
        }),
      });
      const d = await res.json();
      setData((prev) => ({ ...prev, scriptText: d.full_script || `Hello {{name}}, this is {{business}}.` }));
      toast.success('Script generated');
    } catch {
      toast.error('Failed to generate');
    } finally {
      setIsGenerating(false);
    }
  };

  const submit = async () => {
    setIsSubmitting(true);
    try {
      const create = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, isComplianceConfirmed: true }),
      });
      const cd = await create.json();
      if (!create.ok) { toast.error(cd.error || 'Failed'); return; }
      const launch = await fetch(`/api/campaigns/${cd.campaign.id}/launch`, { method: 'POST' });
      if (!launch.ok) { toast.error('Launch failed'); return; }
      toast.success('Campaign launched!');
      router.push(`/campaigns/${cd.campaign.id}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleCustomer = (id: string) => {
    setData((p) => ({ ...p, customerIds: p.customerIds.includes(id) ? p.customerIds.filter((x) => x !== id) : [...p.customerIds, id] }));
  };

  const selectAll = () => setData((p) => ({ ...p, customerIds: customers.map((c) => c.id) }));
  const clearAll = () => setData((p) => ({ ...p, customerIds: [] }));

  return (
    <div className="space-y-6 max-w-5xl mx-auto" data-testid="new-campaign-page">
      <header>
        <button onClick={() => router.push('/campaigns')} className="text-xs text-brand-600 inline-flex items-center gap-1 mb-2"><ArrowLeft className="w-3 h-3" /> Back to campaigns</button>
        <h1 className="text-3xl font-extrabold text-brand-navy">Create new campaign</h1>
      </header>

      {/* Stepper */}
      <div className="glass p-4 flex items-center justify-between gap-2 overflow-x-auto" data-testid="campaign-stepper">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2 shrink-0">
            <div className={`w-8 h-8 rounded-full grid place-items-center text-xs font-bold transition-colors ${step === s.id ? 'bg-brand-gradient text-white shadow-glow' : step > s.id ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
              {step > s.id ? <CheckCircle2 className="w-4 h-4" /> : s.id}
            </div>
            <span className={`text-xs font-semibold ${step >= s.id ? 'text-brand-navy' : 'text-slate-400'}`}>{s.label}</span>
            {i < STEPS.length - 1 && <div className="w-6 h-px bg-slate-200 mx-1" />}
          </div>
        ))}
      </div>

      {/* STEP 1: Purpose */}
      {step === 1 && (
        <div className="glass p-6 lg:p-8" data-testid="step-purpose">
          <h2 className="text-xl font-bold text-brand-navy">Choose campaign purpose</h2>
          <p className="text-sm text-slate-500 mt-1">Pick the use case that matches your call.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-6">
            {PURPOSES.map((p) => {
              const Icon = p.icon;
              const active = data.purpose === p.value;
              return (
                <button
                  key={p.value}
                  onClick={() => setData({ ...data, purpose: p.value })}
                  className={`text-left p-4 rounded-xl border transition-all ${active ? 'border-brand-500 bg-brand-50 shadow-glow' : 'border-slate-200 bg-white hover:border-brand-300'}`}
                  data-testid={`purpose-${p.value}`}
                >
                  <div className={`w-9 h-9 rounded-xl grid place-items-center mb-2 ${active ? 'bg-brand-gradient text-white' : 'bg-brand-50 text-brand-600'}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="font-bold text-brand-navy text-sm">{p.label}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{p.desc}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* STEP 2: Audience */}
      {step === 2 && (
        <div className="glass p-6 lg:p-8" data-testid="step-audience">
          <h2 className="text-xl font-bold text-brand-navy">Select audience</h2>
          <p className="text-sm text-slate-500 mt-1">Pick which customers will be called.</p>
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input className="input-field" placeholder="Campaign name *" value={data.name} onChange={(e) => setData({ ...data, name: e.target.value })} data-testid="campaign-name-input" />
            <div className="text-sm text-slate-500 flex items-center gap-2">
              <Users className="w-4 h-4" /> {data.customerIds.length} of {customers.length} customers selected
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={selectAll} className="btn-secondary text-xs" data-testid="select-all-customers">Select all</button>
            <button onClick={clearAll} className="btn-ghost text-xs">Clear</button>
          </div>
          <div className="mt-4 max-h-96 overflow-y-auto border border-slate-100 rounded-xl divide-y divide-slate-100">
            {customers.length === 0 ? (
              <div className="text-center py-8 text-sm text-slate-500">No customers yet. Add or upload first.</div>
            ) : customers.map((c) => (
              <label key={c.id} className="flex items-center gap-3 p-3 hover:bg-brand-50/40 cursor-pointer" data-testid={`audience-customer-${c.id}`}>
                <input type="checkbox" checked={data.customerIds.includes(c.id)} onChange={() => toggleCustomer(c.id)} className="w-4 h-4 rounded text-brand-600" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-brand-ink truncate">{c.fullName}</div>
                  <div className="text-xs text-slate-500">{c.phone} · {LANGUAGE_LABEL[c.language] || c.language}</div>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* STEP 3: Script */}
      {step === 3 && (
        <div className="glass p-6 lg:p-8" data-testid="step-script">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-xl font-bold text-brand-navy">Customize your script</h2>
              <p className="text-sm text-slate-500 mt-1">AI-generated, fully editable. Use {'{{name}}'} and {'{{business}}'} placeholders.</p>
            </div>
            <div className="flex gap-2 items-center">
              <button onClick={generateScript} disabled={isGenerating} className="btn-primary text-sm" data-testid="generate-script-button">
                <Sparkles className="w-4 h-4" /> {isGenerating ? 'Generating…' : 'Generate with AI'}
              </button>
            </div>
          </div>
          <textarea
            rows={12}
            className="input-field mt-5 font-mono text-sm leading-relaxed"
            placeholder="Click ‘Generate with AI’ or write your script here…"
            value={data.scriptText}
            onChange={(e) => setData({ ...data, scriptText: e.target.value })}
            data-testid="script-textarea"
          />
        </div>
      )}

      {/* STEP 4: Voice */}
      {step === 4 && (
        <div className="glass p-6 lg:p-8" data-testid="step-voice">
          <h2 className="text-xl font-bold text-brand-navy">Voice & language</h2>
          <p className="text-sm text-slate-500 mt-1">Choose how your AI voice agent should sound.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
            {[
              { v: 'female_professional', label: 'Female · Professional' },
              { v: 'female_friendly', label: 'Female · Friendly' },
              { v: 'male_professional', label: 'Male · Professional' },
              { v: 'male_friendly', label: 'Male · Friendly' },
            ].map((o) => (
              <button
                key={o.v}
                onClick={() => setData({ ...data, voiceType: o.v })}
                className={`text-left p-4 rounded-xl border ${data.voiceType === o.v ? 'border-brand-500 bg-brand-50 shadow-glow' : 'border-slate-200 bg-white hover:border-brand-300'}`}
                data-testid={`voice-${o.v}`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-brand-gradient text-white grid place-items-center"><Mic className="w-4 h-4" /></div>
                  <div className="font-bold text-brand-navy">{o.label}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* STEP 5: Schedule */}
      {step === 5 && (
        <div className="glass p-6 lg:p-8" data-testid="step-schedule">
          <h2 className="text-xl font-bold text-brand-navy">Schedule</h2>
          <p className="text-sm text-slate-500 mt-1">Configure when calls should be placed.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
            <div>
              <label className="label-base">Start date & time</label>
              <input type="datetime-local" className="input-field" value={data.scheduledAt} onChange={(e) => setData({ ...data, scheduledAt: e.target.value })} data-testid="schedule-datetime" />
              <p className="text-xs text-slate-500 mt-1">Leave blank to start immediately.</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label-base">Window start</label>
                <input type="time" className="input-field" value={data.callingWindowStart} onChange={(e) => setData({ ...data, callingWindowStart: e.target.value })} data-testid="window-start" />
              </div>
              <div>
                <label className="label-base">Window end</label>
                <input type="time" className="input-field" value={data.callingWindowEnd} onChange={(e) => setData({ ...data, callingWindowEnd: e.target.value })} data-testid="window-end" />
              </div>
            </div>
            <div>
              <label className="label-base">Retry attempts</label>
              <input type="number" min={0} max={5} className="input-field" value={data.retryAttempts} onChange={(e) => setData({ ...data, retryAttempts: parseInt(e.target.value) || 0 })} data-testid="retry-attempts" />
            </div>
            <div>
              <label className="label-base">Delay between calls (sec)</label>
              <input type="number" min={1} max={60} className="input-field" value={data.delayBetweenCalls} onChange={(e) => setData({ ...data, delayBetweenCalls: parseInt(e.target.value) || 5 })} data-testid="delay-between-calls" />
            </div>
          </div>
        </div>
      )}

      {/* STEP 6: Compliance */}
      {step === 6 && (
        <div className="glass p-6 lg:p-8" data-testid="step-compliance">
          <div className="flex items-start gap-3 p-4 bg-brand-50 rounded-xl border border-brand-100">
            <ShieldCheck className="w-6 h-6 text-brand-600 shrink-0" />
            <div>
              <h3 className="font-bold text-brand-navy">Compliance checklist</h3>
              <p className="text-sm text-slate-600 mt-0.5">Confirm responsible calling. Receptify is built to support legitimate customer communication, not spam.</p>
            </div>
          </div>
          <div className="space-y-3 mt-5">
            {[
              { k: 'hasConsent', label: 'I have customer consent to contact these customers.' },
              { k: 'isNotSpam', label: 'This is not a spam, cold sales, or unsolicited marketing campaign.' },
              { k: 'willFollowRules', label: 'I will follow Indian telecom and DND calling rules.' },
              { k: 'isListValid', label: 'My customer list is accurate, up-to-date, and lawfully sourced.' },
            ].map((c) => (
              <label key={c.k} className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 bg-white hover:border-brand-300 cursor-pointer" data-testid={`compliance-${c.k}`}>
                <input type="checkbox" checked={(compliance as any)[c.k]} onChange={(e) => setCompliance((p) => ({ ...p, [c.k]: e.target.checked }))} className="w-4 h-4 mt-0.5" />
                <span className="text-sm text-brand-ink">{c.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* STEP 7: Review */}
      {step === 7 && (
        <div className="glass p-6 lg:p-8" data-testid="step-review">
          <h2 className="text-xl font-bold text-brand-navy">Review & launch</h2>
          <p className="text-sm text-slate-500 mt-1">Confirm the details before launch.</p>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <ReviewItem label="Campaign name" value={data.name} />
            <ReviewItem label="Purpose" value={PURPOSE_LABEL[data.purpose] || data.purpose} />
            <ReviewItem label="Contacts" value={`${data.customerIds.length} customers`} />
            <ReviewItem label="Language" value={LANGUAGE_LABEL[data.language]} />
            <ReviewItem label="Voice" value={data.voiceType.replace(/_/g, ' ')} />
            <ReviewItem label="Calling window" value={`${data.callingWindowStart} – ${data.callingWindowEnd}`} />
            <ReviewItem label="Retries" value={`${data.retryAttempts}`} />
            <ReviewItem label="Scheduled" value={data.scheduledAt || 'Immediately'} />
            <div className="md:col-span-2">
              <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-1.5">Script preview</div>
              <div className="bg-white rounded-xl border border-slate-200 p-4 text-sm text-brand-ink whitespace-pre-wrap font-mono leading-relaxed max-h-40 overflow-auto">{data.scriptText}</div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between glass p-4">
        <button onClick={back} disabled={step === 1} className="btn-ghost text-sm disabled:opacity-50" data-testid="step-back-button">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="text-xs text-slate-500">Step {step} of {STEPS.length}</div>
        {step < 7 ? (
          <button onClick={next} disabled={!canNext()} className="btn-primary text-sm disabled:opacity-50" data-testid="step-next-button">
            Next <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button onClick={submit} disabled={isSubmitting} className="btn-primary text-sm" data-testid="campaign-launch-button">
            <Megaphone className="w-4 h-4" /> {isSubmitting ? 'Launching…' : 'Launch campaign'}
          </button>
        )}
      </div>
    </div>
  );
}

function ReviewItem({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 p-3">
      <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold">{label}</div>
      <div className="text-sm font-semibold text-brand-ink mt-1 capitalize">{value || '—'}</div>
    </div>
  );
}

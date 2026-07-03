'use client';

import { useEffect, useState } from 'react';
import { Sparkles, Copy, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { PURPOSE_LABEL } from '@/lib/utils';

const PURPOSES = Object.entries(PURPOSE_LABEL);

export default function ScriptGeneratorPage() {
  const [business, setBusiness] = useState<any>(null);
  const [form, setForm] = useState({
    purpose: 'payment_reminder',
    business_name: '',
    business_type: '',
    customer_type: 'customer',
    language: 'en',
    tone: 'professional',
    call_goal: '',
    important_details: '',
    cta: '',
  });
  const [result, setResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me').then((r) => r.json()).then((d) => {
      if (d.business) {
        setBusiness(d.business);
        setForm((f) => ({ ...f, business_name: d.business.name, business_type: d.business.businessType || '' }));
      }
    });
  }, []);

  const generate = async () => {
    setIsLoading(true);
    try {
      const r = await fetch('/api/scripts/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const d = await r.json();
      setResult(d);
    } catch (e) {
      toast.error('Failed to generate');
    } finally {
      setIsLoading(false);
    }
  };

  const copy = (text: string) => { navigator.clipboard.writeText(text); toast.success('Copied to clipboard'); };

  return (
    <div className="space-y-6" data-testid="script-generator-page">
      <header>
        <span className="overline">AI Script Generator</span>
        <h1 className="mt-2 text-3xl font-extrabold text-brand-navy">Generate professional calling scripts</h1>
        <p className="text-slate-500 text-sm mt-1">Powered by Claude Sonnet 4.5 · Polite, India-focused, compliance-aware.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Form */}
        <div className="glass p-6 lg:col-span-2">
          <h2 className="font-bold text-brand-navy mb-4">Script details</h2>
          <div className="space-y-3">
            <div>
              <label className="label-base">Purpose</label>
              <select className="input-field" value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} data-testid="sg-purpose-select">
                {PURPOSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="label-base">Business name</label>
              <input className="input-field" value={form.business_name} onChange={(e) => setForm({ ...form, business_name: e.target.value })} data-testid="sg-business-name-input" />
            </div>
            <div>
              <label className="label-base">Business type</label>
              <input className="input-field" placeholder="e.g. Clinic, NBFC, Gym" value={form.business_type} onChange={(e) => setForm({ ...form, business_type: e.target.value })} data-testid="sg-business-type-input" />
            </div>
            <div>
              <label className="label-base">Customer type</label>
              <input className="input-field" placeholder="e.g. patient, lead, member" value={form.customer_type} onChange={(e) => setForm({ ...form, customer_type: e.target.value })} data-testid="sg-customer-type-input" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label-base">Language</label>
                <select className="input-field" value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })} data-testid="sg-language-select">
                  <option value="en">English</option>
                  <option value="hi">Hindi</option>
                  <option value="gu">Gujarati</option>
                </select>
              </div>
              <div>
                <label className="label-base">Tone</label>
                <select className="input-field" value={form.tone} onChange={(e) => setForm({ ...form, tone: e.target.value })} data-testid="sg-tone-select">
                  <option value="professional">Professional</option>
                  <option value="friendly">Friendly</option>
                  <option value="polite">Polite</option>
                </select>
              </div>
            </div>
            <div>
              <label className="label-base">Call goal</label>
              <input className="input-field" placeholder="e.g. Remind about EMI due on 15 Feb" value={form.call_goal} onChange={(e) => setForm({ ...form, call_goal: e.target.value })} data-testid="sg-call-goal-input" />
            </div>
            <div>
              <label className="label-base">Important details</label>
              <textarea rows={2} className="input-field" value={form.important_details} onChange={(e) => setForm({ ...form, important_details: e.target.value })} data-testid="sg-details-input" />
            </div>
            <div>
              <label className="label-base">CTA</label>
              <input className="input-field" placeholder="e.g. Pay via UPI today to avoid late fee" value={form.cta} onChange={(e) => setForm({ ...form, cta: e.target.value })} data-testid="sg-cta-input" />
            </div>
            <button onClick={generate} disabled={isLoading} className="btn-primary w-full" data-testid="sg-generate-button">
              {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</> : <><Sparkles className="w-4 h-4" /> Generate script</>}
            </button>
          </div>
        </div>

        {/* Output */}
        <div className="lg:col-span-3 space-y-4">
          {!result ? (
            <div className="glass p-10 text-center text-sm text-slate-500" data-testid="sg-empty">
              <Sparkles className="w-10 h-10 text-brand-200 mx-auto mb-3" />
              Fill in the details and click <strong>Generate</strong> to create your script.
            </div>
          ) : (
            <>
              {[
                { k: 'full_script', label: 'Full script', highlight: true },
                { k: 'opening', label: 'Opening line' },
                { k: 'main_message', label: 'Main message' },
                { k: 'response_handling', label: 'Customer response handling' },
                { k: 'closing', label: 'Closing' },
                { k: 'cta', label: 'CTA' },
                { k: 'short_version', label: 'Short version' },
                { k: 'polite_version', label: 'Polite version' },
                { k: 'professional_version', label: 'Professional version' },
              ].map(({ k, label, highlight }) => (
                <div key={k} className={highlight ? 'glass-strong p-5 ring-2 ring-brand-200' : 'glass p-5'} data-testid={`sg-result-${k}`}>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-bold text-brand-navy text-sm">{label}</h4>
                    <button onClick={() => copy(result[k] || '')} className="text-xs text-brand-600 hover:underline inline-flex items-center gap-1" data-testid={`sg-copy-${k}`}><Copy className="w-3 h-3" /> Copy</button>
                  </div>
                  <p className="text-sm text-brand-ink whitespace-pre-wrap leading-relaxed">{result[k] || '—'}</p>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

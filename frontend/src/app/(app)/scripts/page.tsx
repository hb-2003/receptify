'use client';

import { useEffect, useState } from 'react';
import { Sparkles, Copy, Save, Loader2, Play } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { PURPOSE_LABEL } from '@/lib/utils';

const PURPOSES = Object.entries(PURPOSE_LABEL);

const CUSTOMER_TYPES = [
  { value: 'customer', label: 'General Customer' },
  { value: 'patient', label: 'Patient / Clinic Guest' },
  { value: 'borrower', label: 'Borrower / EMI Client' },
  { value: 'member', label: 'Gym Member / Fitness Client' },
  { value: 'lead', label: 'Prospect / Site Lead' },
  { value: 'buyer', label: 'Buyer / Retail Customer' },
];

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
        
        let defaultCustType = 'customer';
        const bType = d.business.businessType?.toLowerCase().trim();
        if (bType === 'clinic') defaultCustType = 'patient';
        else if (bType === 'nbfc' || bType === 'finance') defaultCustType = 'borrower';
        else if (bType === 'gym') defaultCustType = 'member';
        else if (bType === 'real-estate') defaultCustType = 'lead';

        setForm((prev) => ({
          ...prev,
          business_name: d.business.name || '',
          business_type: d.business.businessType || '',
          customer_type: defaultCustType,
        }));
      }
    });
  }, []);

  const labels = business?.businessType ? getTenantLabels(business.businessType) : null;

  const togglePlayAudio = () => {
    // Left empty or fallback
  };

  const load = async () => {
    setIsLoading(true);
    const res = await fetch(`/api/customers`);
    const data = await res.json();
    setIsLoading(false);
  };

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

  const copy = (text: string) => { 
    navigator.clipboard.writeText(text); 
    toast.success('Copied to clipboard'); 
  };

  return (
    <div className="space-y-6" data-testid="script-generator-page">
      <header>
        <span className="overline">AI Script Generator</span>
        <h1 className="mt-2 text-3xl font-extrabold text-brand-navy">Generate professional calling scripts</h1>
        <p className="text-slate-500 text-sm mt-1">
          Powered by advanced AI · Tuned for Indian business contexts, compliant and polite.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-stretch">
        
        {/* Form Card */}
        <div className="glass p-6 lg:col-span-2 flex flex-col justify-between h-full">
          <div>
            <h2 className="font-bold text-brand-navy mb-4">Script details</h2>
            <div className="space-y-3.5">
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
                <select 
                  className="input-field" 
                  value={form.customer_type} 
                  onChange={(e) => setForm({ ...form, customer_type: e.target.value })} 
                  data-testid="sg-customer-type-select"
                >
                  {CUSTOMER_TYPES.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
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
                <textarea rows={2} className="input-field" placeholder="e.g. UPI payment links supported, polite tone" value={form.important_details} onChange={(e) => setForm({ ...form, important_details: e.target.value })} data-testid="sg-details-input" />
              </div>
              
              <div>
                <label className="label-base">CTA</label>
                <input className="input-field" placeholder="e.g. Pay via UPI today to avoid late fee" value={form.cta} onChange={(e) => setForm({ ...form, cta: e.target.value })} data-testid="sg-cta-input" />
              </div>
            </div>
          </div>
          
          <button 
            onClick={generate} 
            disabled={isLoading} 
            className="btn-primary w-full mt-6 sticky bottom-0 shadow-lg" 
            data-testid="sg-generate-button"
          >
            {isLoading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Generating script…</>
            ) : (
              <><Sparkles className="w-4 h-4" /> Generate script</>
            )}
          </button>
        </div>

        {/* Output Panel Column */}
        <div className="lg:col-span-3 h-full flex flex-col">
          {!result ? (
            <div 
              className="glass p-12 text-center text-sm text-slate-500 flex flex-col items-center justify-center h-full min-h-[500px] border-2 border-dashed border-slate-200" 
              data-testid="sg-empty"
            >
              <div className="w-12 h-12 rounded-2xl bg-[#EFF6FF] text-[#2F5CFF] grid place-items-center mb-4 shadow-inner">
                <Sparkles className="w-6 h-6 animate-pulse" />
              </div>
              <h3 className="font-bold text-base text-brand-navy mb-1">Script Architecture Protocol</h3>
              <p className="text-xs text-slate-400 max-w-sm mb-6 text-center leading-relaxed">
                Fill in your campaign parameters on the left and click **Generate** to draft a high-converting, localized voice calling script.
              </p>
              
              {/* Abstract layout preview container */}
              <div className="w-full max-w-xs space-y-3 text-left border-t border-slate-100 pt-6">
                <span className="block text-[10px] font-mono font-bold uppercase tracking-[0.15em] text-[#2F5CFF]/80 mb-3 text-center">
                  PROPOSED SCRIPT SEGMENTS
                </span>
                {[
                  { step: '1. Opening greeting & local identification', d: 'polite regional namaste' },
                  { step: '2. Primary message statement', d: 'factual EMI or clinic reason' },
                  { step: '3. Legal TRAI DND check & compliance', d: 'consent verification' },
                  { step: '4. Immediate action CTA', d: 'payment link or confirm code' },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-1.5" />
                    <div>
                      <div className="font-semibold">{item.step}</div>
                      <div className="text-[10px] text-slate-400/80 italic mt-0.5">{item.d}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4 max-h-[680px] overflow-y-auto pr-1">
              {[
                { k: 'full_script', label: 'Full Script (AI Voice Protocol Output)', highlight: true },
                { k: 'opening', label: 'Opening Line' },
                { k: 'main_message', label: 'Main Message Body' },
                { k: 'response_handling', label: 'Customer Responses & Branches' },
                { k: 'closing', label: 'Closing & Opt-Out Option' },
                { k: 'cta', label: 'Primary Call to Action (CTA)' },
                { k: 'short_version', label: 'Short Version (SMS/Alternative)' },
                { k: 'polite_version', label: 'Polite / Courteous Version' },
                { k: 'professional_version', label: 'Professional / Corporate Version' },
              ].map(({ k, label, highlight }) => (
                <div 
                  key={k} 
                  className={cn(
                    "p-5 rounded-2xl border transition-all duration-300",
                    highlight 
                      ? 'bg-[#0B1220] border-slate-800 text-white shadow-xl shadow-brand-navy/10' 
                      : 'bg-white border-[#E7E4DC] text-brand-ink'
                  )} 
                  data-testid={`sg-result-${k}`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h4 className={cn("font-bold text-sm tracking-tight", highlight ? "text-[#2F5CFF]" : "text-brand-navy")}>
                      {label}
                    </h4>
                    <button 
                      onClick={() => copy(result[k] || '')} 
                      className={cn(
                        "text-xs font-mono font-bold uppercase tracking-wider inline-flex items-center gap-1.5 hover:underline", 
                        highlight ? "text-[#2F5CFF]" : "text-brand-600"
                      )} 
                      data-testid={`sg-copy-${k}`}
                    >
                      <Copy className="w-3.5 h-3.5" /> Copy
                    </button>
                  </div>
                  <p className={cn(
                    "text-xs sm:text-sm whitespace-pre-wrap leading-relaxed", 
                    highlight 
                      ? "font-mono italic text-slate-100" 
                      : "text-slate-600 font-medium"
                  )}>
                    {highlight ? `\u201C${result[k] || '—'}\u201D` : result[k] || '—'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
        
      </div>
    </div>
  );
}

// Inline fallback label helper for mapping types
function getTenantLabels(type: string) {
  const norm = type?.toLowerCase().trim();
  if (norm === 'clinic') return { customerLabel: 'Patient' };
  if (norm === 'gym') return { customerLabel: 'Member' };
  if (norm === 'nbfc' || norm === 'finance') return { customerLabel: 'Borrower' };
  return { customerLabel: 'Customer' };
}

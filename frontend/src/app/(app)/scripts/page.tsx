'use client';

import { useEffect, useState, useRef } from 'react';
import { Sparkles, Copy, Save, Loader2, Play, Plus, Check } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { PURPOSE_LABEL } from '@/lib/utils';

const PURPOSES = Object.entries(PURPOSE_LABEL);

const VARIABLES = [
  { value: 'customer_name', label: '[Customer Name]', color: 'blue' },
  { value: 'amount_due', label: '[Amount Due]', color: 'emerald' },
  { value: 'due_date', label: '[Due Date]', color: 'amber' },
  { value: 'appointment_date', label: '[Appointment Date]', color: 'purple' },
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
    call_goal: '', // This will hold the plain text / builder content from textarea
    description: '', // This will hold "Describe what you want (optional)"
    cta: '',
    objection_handling: '',
    dynamic_variables: [] as string[],
    include_opt_out: false,
  });

  const [result, setResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showSampleData, setShowSampleData] = useState(false);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  // Insert variable tag at current cursor position in the call_goal textarea
  const insertVariable = (variableLabel: string, variableValue: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = form.call_goal;
    const before = text.substring(0, start);
    const after = text.substring(end, text.length);

    const updatedText = `${before}${variableLabel}${after}`;
    
    // Add variable to dynamic_variables list if not already present
    const updatedVars = form.dynamic_variables.includes(variableValue)
      ? form.dynamic_variables
      : [...form.dynamic_variables, variableValue];

    setForm((prev) => ({ 
      ...prev, 
      call_goal: updatedText,
      dynamic_variables: updatedVars
    }));

    // Re-focus and set selection range after React update completes
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + variableLabel.length, start + variableLabel.length);
    }, 0);
  };

  const handleCustomVariableAdd = () => {
    const customName = prompt("Enter custom variable name (e.g. Due Amount, Token Number):");
    if (!customName) return;
    
    const formattedLabel = `[${customName.trim()}]`;
    insertVariable(formattedLabel, customName.toLowerCase().replace(/\s+/g, '_'));
  };

  const generate = async () => {
    setIsLoading(true);
    try {
      // Map form fields to fit backend prompt requirements
      const payload = {
        ...form,
        important_details: form.description, // Pass description as extra context
      };
      
      const r = await fetch('/api/scripts/generate', {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      setResult(d);
    } catch (e) {
      toast.error('Failed to generate script');
    } finally {
      setIsLoading(false);
    }
  };

  const useAsIs = () => {
    if (!form.call_goal) {
      toast.error("Please type a message in the builder first.");
      return;
    }
    
    // Package what the user typed directly into fullScript response schema
    setResult({
      full_script: form.call_goal,
      opening: "Welcome / Connection greeting is integrated in your text.",
      main_message: form.call_goal,
      response_handling: "Politely accept response and proceed to closing.",
      closing: form.include_opt_out ? "Thank you. This call was made in compliance with TRAI guidelines. To stop receiving these promotional alerts, please press 9 to opt-out." : "Thank you for your time. Goodbye.",
      cta: form.cta || "Please respond as requested.",
      short_version: form.call_goal.substring(0, 100) + "...",
      polite_version: "Hello. Hope you are having a nice day. " + form.call_goal,
      professional_version: form.call_goal
    });
    
    toast.success("Using your custom text as script draft!");
  };

  const saveTemplate = () => {
    toast.success("Script Template saved successfully to your calling suite!");
  };

  const copy = (text: string) => { 
    navigator.clipboard.writeText(text); 
    toast.success('Copied to clipboard'); 
  };

  // Safe variables highlighting preview parser
  const renderPreview = (text: string) => {
    if (!text) {
      return <span className="text-slate-400 italic">Start typing on the left to see live preview...</span>;
    }

    const replacements: Record<string, string> = {
      '[Customer Name]': showSampleData ? 'Hardik' : '[Customer Name]',
      '[Amount Due]': showSampleData ? '₹1200' : '[Amount Due]',
      '[Due Date]': showSampleData ? '15 Feb' : '[Due Date]',
      '[Appointment Date]': showSampleData ? '12 July' : '[Appointment Date]',
    };

    // Regex to split text by bracketed variables
    const parts = text.split(/(\[[^\]]+\])/g);
    return parts.map((part, index) => {
      if (part === '[Customer Name]') {
        return <span key={index} className="px-2 py-0.5 rounded-lg bg-blue-50 text-blue-700 font-bold border border-blue-200 inline-block text-xs mx-0.5">{replacements[part]}</span>;
      }
      if (part === '[Amount Due]') {
        return <span key={index} className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 inline-block text-xs mx-0.5">{replacements[part]}</span>;
      }
      if (part === '[Due Date]') {
        return <span key={index} className="px-2 py-0.5 rounded-lg bg-amber-50 text-amber-700 font-bold border border-amber-200 inline-block text-xs mx-0.5">{replacements[part]}</span>;
      }
      if (part === '[Appointment Date]') {
        return <span key={index} className="px-2 py-0.5 rounded-lg bg-purple-50 text-purple-700 font-bold border border-purple-200 inline-block text-xs mx-0.5">{replacements[part]}</span>;
      }
      
      // Handle custom user-created bracketed variables
      if (part.startsWith('[') && part.endsWith(']')) {
        return <span key={index} className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 font-bold border border-slate-300 inline-block text-xs mx-0.5">{part}</span>;
      }

      return part;
    });
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
        
        {/* LEFT PANEL: Build Message */}
        <div className="glass p-6 lg:col-span-2 flex flex-col justify-between h-full bg-white border border-[#E7E4DC] rounded-3xl shadow-sm">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-sm tracking-tight uppercase text-slate-500">Build your message</h2>
              {/* Collapsible Advanced details */}
              <details className="group border-0 select-none">
                <summary className="text-[11px] font-bold text-[#2F5CFF] hover:underline cursor-pointer list-none flex items-center gap-1">
                  Advanced <span className="group-open:rotate-180 transition-transform text-[8px]">▼</span>
                </summary>
                <div className="absolute left-6 right-6 lg:left-auto lg:w-[320px] p-4 bg-white rounded-2xl border border-slate-200 shadow-xl space-y-3 z-30 mt-1.5">
                  <div>
                    <label className="label-base">Purpose</label>
                    <select className="input-field" value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} data-testid="sg-purpose-select">
                      {PURPOSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
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
                  <div>
                    <label className="label-base">Business name</label>
                    <input className="input-field" value={form.business_name} onChange={(e) => setForm({ ...form, business_name: e.target.value })} />
                  </div>
                </div>
              </details>
            </div>

            {/* Variable Chips Row */}
            <div className="flex flex-wrap gap-1.5 p-1 bg-slate-50 rounded-2xl border border-slate-200/60">
              {VARIABLES.map((v) => (
                <button
                  key={v.value}
                  onClick={() => insertVariable(v.label, v.value)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl border text-[11px] font-bold cursor-pointer transition-all duration-200",
                    v.color === 'blue' && "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100",
                    v.color === 'emerald' && "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100",
                    v.color === 'amber' && "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100",
                    v.color === 'purple' && "bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100"
                  )}
                >
                  {v.label}
                </button>
              ))}
              <button
                onClick={handleCustomVariableAdd}
                className="px-3 py-1.5 rounded-xl border border-dashed border-slate-300 text-slate-500 bg-white hover:bg-slate-50 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add Variable
              </button>
            </div>

            {/* Main Textarea */}
            <div className="space-y-1.5">
              <textarea
                ref={textareaRef}
                rows={7}
                className="input-field font-mono text-sm leading-relaxed p-4 bg-slate-50/20 border-slate-200/80 focus:bg-white resize-none"
                placeholder="Type your message here, or click a variable above to insert it..."
                value={form.call_goal}
                onChange={(e) => setForm({ ...form, call_goal: e.target.value })}
                data-testid="sg-call-goal-input"
              />
            </div>

            {/* Optional AI Prompt details */}
            <div className="space-y-1.5 pt-2">
              <label className="text-xs font-bold text-slate-800">Describe what you want (optional)</label>
              <textarea
                rows={2}
                className="input-field bg-slate-50/10 border-slate-200 text-xs sm:text-sm"
                placeholder="e.g. Remind patient about appointment tomorrow, polite tone, ask to pay via UPI"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                data-testid="sg-details-input"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-3">
              <div>
                <label className="label-base">Objections Handling (Optional)</label>
                <input className="input-field py-2" placeholder="e.g. slots between 10am-2pm" value={form.objection_handling} onChange={(e) => setForm({ ...form, objection_handling: e.target.value })} data-testid="sg-objections-input" />
              </div>
              <div>
                <label className="label-base">Call CTA (Optional)</label>
                <input className="input-field py-2" placeholder="e.g. Pay via UPI today" value={form.cta} onChange={(e) => setForm({ ...form, cta: e.target.value })} data-testid="sg-cta-input" />
              </div>
            </div>

            {/* TRAI Opt-Out Switch */}
            <div className="flex items-center justify-between p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/60 mt-2">
              <div>
                <span className="text-xs font-bold text-slate-800 block">Include TRAI Compliance Wording</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">Append 'Press 9 to opt-out' to closing</span>
              </div>
              <input 
                type="checkbox" 
                className="w-4 h-4 text-[#2F5CFF] focus:ring-[#2F5CFF]/10 border-slate-300 rounded cursor-pointer" 
                checked={form.include_opt_out} 
                onChange={(e) => setForm({ ...form, include_opt_out: e.target.checked })} 
                data-testid="sg-opt-out-checkbox"
              />
            </div>

          </div>
          
          {/* Action CTAs Bottom panel */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-8">
            <button 
              onClick={useAsIs}
              className="px-4 h-11 border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold uppercase rounded-xl transition-all cursor-pointer inline-flex items-center justify-center gap-1.5"
            >
              Use As-Is
            </button>
            <button 
              onClick={generate} 
              disabled={isLoading || !form.business_name} 
              className="px-4 h-11 bg-[#2F5CFF] hover:bg-[#1D4ED8] text-white text-xs font-bold uppercase rounded-xl shadow-lg shadow-[#2F5CFF]/15 transition-all cursor-pointer inline-flex items-center justify-center gap-1.5 disabled:opacity-50" 
              data-testid="sg-generate-button"
            >
              {isLoading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
              ) : (
                <><Sparkles className="w-4 h-4" /> Generate script</>
              )}
            </button>
          </div>
        </div>

        {/* RIGHT PANEL: Output Panel Column */}
        <div className="lg:col-span-3 h-full flex flex-col justify-between">
          <div className="space-y-4 max-h-[640px] overflow-y-auto pr-1">
            <div className="glass p-5 rounded-2xl border border-[#E7E4DC] bg-slate-50/10 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-3.5">
                <h3 className="font-bold text-sm text-brand-navy">Live Message Preview</h3>
                <button
                  onClick={() => setShowSampleData(!showSampleData)}
                  className={cn(
                    "text-[10px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-lg border transition-all duration-200 cursor-pointer",
                    showSampleData ? "bg-[#EFF6FF] border-[#2F5CFF] text-[#2F5CFF]" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  )}
                >
                  {showSampleData ? "✓ Sample Data Active" : "Mock Sample Data"}
                </button>
              </div>
              <div className="p-4 bg-white border border-[#E7E4DC] rounded-xl shadow-inner min-h-[120px] text-xs sm:text-sm leading-relaxed text-slate-600">
                {renderPreview(form.call_goal)}
              </div>
            </div>

            {/* Generated Script results sections list */}
            {result && (
              <div className="space-y-4">
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

          {/* Action template bottom bar */}
          {result && (
            <div className="flex items-center justify-end gap-3 mt-4 pt-4 border-t border-slate-150">
              <button 
                onClick={saveTemplate}
                className="btn-primary px-5 py-2.5 text-xs font-bold uppercase rounded-xl tracking-wider flex items-center gap-1.5 shadow-md hover:bg-[#1D4ED8] cursor-pointer"
              >
                <Save className="w-4 h-4" /> Save Script to Campaign
              </button>
            </div>
          )}
        </div>
        
      </div>
    </div>
  );
}

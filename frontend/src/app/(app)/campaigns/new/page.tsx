'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Wallet, Calendar, MessageSquareHeart, Bell, RefreshCw, PackageCheck,
  ArrowLeft, ArrowRight, Sparkles, ShieldCheck, CheckCircle2, Users, Megaphone, FileText, Mic, Play, Loader2, Plus, AlertTriangle, Save, Check, Trash2, Filter
} from 'lucide-react';
import { PURPOSE_LABEL } from '@/lib/utils';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

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
  { id: 1, label: 'Basics' },
  { id: 2, label: 'Audience' },
  { id: 3, label: 'Message' },
  { id: 4, label: 'Voice' },
  { id: 5, label: 'Compliance' }, // Moved UP right after message!
  { id: 6, label: 'Schedule' },
  { id: 7, label: 'Test Call' }, // New step!
  { id: 8, label: 'Review & Launch' },
];

const VARIABLES = [
  { value: 'customer_name', label: '[Customer Name]', color: 'blue' },
  { value: 'amount_due', label: '[Amount Due]', color: 'emerald' },
  { value: 'due_date', label: '[Due Date]', color: 'amber' },
  { value: 'appointment_date', label: '[Appointment Date]', color: 'purple' },
];

const FILTER_FIELDS = [
  { value: 'city', label: 'City', type: 'text' },
  { value: 'customer_type', label: 'Customer Type', type: 'text' },
  { value: 'due_date', label: 'Due Date', type: 'date' },
  { value: 'appointment_date', label: 'Appointment Date', type: 'date' },
];

const OPERATORS = [
  { value: 'EQUALS', label: 'Is exactly' },
  { value: 'NOT_EQUALS', label: 'Is not' },
  { value: 'CONTAINS', label: 'Contains' },
  { value: 'GREATER_THAN', label: 'Greater than (>)' },
  { value: 'LESS_THAN', label: 'Less than (<)' },
  { value: 'IS_NULL', label: 'Is empty' },
  { value: 'IS_NOT_NULL', label: 'Is not empty' },
];

interface FilterRule {
  id: string;
  field_name: string;
  operator: string;
  value: any;
}

interface FilterGroup {
  id: string;
  logic_operator: 'AND' | 'OR';
  rules: FilterRule[];
}

export default function NewCampaignPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [customers, setCustomers] = useState<any[]>([]);
  const [business, setBusiness] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Test Call state
  const [testPhoneNumber, setTestPhoneNumber] = useState('');
  const [isSendingTestCall, setIsSendingTestCall] = useState(false);
  const [isPlayingActualVoiceSample, setIsPlayingActualVoiceSample] = useState(false);

  // Audience Mode Selection: 'rules' or 'static'
  const [audienceMode, setAudienceMode] = useState<'rules' | 'static'>('rules');
  
  // Rule-Builder Group State
  const [filterGroups, setFilterGroups] = useState<FilterGroup[]>([
    {
      id: 'group-1',
      logic_operator: 'AND',
      rules: [
        { id: 'rule-1', field_name: 'city', operator: 'EQUALS', value: '' }
      ]
    }
  ]);
  
  // Live audience count metrics preview state
  const [previewCount, setPreviewCount] = useState(0);
  const [previewCustomers, setPreviewCustomers] = useState<any[]>([]);
  const [isFetchingPreview, setIsFetchingPreview] = useState(false);

  // Core campaign payload
  const [data, setData] = useState({
    name: '',
    purpose: '',
    customerIds: [] as string[],
    scriptText: '',
    language: 'en' as 'en', // Strictly locked to English
    voiceType: 'female_professional',
    scheduledAt: '',
    callingWindowStart: '09:00',
    callingWindowEnd: '19:00',
    retryAttempts: 2,
    delayBetweenCalls: 5,
    isComplianceConfirmed: false,
    objection_handling: '',
    cta: '',
    description: '', // Description to feed Generate script AI
  });

  // Compliance checklists
  const [compliance, setCompliance] = useState({ 
    hasConsent: false, 
    isNotSpam: false, 
    willFollowRules: false, 
    isListValid: false 
  });
  
  const [showSampleData, setShowSampleData] = useState(false);
  const scriptTextareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    fetch('/api/customers').then((r) => r.json()).then((d) => setCustomers(d.customers || []));
    fetch('/api/auth/me').then((r) => r.json()).then((d) => setBusiness(d.business));
  }, []);

  // Fetch dynamic preview metrics when filter groups are updated
  useEffect(() => {
    if (audienceMode === 'rules' && step === 2) {
      triggerPreviewFetch();
    }
  }, [filterGroups, audienceMode, step]);

  // Clean up any ongoing browser speech synthesis when changing steps or unmounting
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [step]);

  const triggerPreviewFetch = async () => {
    // Cancel any ongoing previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsFetchingPreview(true);

    try {
      const res = await fetch('/api/customers/audiences/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filterGroups }),
        signal: controller.signal
      });
      const d = await res.json();
      setPreviewCount(d.count || 0);
      setPreviewCustomers(d.customers || []);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error("Preview fetch failed", err);
        setPreviewCount(0);
        setPreviewCustomers([]);
      }
    } finally {
      // Only finalize loading state if this is the current active request
      if (abortControllerRef.current === controller) {
        setIsFetchingPreview(false);
      }
    }
  };

  const next = () => setStep((s) => Math.min(8, s + 1));
  const back = () => setStep((s) => Math.max(1, s - 1));

  // Auto-scan script compliance validation rules (Strict Gate)
  const isScriptCompliant = () => {
    const text = data.scriptText.toLowerCase();
    
    // Check if the script contains TRAI DND opt-out indicators
    const hasOptOutKeyword = text.includes('opt-out') || text.includes('press 9') || text.includes('dnd');
    
    // Script must also be at least 30 characters
    return hasOptOutKeyword && data.scriptText.trim().length >= 30;
  };

  const canNext = () => {
    if (step === 1) return !!data.purpose && !!data.name;
    if (step === 2) {
      if (audienceMode === 'static') return data.customerIds.length > 0;
      
      // Filter Rules must match at least 1 customer and all rules must have a valid non-empty value (except for null check operators)
      const allRulesValid = filterGroups.every((group) => 
        group.rules.every((rule) => {
          if (rule.operator === 'IS_NULL' || rule.operator === 'IS_NOT_NULL') return true;
          return rule.value !== undefined && rule.value !== null && String(rule.value).trim() !== '';
        })
      );
      return previewCount > 0 && allRulesValid;
    }
    if (step === 3) return data.scriptText.trim().length > 10;
    if (step === 5) {
      // Compliance check is now a hard gate blocking next progress
      const scriptOk = isScriptCompliant();
      const checkboxesOk = compliance.hasConsent && compliance.isNotSpam && compliance.willFollowRules && compliance.isListValid;
      return scriptOk && checkboxesOk;
    }
    if (step === 6) return !!data.scheduledAt;
    return true;
  };

  // Variable chip cursor insertion helper
  const insertVariable = (variableLabel: string) => {
    const textarea = scriptTextareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = data.scriptText;
    const before = text.substring(0, start);
    const after = text.substring(end, text.length);

    const updatedText = `${before}${variableLabel}${after}`;
    
    setData((prev) => ({ ...prev, scriptText: updatedText }));

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + variableLabel.length, start + variableLabel.length);
    }, 0);
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
          language: 'en',
          tone: 'professional',
          call_goal: data.description,
          objection_handling: data.objection_handling,
          cta: data.cta,
          include_opt_out: true, // Default to true for TRAI compliance
        }),
      });
      const d = await res.json();
      setData((prev) => ({ ...prev, scriptText: d.fullScript || d.full_script || `Hello [Customer Name], this is ${business?.name || 'our team'} calling regarding your appointment. Press 9 to opt-out.` }));
      toast.success('AI script generated successfully');
    } catch {
      toast.error('Failed to generate script');
    } finally {
      setIsGenerating(false);
    }
  };

  const sendTestCall = async () => {
    if (!testPhoneNumber) {
      toast.error('Please enter a phone number first');
      return;
    }
    if (!data.scriptText) {
      toast.error('Please write or generate a script first');
      return;
    }

    setIsSendingTestCall(true);
    try {
      const res = await fetch('/api/calls/test-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: testPhoneNumber,
          scriptText: data.scriptText
        })
      });
      const d = await res.json();
      if (res.ok) {
        toast.success(`Test call successfully triggered to ${testPhoneNumber}! Please answer your phone.`);
      } else {
        toast.error(d.error || 'Failed to place test call');
      }
    } catch {
      toast.error('Telephony connection error placing test call');
    } finally {
      setIsSendingTestCall(false);
    }
  };

  const playVoiceActualScript = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      toast.error("Text-to-speech is not supported on this browser.");
      return;
    }

    if (!data.scriptText) {
      toast.error("Please write or generate a script first.");
      return;
    }

    // Cancel any ongoing speech and resume to unstick Chrome's synthesis engine
    window.speechSynthesis.cancel();
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }

    setIsPlayingActualVoiceSample(true);
    toast.info("Synthesizing actual voice script sample...");

    // Clean script text of template brackets so the voice synthesizer sounds natural
    const cleanText = data.scriptText
      .replace(/\{\{fullName\}\}/gi, "Priya Patel")
      .replace(/\{\{name\}\}/gi, "Rahul")
      .replace(/\{\{dueDate\}\}/gi, "the fourteenth of October")
      .replace(/\{\{due_date\}\}/gi, "the fourteenth of October")
      .replace(/\{\{appointmentDate\}\}/gi, "tomorrow at 4 PM")
      .replace(/\{\{appointment_date\}\}/gi, "tomorrow at 4 PM")
      .replace(/\{\{customerType\}\}/gi, "Patient")
      .replace(/\{\{customer_type\}\}/gi, "Patient")
      .replace(/\{\{city\}\}/gi, "Mumbai")
      .replace(/\{\{[^}]+\}\}/g, "customer");

    const utterance = new SpeechSynthesisUtterance(cleanText);

    // Determine language and locale
    const lang = data.language || 'en';
    let langLocale = 'en-IN';
    if (lang === 'hi') langLocale = 'hi-IN';
    else if (lang === 'gu') langLocale = 'gu-IN';

    utterance.lang = langLocale;

    // Retrieve available system voices
    const voices = window.speechSynthesis.getVoices();
    const isMale = data.voiceType ? data.voiceType.includes('male') : false;

    // Search for a matching Indian accent or regional voice
    const matchingVoice = voices.find(v => {
      const nameLower = v.name.toLowerCase();
      const matchesLocale = v.lang.replace('_', '-').toLowerCase() === langLocale.toLowerCase();
      if (!matchesLocale) return false;

      if (isMale) {
        return nameLower.includes('male') || nameLower.includes('ravi') || nameLower.includes('david') || nameLower.includes('google hindi') || nameLower.includes('aman') || nameLower.includes('rishi');
      } else {
        return nameLower.includes('female') || nameLower.includes('heera') || nameLower.includes('zira') || nameLower.includes('google translation') || nameLower.includes('swara') || nameLower.includes('tara') || nameLower.includes('lekha');
      }
    }) || voices.find(v => v.lang.toLowerCase().startsWith(lang.toLowerCase()));

    if (matchingVoice) {
      utterance.voice = matchingVoice;
    }

    // Configure voice style rate and pitch
    if (data.voiceType && data.voiceType.includes('friendly')) {
      utterance.rate = 1.0;
      utterance.pitch = 1.15; // Slightly higher pitch for friendly tone
    } else {
      utterance.rate = 0.92; // Slightly measured pace for professional tone
      utterance.pitch = 1.0;
    }

    utterance.onend = () => {
      setIsPlayingActualVoiceSample(false);
      toast.success("Voice sample playback finished successfully!");
      // Clear global reference
      delete (window as any)._currentUtterance;
    };

    utterance.onerror = (err) => {
      if (err.error !== 'interrupted') {
        console.error("SpeechSynthesis error:", err);
        setIsPlayingActualVoiceSample(false);
        toast.error("Voice synthesis playback failed.");
        // Clear global reference
        delete (window as any)._currentUtterance;
      }
    };

    // Store a global reference to prevent garbage collection in Chrome/Safari!
    (window as any)._currentUtterance = utterance;

    window.speechSynthesis.speak(utterance);
  };

  const submit = async (statusOverride = 'scheduled') => {
    setIsSubmitting(true);
    try {
      const payload: any = {
        ...data,
        complianceConfirmed: data.isComplianceConfirmed,
        status: 'draft',
      };
      
      delete payload.isComplianceConfirmed;
      
      // If in Rules Mode, pass the filter groups instead of raw customer IDs
      if (audienceMode === 'rules') {
        payload.filterGroups = filterGroups;
        payload.customerIds = []; // Empty out individual list
      }

      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || 'Failed to submit campaign');
        return;
      }

      const createdCampaignResponse = await res.json();
      const campaignId = createdCampaignResponse.campaign.id;

      if (statusOverride !== 'draft') {
        const launchRes = await fetch(`/api/campaigns/${campaignId}/launch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (!launchRes.ok) {
          const launchErr = await launchRes.json();
          toast.error(launchErr.error || 'Failed to launch campaign after creation.');
          return;
        }
        
        toast.success('Campaign launched successfully!');
      } else {
        toast.success('Campaign saved as Draft');
      }
      
      router.push('/campaigns');
    } catch {
      toast.error('Network error submitting campaign');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Rule builder modification helpers
  const addFilterGroup = () => {
    const id = `group-${Date.now()}`;
    setFilterGroups([...filterGroups, { id, logic_operator: 'AND', rules: [{ id: `rule-${Date.now()}`, field_name: 'city', operator: 'EQUALS', value: '' }] }]);
  };

  const removeFilterGroup = (groupId: string) => {
    setFilterGroups(filterGroups.filter((g) => g.id !== groupId));
  };

  const addRuleToGroup = (groupId: string) => {
    setFilterGroups(filterGroups.map((g) => {
      if (g.id === groupId) {
        return {
          ...g,
          rules: [...g.rules, { id: `rule-${Date.now()}`, field_name: 'city', operator: 'EQUALS', value: '' }]
        };
      }
      return g;
    }));
  };

  const removeRuleFromGroup = (groupId: string, ruleId: string) => {
    setFilterGroups(filterGroups.map((g) => {
      if (g.id === groupId) {
        return {
          ...g,
          rules: g.rules.filter((r) => r.id !== ruleId)
        };
      }
      return g;
    }).filter((g) => g.rules.length > 0)); // Delete group completely if it contains 0 rules
  };

  const updateRuleValue = (groupId: string, ruleId: string, updates: Partial<FilterRule>) => {
    setFilterGroups(filterGroups.map((g) => {
      if (g.id === groupId) {
        return {
          ...g,
          rules: g.rules.map((r) => r.id === ruleId ? { ...r, ...updates } : r)
        };
      }
      return g;
    }));
  };

  const updateGroupOperator = (groupId: string, operator: 'AND' | 'OR') => {
    setFilterGroups(filterGroups.map((g) => g.id === groupId ? { ...g, logic_operator: operator } : g));
  };

  // Safe preview highlights builder
  const renderPreview = (text: string) => {
    if (!text) return <span className="text-slate-400 italic">No script written yet...</span>;

    const replacements: Record<string, string> = {
      '[Customer Name]': showSampleData ? 'Hardik' : '[Customer Name]',
      '[Amount Due]': showSampleData ? '₹1200' : '[Amount Due]',
      '[Due Date]': showSampleData ? '15 Feb' : '[Due Date]',
      '[Appointment Date]': showSampleData ? '12 July' : '[Appointment Date]',
    };

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
      if (part.startsWith('[') && part.endsWith(']')) {
        return <span key={index} className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 inline-block text-xs mx-0.5">{part}</span>;
      }
      return part;
    });
  };

  return (
    <div className="space-y-6" data-testid="new-campaign-page">
      <header className="flex items-center justify-between gap-4">
        <div>
          <span className="overline">Campaigns</span>
          <h1 className="mt-2 text-3xl font-extrabold text-brand-navy">Create Outbound Campaign</h1>
        </div>
      </header>

      {/* Dynamic 8-Step wizard progress track */}
      <div className="bg-white border border-[#E7E4DC] p-5 rounded-2xl flex flex-wrap items-center justify-between gap-4">
        {STEPS.map((s) => (
          <div key={s.id} className="flex items-center gap-2">
            <span className={cn(
              "w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold transition-all",
              step === s.id ? "bg-[#2F5CFF] text-white" : step > s.id ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-400"
            )}>
              {s.id}
            </span>
            <span className={cn(
              "text-xs font-bold tracking-tight",
              step === s.id ? "text-brand-navy" : "text-slate-400"
            )}>
              {s.label}
            </span>
            {s.id < 8 && <span className="text-slate-200 text-xs hidden sm:inline">➜</span>}
          </div>
        ))}
      </div>

      <main className="min-h-[420px]">

        {/* STEP 1: Basics */}
        {step === 1 && (
          <div className="glass p-6 lg:p-8 space-y-5 bg-white border border-[#E7E4DC] rounded-3xl" data-testid="step-basics">
            <h2 className="text-xl font-bold text-brand-navy">Campaign basics</h2>
            <p className="text-sm text-slate-500 mt-1">Configure your campaign name and purpose.</p>
            <div className="mt-6">
              <label className="label-base">Campaign Name</label>
              <input className="input-field" placeholder="e.g. Appointment Reminder - July Week 2" value={data.name} onChange={(e) => setData({ ...data, name: e.target.value })} />
            </div>

            <div className="mt-6">
              <label className="label-base block mb-3">Select Campaign Purpose</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {PURPOSES.map((p) => {
                  const Icon = p.icon;
                  const isSelected = data.purpose === p.value;
                  return (
                    <button
                      key={p.value}
                      onClick={() => setData({ ...data, purpose: p.value })}
                      className={cn(
                        "p-4 rounded-2xl border text-left flex gap-3.5 items-start transition-all cursor-pointer",
                        isSelected ? "bg-[#EFF6FF] border-[#2F5CFF] ring-2 ring-[#2F5CFF]/15" : "bg-white border-[#E7E4DC] hover:bg-slate-50"
                      )}
                    >
                      <div className={cn("p-2 rounded-xl border mt-0.5", isSelected ? "bg-white border-[#2F5CFF]/20 text-[#2F5CFF]" : "bg-slate-50 border-[#E7E4DC] text-slate-500")}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-bold text-sm text-brand-navy">{p.label}</div>
                        <div className="text-[11px] text-slate-400 block mt-1 leading-relaxed">{p.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Audience Selection (UPGRADED RULE BUILDER FLOW) */}
        {step === 2 && (
          <div className="glass p-6 lg:p-8 space-y-6 bg-white border border-[#E7E4DC] rounded-3xl" data-testid="step-audience">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-xl font-bold text-brand-navy">Choose Campaign Audience</h2>
                <p className="text-sm text-slate-500 mt-1">Configure CRM target criteria or select contacts manually as fallback.</p>
              </div>
              
              {/* Audience Mode Switch */}
              <div className="inline-flex p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setAudienceMode('rules')}
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                    audienceMode === 'rules' ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800"
                  )}
                >
                  <Filter className="w-3.5 h-3.5 inline mr-1" /> Dynamic Rules
                </button>
                <button
                  type="button"
                  onClick={() => setAudienceMode('static')}
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                    audienceMode === 'static' ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800"
                  )}
                >
                  <Users className="w-3.5 h-3.5 inline mr-1" /> Static List
                </button>
              </div>
            </div>

            {audienceMode === 'rules' ? (
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-stretch">
                {/* Rule Builder Panel */}
                <div className="lg:col-span-3 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500">Segmentation Rules</h3>
                    <button
                      type="button"
                      onClick={addFilterGroup}
                      className="text-[11px] font-bold text-[#2F5CFF] hover:underline cursor-pointer inline-flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add OR Group
                    </button>
                  </div>

                  <div className="space-y-4">
                    {filterGroups.map((g, gIdx) => (
                      <div key={g.id} className="p-5 bg-slate-50 border border-slate-200/80 rounded-2xl relative space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Match group conditions:</span>
                            <select
                              value={g.logic_operator}
                              onChange={(e) => updateGroupOperator(g.id, e.target.value as any)}
                              className="px-2 py-1 text-[10px] font-bold text-slate-700 bg-white border border-slate-200 rounded cursor-pointer"
                            >
                              <option value="AND">AND (All match)</option>
                              <option value="OR">OR (Any match)</option>
                            </select>
                          </div>
                          
                          {filterGroups.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeFilterGroup(g.id)}
                              className="text-slate-400 hover:text-rose-500 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        {/* Rules Rows list inside Group */}
                        <div className="space-y-2.5">
                          {g.rules.map((r, rIdx) => (
                            <div key={r.id} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                              {/* Field */}
                              <div className="sm:col-span-4">
                                <select
                                  value={r.field_name}
                                  onChange={(e) => updateRuleValue(g.id, r.id, { field_name: e.target.value })}
                                  className="input-field py-2 text-xs font-bold text-slate-700 cursor-pointer"
                                >
                                  <option value="city">City</option>
                                  <option value="customer_type">Customer Type</option>
                                  <option value="due_date">Due Date</option>
                                  <option value="appointment_date">Appointment Date</option>
                                  <option value="custom_fields.lead_score">Custom Field: Lead Score</option>
                                </select>
                              </div>

                              {/* Operator */}
                              <div className="sm:col-span-4">
                                <select
                                  value={r.operator}
                                  onChange={(e) => updateRuleValue(g.id, r.id, { operator: e.target.value })}
                                  className="input-field py-2 text-xs font-semibold text-slate-600 cursor-pointer"
                                >
                                  {OPERATORS.map((o) => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                  ))}
                                </select>
                              </div>

                              {/* Value Input (Not rendered if operator is null-check) */}
                              <div className="sm:col-span-3">
                                {r.operator !== 'IS_NULL' && r.operator !== 'IS_NOT_NULL' ? (
                                  <input
                                    type={r.field_name.includes('date') ? 'date' : 'text'}
                                    className="input-field py-2 text-xs"
                                    placeholder="Enter value"
                                    value={r.value}
                                    onChange={(e) => updateRuleValue(g.id, r.id, { value: e.target.value })}
                                  />
                                ) : (
                                  <span className="text-[10px] text-slate-400 block px-2.5 font-bold uppercase tracking-wider">Null Checker</span>
                                )}
                              </div>

                              {/* Delete Rule */}
                              <div className="sm:col-span-1 text-center">
                                {g.rules.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => removeRuleFromGroup(g.id, r.id)}
                                    className="text-slate-400 hover:text-rose-500 cursor-pointer"
                                  >
                                    ✖
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>

                        <button
                          type="button"
                          onClick={() => addRuleToGroup(g.id)}
                          className="text-[10px] font-bold text-slate-500 hover:text-slate-800 cursor-pointer inline-flex items-center gap-1 pt-1.5"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add Condition row
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Target Audience Count Preview Card */}
                <div className="lg:col-span-2 h-full flex flex-col justify-between">
                  <div className="glass p-5 rounded-2xl border border-slate-200 space-y-4">
                    <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400">Live Preview Counter</span>
                    
                    <div className="text-center p-6 bg-slate-50 border border-slate-150 rounded-2xl">
                      {isFetchingPreview ? (
                        <div className="flex flex-col items-center justify-center space-y-2 py-4">
                          <Loader2 className="w-6 h-6 text-[#2F5CFF] animate-spin" />
                          <span className="text-xs text-slate-400 font-bold">Scanning audience lists...</span>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <div className="text-4xl font-extrabold text-[#2F5CFF] tracking-tight">{previewCount}</div>
                          <div className="text-xs font-bold text-slate-700">Target Contacts Matched</div>
                          <p className="text-[10px] text-slate-400 italic leading-relaxed pt-1.5">Matching patients are evaluated at runtime dynamically when the campaign runs</p>
                        </div>
                      )}
                    </div>

                    {/* Previews records table */}
                    {!isFetchingPreview && previewCustomers.length > 0 && (
                      <div className="space-y-2">
                        <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 px-1">Audience Samples</span>
                        <div className="divide-y divide-slate-100 max-h-[160px] overflow-y-auto pr-1">
                          {previewCustomers.map((c, idx) => (
                            <div key={idx} className="py-2 flex justify-between gap-3 text-xs">
                              <span className="font-bold text-slate-800">{c.fullName}</span>
                              <span className="text-slate-400 font-mono">{c.city || 'No City'}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              // STATIC MANUAL TABLE SELECTION
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-400 leading-normal">Checking boxes triggers a manual static mapping inside the CampaignCustomer DB records.</p>
                  <div className="bg-[#EFF6FF] border border-[#2F5CFF]/20 px-3.5 py-2 rounded-xl font-mono text-xs font-bold text-[#2F5CFF]">
                    Selected Checklist: {data.customerIds.length} Customers
                  </div>
                </div>

                <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-[320px] overflow-y-auto mt-4">
                  <table className="w-full text-left border-collapse text-xs sm:text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                        <th className="p-3 w-10">Select</th>
                        <th className="p-3">Customer Name</th>
                        <th className="p-3">Phone</th>
                        <th className="p-3">Email</th>
                        <th className="p-3">City</th>
                        <th className="p-3">Type</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {customers.map((c) => {
                        const isChecked = data.customerIds.includes(c.id);
                        return (
                          <tr key={c.id} className="hover:bg-slate-50/50">
                            <td className="p-3">
                              <input
                                type="checkbox"
                                className="w-4 h-4 text-[#2F5CFF] rounded cursor-pointer"
                                checked={isChecked}
                                onChange={() => {
                                  const newList = isChecked
                                    ? data.customerIds.filter((id) => id !== c.id)
                                    : [...data.customerIds, c.id];
                                  setData({ ...data, customerIds: newList });
                                }}
                              />
                            </td>
                            <td className="p-3 font-bold text-slate-800">{c.fullName}</td>
                            <td className="p-3 font-mono text-slate-500">{c.phone}</td>
                            <td className="p-3 text-slate-500">{c.email || '—'}</td>
                            <td className="p-3 text-slate-500">{c.city || '—'}</td>
                            <td className="p-3 text-slate-500 uppercase font-bold text-[10px] tracking-wider">{c.customerType || 'Customer'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 3: Message / Script Creation */}
        {step === 3 && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-stretch" data-testid="step-message">
            {/* Left builder panel */}
            <div className="glass p-6 lg:col-span-2 flex flex-col justify-between h-full bg-white border border-[#E7E4DC] rounded-3xl">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-bold text-sm uppercase tracking-wider text-slate-500">Message Creator</h2>
                  <button onClick={generateScript} disabled={isGenerating || !data.purpose} className="btn-primary text-xs flex gap-1 h-9 px-3">
                    {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Auto-Generate Script
                  </button>
                </div>

                {/* Insertion Chips Row */}
                <div className="flex flex-wrap gap-1.5 p-1 bg-slate-50 rounded-2xl border border-slate-200/60">
                  {VARIABLES.map((v) => (
                    <button
                      key={v.value}
                      onClick={() => insertVariable(v.label)}
                      className={cn(
                        "px-3 py-1.5 rounded-xl border text-[10px] font-bold cursor-pointer transition-all",
                        v.color === 'blue' && "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100",
                        v.color === 'emerald' && "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100",
                        v.color === 'amber' && "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100",
                        v.color === 'purple' && "bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100"
                      )}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>

                <div className="space-y-1.5">
                  <textarea
                    ref={scriptTextareaRef}
                    rows={7}
                    className="input-field font-mono text-sm leading-relaxed p-4 bg-slate-50/20 border-slate-200/80 focus:bg-white resize-none"
                    placeholder="Type your script here, or click a variable above to insert it..."
                    value={data.scriptText}
                    onChange={(e) => setData({ ...data, scriptText: e.target.value })}
                    data-testid="script-textarea"
                  />
                </div>

                {/* AI prompt options */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800">What is the call goal? (For AI script builder)</label>
                  <input className="input-field text-sm" placeholder="e.g. Remind patient of their dental cleaning" value={data.description} onChange={(e) => setData({ ...data, description: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label-base">Objections (Optional)</label>
                    <input className="input-field text-xs sm:text-sm py-2" placeholder="e.g. offer slots" value={data.objection_handling} onChange={(e) => setData({ ...data, objection_handling: e.target.value })} />
                  </div>
                  <div>
                    <label className="label-base">Call CTA (Optional)</label>
                    <input className="input-field text-xs sm:text-sm py-2" placeholder="e.g. confirm booking" value={data.cta} onChange={(e) => setData({ ...data, cta: e.target.value })} />
                  </div>
                </div>
              </div>
            </div>

            {/* Right live preview panel */}
            <div className="glass p-6 lg:col-span-3 flex flex-col justify-between h-full bg-white border border-[#E7E4DC] rounded-3xl">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-sm text-brand-navy">Live Message Preview</h3>
                  <button
                    onClick={() => setShowSampleData(!showSampleData)}
                    className={cn(
                      "text-[10px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-lg border cursor-pointer",
                      showSampleData ? "bg-[#EFF6FF] border-[#2F5CFF] text-[#2F5CFF]" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    {showSampleData ? "✓ Sample Data Active" : "Mock Sample Data"}
                  </button>
                </div>
                <div className="p-4 bg-white border border-[#E7E4DC] rounded-xl shadow-inner min-h-[120px] text-xs sm:text-sm leading-relaxed text-slate-600">
                  {renderPreview(data.scriptText)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: Voice Select */}
        {step === 4 && (
          <div className="glass p-6 lg:p-8 space-y-5 bg-white border border-[#E7E4DC] rounded-3xl" data-testid="step-voice">
            <h2 className="text-xl font-bold text-brand-navy">Voice Select</h2>
            <p className="text-sm text-slate-500">Configure your speaker avatar accent preferences below.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3">
              {[
                { id: 'female_professional', label: 'Female · Professional (Alice)', desc: 'Clear, corporate, and precise articulation' },
                { id: 'female_friendly', label: 'Female · Friendly', desc: 'Warm, highly engaging regional tone' },
                { id: 'male_professional', label: 'Male · Professional', desc: 'Authoritative, calm, and formal speech' },
                { id: 'male_friendly', label: 'Male · Friendly', desc: 'Conversational, energetic, and helpful accent' }
              ].map((v) => {
                const active = data.voiceType === v.id;
                return (
                  <button
                    key={v.id}
                    onClick={() => setData({ ...data, voiceType: v.id })}
                    className={cn(
                      "p-5 border rounded-2xl text-left transition-all duration-200 cursor-pointer flex flex-col justify-between h-28",
                      active ? "bg-[#EFF6FF] border-[#2F5CFF]" : "bg-white border-slate-200 hover:bg-slate-50"
                    )}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-bold text-sm text-slate-800">{v.label}</span>
                      {active && <span className="w-5 h-5 rounded-full bg-[#2F5CFF] text-white flex items-center justify-center text-[10px]">✓</span>}
                    </div>
                    <span className="text-[11px] text-slate-400 block mt-1.5 leading-relaxed">{v.desc}</span>
                  </button>
                );
              })}
            </div>

            {/* Synthesis audio wave visualizer sample */}
            <div className="mt-6 p-5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between gap-4 flex-wrap">
              <div>
                <span className="text-xs font-bold text-slate-800 block">Hear actual synthesized script voice</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">Reads your typed script using your selected accent profile</span>
              </div>
              <button
                onClick={playVoiceActualScript}
                disabled={isPlayingActualVoiceSample || !data.scriptText}
                className="btn-primary py-2.5 h-11 px-4 text-xs font-mono font-bold flex gap-1.5 items-center cursor-pointer disabled:opacity-50"
              >
                {isPlayingActualVoiceSample ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Synthesizing...</>
                ) : (
                  <><Play className="w-4 h-4" /> Play Script Sample</>
                )}
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: Compliance Check Gate (Moved Up) */}
        {step === 5 && (
          <div className="glass p-6 lg:p-8 space-y-5 bg-white border border-[#E7E4DC] rounded-3xl" data-testid="step-compliance">
            <h2 className="text-xl font-bold text-brand-navy">TRAI Compliance Gate</h2>
            <p className="text-sm text-slate-500 mt-1">Indian telecommunication regulations strictly enforce and require opt-out channels and consent audits. Verify your script compliance status to pass.</p>

            {/* Auto-scan result card */}
            <div className="mt-6">
              {isScriptCompliant() ? (
                <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5" />
                  <div>
                    <div className="text-sm font-bold">Script Auto-Scan: COMPLIANT ✅</div>
                    <div className="text-xs text-emerald-600 mt-1">Successfully scanned opt-out instructions and valid DND opt-out parameters inside the script.</div>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-rose-600 mt-0.5" />
                  <div>
                    <div className="text-sm font-bold">Script Auto-Scan: NON-COMPLIANT ❌</div>
                    <div className="text-xs text-rose-600 mt-1">
                      <strong>Blocked:</strong> Your script is missing strict DND opt-out wording (must include words like <em>{"'opt-out'"}</em> or <em>{"'press 9'"}</em>, and have length &gt;= 30). You cannot proceed further.
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Consent checkboxes */}
            <div className="space-y-3.5 mt-6">
              {[
                { k: 'hasConsent', label: 'I confirm that all targeted customer records have granted active communication consent.' },
                { k: 'isNotSpam', label: 'I certify that this outbound script is strictly promotional or transactional with zero spam intents.' },
                { k: 'willFollowRules', label: 'I agree to strictly limit call dispatches within the TRAI-enforced daily window (9:00 AM to 9:00 PM IST).' },
                { k: 'isListValid', label: 'I certify that this patient audience list has been scrubbed against active NDNC registries.' },
              ].map((item) => (
                <label key={item.k} className="flex items-start gap-3 p-3 bg-slate-50/50 rounded-xl border border-slate-150 hover:bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-[#2F5CFF] rounded cursor-pointer mt-0.5"
                    checked={(compliance as any)[item.k]}
                    onChange={(e) => setCompliance({ ...compliance, [item.k]: e.target.checked })}
                  />
                  <span className="text-xs font-semibold text-slate-700 leading-normal">{item.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* STEP 6: Schedule */}
        {step === 6 && (
          <div className="glass p-6 lg:p-8 space-y-5 bg-white border border-[#E7E4DC] rounded-3xl" data-testid="step-schedule">
            <h2 className="text-xl font-bold text-brand-navy">Campaign schedule</h2>
            <p className="text-sm text-slate-500 mt-1">Configure launch schedules, retry policies, and operational calling intervals.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              <div>
                <label className="label-base">Start Date & Time</label>
                <input type="datetime-local" className="input-field" value={data.scheduledAt} onChange={(e) => setData({ ...data, scheduledAt: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-base">Window Start</label>
                  <input type="time" className="input-field" value={data.callingWindowStart} onChange={(e) => setData({ ...data, callingWindowStart: e.target.value })} />
                </div>
                <div>
                  <label className="label-base">Window End</label>
                  <input type="time" className="input-field" value={data.callingWindowEnd} onChange={(e) => setData({ ...data, callingWindowEnd: e.target.value })} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              <div>
                <label className="label-base">Max Retry Attempts</label>
                <select className="input-field" value={data.retryAttempts} onChange={(e) => setData({ ...data, retryAttempts: parseInt(e.target.value) })}>
                  {[1, 2, 3, 4, 5].map((i) => <option key={i} value={i}>{i} attempts</option>)}
                </select>
              </div>
              <div>
                <label className="label-base">Delay between Retries (Minutes)</label>
                <select className="input-field" value={data.delayBetweenCalls} onChange={(e) => setData({ ...data, delayBetweenCalls: parseInt(e.target.value) })}>
                  {[5, 10, 15, 30, 60].map((m) => <option key={m} value={m}>{m} minutes</option>)}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* STEP 7: Real-time Test Call (New Step!) */}
        {step === 7 && (
          <div className="glass p-6 lg:p-8 space-y-5 bg-white border border-[#E7E4DC] rounded-3xl" data-testid="step-testcall">
            <h2 className="text-xl font-bold text-brand-navy">Send Real Test Call</h2>
            <p className="text-sm text-slate-500 mt-1">Receive a real live voice call to your own phone number now. This ensures the voice pronunciation and variables read 100% perfectly before you launch to your customer list!</p>

            <div className="mt-6 max-w-md p-6 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
              <div>
                <label className="label-base">Test Phone Number</label>
                <input 
                  type="text" 
                  className="input-field font-mono" 
                  placeholder="e.g. +919876543210" 
                  value={testPhoneNumber} 
                  onChange={(e) => setTestPhoneNumber(e.target.value)} 
                />
              </div>

              <button
                onClick={sendTestCall}
                disabled={isSendingTestCall || !testPhoneNumber}
                className="btn-primary w-full h-11 text-xs font-mono font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSendingTestCall ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Calling your phone...</>
                ) : (
                  <><Mic className="w-4 h-4" /> Send Real Test Call</>
                )}
              </button>
            </div>
          </div>
        )}

        {/* STEP 8: Review & Launch Campaign */}
        {step === 8 && (
          <div className="glass p-6 lg:p-8 space-y-5 bg-white border border-[#E7E4DC] rounded-3xl" data-testid="step-review">
            <h2 className="text-xl font-bold text-brand-navy">Campaign Summary Review</h2>
            <p className="text-sm text-slate-500 mt-1">Verify all parameters and launch your campaign to the customer list.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 items-start">
              <div className="space-y-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs sm:text-sm">
                  <div className="flex justify-between border-b border-slate-200/60 pb-2"><span className="font-bold text-slate-500">Campaign Name:</span> <span className="font-bold text-slate-800">{data.name}</span></div>
                  <div className="flex justify-between border-b border-slate-200/60 pb-2"><span className="font-bold text-slate-500">Purpose:</span> <span className="font-bold text-slate-800 uppercase text-xs tracking-wider">{data.purpose.replace('_', ' ')}</span></div>
                  <div className="flex justify-between border-b border-slate-200/60 pb-2">
                    <span className="font-bold text-slate-500">Audience:</span> 
                    <span className="font-bold text-[#2F5CFF]">
                      {audienceMode === 'rules' ? `Dynamic Rules (${previewCount} Matched)` : `${data.customerIds.length} Customers selected`}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200/60 pb-2"><span className="font-bold text-slate-500">Voice Assistant:</span> <span className="font-bold text-slate-800 capitalize">{data.voiceType.replace('_', ' ')}</span></div>
                  <div className="flex justify-between border-b border-slate-200/60 pb-2"><span className="font-bold text-slate-500">Compliance Code:</span> <span className="font-bold text-emerald-600">COMPLIANT (TRAI Verified)</span></div>
                  <div className="flex justify-between"><span className="font-bold text-slate-500">Schedule Launch:</span> <span className="font-bold text-slate-800">{data.scheduledAt.replace('T', ' ')}</span></div>
                </div>

                {/* Save as Draft or Submit CTA */}
                <div className="grid grid-cols-2 gap-3 pt-4">
                  <button
                    disabled={isSubmitting}
                    onClick={() => submit('draft')}
                    className="h-11 border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold uppercase rounded-xl transition-all cursor-pointer inline-flex items-center justify-center gap-1.5"
                  >
                    <Save className="w-4 h-4" /> Save as Draft
                  </button>
                  <button
                    disabled={isSubmitting}
                    onClick={() => submit('scheduled')}
                    className="h-11 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold uppercase rounded-xl transition-all cursor-pointer inline-flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/15"
                  >
                    <Check className="w-4 h-4" /> Launch Campaign
                  </button>
                </div>
              </div>

              {/* Script review preview card */}
              <div className="p-5 bg-white border border-[#E7E4DC] shadow-inner rounded-2xl space-y-3.5">
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500">Final Script Text</h3>
                <p className="text-xs sm:text-sm leading-relaxed text-slate-600 whitespace-pre-wrap">{data.scriptText}</p>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* Navigation buttons footer */}
      <footer className="flex items-center justify-between border-t border-slate-200 pt-5 mt-8">
        <button
          onClick={back}
          disabled={step === 1 || isSubmitting}
          className="px-6 h-11 border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-mono font-bold uppercase rounded-xl transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        {step < 8 ? (
          <button
            onClick={next}
            disabled={!canNext()}
            className="px-6 h-11 bg-[#2F5CFF] hover:bg-[#1D4ED8] text-white text-xs font-mono font-bold uppercase rounded-xl transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            Next <ArrowRight className="w-4 h-4" />
          </button>
        ) : null}
      </footer>
    </div>
  );
}

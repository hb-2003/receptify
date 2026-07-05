'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Logo } from '@/components/ui/Logo';
import { 
  ArrowRight, Sparkles, Building2, User, Mail, Lock, 
  Phone, MapPin, Loader2, ShieldCheck, Zap, PhoneCall 
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

// Developer-friendly toggle for production gating
const SHOW_DEMO_CREDENTIALS = process.env.NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS === 'true';

const BIZ_TYPES = [
  'Clinic / Healthcare', 'NBFC / Finance', 'Diagnostic Lab', 'Real Estate',
  'Coaching / Ed-tech', 'Gym / Fitness', 'D2C Brand', 'Local Service Business', 'Other',
];

const TICKER_ITEMS = [
  { textPrefix: '✓ EMI reminder answered · Surat · ', textSuffix: ' ago', num: '12s' },
  { textPrefix: '↻ Callback scheduled · Pune · ', textSuffix: ' ago', num: '34s' },
  { textPrefix: '✓ Appointment confirmed · Bengaluru · ', textSuffix: ' ago', num: '1m' },
];

function MiniCallTicker() {
  return (
    <div className="w-full bg-white/40 backdrop-blur-md border-t border-[#E7E4DC] py-2 overflow-hidden select-none absolute bottom-0 left-0 right-0 z-20">
      <div className="flex whitespace-nowrap gap-12 animate-marquee-slow">
        {Array.from({ length: 4 }).flatMap(() => TICKER_ITEMS).map((item, idx) => (
          <div key={idx} className="flex items-center gap-2 text-[10px] font-semibold text-[#64748B]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#2F5CFF] shadow-[0_0_6px_rgba(47,92,255,0.4)] animate-pulse" />
            <span>{item.textPrefix}</span>
            <span className="font-mono text-[#2F5CFF] font-bold">{item.num}</span>
            <span>{item.textSuffix}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    ownerName: '',
    businessName: '',
    email: '',
    phone: '',
    password: '',
    businessType: 'Clinic / Healthcare',
    customBusinessType: '', // Holds custom text when 'Other' is selected
    city: '',
    preferredLanguage: 'en',
  });
  const [loading, setLoading] = useState(false);
  const update = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  // Auto-fills demo credentials for staging
  const handleAutoFillDemo = () => {
    setForm({
      ownerName: 'Jane Sandbox',
      businessName: 'Sandbox Enterprises',
      email: `sandbox_${Math.floor(Math.random() * 10000)}@receptify.in`,
      phone: '9876543210',
      password: 'Demo@1234',
      businessType: 'Clinic / Healthcare',
      customBusinessType: '',
      city: 'Bangalore',
      preferredLanguage: 'en',
    });
    toast.success('Staging credentials loaded! Click Sign Up now to register.');
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // Resolve final business type
    const finalType = form.businessType === 'Other' && form.customBusinessType.trim() !== '' 
      ? form.customBusinessType 
      : form.businessType;

    const payload = { ...form, businessType: finalType };

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Signup failed');
        return;
      }
      toast.success('Account created! Welcome to Receptify.');
      router.push('/dashboard');
      router.refresh();
    } catch {
      toast.error('Connection failed. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen grid grid-cols-1 lg:grid-cols-2 font-sans bg-white relative overflow-y-auto" data-testid="signup-page">
      
      {/* Self-contained CSS animations */}
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee-slow {
          animation: marquee 25s linear infinite;
        }
      `}</style>

      {/* ========================================================================= */}
      {/* LEFT SIDE: AUTH FORM PANEL (50% Split)                                     */}
      {/* ========================================================================= */}
      <div className="flex flex-col justify-between p-8 sm:p-12 lg:p-16 bg-[#FAFAF7] min-h-screen relative z-10">
        
        {/* Header (Logo + Tagline chip) */}
        <div className="flex items-center gap-3">
          <Link href="/" className="inline-block hover:opacity-90 transition-opacity">
            <Logo className="text-[20px]" />
          </Link>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#2F5CFF]/10 text-[#2F5CFF] uppercase tracking-wider">
            AI Voice Platform
          </span>
        </div>

        {/* Centralised Form Container */}
        <div className="max-w-md w-full mx-auto my-auto space-y-6 py-8">
          
          {/* Headline */}
          <div className="space-y-1.5">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-[#0F172A] tracking-tight leading-none">
              Create your account
            </h1>
            <p className="text-sm text-[#64748B]">
              No credit card required · 50 free calls included
            </p>
          </div>

          {/* Sandbox trial auto-fill widget */}
          {SHOW_DEMO_CREDENTIALS && (
            <div className="p-4 rounded-xl border border-dashed border-[#2F5CFF]/30 bg-[#2F5CFF]/5 flex gap-4 items-center justify-between shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#2F5CFF]/10 flex items-center justify-center text-[#2F5CFF] flex-shrink-0">
                  <Zap className="w-4.5 h-4.5 fill-[#2F5CFF]" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#0F172A]">Staging Sandbox</h4>
                  <p className="text-[10px] text-[#64748B]">Instantly pre-fill details to test</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={handleAutoFillDemo}
                className="px-3.5 py-1.5 bg-white border border-[#E2E8F0] text-xs font-bold text-[#2F5CFF] rounded-lg shadow-sm hover:bg-[#2F5CFF] hover:text-white transition-all cursor-pointer select-none"
              >
                Try Demo
              </button>
            </div>
          )}

          <form onSubmit={submit} className="space-y-4">
            
            {/* Owner name & Business name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#0F172A] uppercase tracking-wide">Owner name</label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    required 
                    value={form.ownerName} 
                    onChange={(e) => update('ownerName', e.target.value)} 
                    className="input-field pl-11 h-11 border-[#E2E8F0] bg-white transition-all focus:border-[#2F5CFF] focus:ring-2 focus:ring-[#2F5CFF]/10" 
                    placeholder="John Doe" 
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#0F172A] uppercase tracking-wide">Business name</label>
                <div className="relative">
                  <Building2 className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    required 
                    value={form.businessName} 
                    onChange={(e) => update('businessName', e.target.value)} 
                    className="input-field pl-11 h-11 border-[#E2E8F0] bg-white transition-all focus:border-[#2F5CFF] focus:ring-2 focus:ring-[#2F5CFF]/10" 
                    placeholder="Acme Corp" 
                  />
                </div>
              </div>
            </div>

            {/* Work email */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#0F172A] uppercase tracking-wide">Work email</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  required 
                  type="email" 
                  value={form.email} 
                  onChange={(e) => update('email', e.target.value)} 
                  className="input-field pl-11 h-11 border-[#E2E8F0] bg-white transition-all focus:border-[#2F5CFF] focus:ring-2 focus:ring-[#2F5CFF]/10" 
                  placeholder="john@acme.com" 
                />
              </div>
            </div>

            {/* Phone number & City */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#0F172A] uppercase tracking-wide">Phone number</label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    required 
                    value={form.phone} 
                    onChange={(e) => update('phone', e.target.value)} 
                    className="input-field pl-11 h-11 border-[#E2E8F0] bg-white transition-all focus:border-[#2F5CFF] focus:ring-2 focus:ring-[#2F5CFF]/10" 
                    placeholder="+91 98765 43210" 
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#0F172A] uppercase tracking-wide">City</label>
                <div className="relative">
                  <MapPin className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    required 
                    value={form.city} 
                    onChange={(e) => update('city', e.target.value)} 
                    className="input-field pl-11 h-11 border-[#E2E8F0] bg-white transition-all focus:border-[#2F5CFF] focus:ring-2 focus:ring-[#2F5CFF]/10" 
                    placeholder="Mumbai" 
                  />
                </div>
              </div>
            </div>

            {/* Business type select */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#0F172A] uppercase tracking-wide">Business type</label>
              <select 
                value={form.businessType} 
                onChange={(e) => update('businessType', e.target.value)} 
                className="input-field h-11 px-3.5 border-[#E2E8F0] bg-white transition-all focus:border-[#2F5CFF] focus:ring-2 focus:ring-[#2F5CFF]/10 cursor-pointer"
              >
                {BIZ_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            {/* Dynamic custom specifying business type input */}
            {form.businessType === 'Other' && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#2F5CFF] uppercase tracking-wide">Please specify</label>
                <input 
                  required 
                  value={form.customBusinessType} 
                  onChange={(e) => update('customBusinessType', e.target.value)} 
                  className="input-field h-11 border-[#2F5CFF]/30 bg-[#2F5CFF]/5 transition-all focus:border-[#2F5CFF]" 
                  placeholder="e.g. Logistics, E-commerce..." 
                />
              </div>
            )}

            {/* Password & Language */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#0F172A] uppercase tracking-wide">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    required 
                    minLength={8} 
                    type="password" 
                    value={form.password} 
                    onChange={(e) => update('password', e.target.value)} 
                    className="input-field pl-11 h-11 border-[#E2E8F0] bg-white transition-all focus:border-[#2F5CFF] focus:ring-2 focus:ring-[#2F5CFF]/10" 
                    placeholder="Min 8 chars" 
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#0F172A] uppercase tracking-wide">Preferred Language</label>
                <select 
                  value={form.preferredLanguage} 
                  onChange={(e) => update('preferredLanguage', e.target.value)} 
                  className="input-field h-11 px-3.5 border-[#E2E8F0] bg-white transition-all focus:border-[#2F5CFF] focus:ring-2 focus:ring-[#2F5CFF]/10 cursor-pointer"
                >
                  <option value="en">English (EN)</option>
                </select>
              </div>
            </div>

            {/* Primary Submit CTA button */}
            <button 
              type="submit" 
              disabled={loading} 
              className="w-full h-11 bg-[#2F5CFF] hover:bg-[#1D4ED8] text-white text-xs font-mono font-bold uppercase tracking-widest rounded-lg shadow-sm transition-all duration-200 inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-4" 
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Setting up account...
                </>
              ) : (
                <>
                  <span>Create Account</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          {/* Sibling login link */}
          <div className="text-center text-xs text-slate-500 pt-1">
            Already have an account?{' '}
            <Link href="/login" className="text-[#2F5CFF] font-bold hover:underline" data-testid="signup-login-link">
              Sign in
            </Link>
          </div>

        </div>

        {/* Symmetrical footer */}
        <div className="text-center lg:text-left text-[11px] text-[#64748B] border-t border-[#E7E4DC] pt-5 flex items-center justify-between">
          <p>© {new Date().getFullYear()} Receptify</p>
          <div className="flex gap-1.5 items-center">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>🔒 SOC2 Compliant · ISO 27001</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* RIGHT SIDE: COMPOSED MINI-DASHBOARD MOMENT (Branding Panel) (50% Split)    */}
      {/* ========================================================================= */}
      <div className="hidden lg:flex flex-col justify-center items-center p-16 bg-[#FBFAF7] relative overflow-hidden border-l border-[#E7E4DC]">
        
        {/* Subtle dotgrid background texture */}
        <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(#2F5CFF_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />
        
        {/* Soft radial glow directly behind the card mockup */}
        <div className="absolute w-[450px] h-[450px] bg-[#2F5CFF]/[0.08] rounded-full blur-[80px] pointer-events-none z-0" />

        {/* Composed Sibling Card Group (Vertically Centered) */}
        <div className="relative z-10 flex flex-col items-center w-full max-w-sm">
          
          {/* Sibling Value Showcase Card */}
          <div className="bg-white border border-[#E7E4DC] rounded-2xl p-7 shadow-[0_20px_50px_rgba(47,92,255,0.04)] w-80 relative overflow-hidden transition-all duration-300 hover:border-[#2F5CFF]/30">
            <div className="flex flex-col items-center">
              
              {/* Included Pill Status */}
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#2F5CFF]/10 border border-[#2F5CFF]/20 text-[10px] font-bold text-[#2F5CFF] uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" />
                Included
              </div>

              {/* Blue Rounded Square Voice/Phone Icon */}
              <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-[#2F5CFF] to-blue-400 flex items-center justify-center text-white shadow-md shadow-[#2F5CFF]/15 mt-4 mb-3">
                <Sparkles className="w-5.5 h-5.5 animate-pulse" />
              </div>

              {/* Card Titles */}
              <h3 className="font-extrabold text-[#0B1220] text-base">Here&apos;s what you get</h3>
              <p className="text-xs text-slate-500 mt-0.5">Staged AI Sandbox Account</p>

              {/* Sibling quantitative stats inside the card container (91% / 4,200+ / 68%) */}
              <div className="border-t border-[#E7E4DC]/80 mt-6 pt-5 w-full">
                <div className="grid grid-cols-3 gap-2 w-full text-center">
                  <div>
                    <div className="text-xs font-mono font-bold text-[#2F5CFF]">91%</div>
                    <div className="text-[9px] text-slate-400 uppercase font-bold mt-0.5 leading-none">Pick-up</div>
                  </div>
                  <div>
                    <div className="text-xs font-mono font-bold text-[#2F5CFF]">4,200+</div>
                    <div className="text-[9px] text-slate-400 uppercase font-bold mt-0.5 leading-none">Calls/Day</div>
                  </div>
                  <div>
                    <div className="text-xs font-mono font-bold text-[#2F5CFF]">68%</div>
                    <div className="text-[9px] text-slate-400 uppercase font-bold mt-0.5 leading-none">Reached</div>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Sibling outcome value badges below the card */}
          <div className="flex flex-wrap items-center justify-center gap-1.5 mt-6 relative z-10">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-semibold font-mono badge-completed">
              No Card Needed
            </span>
            <span className="px-2.5 py-0.5 rounded text-[10px] font-semibold font-mono badge-active">
              Localized Accents
            </span>
            <span className="px-2.5 py-0.5 rounded text-[10px] font-semibold font-mono badge-warning">
              50 Free Calls
            </span>
          </div>

        </div>

        {/* Condensed version of the live call ticker strip along the bottom edge */}
        <MiniCallTicker />

      </div>
    </main>
  );
}

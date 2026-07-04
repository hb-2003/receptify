'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Logo } from '@/components/ui/Logo';
import { 
  ArrowRight, Sparkles, Building2, User, Mail, Lock, 
  Phone, MapPin, Loader2, ShieldCheck, Zap 
} from 'lucide-react';
import { toast } from 'sonner';

// Developer-friendly toggle for production gating
const SHOW_DEMO_CREDENTIALS = process.env.NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS !== 'false';

const BIZ_TYPES = [
  'Clinic / Healthcare', 'NBFC / Finance', 'Diagnostic Lab', 'Real Estate',
  'Coaching / Ed-tech', 'Gym / Fitness', 'D2C Brand', 'Local Service Business', 'Other',
];

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

  // Auto-fills demo credentials for smooth, rapid sandbox testing (Staging Sandbox)
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
    toast.success('Staging credentials loaded! Click Get started now to register.');
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
    <main className="min-h-screen grid grid-cols-1 lg:grid-cols-2 font-sans bg-[#FAFAFA]" data-testid="signup-page">
      
      {/* ========================================================================= */}
      {/* LEFT SIDE: CLEAN & MINIMAL FORM (50% Symmetrical Split) */}
      {/* ========================================================================= */}
      <div className="flex flex-col p-8 sm:p-12 lg:px-16 bg-white min-h-screen justify-between">
        
        {/* Top Header with Logo & Pill */}
        <div className="flex items-center gap-3 mb-8">
          <Link href="/"><Logo /></Link>
          <span className="inline-flex items-center px-2 py-0.5 rounded bg-[#4F63F6]/5 border border-[#4F63F6]/10 text-[9px] font-bold text-[#4F63F6] tracking-wider uppercase">
            AI VOICE PLATFORM
          </span>
        </div>

        {/* Centralised Form */}
        <div className="max-w-md w-full mx-auto flex-1 flex flex-col justify-center">
          
          {/* Form Header */}
          <div className="space-y-1.5 mb-6">
            <h1 className="text-4xl font-extrabold text-[#0F172A] tracking-tight">Create your account</h1>
            <p className="text-xs text-[#64748B]">No credit card required · 50 free calls included</p>
          </div>

          {/* Staging Sandbox try demo */}
          {SHOW_DEMO_CREDENTIALS && (
            <div className="p-4 rounded-xl border border-dashed border-[#4F63F6]/30 bg-[#4F63F6]/5 flex gap-4 items-center justify-between shadow-sm mb-6">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#4F63F6]/10 flex items-center justify-center text-[#4F63F6] flex-shrink-0">
                  <Zap className="w-4.5 h-4.5 fill-[#4F63F6]" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#0F172A]">Staging Sandbox</h4>
                  <p className="text-[10px] text-[#64748B]">Instantly pre-fill details to test</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={handleAutoFillDemo}
                className="px-3.5 py-1.5 bg-white border border-[#E2E8F0] text-xs font-bold text-[#4F63F6] rounded-lg shadow-sm hover:bg-[#4F63F6] hover:text-white transition-all cursor-pointer select-none"
              >
                Try Demo
              </button>
            </div>
          )}

          {/* Form Fields */}
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
                    className="w-full h-12 bg-white border border-[#E2E8F0] rounded-[10px] px-3.5 pl-11 text-sm text-[#0F172A] placeholder:text-slate-400 outline-none transition-all focus:border-[#4F63F6] focus:ring-2 focus:ring-[#4F63F6]/10" 
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
                    className="w-full h-12 bg-white border border-[#E2E8F0] rounded-[10px] px-3.5 pl-11 text-sm text-[#0F172A] placeholder:text-slate-400 outline-none transition-all focus:border-[#4F63F6] focus:ring-2 focus:ring-[#4F63F6]/10" 
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
                  className="w-full h-12 bg-white border border-[#E2E8F0] rounded-[10px] px-3.5 pl-11 text-sm text-[#0F172A] placeholder:text-slate-400 outline-none transition-all focus:border-[#4F63F6] focus:ring-2 focus:ring-[#4F63F6]/10" 
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
                    className="w-full h-12 bg-white border border-[#E2E8F0] rounded-[10px] px-3.5 pl-11 text-sm text-[#0F172A] placeholder:text-slate-400 outline-none transition-all focus:border-[#4F63F6] focus:ring-2 focus:ring-[#4F63F6]/10" 
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
                    className="w-full h-12 bg-white border border-[#E2E8F0] rounded-[10px] px-3.5 pl-11 text-sm text-[#0F172A] placeholder:text-slate-400 outline-none transition-all focus:border-[#4F63F6] focus:ring-2 focus:ring-[#4F63F6]/10" 
                    placeholder="Mumbai" 
                  />
                </div>
              </div>
            </div>

            {/* Business type */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#0F172A] uppercase tracking-wide">Business type</label>
              <select 
                value={form.businessType} 
                onChange={(e) => update('businessType', e.target.value)} 
                className="w-full h-12 bg-white border border-[#E2E8F0] rounded-[10px] px-3.5 text-sm text-[#0F172A] outline-none transition-all focus:border-[#4F63F6] focus:ring-2 focus:ring-[#4F63F6]/10 cursor-pointer"
              >
                {BIZ_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            {/* Dynamic custom business type field */}
            {form.businessType === 'Other' && (
              <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
                <label className="text-xs font-bold text-[#4F63F6] uppercase tracking-wide">Please specify</label>
                <input 
                  required 
                  value={form.customBusinessType} 
                  onChange={(e) => update('customBusinessType', e.target.value)} 
                  className="w-full h-12 bg-[#4F63F6]/5 border border-[#4F63F6]/30 rounded-[10px] px-3.5 text-sm text-[#0F172A] placeholder:text-slate-400 outline-none transition-all focus:border-[#4F63F6]" 
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
                    className="w-full h-12 bg-white border border-[#E2E8F0] rounded-[10px] px-3.5 pl-11 text-sm text-[#0F172A] placeholder:text-slate-400 outline-none transition-all focus:border-[#4F63F6] focus:ring-2 focus:ring-[#4F63F6]/10" 
                    placeholder="Min 8 chars" 
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#0F172A] uppercase tracking-wide">Preferred Language</label>
                <select 
                  value={form.preferredLanguage} 
                  onChange={(e) => update('preferredLanguage', e.target.value)} 
                  className="w-full h-12 bg-white border border-[#E2E8F0] rounded-[10px] px-3.5 text-sm text-[#0F172A] outline-none transition-all focus:border-[#4F63F6] focus:ring-2 focus:ring-[#4F63F6]/10 cursor-pointer"
                >
                  <option value="en">English (EN)</option>
                </select>
              </div>
            </div>

            {/* Submit Button */}
            <button 
              type="submit" 
              disabled={loading} 
              className="w-full h-12 bg-[#4F63F6] hover:bg-[#3949D5] hover:-translate-y-0.5 active:translate-y-0 text-white font-semibold rounded-lg text-sm transition-all flex items-center justify-center gap-2 mt-6 cursor-pointer select-none shadow-md shadow-[#4F63F6]/15" 
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Setting up account...
                </>
              ) : (
                <>Get started now <ArrowRight className="w-4.5 h-4.5" /></>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative flex py-2 items-center my-4">
            <div className="flex-grow border-t border-[#E2E8F0]" />
            <span className="flex-shrink mx-4 text-slate-400 text-xs uppercase font-semibold tracking-wider">or</span>
            <div className="flex-grow border-t border-[#E2E8F0]" />
          </div>

          {/* Secondary Google Button */}
          <button
            type="button"
            onClick={() => toast.info('Google Sign-In is pre-configured on staging.')}
            className="w-full h-12 bg-white border border-[#E2E8F0] text-slate-700 rounded-lg text-sm font-semibold flex items-center justify-center gap-2.5 transition-all hover:bg-slate-50 active:scale-[0.99] shadow-sm cursor-pointer select-none"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.18 1-.78 1.85-1.63 2.42v2.01h2.64c1.54-1.42 2.63-3.5 2.63-5.44z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.52-2.01c-.97.65-2.23 1.04-3.76 1.04-2.87 0-5.3-1.94-6.16-4.54H1.14v2.07C2.96 20.31 7.18 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.83a6.5 6.5 0 010-4.14V8.62H1.14a11.95 11.95 0 000 10.76l4.7-2.55z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.18 1 2.96 3.69 1.14 8.62l4.7 2.55c.86-2.6 3.3-4.54 12-4.54z" fill="#EA4335" />
            </svg>
            Sign up with Google
          </button>

          {/* Footer Link */}
          <div className="text-center text-xs text-[#64748B] mt-6">
            Already have an account?{' '}
            <Link href="/login" className="text-[#4F63F6] font-bold hover:underline" data-testid="signup-login-link">
              Sign in
            </Link>
          </div>

        </div>

        {/* Symmetrical Bottom Trust Row */}
        <div className="text-center lg:text-left text-[11px] text-[#64748B] border-t border-[#E2E8F0] pt-5 mt-8 flex items-center justify-between">
          <p>© 2026 Receptify</p>
          <div className="flex gap-1.5 items-center">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>🔒 SOC2 Compliant · ISO 27001</span>
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* RIGHT SIDE: MINIMAL BRANDING PANEL (Notion, Stripe, Linear style)        */}
      {/* ========================================================================= */}
      <div className="hidden lg:flex flex-col justify-center items-center p-16 bg-gradient-to-br from-[#F5F7FF] to-[#EDEFFC] relative overflow-hidden border-l border-[#E2E8F0]">
        
        {/* Large, very subtle geometric shape at extremely low opacity (5-8%) for depth only */}
        <div className="absolute w-[450px] h-[450px] bg-brand-500/[0.06] rounded-full blur-[80px] pointer-events-none" />

        {/* Airy Centerpiece Content Container */}
        <div className="relative z-10 flex flex-col items-center">
          
          {/* Centered Single Focal Card */}
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-8 shadow-xl shadow-brand-900/[0.04] w-80">
            <div className="flex flex-col items-center text-center">
              
              {/* Setting Up Status Pill */}
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-[10px] font-bold text-[#4F63F6] uppercase tracking-wider mb-4">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4F63F6] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#4F63F6]"></span>
                </span>
                Setting Up
              </div>

              {/* Purple/Indigo Gradient square with Sparkle Icon */}
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#4F63F6] to-indigo-400 flex items-center justify-center text-white shadow-lg shadow-[#4F63F6]/15 mb-4">
                <Sparkles className="w-6 h-6" />
              </div>

              {/* Card Titles */}
              <h3 className="font-bold text-[#0D1B3E] text-base">Account Setup</h3>
              <p className="text-xs text-slate-500 mt-1">Initializing AI workspace</p>

              {/* Single thin progress bar under the text */}
              <div className="w-full mt-6">
                <div className="h-1 bg-slate-100 rounded-full w-full overflow-hidden">
                  <div className="h-full bg-[#4F63F6] w-2/3 rounded-full animate-pulse" />
                </div>
              </div>

            </div>
          </div>

          {/* Minimal Plain Text Stat Row */}
          <div className="mt-8 text-xs text-slate-400 font-medium flex items-center justify-center gap-3">
            <span>50 free calls</span>
            <span className="text-slate-300">•</span>
            <span>No credit card</span>
            <span className="text-slate-300">•</span>
            <span>2-min setup</span>
          </div>

        </div>

      </div>
    </main>
  );
}

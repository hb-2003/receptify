'use client';

import { useState, Suspense, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Logo } from '@/components/ui/Logo';
import { 
  Mail, Lock, ArrowRight, Eye, EyeOff, 
  PhoneCall, Loader2, Zap, ShieldCheck 
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

// Developer-friendly toggle for production gating
const SHOW_DEMO_CREDENTIALS = process.env.NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS === 'true';

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

function LoginForm() {
  const router = useRouter();
  const searchParameters = useSearchParams();
  const rawNext = searchParameters?.get('next') || '/dashboard';
  const redirectDestinationUrl = (rawNext.startsWith('/') && !rawNext.startsWith('//')) 
    ? rawNext 
    : '/dashboard';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-fills demo credentials for rapid testing
  const handleAutoFillDemo = () => {
    setEmail('demo@receptify.in');
    setPassword('Demo@1234');
    toast.success('Staging credentials loaded! Click Sign In to enter.');
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const authResponse = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const responseData = await authResponse.json();
      if (!authResponse.ok) {
        toast.error(responseData.error || 'Login failed');
        return;
      }
      toast.success('Welcome back!');
      router.push(redirectDestinationUrl);
      router.refresh();
    } catch {
      toast.error('Connection failed. Make sure the backend is running.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen grid grid-cols-1 lg:grid-cols-2 font-sans bg-white relative overflow-y-auto" data-testid="login-page">
      
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
        <div className="max-w-sm w-full mx-auto my-auto space-y-7 py-12">
          
          {/* Headline */}
          <div className="space-y-1.5">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-[#0F172A] tracking-tight leading-none">
              Welcome back
            </h1>
            <p className="text-sm text-[#64748B]">
              Sign in to manage your AI receptionists
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
                  <p className="text-[10px] text-[#64748B]">Instantly pre-fill to test</p>
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

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            
            {/* Email Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#0F172A] uppercase tracking-wide">Business Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  required
                  type="email"
                  className="input-field pl-11 h-11 border-[#E2E8F0] bg-white transition-all focus:border-[#2F5CFF] focus:ring-2 focus:ring-[#2F5CFF]/10"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  data-testid="login-email-input"
                  placeholder="you@business.in"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-baseline">
                <label className="text-xs font-bold text-[#0F172A] uppercase tracking-wide">Password</label>
                <Link href="/forgot-password" className="text-[11px] font-bold text-[#2F5CFF] hover:underline uppercase tracking-wide">
                  Forgot?
                </Link>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  required
                  type={showPassword ? 'text' : 'password'}
                  className="input-field pl-11 pr-11 h-11 border-[#E2E8F0] bg-white transition-all focus:border-[#2F5CFF] focus:ring-2 focus:ring-[#2F5CFF]/10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  data-testid="login-password-input"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#0F172A] focus:outline-none"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* CTA Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-11 bg-[#2F5CFF] hover:bg-[#1D4ED8] text-white text-xs font-mono font-bold uppercase tracking-widest rounded-lg shadow-sm transition-all duration-200 inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Authenticating...
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          {/* Sibling signup link */}
          <div className="text-center text-xs text-slate-500 pt-2">
            New to Receptify?{' '}
            <Link href="/signup" className="text-[#2F5CFF] font-bold hover:underline" data-testid="login-signup-link">
              Create an account
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
          
          {/* Main Showcase Card */}
          <div className="bg-white border border-[#E7E4DC] rounded-2xl p-7 shadow-[0_20px_50px_rgba(47,92,255,0.04)] w-80 relative overflow-hidden transition-all duration-300 hover:border-[#2F5CFF]/30">
            <div className="flex flex-col items-center">
              
              {/* Active Pill Status */}
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                </span>
                Active
              </div>

              {/* Blue Rounded Square Voice/Phone Icon */}
              <div className="w-12 h-12 rounded-xl bg-[#2F5CFF] flex items-center justify-center text-white shadow-md shadow-[#2F5CFF]/15 mt-4 mb-3">
                <PhoneCall className="w-5.5 h-5.5" />
              </div>

              {/* Card Titles */}
              <h3 className="font-extrabold text-[#0B1220] text-base">Receptify Voice Agent</h3>
              <p className="text-xs text-slate-500 mt-0.5">Automated queue processing</p>

              {/* Inline quantitative stats inside the card container */}
              <div className="border-t border-[#E7E4DC]/80 mt-6 pt-5 w-full">
                <div className="grid grid-cols-3 gap-2 w-full text-center">
                  <div>
                    <div className="text-xs font-mono font-bold text-[#2F5CFF]">12</div>
                    <div className="text-[9px] text-slate-400 uppercase font-bold mt-0.5 leading-none">Live Calls</div>
                  </div>
                  <div>
                    <div className="text-xs font-mono font-bold text-[#2F5CFF]">98.4%</div>
                    <div className="text-[9px] text-slate-400 uppercase font-bold mt-0.5 leading-none">Answer</div>
                  </div>
                  <div>
                    <div className="text-xs font-mono font-bold text-[#2F5CFF]">24/7</div>
                    <div className="text-[9px] text-slate-400 uppercase font-bold mt-0.5 leading-none">Uptime</div>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Real Outcome Badges below the card to match product motifs */}
          <div className="flex flex-wrap items-center justify-center gap-1.5 mt-6 relative z-10">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-semibold font-mono badge-completed">
              <span className="font-bold">816</span> Done
            </span>
            <span className="px-2.5 py-0.5 rounded text-[10px] font-semibold font-mono badge-warning">
              <span className="font-bold">218</span> Pending
            </span>
            <span className="px-2.5 py-0.5 rounded text-[10px] font-semibold font-mono badge-callback">
              <span className="font-bold">340</span> Active
            </span>
          </div>

        </div>

        {/* Condensed version of the live call ticker strip along the bottom edge */}
        <MiniCallTicker />

      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#FBFAF7]">
        <p className="text-slate-500 text-sm">Loading login screen...</p>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}

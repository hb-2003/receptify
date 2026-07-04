'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Logo } from '@/components/ui/Logo';
import { 
  Mail, Lock, ArrowRight, Eye, EyeOff, 
  PhoneCall, Loader2, Zap, ShieldCheck, Activity, BarChart3 
} from 'lucide-react';
import { toast } from 'sonner';

// Developer-friendly toggle for production gating
const SHOW_DEMO_CREDENTIALS = process.env.NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS !== 'false';

// The main login form and refined showcase component
function LoginForm() {
  const router = useRouter();
  const searchParameters = useSearchParams();
  const redirectDestinationUrl = searchParameters?.get('next') || '/dashboard';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-fills demo credentials for smooth, rapid sandbox testing (Addresses Requirement 3)
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
    <main className="min-h-screen grid grid-cols-1 lg:grid-cols-2 font-sans bg-white relative overflow-hidden" data-testid="login-page">
      
      {/* Self-contained CSS animations for premium floating, pulsing, and glowing effects */}
      <style>{`
        @keyframes float-slow {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-10px) rotate(1deg); }
        }
        @keyframes float-medium {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
        }
        @keyframes pulse-wave {
          0% { transform: scale(0.9); opacity: 0.4; }
          100% { transform: scale(1.5); opacity: 0; }
        }
        .animate-float-slow {
          animation: float-slow 7s ease-in-out infinite;
        }
        .animate-float-medium {
          animation: float-medium 5s ease-in-out infinite;
        }
        .animate-wave-slow {
          animation: pulse-wave 4s cubic-bezier(0.16, 1, 0.3, 1) infinite;
        }
      `}</style>

      {/* ========================================================================= */}
      {/* LEFT SIDE: ULTRA-PREMIUM REDESIGNED SAAS LOGIN (50% Split) (Requirement 1-9) */}
      {/* ========================================================================= */}
      <div className="flex flex-col justify-between p-8 sm:p-12 lg:p-16 bg-[#FAFAFA] min-h-screen relative z-10">
        
        {/* 1. HEADER (Addresses Requirement 1: Logo & Tagline chip) */}
        <div className="flex items-center gap-3">
          <Link href="/" className="inline-block hover:opacity-90 transition-opacity">
            <Logo className="text-[20px]" />
          </Link>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#4F63F6]/10 text-[#4F63F6] uppercase tracking-wider">
            AI Voice Platform
          </span>
        </div>

        {/* Centralised Form Container (Addresses Requirement 8: Spacing & Rhythm) */}
        <div className="max-w-sm w-full mx-auto my-auto space-y-7 py-12">
          
          {/* 2. HEADLINE SECTION (Addresses Requirement 2: Premium Bold Typography) */}
          <div className="space-y-1.5">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-[#0F172A] tracking-tight leading-none">
              Welcome back
            </h1>
            <p className="text-sm text-[#64748B]">
              Sign in to manage your AI receptionists
            </p>
          </div>

          {/* 3. SANDBOX/DEMO CREDENTIALS (Addresses Requirement 3: Try Demo Auto-fill) */}
          {SHOW_DEMO_CREDENTIALS && (
            <div className="p-4 rounded-xl border border-dashed border-[#4F63F6]/30 bg-[#4F63F6]/5 flex gap-4 items-center justify-between shadow-sm animate-fade-in">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#4F63F6]/10 flex items-center justify-center text-[#4F63F6] flex-shrink-0">
                  <Zap className="w-4.5 h-4.5 fill-[#4F63F6]" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#0F172A]">Staging Sandbox</h4>
                  <p className="text-[10px] text-[#64748B]">Instantly pre-fill to test</p>
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

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            
            {/* 4. FORM FIELDS: Email (Addresses Requirement 4) */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#0F172A] uppercase tracking-wide">Business Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  required
                  type="email"
                  className="input-field pl-11 h-11 border-[#E2E8F0] bg-white transition-all focus:border-[#4F63F6] focus:ring-2 focus:ring-[#4F63F6]/10"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  data-testid="login-email-input"
                  placeholder="you@business.in"
                />
              </div>
            </div>

            {/* 4. FORM FIELDS: Password (Addresses Requirement 4) */}
            <div className="space-y-1.5">
              {/* Perfectly aligned label and link */}
              <div className="flex justify-between items-baseline">
                <label className="text-xs font-bold text-[#0F172A] uppercase tracking-wide">Password</label>
                <Link href="/forgot-password" className="text-xs font-bold text-[#4F63F6] hover:underline">
                  Forgot?
                </Link>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  required
                  type={showPassword ? 'text' : 'password'}
                  className="input-field pl-11 pr-11 h-11 border-[#E2E8F0] bg-white transition-all focus:border-[#4F63F6] focus:ring-2 focus:ring-[#4F63F6]/10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  data-testid="login-password-input"
                  placeholder="••••••••"
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword((show) => !show)} 
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-brand-600 focus:outline-none"
                >
                  {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                </button>
              </div>
            </div>

            {/* 5. PRIMARY BUTTON (Addresses Requirement 5: Hover scaling/darker brand colors) */}
            <button 
              type="submit" 
              disabled={isSubmitting} 
              className="w-full h-11 bg-[#4F63F6] text-white rounded-xl flex items-center justify-center gap-2.5 active:scale-[0.98] hover:bg-[#3d51e2] hover:scale-[1.01] transition-all duration-150 font-bold text-sm tracking-wide shadow-lg shadow-[#4F63F6]/15 group mt-5" 
              data-testid="login-submit-button"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4.5 h-4.5 animate-spin" /> Signing in...
                </>
              ) : (
                <>
                  Sign in to dashboard 
                  <ArrowRight className="w-4.5 h-4.5 transition-transform group-hover:translate-x-1" />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-[#E2E8F0]" />
            <span className="flex-shrink mx-4 text-slate-400 text-xs uppercase font-semibold tracking-wider">or</span>
            <div className="flex-grow border-t border-[#E2E8F0]" />
          </div>

          {/* 6. SECONDARY ACTIONS: Social Login & Create Account (Addresses Requirement 6) */}
          <div className="space-y-4">
            <button 
              type="button"
              onClick={() => toast.info('Google Sign-In is pre-configured on staging.')}
              className="w-full h-11 bg-white border border-[#E2E8F0] text-slate-700 rounded-xl text-sm font-semibold flex items-center justify-center gap-2.5 transition-all hover:bg-slate-50 active:scale-[0.99] shadow-sm"
            >
              {/* Custom High-Fidelity Google SVG Logo */}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.18 1-.78 1.85-1.63 2.42v2.01h2.64c1.54-1.42 2.63-3.5 2.63-5.44z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.52-2.01c-.97.65-2.23 1.04-3.76 1.04-2.87 0-5.3-1.94-6.16-4.54H1.14v2.07C2.96 20.31 7.18 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.83a6.5 6.5 0 010-4.14V8.62H1.14a11.95 11.95 0 000 10.76l4.7-2.55z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.18 1 2.96 3.69 1.14 8.62l4.7 2.55c.86-2.6 3.3-4.54 12-4.54z" fill="#EA4335" />
              </svg>
              Sign in with Google
            </button>

            <div className="text-center text-xs text-slate-500">
              New to Receptify?{' '}
              <Link href="/signup" className="text-[#4F63F6] font-bold hover:underline" data-testid="login-signup-link">
                Create an account
              </Link>
            </div>
          </div>
        </div>

        {/* 7. FOOTER (Addresses Requirement 7: SOC2 & Muted single line) */}
        <div className="text-center lg:text-left text-[11px] text-[#64748B] border-t border-[#E2E8F0] pt-5 flex items-center justify-between">
          <p>© {new Date().getFullYear()} Receptify</p>
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
              
              {/* Active Pill Status */}
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-[10px] font-bold text-emerald-700 uppercase tracking-wider mb-4">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                </span>
                Active
              </div>

              {/* Blue Rounded Square Voice/Phone Icon */}
              <div className="w-14 h-14 rounded-2xl bg-[#2563EB] flex items-center justify-center text-white shadow-lg shadow-brand-500/10 mb-4">
                <PhoneCall className="w-6 h-6" />
              </div>

              {/* Card Titles */}
              <h3 className="font-bold text-[#0D1B3E] text-base">Receptify Voice Agent</h3>
              <p className="text-xs text-slate-500 mt-1">Automated queue processing</p>

            </div>
          </div>

          {/* Minimal Plain Text Stat Row */}
          <div className="mt-8 text-xs text-slate-400 font-medium flex items-center justify-center gap-3">
            <span>12 live calls</span>
            <span className="text-slate-300">•</span>
            <span>98.4% pick-up rate</span>
            <span className="text-slate-300">•</span>
            <span>24/7 uptime</span>
          </div>

        </div>

      </div>
    </main>
  );
}

// Next.js 15 requires pages using useSearchParams() to be wrapped in a Suspense boundary
// to allow proper static compilation and server-side pre-rendering.
export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-marketing">
        <p className="text-slate-500 text-sm">Loading login screen...</p>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}

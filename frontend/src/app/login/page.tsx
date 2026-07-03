'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Logo } from '@/components/ui/Logo';
import { Mail, Lock, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

// The main login form component that reads search parameters for post-login redirection
function LoginForm() {
  const router = useRouter();
  const searchParameters = useSearchParams();
  const redirectDestinationUrl = searchParameters?.get('next') || '/dashboard';
  const [email, setEmail] = useState('demo@receptify.in');
  const [password, setPassword] = useState('Demo@1234');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="bg-marketing min-h-screen flex items-center justify-center px-4 py-10 relative" data-testid="login-page">
      <div className="glow-orb w-96 h-96 -top-10 -left-10 bg-brand-100" />
      <div className="glow-orb w-96 h-96 -bottom-10 -right-10 bg-brand-50" />

      <div className="relative w-full max-w-md">
        <div className="text-center mb-6">
          <Link href="/" className="inline-block"><Logo /></Link>
        </div>
        <div className="glass-strong p-8 animate-fade-up">
          <h1 className="text-2xl font-extrabold text-brand-navy">Welcome back</h1>
          <p className="text-sm text-slate-500 mt-1">Sign in to your Receptify account</p>

          <form onSubmit={handleLoginSubmit} className="mt-6 space-y-4">
            <div>
              <label className="label-base">Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  required
                  type="email"
                  className="input-field pl-10"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  data-testid="login-email-input"
                  placeholder="you@business.in"
                />
              </div>
            </div>
            <div>
              <label className="label-base">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  required
                  type={showPassword ? 'text' : 'password'}
                  className="input-field pl-10 pr-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  data-testid="login-password-input"
                />
                <button type="button" onClick={() => setShowPassword((show) => !show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-brand-600">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={isSubmitting} className="btn-primary w-full" data-testid="login-submit-button">
              {isSubmitting ? 'Signing in…' : <>Sign in <ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>

          <div className="mt-5 flex items-center justify-between text-sm">
            <Link href="/signup" className="text-brand-700 font-semibold hover:underline" data-testid="login-signup-link">Create an account</Link>
            <Link href="/forgot-password" className="text-slate-500 hover:text-brand-700">Forgot password?</Link>
          </div>

          <div className="mt-6 p-3 rounded-xl bg-brand-50 border border-brand-100 text-xs text-brand-900">
            <span className="font-semibold">Demo account:</span> demo@receptify.in / Demo@1234
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
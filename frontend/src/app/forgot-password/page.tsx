'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Logo } from '@/components/ui/Logo';
import { toast } from 'sonner';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (response.ok) {
        toast.success(data.message || 'Reset link sent!');
        setSent(true);
      } else {
        toast.error(data.error || 'Failed to send reset link');
      }
    } catch (err) {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="bg-marketing min-h-screen flex items-center justify-center px-4 py-10" data-testid="forgot-password-page">
      <div className="w-full max-w-md">
        <div className="text-center mb-6"><Link href="/"><Logo /></Link></div>
        <div className="glass-strong p-8">
          <h1 className="text-2xl font-extrabold text-brand-navy">Reset your password</h1>
          <p className="text-sm text-slate-500 mt-1">Enter your email and we&apos;ll send reset instructions.</p>
          {sent ? (
            <div className="mt-6 p-4 rounded-xl bg-emerald-50 border border-emerald-100 text-sm text-emerald-700">
              If an account exists for {email}, you&apos;ll receive a reset email shortly.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <input required type="email" className="input-field" placeholder="you@business.in" value={email} onChange={(e) => setEmail(e.target.value)} data-testid="forgot-email-input" disabled={isLoading} />
              <button className="btn-primary w-full disabled:opacity-50" data-testid="forgot-submit-button" disabled={isLoading}>
                {isLoading ? 'Sending...' : 'Send reset link'}
              </button>
            </form>
          )}
          <div className="mt-5 text-center text-sm">
            <Link href="/login" className="text-brand-700 font-semibold">Back to sign in</Link>
          </div>
        </div>
      </div>
    </main>
  );
}

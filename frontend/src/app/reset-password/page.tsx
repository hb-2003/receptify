'use client';

import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useState, Suspense } from 'react';
import { Logo } from '@/components/ui/Logo';
import { toast } from 'sonner';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token) {
      toast.error('Reset token is missing from the URL.');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await response.json();
      if (response.ok) {
        toast.success(data.message || 'Password successfully updated!');
        setSuccess(true);
        setTimeout(() => {
          router.push('/login');
        }, 3000);
      } else {
        toast.error(data.error || 'Failed to reset password.');
      }
    } catch (err) {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-6">
        <Link href="/">
          <Logo />
        </Link>
      </div>
      <div className="glass-strong p-8">
        <h1 className="text-2xl font-extrabold text-brand-navy">Choose a new password</h1>
        <p className="text-sm text-slate-500 mt-1">Please enter your new password below.</p>

        {success ? (
          <div className="mt-6 p-4 rounded-xl bg-emerald-50 border border-emerald-100 text-sm text-emerald-700">
            Your password has been reset successfully. Redirecting you to login...
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                New Password
              </label>
              <input
                required
                type="password"
                className="input-field"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                data-testid="reset-password-input"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                Confirm Password
              </label>
              <input
                required
                type="password"
                className="input-field"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isLoading}
                data-testid="reset-confirm-password-input"
              />
            </div>
            <button
              type="submit"
              className="btn-primary w-full disabled:opacity-50"
              disabled={isLoading || !token}
              data-testid="reset-submit-button"
            >
              {isLoading ? 'Resetting...' : 'Reset password'}
            </button>
          </form>
        )}
        <div className="mt-5 text-center text-sm">
          <Link href="/login" className="text-brand-700 font-semibold">
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="bg-marketing min-h-screen flex items-center justify-center px-4 py-10" data-testid="reset-password-page">
      <Suspense fallback={<div className="text-slate-500">Loading...</div>}>
        <ResetPasswordForm />
      </Suspense>
    </main>
  );
}

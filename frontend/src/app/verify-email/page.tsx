'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState, useEffect, useRef, Suspense } from 'react';
import { Logo } from '@/components/ui/Logo';
import { CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';

function VerifyEmailForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Verifying your email address...');
  const verifyStarted = useRef(false);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('The verification token is missing from the link.');
      return;
    }

    if (verifyStarted.current) {
      return;
    }
    verifyStarted.current = true;

    const verifyEmail = async () => {
      try {
        const response = await fetch('/api/auth/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const data = await response.json();
        if (response.ok) {
          setStatus('success');
          setMessage(data.message || 'Your email has been successfully verified.');
        } else {
          setStatus('error');
          setMessage(data.error || 'Failed to verify email. The link may have expired.');
        }
      } catch (err) {
        setStatus('error');
        setMessage('Something went wrong. Please try again.');
      }
    };

    verifyEmail();
  }, [token]);

  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-6">
        <Link href="/">
          <Logo />
        </Link>
      </div>
      <div className="glass-strong p-8 text-center">
        {status === 'loading' && (
          <div className="flex flex-col items-center space-y-4">
            <div className="p-3 bg-blue-50 rounded-full text-blue-600 animate-spin">
              <Loader2 className="h-8 w-8" />
            </div>
            <h1 className="text-2xl font-extrabold text-brand-navy">Verifying Email</h1>
            <p className="text-sm text-slate-500">{message}</p>
          </div>
        )}

        {status === 'success' && (
          <div className="flex flex-col items-center space-y-4">
            <div className="p-3 bg-emerald-50 rounded-full text-emerald-600">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h1 className="text-2xl font-extrabold text-brand-navy">Email Verified!</h1>
            <p className="text-sm text-slate-500">{message}</p>
            <div className="pt-2 w-full">
              <Link href="/login" className="btn-primary block w-full text-center">
                Go to Sign In
              </Link>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center space-y-4">
            <div className="p-3 bg-rose-50 rounded-full text-rose-600">
              <AlertTriangle className="h-8 w-8" />
            </div>
            <h1 className="text-2xl font-extrabold text-brand-navy">Verification Failed</h1>
            <p className="text-sm text-slate-500">{message}</p>
            <div className="pt-2 w-full space-y-2">
              <Link href="/login" className="btn-secondary block w-full text-center">
                Back to Sign In
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <main className="bg-marketing min-h-screen flex items-center justify-center px-4 py-10" data-testid="verify-email-page">
      <Suspense fallback={<div className="text-slate-500">Loading...</div>}>
        <VerifyEmailForm />
      </Suspense>
    </main>
  );
}

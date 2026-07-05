'use client';

import { useEffect, useState } from 'react';
import { Settings as SettingsIcon, Phone, ShieldCheck, Sparkles, Key, Loader2, CheckCircle2, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

export default function SettingsPage() {
  const [me, setMe] = useState<any>(null);
  const [twilio, setTwilio] = useState({ accountSid: '', authToken: '', phoneNumber: '' });
  const [showToken, setShowToken] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'verified' | 'failed'>('idle');
  const [connectionError, setConnectionError] = useState('');

  useEffect(() => {
    // 1. Fetch user session
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then(setMe);

    // 2. Fetch existing Twilio config
    fetch('/api/v1/business/twilio')
      .then((r) => r.json())
      .then((data) => {
        if (data.accountSid) {
          setTwilio({
            accountSid: data.accountSid || '',
            authToken: data.hasAuthToken ? '••••••••••••••••••••••••••••' : '',
            phoneNumber: data.phoneNumber || '',
          });
          if (data.hasAuthToken) {
            setConnectionStatus('verified');
          }
        }
      });
  }, []);

  const handleTestConnection = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!twilio.accountSid || !twilio.authToken) {
      toast.error('Account SID and Auth Token are required to test connection');
      return;
    }
    
    setConnectionStatus('testing');
    setConnectionError('');
    
    try {
      const res = await fetch('/api/v1/business/twilio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountSid: twilio.accountSid,
          authToken: twilio.authToken === '••••••••••••••••••••••••••••' ? '' : twilio.authToken,
          phoneNumber: twilio.phoneNumber
        })
      });
      
      const data = await res.json();
      if (!res.ok) {
        setConnectionStatus('failed');
        setConnectionError(data.error || 'Failed to authenticate with Twilio');
        toast.error(data.error || 'Twilio authentication failed');
      } else {
        setConnectionStatus('verified');
        toast.success('Twilio account successfully connected & verified!');
      }
    } catch (err: any) {
      setConnectionStatus('failed');
      setConnectionError(err.message || 'Network error');
      toast.error('Network error during Twilio authentication');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!twilio.accountSid || !twilio.authToken) {
      toast.error('Account SID and Auth Token are required');
      return;
    }

    setIsSaving(true);
    setConnectionError('');

    try {
      const res = await fetch('/api/v1/business/twilio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountSid: twilio.accountSid,
          authToken: twilio.authToken === '••••••••••••••••••••••••••••' ? '' : twilio.authToken,
          phoneNumber: twilio.phoneNumber
        })
      });

      const data = await res.json();
      setIsSaving(false);

      if (!res.ok) {
        setConnectionStatus('failed');
        setConnectionError(data.error || 'Save and verify failed');
        toast.error(data.error || 'Save failed');
      } else {
        setConnectionStatus('verified');
        toast.success('Twilio configuration successfully saved & verified!');
      }
    } catch (err: any) {
      setIsSaving(false);
      setConnectionStatus('failed');
      setConnectionError(err.message || 'Network error');
      toast.error('Network error during save');
    }
  };

  if (!me?.user) return <div className="glass h-60 animate-pulse" />;

  return (
    <div className="space-y-6 max-w-3xl" data-testid="settings-page">
      <header>
        <span className="overline">Account</span>
        <h1 className="mt-2 text-3xl font-extrabold text-brand-navy">Settings</h1>
      </header>

      {/* Grid wrapper for standard profiles */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass p-6">
          <h2 className="font-bold text-brand-navy mb-4">Owner profile</h2>
          <div className="space-y-3 text-sm">
            <Field label="Owner name" value={me.user.ownerName} />
            <Field label="Email" value={me.user.email} />
            <Field label="Phone" value={me.user.phone || '—'} />
            <Field label="Role" value={me.user.role} />
          </div>
        </div>

        {me.business && (
          <div className="glass p-6">
            <h2 className="font-bold text-brand-navy mb-4">Business profile</h2>
            <div className="space-y-3 text-sm">
              <Field label="Business name" value={me.business.name} />
              <Field label="Business type" value={me.business.businessType || '—'} />
              <Field label="City" value={me.business.city || '—'} />
              <Field label="Preferred language" value={me.business.preferredLanguage} />
              <div className="grid grid-cols-2 gap-2">
                <Field label="Plan tier" value={me.business.planTier} />
                <Field label="Credits" value={String(me.business.callCredits)} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Telephony Settings Section (Twilio Live Configuration) */}
      <div className="glass p-6 relative overflow-hidden" data-testid="settings-twilio-card">
        <div className="absolute top-0 right-0 w-24 h-24 bg-[#2F5CFF]/[0.02] rounded-full blur-xl pointer-events-none" />
        
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5 flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#2F5CFF]/10 text-[#2F5CFF] grid place-items-center">
              <Phone className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-lg text-brand-navy">Twilio Telephony Integration</h2>
              <p className="text-xs text-slate-400 mt-0.5">Configure your custom carrier credentials for outbound campaigns.</p>
            </div>
          </div>
          
          {/* Connection Status Badge */}
          <div>
            {connectionStatus === 'verified' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-600">
                <CheckCircle2 className="w-3.5 h-3.5" /> Live & Connected
              </span>
            )}
            {connectionStatus === 'testing' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-xs font-bold text-blue-600 animate-pulse">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Verifying...
              </span>
            )}
            {connectionStatus === 'failed' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-xs font-bold text-rose-600">
                <AlertTriangle className="w-3.5 h-3.5" /> Authentication Failed
              </span>
            )}
            {connectionStatus === 'idle' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-500">
                Unconfigured
              </span>
            )}
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label-base flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-slate-400" /> Account SID *
              </label>
              <input 
                required 
                className="input-field" 
                placeholder="ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX" 
                value={twilio.accountSid} 
                onChange={(e) => setTwilio({ ...twilio, accountSid: e.target.value })}
                data-testid="twilio-sid-input"
              />
            </div>
            
            <div>
              <label className="label-base flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-slate-400" /> Twilio Phone Number
              </label>
              <input 
                className="input-field" 
                placeholder="+1XXXXXXXXXX or +91XXXXXXXXXX" 
                value={twilio.phoneNumber} 
                onChange={(e) => setTwilio({ ...twilio, phoneNumber: e.target.value })}
                data-testid="twilio-phone-input"
              />
            </div>
          </div>

          <div>
            <label className="label-base flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-slate-400" /> Auth Token *
            </label>
            <div className="relative">
              <input 
                required 
                type={showToken ? 'text' : 'password'} 
                className="input-field pr-10" 
                placeholder="Your secure Twilio Auth Token" 
                value={twilio.authToken} 
                onChange={(e) => setTwilio({ ...twilio, authToken: e.target.value })}
                data-testid="twilio-token-input"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
              >
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {connectionStatus === 'failed' && connectionError && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-600 flex items-start gap-2.5 font-medium leading-relaxed">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Error verifying with Twilio carrier:</span> {connectionError}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2.5 pt-2 flex-wrap">
            <button 
              type="button" 
              onClick={handleTestConnection}
              disabled={connectionStatus === 'testing' || isSaving}
              className="btn-secondary text-sm flex items-center gap-1.5"
              data-testid="twilio-test-button"
            >
              {connectionStatus === 'testing' ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Testing...</>
              ) : (
                <><Sparkles className="w-4 h-4" /> Test Connection</>
              )}
            </button>
            
            <button 
              type="submit" 
              disabled={connectionStatus === 'testing' || isSaving}
              className="btn-primary text-sm flex items-center gap-1.5"
              data-testid="twilio-save-button"
            >
              {isSaving ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Verifying & Saving...</>
              ) : (
                <>Save & Verify</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 p-3 flex justify-between items-center gap-2">
      <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold">{label}</div>
      <div className="text-sm font-semibold text-brand-ink truncate capitalize">{value}</div>
    </div>
  );
}

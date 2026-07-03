'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Megaphone, Users, PhoneCall, BarChart3, Play, Pause } from 'lucide-react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { PURPOSE_LABEL, LANGUAGE_LABEL, formatDate, formatDuration } from '@/lib/utils';
import { toast } from 'sonner';

export default function CampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = async () => {
    const r = await fetch(`/api/campaigns/${id}`);
    if (!r.ok) { setIsLoading(false); return; }
    const d = await r.json();
    setData(d);
    setIsLoading(false);
  };
  useEffect(() => { load(); const t = setInterval(load, 2000); return () => clearInterval(t); }, [id]);

  const launch = async () => {
    const r = await fetch(`/api/campaigns/${id}/launch`, { method: 'POST' });
    const d = await r.json();
    if (!r.ok) { toast.error(d.error || 'Launch failed'); return; }
    toast.success('Campaign launched');
    load();
  };

  if (isLoading || !data) return <div className="glass h-60 animate-pulse" />;

  const c = data.campaign;
  const calls = data.calls || [];
  const progress = c.totalContacts ? Math.round((c.callsCompleted / c.totalContacts) * 100) : 0;

  return (
    <div className="space-y-6" data-testid="campaign-detail-page">
      <header className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <Link href="/campaigns" className="text-xs text-brand-600 inline-flex items-center gap-1 mb-2"><ArrowLeft className="w-3 h-3" /> Back to campaigns</Link>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-extrabold text-brand-navy">{c.name}</h1>
            <StatusBadge status={c.status} />
          </div>
          <div className="text-sm text-slate-500 mt-1">{PURPOSE_LABEL[c.purpose] || c.purpose} · {LANGUAGE_LABEL[c.language]} · Created {formatDate(c.createdAt)}</div>
        </div>
        {c.status === 'draft' && (
          <button onClick={launch} className="btn-primary text-sm" data-testid="campaign-launch-btn"><Play className="w-4 h-4" /> Launch campaign</button>
        )}
      </header>

      {/* Progress */}
      <div className="glass p-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-bold text-brand-navy">Campaign progress</h3>
          <span className="text-sm font-bold text-brand-700">{c.callsCompleted}/{c.totalContacts} · {progress}%</span>
        </div>
        <div className="h-3 bg-brand-50 rounded-full overflow-hidden">
          <div className="h-full bg-brand-gradient transition-all" style={{ width: `${progress}%` }} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
          <Stat label="Total contacts" value={c.totalContacts} icon={Users} />
          <Stat label="Completed" value={c.callsCompleted} icon={PhoneCall} />
          <Stat label="Answered" value={c.callsAnswered} icon={BarChart3} accent="success" />
          <Stat label="Failed" value={c.callsFailed} icon={Megaphone} accent="danger" />
        </div>
      </div>

      {/* Live call log */}
      <div className="glass p-6">
        <h3 className="font-bold text-brand-navy mb-4">Live call log</h3>
        {calls.length === 0 ? (
          <div className="text-sm text-slate-500 text-center py-8">No calls yet. Launch the campaign to begin.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="campaign-calls-table">
              <thead>
                <tr className="text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-3">Customer</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Outcome</th>
                  <th className="px-3 py-3">Duration</th>
                  <th className="px-3 py-3">Time</th>
                  <th className="px-3 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {calls.map((call: any) => {
                  const cust = data.customers.find((x: any) => x.id === call.customerId);
                  return (
                    <tr key={call.id} className="hover:bg-brand-50/40">
                      <td className="px-3 py-3">
                        <div className="font-semibold text-brand-ink">{cust?.fullName || 'Unknown'}</div>
                        <div className="text-xs text-slate-500">{cust?.phone}</div>
                      </td>
                      <td className="px-3 py-3"><StatusBadge status={call.status} /></td>
                      <td className="px-3 py-3"><StatusBadge status={call.outcome} type="outcome" /></td>
                      <td className="px-3 py-3 text-slate-600">{formatDuration(call.durationSec)}</td>
                      <td className="px-3 py-3 text-xs text-slate-500">{call.startedAt ? formatDate(call.startedAt) : '—'}</td>
                      <td className="px-3 py-3 text-right">
                        <Link href={`/calls/${call.id}`} className="text-brand-600 text-xs font-semibold hover:underline">View →</Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Script */}
      <div className="glass p-6">
        <h3 className="font-bold text-brand-navy mb-3">Campaign script</h3>
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-sm whitespace-pre-wrap font-mono leading-relaxed text-brand-ink">{c.scriptText || '—'}</div>
      </div>
    </div>
  );
}

function Stat({ label, value, icon: Icon, accent }: { label: string; value: any; icon: any; accent?: 'success' | 'danger' }) {
  const cls = accent === 'success' ? 'text-emerald-600' : accent === 'danger' ? 'text-red-600' : 'text-brand-navy';
  return (
    <div className="bg-white rounded-xl border border-slate-100 p-4">
      <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold flex items-center gap-1"><Icon className="w-3 h-3" /> {label}</div>
      <div className={`text-2xl font-extrabold mt-1 ${cls}`}>{value}</div>
    </div>
  );
}

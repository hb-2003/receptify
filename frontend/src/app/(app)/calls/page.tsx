'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { History, Filter } from 'lucide-react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatDate, formatDuration } from '@/lib/utils';

export default function CallsPage() {
  const [calls, setCalls] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [outcome, setOutcome] = useState('');

  useEffect(() => {
    const load = async () => {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      if (outcome) params.set('outcome', outcome);
      const r = await fetch(`/api/calls?${params.toString()}`);
      const d = await r.json();
      setCalls(d.calls || []);
      setIsLoading(false);
    };
    load();
  }, [status, outcome]);

  return (
    <div className="space-y-6" data-testid="calls-page">
      <header>
        <span className="overline">Call records</span>
        <h1 className="mt-2 text-3xl font-extrabold text-brand-navy">Call history</h1>
        <p className="text-slate-500 text-sm mt-1">Every call placed by Receptify, with status, outcome and details.</p>
      </header>

      <div className="glass p-4 flex flex-wrap items-center gap-3">
        <Filter className="w-4 h-4 text-slate-400" />
        <select className="input-field py-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value)} data-testid="calls-status-filter">
          <option value="">All statuses</option>
          {['queued', 'ringing', 'in_progress', 'completed', 'failed', 'no_answer'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="input-field py-2 text-sm" value={outcome} onChange={(e) => setOutcome(e.target.value)} data-testid="calls-outcome-filter">
          <option value="">All outcomes</option>
          {['interested', 'not_interested', 'callback_requested', 'payment_promised', 'appointment_confirmed', 'wrong_number', 'no_answer', 'failed'].map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="glass h-60 animate-pulse" />
      ) : calls.length === 0 ? (
        <EmptyState icon={History} title="No calls yet" description="Launch a campaign to see calls here." />
      ) : (
        <div className="glass overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="calls-table">
              <thead className="bg-white/60 border-b border-slate-100">
                <tr className="text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-4">Customer</th>
                  <th className="px-5 py-4">Phone</th>
                  <th className="px-5 py-4">Campaign</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">Outcome</th>
                  <th className="px-5 py-4">Duration</th>
                  <th className="px-5 py-4">Date/time</th>
                  <th className="px-5 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {calls.map((c) => (
                  <tr key={c.id} className="hover:bg-brand-50/40" data-testid={`call-row-${c.id}`}>
                    <td className="px-5 py-4 font-semibold text-brand-ink">{c.customer?.fullName || 'Unknown'}</td>
                    <td className="px-5 py-4 text-slate-600">{c.customer?.phone}</td>
                    <td className="px-5 py-4 text-slate-700">{c.campaign?.name || '—'}</td>
                    <td className="px-5 py-4"><StatusBadge status={c.status} /></td>
                    <td className="px-5 py-4"><StatusBadge status={c.outcome} type="outcome" /></td>
                    <td className="px-5 py-4 text-slate-600">{formatDuration(c.durationSec)}</td>
                    <td className="px-5 py-4 text-xs text-slate-500">{formatDate(c.createdAt)}</td>
                    <td className="px-5 py-4 text-right">
                      <Link href={`/calls/${c.id}`} className="text-brand-600 text-xs font-semibold hover:underline" data-testid={`call-view-${c.id}`}>View →</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

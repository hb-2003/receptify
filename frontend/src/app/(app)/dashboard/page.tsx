'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Users, Megaphone, PhoneCall, CheckCircle2, AlertCircle, RefreshCw, ArrowRight, Sparkles, Upload, BarChart3, PlusCircle } from 'lucide-react';
import { KpiCard } from '@/components/ui/KpiCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { PURPOSE_LABEL, formatDate } from '@/lib/utils';
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell } from 'recharts';

const OUTCOME_COLORS: Record<string, string> = {
  interested: '#10B981',
  callback_requested: '#F59E0B',
  payment_promised: '#10B981',
  appointment_confirmed: '#10B981',
  not_interested: '#94A3B8',
  no_answer: '#CBD5E1',
  wrong_number: '#EF4444',
  failed: '#EF4444',
  pending: '#94A3B8',
};

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = async () => {
    const res = await fetch('/api/analytics');
    const d = await res.json();
    setData(d);
    setIsLoading(false);
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-64 bg-white/60 rounded-xl animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 glass animate-pulse" />)}
        </div>
      </div>
    );
  }

  const totals = data?.totals || {};

  return (
    <div className="space-y-8" data-testid="dashboard-page">
      <header className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <span className="overline">Overview</span>
          <h1 className="mt-2 text-3xl font-extrabold text-brand-navy">Welcome back 👋</h1>
          <p className="text-slate-500 text-sm mt-1">Here is what&apos;s happening with your calling campaigns.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/campaigns/new" className="btn-primary text-sm" data-testid="quick-create-campaign">
            <PlusCircle className="w-4 h-4" /> Create campaign
          </Link>
          <Link href="/scripts" className="btn-secondary text-sm" data-testid="quick-generate-script">
            <Sparkles className="w-4 h-4" /> Generate script
          </Link>
          <Link href="/analytics" className="btn-ghost text-sm" data-testid="quick-view-reports">
            <BarChart3 className="w-4 h-4" /> View reports
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <KpiCard label="Total customers" value={totals.totalCustomers || 0} icon={Users} accent="primary" testId="kpi-total-customers" />
        <KpiCard label="Total campaigns" value={totals.totalCampaigns || 0} icon={Megaphone} accent="primary" testId="kpi-total-campaigns" />
        <KpiCard label="Total calls" value={totals.totalCalls || 0} icon={PhoneCall} accent="primary" testId="kpi-total-calls" />
        <KpiCard label="Answered" value={totals.answered || 0} icon={CheckCircle2} accent="success" testId="kpi-answered" />
        <KpiCard label="Failed" value={totals.failed || 0} icon={AlertCircle} accent="danger" testId="kpi-failed" />
        <KpiCard label="Callbacks" value={totals.callbacks || 0} icon={RefreshCw} accent="warning" testId="kpi-callbacks" />
        <KpiCard label="Answer rate" value={`${data?.answerRate || 0}%`} icon={CheckCircle2} accent="success" testId="kpi-answer-rate" />
        <KpiCard label="Failed rate" value={`${data?.failedRate || 0}%`} icon={AlertCircle} accent="danger" testId="kpi-failed-rate" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="glass p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-bold text-brand-navy">Calls in last 14 days</h2>
          </div>
          {!data?.callsByDay?.length ? (
            <div className="text-sm text-slate-500 py-10 text-center">No calls yet. Launch your first campaign to see activity.</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={data.callsByDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#64748B' }} />
                <YAxis tick={{ fontSize: 12, fill: '#64748B' }} />
                <Tooltip contentStyle={{ background: 'rgba(255,255,255,0.95)', border: '1px solid #DBEAFE', borderRadius: 12 }} />
                <Line type="monotone" dataKey="count" stroke="#2563EB" strokeWidth={3} dot={{ fill: '#2563EB', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="glass p-6">
          <h2 className="font-bold text-brand-navy mb-4">Outcome breakdown</h2>
          {!data?.outcomes?.length ? (
            <div className="text-sm text-slate-500 py-10 text-center">No outcomes yet.</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={170}>
                <PieChart>
                  <Pie data={data.outcomes} dataKey="count" nameKey="outcome" innerRadius={45} outerRadius={70} paddingAngle={3}>
                    {data.outcomes.map((o: any, i: number) => (
                      <Cell key={i} fill={OUTCOME_COLORS[o.outcome] || '#94A3B8'} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'rgba(255,255,255,0.95)', border: '1px solid #DBEAFE', borderRadius: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {data.outcomes.slice(0, 5).map((o: any) => (
                  <div key={o.outcome} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ background: OUTCOME_COLORS[o.outcome] || '#94A3B8' }} />
                      <span className="text-slate-600 capitalize">{o.outcome.replace(/_/g, ' ')}</span>
                    </div>
                    <span className="font-bold text-brand-navy">{o.count}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-bold text-brand-navy">Recent campaigns</h2>
            <Link href="/campaigns" className="text-xs text-brand-600 font-semibold hover:underline">View all <ArrowRight className="inline w-3 h-3" /></Link>
          </div>
          {!data?.recentCampaigns?.length ? (
            <EmptyState icon={Megaphone} title="No campaigns yet" description="Create your first AI calling campaign to get started." action={<Link href="/campaigns/new" className="btn-primary text-sm" data-testid="empty-create-campaign">Create campaign</Link>} />
          ) : (
            <div className="space-y-3" data-testid="recent-campaigns-list">
              {data.recentCampaigns.map((c: any) => (
                <Link key={c.id} href={`/campaigns/${c.id}`} className="flex items-center justify-between p-3 rounded-xl hover:bg-brand-50 transition-colors">
                  <div className="min-w-0">
                    <div className="font-semibold text-brand-ink truncate">{c.name}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{PURPOSE_LABEL[c.purpose] || c.purpose} · {c.totalContacts} contacts</div>
                  </div>
                  <StatusBadge status={c.status} />
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="glass p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-bold text-brand-navy">Recent call activity</h2>
            <Link href="/calls" className="text-xs text-brand-600 font-semibold hover:underline">View all <ArrowRight className="inline w-3 h-3" /></Link>
          </div>
          {!data?.recentCalls?.length ? (
            <EmptyState icon={PhoneCall} title="No calls yet" description="Launch a campaign to see calls here." />
          ) : (
            <div className="space-y-2" data-testid="recent-calls-list">
              {data.recentCalls.map((c: any) => (
                <Link key={c.id} href={`/calls/${c.id}`} className="flex items-center justify-between p-3 rounded-xl hover:bg-brand-50 transition-colors">
                  <div className="min-w-0">
                    <div className="font-semibold text-brand-ink truncate">{c.customer?.fullName || 'Unknown'}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{c.campaign?.name || 'Campaign'} · {formatDate(c.createdAt)}</div>
                  </div>
                  <StatusBadge status={c.outcome} type="outcome" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

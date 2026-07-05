'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Users, Megaphone, PhoneCall, CheckCircle2, AlertCircle, RefreshCw, ArrowRight, Sparkles, Upload, BarChart3, PlusCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';
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

  const load = useCallback(async () => {
    const res = await fetch('/api/analytics');
    const d = await res.json();
    setData(d);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  const handleDismissOnboarding = async () => {
    try {
      const res = await fetch('/api/auth/onboarding/dismiss', { method: 'POST' });
      if (res.ok) {
        load();
      }
    } catch (err) {
      console.error('Failed to dismiss onboarding', err);
    }
  };

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
  const step1_done = (totals.totalCustomers || 0) > 0;
  const step2_done = (totals.totalScripts || 0) > 0;
  const step3_done = (totals.totalCampaigns || 0) > 0;
  const step4_done = (totals.totalCalls || 0) > 0;

  const completedStepsCount = (step1_done ? 1 : 0) + (step2_done ? 1 : 0) + (step3_done ? 1 : 0) + (step4_done ? 1 : 0);
  const isAllStepsCompleted = completedStepsCount === 4;

  const showOnboarding = !data?.onboardingDismissed;

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

      {/* Onboarding Checklist Card or Completion Card */}
      {showOnboarding && (
        isAllStepsCompleted ? (
          <div className="glass p-6 rounded-2xl relative mb-8 border border-emerald-100 bg-emerald-50/5 shadow-sm text-center py-8" data-testid="onboarding-completion-card">
            <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-700 grid place-items-center text-lg font-bold mx-auto mb-3">✓</div>
            <h2 className="text-lg font-bold text-emerald-900">All onboarding steps completed!</h2>
            <p className="text-emerald-800 text-xs mt-1 max-w-md mx-auto">
              You&apos;ve successfully imported contacts, generated AI scripts, created campaigns, and launched calling! Your dashboard is now fully active.
            </p>
            <button 
              onClick={handleDismissOnboarding} 
              className="btn-primary mt-4 py-2 px-6 text-xs font-bold"
              data-testid="onboarding-complete-dismiss-button"
            >
              Go to Dashboard Overview
            </button>
          </div>
        ) : (
          <div className="glass p-6 rounded-2xl relative mb-8 border border-slate-200 shadow-sm bg-white" data-testid="onboarding-checklist-card">
            <button 
              onClick={handleDismissOnboarding}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors border border-slate-200/50"
              title="Skip onboarding"
              data-testid="onboarding-skip-button"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-bold text-brand-navy">Get your first campaign running</h2>
                <p className="text-slate-500 text-xs mt-0.5">Follow these simple steps to start answering every call with Receptify AI.</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-brand-600">{completedStepsCount} of 4 steps done</span>
                <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-brand-600 transition-all duration-500" 
                    style={{ width: `${(completedStepsCount / 4) * 100}%` }} 
                  />
                </div>
              </div>
            </div>

            {/* Checklist items */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-5">
              {/* Step 1 */}
              <div className={cn("p-4 rounded-xl border flex flex-col justify-between gap-3", step1_done ? "bg-emerald-50/10 border-emerald-100" : "bg-slate-50/30 border-slate-100")}>
                <div className="flex items-start gap-2.5">
                  {step1_done ? (
                    <span className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-700 grid place-items-center text-xs font-bold shrink-0 mt-0.5">✓</span>
                  ) : (
                    <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-400 grid place-items-center text-xs font-bold shrink-0 mt-0.5">1</span>
                  )}
                  <div>
                    <div className={cn("text-xs font-bold", step1_done ? "text-emerald-800" : "text-brand-navy")}>Import your contacts</div>
                    <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">Add customers manually or upload CSV.</p>
                  </div>
                </div>
                {step1_done ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 w-fit">Done</span>
                ) : (
                  <Link href="/customers/upload" className="btn-secondary py-1.5 px-3 text-xs font-bold text-center block w-full mt-1">Import contacts</Link>
                )}
              </div>

              {/* Step 2 */}
              <div className={cn("p-4 rounded-xl border flex flex-col justify-between gap-3", step2_done ? "bg-emerald-50/10 border-emerald-100" : "bg-slate-50/30 border-slate-100")}>
                <div className="flex items-start gap-2.5">
                  {step2_done ? (
                    <span className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-700 grid place-items-center text-xs font-bold shrink-0 mt-0.5">✓</span>
                  ) : (
                    <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-400 grid place-items-center text-xs font-bold shrink-0 mt-0.5">2</span>
                  )}
                  <div>
                    <div className={cn("text-xs font-bold", step2_done ? "text-emerald-800" : "text-brand-navy")}>Generate a call script</div>
                    <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">Let AI build your receptionist script.</p>
                  </div>
                </div>
                {step2_done ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 w-fit">Done</span>
                ) : (
                  <Link href="/scripts" className="btn-primary py-1.5 px-3 text-xs font-bold text-center block w-full mt-1">Generate script</Link>
                )}
              </div>

              {/* Step 3 */}
              <div className={cn("p-4 rounded-xl border flex flex-col justify-between gap-3", step3_done ? "bg-emerald-50/10 border-emerald-100" : "bg-slate-50/30 border-slate-100")}>
                <div className="flex items-start gap-2.5">
                  {step3_done ? (
                    <span className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-700 grid place-items-center text-xs font-bold shrink-0 mt-0.5">✓</span>
                  ) : (
                    <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-400 grid place-items-center text-xs font-bold shrink-0 mt-0.5">3</span>
                  )}
                  <div>
                    <div className={cn("text-xs font-bold", step3_done ? "text-emerald-800" : "text-brand-navy")}>Create a campaign</div>
                    <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">Configure voice, schedule and consent.</p>
                  </div>
                </div>
                {step3_done ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 w-fit">Done</span>
                ) : (
                  <Link href="/campaigns/new" className="btn-primary py-1.5 px-3 text-xs font-bold text-center block w-full mt-1">Create campaign</Link>
                )}
              </div>

              {/* Step 4 */}
              <div className={cn("p-4 rounded-xl border flex flex-col justify-between gap-3", step4_done ? "bg-emerald-50/10 border-emerald-100" : "bg-slate-50/30 border-slate-100")}>
                <div className="flex items-start gap-2.5">
                  {step4_done ? (
                    <span className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-700 grid place-items-center text-xs font-bold shrink-0 mt-0.5">✓</span>
                  ) : (
                    <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-400 grid place-items-center text-xs font-bold shrink-0 mt-0.5">4</span>
                  )}
                  <div>
                    <div className={cn("text-xs font-bold", step4_done ? "text-emerald-800" : "text-brand-navy")}>Launch and monitor</div>
                    <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">Initiate AI calling & monitor results.</p>
                  </div>
                </div>
                {step4_done ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 w-fit">Done</span>
                ) : (
                  <Link 
                    href="/analytics" 
                    className={cn(
                      "py-1.5 px-3 text-xs font-bold text-center block w-full mt-1 rounded-lg transition-all",
                      step3_done 
                        ? "btn-primary" 
                        : "bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed pointer-events-none"
                    )}
                    aria-disabled={!step3_done}
                  >
                    View reports
                  </Link>
                )}
              </div>
            </div>
            
            <div className="mt-4 flex justify-end">
              <button 
                onClick={handleDismissOnboarding}
                className="text-[11px] font-bold text-[#2F5CFF] hover:underline uppercase tracking-wider cursor-pointer"
                data-testid="onboarding-skip-link"
              >
                Skip for now
              </button>
            </div>
          </div>
        )
      )}

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

      {showOnboarding && !data?.callsByDay?.length && !data?.outcomes?.length ? (
        <div className="glass p-8 text-center flex flex-col items-center justify-center min-h-[220px]" data-testid="merged-empty-state-card">
          <div className="w-12 h-12 rounded-2xl bg-[#EFF6FF] text-[#2F5CFF] grid place-items-center mb-3 shadow-inner">
            <BarChart3 className="w-6 h-6 animate-pulse" />
          </div>
          <h3 className="font-bold text-brand-navy text-sm mb-1">Performance Analytics Dashboard</h3>
          <p className="text-xs text-slate-500 max-w-md">
            Your call activity and outcomes will appear here once you launch a campaign.
          </p>
        </div>
      ) : (
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
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-bold text-brand-navy">Recent campaigns</h2>
            <Link href="/campaigns" className="text-xs text-brand-600 font-semibold hover:underline">View all <ArrowRight className="inline w-3 h-3" /></Link>
          </div>
          {!data?.recentCampaigns?.length ? (
            <EmptyState icon={Megaphone} title="Campaign Desk Empty" description="Once you create a campaign, it will be listed here for quick launch access." action={<Link href="/campaigns/new" className="btn-primary text-sm" data-testid="empty-create-campaign">Create campaign</Link>} />
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
            <EmptyState icon={PhoneCall} title="Awaiting Call Traffic" description="Real-time call transcripts and summaries will stream here as they happen." />
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

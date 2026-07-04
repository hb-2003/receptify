  import {
    LayoutDashboard, Users, Megaphone, History, Sparkles, BarChart3, CreditCard, Settings,
    Search, Bell, MoreHorizontal, TrendingUp, PhoneCall, CheckCircle2, AlertCircle, RefreshCw,
  } from 'lucide-react';

  const NAV = [
    { icon: LayoutDashboard, label: 'Dashboard', active: true },
    { icon: Users, label: 'Customers' },
    { icon: Megaphone, label: 'Campaigns' },
    { icon: History, label: 'Call History' },
    { icon: Sparkles, label: 'AI Scripts' },
    { icon: BarChart3, label: 'Analytics' },
    { icon: CreditCard, label: 'Billing' },
    { icon: Settings, label: 'Settings' },
  ];

  const STATS = [
    { label: 'Total Calls',  value: '4,217', delta: '+12%', up: true,  icon: PhoneCall },
    { label: 'Answered',     value: '3,841', delta: '91.1%', up: true,  icon: CheckCircle2 },
    { label: 'Callbacks',    value: '312',   delta: '+8%',  up: true,  icon: RefreshCw },
    { label: 'Failed',       value: '64',    delta: '−2%',  up: false, icon: AlertCircle },
  ];

  const CAMPAIGNS = [
    { n: 'EMI Reminder — October', p: 'Payment Reminder',     c: '1,200', prog: 68,  s: 'Active',    d: 'Oct 14' },
    { n: 'Clinic Oct Appointments', p: 'Appointment Reminder', c: '340',   prog: 100, s: 'Completed', d: 'Oct 12' },
    { n: 'Real Estate Site Visits', p: 'Lead Follow-up',       c: '580',   prog: 0,   s: 'Draft',     d: 'Oct 18' },
    { n: 'Gym Membership Renewals', p: 'Service Renewal',      c: '210',   prog: 45,  s: 'Active',    d: 'Oct 15' },
    { n: 'D2C COD Confirmations',   p: 'COD Confirmation',     c: '89',    prog: 100, s: 'Completed', d: 'Oct 11' },
  ];

  const STATUS_PILL: Record<string, string> = {
    Active:    'bg-blue-50 text-blue-700',
    Completed: 'bg-emerald-50 text-emerald-700',
    Draft:     'bg-slate-100 text-slate-600',
    Paused:    'bg-amber-50 text-amber-700',
  };

  export default function LandingDashboardPreview({ large = false }: { large?: boolean }) {
    return (
      <div
        className={
          'bg-white border border-line rounded-2xl shadow-preview overflow-hidden ' +
          (large ? 'w-full' : 'w-full')
        }
        data-testid="landing-dashboard-preview"
      >
        {/* Browser-frame chrome */}
        <div className="h-7 bg-canvas-alt border-b border-line flex items-center px-3 gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
          <div className="flex-1" />
          <div className="text-[10px] text-ink-subtle font-mono">app.receptify.in/dashboard</div>
          <div className="flex-1" />
        </div>

        <div className="flex">
          {/* Sidebar */}
          <aside className="bg-brand-navy w-[180px] hidden sm:flex flex-col py-3 px-2 shrink-0">
            <div className="px-2 pb-3 flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-brand-gradient grid place-items-center">
                <PhoneCall className="w-3 h-3 text-white" strokeWidth={2.5} />
              </div>
              <span className="logo-mark text-white text-[15px]">RECEPTIFY</span>
            </div>
            <nav className="space-y-0.5 mt-2">
              {NAV.map((n) => (
                <div
                  key={n.label}
                  className={
                    'flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[11px] font-medium ' +
                    (n.active ? 'bg-brand-900 text-white' : 'text-white/65')
                  }
                >
                  <n.icon className="w-3 h-3" />
                  {n.label}
                </div>
              ))}
            </nav>
            <div className="mt-auto pt-3 border-t border-white/10 flex items-center gap-2 px-2">
              <div className="w-6 h-6 rounded-full bg-brand-600 text-white grid place-items-center text-[10px] font-bold">RM</div>
              <div className="min-w-0">
                <div className="text-[11px] font-semibold text-white truncate">Rahul Mehta</div>
                <div className="text-[9px] text-white/55 truncate">Business Plan</div>
              </div>
            </div>
          </aside>

          {/* Main */}
          <div className="flex-1 min-w-0">
            {/* Top bar */}
            <div className="h-10 border-b border-line flex items-center justify-between px-4">
              <div className="text-[12px] font-semibold text-ink">Active Campaigns</div>
              <div className="flex items-center gap-2">
                <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-line w-32">
                  <Search className="w-3 h-3 text-ink-subtle" />
                  <span className="text-[10px] text-ink-subtle">Search…</span>
                </div>
                <Bell className="w-3.5 h-3.5 text-ink-subtle" />
                <div className="w-6 h-6 rounded-full bg-brand-50 text-brand-600 grid place-items-center text-[10px] font-bold">RM</div>
              </div>
            </div>

            {/* Stats */}
            <div className="px-4 pt-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                {STATS.map((s) => (
                  <div key={s.label} className="bg-white border border-line rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-semibold uppercase tracking-wider text-ink-subtle">{s.label}</span>
                      <div className="w-5 h-5 rounded-md bg-brand-50 grid place-items-center">
                        <s.icon className="w-2.5 h-2.5 text-brand-600" />
                      </div>
                    </div>
                    <div className="text-[20px] font-bold text-ink mt-1" style={{ letterSpacing: '-0.02em' }}>{s.value}</div>
                    <div className={'text-[10px] mt-0.5 ' + (s.up ? 'text-emerald-600' : 'text-red-600')}>
                      {s.up ? '↑' : '↓'} {s.delta} this week
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Campaign progress */}
            <div className="px-4 pt-3">
              <div className="bg-white border border-line rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-semibold text-ink">EMI Reminder — October Batch</div>
                    <div className="text-[10px] text-ink-subtle">1,200 contacts · Started 2 hours ago</div>
                  </div>
                  <span className="text-[10px] font-bold text-brand-600">68%</span>
                </div>
                <div className="mt-2 h-1.5 bg-line rounded-full overflow-hidden">
                  <div className="h-full bg-progress-fill" style={{ width: '68%' }} />
                </div>
                <div className="mt-2 flex items-center gap-1.5 text-[9px] font-semibold">
                  <span className="badge badge-completed">816 Done</span>
                  <span className="badge badge-warning">218 Pending</span>
                  <span className="badge badge-neutral">166 No Answer</span>
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="px-4 pt-3 pb-4">
              <div className="bg-white border border-line rounded-lg overflow-hidden">
                <table className="w-full text-[10px]">
                  <thead className="bg-canvas-alt border-b border-line">
                    <tr className="text-left text-ink-subtle">
                      {['Campaign', 'Purpose', 'Contacts', 'Progress', 'Status', 'Date', ''].map((h) => (
                        <th key={h} className="px-3 py-2 font-semibold uppercase tracking-wider text-[9px]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-subtle">
                    {CAMPAIGNS.map((c, i) => (
                      <tr key={i} className="hover:bg-canvas-alt">
                        <td className="px-3 py-2 font-semibold text-ink">{c.n}</td>
                        <td className="px-3 py-2 text-ink-muted">{c.p}</td>
                        <td className="px-3 py-2 text-ink mono">{c.c}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1.5">
                            <div className="w-12 h-1 bg-line rounded-full overflow-hidden">
                              <div className="h-full bg-progress-fill" style={{ width: `${c.prog}%` }} />
                            </div>
                            <span className="text-[9px] text-ink-muted">{c.prog}%</span>
                          </div>
                        </td>
                        <td className="px-3 py-2"><span className={'badge ' + STATUS_PILL[c.s]}>{c.s}</span></td>
                        <td className="px-3 py-2 text-ink-subtle">{c.d}</td>
                        <td className="px-3 py-2 text-ink-subtle"><MoreHorizontal className="w-3 h-3" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

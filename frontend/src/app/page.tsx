import Link from 'next/link';
import {
  PhoneCall, Sparkles, Upload, Calendar, BarChart3, Megaphone, ShieldCheck,
  Landmark, HeartPulse, Home, Dumbbell, ShoppingBag, GraduationCap, Wrench,
  CheckCircle2, ArrowRight, Mic, FileSpreadsheet, Languages, FileText, ChevronDown,
  Wallet, RefreshCw, Bell, MessageSquareHeart, PackageCheck,
  Clock, TrendingDown, UserX, Play, Star, Bot, Tag, BarChart, Headphones,
  CalendarClock, ArrowUpRight, LayoutDashboard, History, FileStack, Search,
} from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import LandingDashboardPreview from '@/components/landing/DashboardPreview';

const NAV = [
  { label: 'Features', href: '#features' },
  { label: 'Use Cases', href: '#use-cases' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Compliance', href: '#compliance' },
];

export default function LandingPage() {
  return (
    <main className="bg-marketing min-h-screen" data-testid="landing-page">
      {/* NAVBAR */}
      <header className="sticky top-0 z-50 bg-white border-b border-line">
        <div className="container-max flex items-center justify-between px-6 h-16">
          <Link href="/" aria-label="Receptify home"><Logo /></Link>
          <nav className="hidden md:flex items-center gap-8">
            {NAV.map((l) => (
              <a key={l.href} href={l.href} className="text-sm font-medium text-ink-muted hover:text-ink transition-colors" data-testid={`nav-link-${l.label.toLowerCase().replace(/\s/g, '-')}`}>
                {l.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-1.5">
            <Link href="/login" className="btn-ghost" data-testid="nav-login">Log in</Link>
            <Link href="/signup" className="btn-primary" data-testid="nav-signup">Start Free Trial</Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="bg-hero relative overflow-hidden">
        <div className="container-max px-6 pt-24 pb-20 lg:pt-28 lg:pb-24 grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
          <div className="lg:col-span-6 animate-reveal">
            <span className="eyebrow-pill" data-testid="hero-eyebrow">
              <PhoneCall className="w-3 h-3" />
              AI Calling Platform for Indian Businesses
            </span>
            <h1 className="h1-hero mt-5">
              Your customers <br className="hidden sm:block" />
              called. Every time.
            </h1>
            <p className="mt-5 text-[17px] leading-[1.65] text-ink-muted max-w-[460px]">
              Upload your customer list, generate a script, and let Receptify&apos;s AI voice agent handle the calls — with every outcome tracked in real time.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/signup" className="btn-primary" data-testid="hero-cta-primary">
                Start Free Trial <ArrowRight className="w-4 h-4" />
              </Link>
              <a href="#dashboard-preview" className="btn-secondary" data-testid="hero-cta-secondary">
                <Play className="w-3.5 h-3.5" /> Watch 2-min Demo
              </a>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] font-medium text-ink-muted">
              {['No credit card needed', 'Hindi & English', 'DND-aware'].map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> {t}
                </span>
              ))}
            </div>
          </div>

          {/* Hero visual */}
          <div className="lg:col-span-6 relative" data-testid="hero-visual">
            <LandingDashboardPreview />
            {/* Floating glass chips */}
            <div className="hidden md:block absolute -top-2 -right-3 glass-chip px-4 py-2.5 animate-float-chip" style={{ animationDelay: '0s' }}>
              <div className="text-[10px] uppercase font-semibold text-ink-subtle tracking-wider">Calls made</div>
              <div className="text-base font-bold text-ink mt-0.5">4,217</div>
            </div>
            <div className="hidden md:flex absolute top-1/2 -right-4 glass-chip items-center gap-2 px-3.5 py-2 animate-float-chip" style={{ animationDelay: '0.8s' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-xs font-semibold text-ink">94% answered</span>
            </div>
            <div className="hidden md:block absolute -bottom-3 left-4 glass-chip px-4 py-2.5 animate-float-chip" style={{ animationDelay: '1.6s' }}>
              <div className="text-[10px] uppercase font-semibold text-ink-subtle tracking-wider">Cost / call</div>
              <div className="text-base font-bold text-ink mt-0.5">₹2.80 <span className="text-xs font-medium text-ink-muted">avg</span></div>
            </div>
          </div>
        </div>
      </section>

      {/* TRUST STRIP */}
      <section className="bg-canvas-alt border-y border-line">
        <div className="container-max px-6 py-5 flex flex-wrap items-center justify-center gap-x-1 gap-y-2 text-[13px] font-medium text-ink-muted">
          {['DND-Aware Calling', 'Hindi & English Voice', 'CSV Upload in Seconds', 'No Cold Spam', 'Built for Indian Businesses'].map((item, i, arr) => (
            <span key={item} className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-brand-600" />
              <span>{item}</span>
              {i < arr.length - 1 && <span className="mx-3 text-brand-100">·</span>}
            </span>
          ))}
        </div>
      </section>

      {/* PROBLEM */}
      <section className="section-padding">
        <div className="container-max">
          <div className="max-w-2xl">
            <span className="overline">The problem</span>
            <h2 className="h2-section mt-3">Manual calling is costing you customers.</h2>
            <p className="mt-4 text-[17px] leading-[1.65] text-ink-muted">
              Your team can only call so many people per day. Leads go cold. Reminders are missed. Follow-ups never happen.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-12">
            {[
              { icon: Clock, stat: '6+ hrs', label: 'spent daily on manual follow-up calls by an average sales team.' },
              { icon: TrendingDown, stat: '40%', label: 'drop in conversion when leads are not called back within an hour.' },
              { icon: UserX, stat: '3×', label: 'higher payment default rates when reminders are sent late or missed.' },
            ].map((c, i) => (
              <div key={i} className="bg-white border border-line rounded-2xl p-7 shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200">
                <div className="w-11 h-11 rounded-xl bg-brand-50 grid place-items-center">
                  <c.icon className="w-5 h-5 text-brand-600" />
                </div>
                <div className="text-[32px] font-bold text-brand-600 mt-5" style={{ letterSpacing: '-0.02em' }}>{c.stat}</div>
                <p className="text-sm text-ink-muted mt-2 leading-relaxed">{c.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SOLUTION / HOW IT WORKS */}
      <section id="how-it-works" className="section-padding bg-canvas-alt border-y border-line">
        <div className="container-max">
          <div className="max-w-2xl">
            <span className="overline">The solution</span>
            <h2 className="h2-section mt-3">AI calls your customers, so your team doesn&apos;t have to.</h2>
            <p className="mt-4 text-[17px] leading-[1.65] text-ink-muted">
              Upload your customer list, pick a purpose, generate a polite script, and let Receptify handle the calls — with every outcome tracked.
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 md:grid-cols-5 gap-3 md:gap-2 relative">
            {[
              { icon: Upload, t: 'Upload list', d: 'CSV or manual entry.' },
              { icon: Tag, t: 'Pick purpose', d: 'Reminder, follow-up, renewal.' },
              { icon: Sparkles, t: 'Generate script', d: 'AI-written, multilingual.' },
              { icon: CalendarClock, t: 'Schedule & launch', d: 'Choose window + retries.' },
              { icon: BarChart3, t: 'Track outcomes', d: 'Recordings + transcripts.' },
            ].map((s, i, arr) => (
              <div key={i} className="relative flex flex-col items-start md:items-center text-left md:text-center">
                <div className="flex items-center gap-3 md:flex-col md:gap-3 w-full">
                  <div className="w-8 h-8 rounded-full bg-brand-600 text-white grid place-items-center font-bold text-sm shrink-0">{i + 1}</div>
                  <s.icon className="w-5 h-5 text-brand-600 hidden md:block" />
                  <div className="md:mt-1">
                    <div className="font-semibold text-ink text-[15px]">{s.t}</div>
                    <div className="text-[13px] text-ink-muted mt-0.5">{s.d}</div>
                  </div>
                </div>
                {i < arr.length - 1 && (
                  <div className="hidden md:block absolute top-4 left-[60%] w-[80%] border-t border-dashed border-brand-100" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DASHBOARD PREVIEW (centerpiece) */}
      <section id="dashboard-preview" className="section-padding">
        <div className="container-max">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="overline">Dashboard</span>
            <h2 className="h2-section mt-3">Track every call. Know every outcome.</h2>
            <p className="mt-4 text-[17px] leading-[1.65] text-ink-muted">
              Real-time dashboards. Call recordings. AI summaries. Outcome tagging — built into one clean workspace.
            </p>
          </div>
          <div className="relative max-w-[1100px] mx-auto">
            <LandingDashboardPreview large />
          </div>
        </div>
      </section>

      {/* USE CASES */}
      <section id="use-cases" className="section-padding bg-canvas-alt border-y border-line">
        <div className="container-max">
          <div className="max-w-2xl">
            <span className="overline">Use cases</span>
            <h2 className="h2-section mt-3">Every customer touchpoint, automated.</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-12">
            {[
              { icon: Wallet, t: 'Payment Reminders', d: 'Reduce overdues with polite EMI & invoice nudges.' },
              { icon: Calendar, t: 'Appointment Reminders', d: 'Confirm bookings, reduce no-shows.' },
              { icon: MessageSquareHeart, t: 'Lead Follow-ups', d: 'Re-engage warm enquiries automatically.' },
              { icon: Bell, t: 'Feedback Calls', d: 'Capture customer feedback at scale.' },
              { icon: PackageCheck, t: 'COD Confirmations', d: 'Confirm orders before dispatch.' },
              { icon: RefreshCw, t: 'Service Renewals', d: 'Polite, timely renewal nudges.' },
              { icon: CalendarClock, t: 'Event Reminders', d: 'A day-before nudge for attendees.' },
              { icon: RefreshCw, t: 'Customer Reactivation', d: 'Win back inactive customers.' },
              { icon: RefreshCw, t: 'Subscription Renewals', d: 'Renew memberships on time.' },
            ].map((c, i) => (
              <div key={i} className="bg-white border border-line rounded-xl p-5 hover:border-brand-600 hover:shadow-card-hover transition-all duration-200">
                <c.icon className="w-5 h-5 text-brand-600" />
                <h3 className="font-semibold text-ink text-[15px] mt-2.5">{c.t}</h3>
                <p className="text-[13px] text-ink-muted mt-1 leading-relaxed">{c.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* INDUSTRIES */}
      <section className="section-padding">
        <div className="container-max">
          <div className="max-w-2xl">
            <span className="overline">Industries</span>
            <h2 className="h2-section mt-3">Built for the businesses that run India.</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-12">
            {[
              { icon: Landmark, t: 'NBFCs & Finance', d: 'EMI reminders, collections nudges, KYC follow-ups.' },
              { icon: HeartPulse, t: 'Clinics & Labs', d: 'Appointment confirmations, report-ready alerts.' },
              { icon: Home, t: 'Real Estate', d: 'Lead follow-ups, site visit reminders.' },
              { icon: GraduationCap, t: 'Coaching & EdTech', d: 'Admission follow-ups, batch reminders.' },
              { icon: Dumbbell, t: 'Gyms & Fitness', d: 'Membership renewals, class reminders.' },
              { icon: ShoppingBag, t: 'D2C Brands', d: 'COD confirmations, abandoned cart calls.' },
            ].map((c, i) => (
              <div key={i} className="bg-canvas-alt border border-line rounded-2xl p-6 hover:bg-brand-50 transition-colors duration-200">
                <div className="w-10 h-10 rounded-xl bg-white border border-line grid place-items-center">
                  <c.icon className="w-5 h-5 text-brand-600" />
                </div>
                <h3 className="font-bold text-ink text-[15px] mt-4">{c.t}</h3>
                <p className="text-[13px] text-ink-muted mt-1 leading-relaxed">{c.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="section-padding bg-canvas-alt border-y border-line">
        <div className="container-max">
          <div className="max-w-2xl">
            <span className="overline">Features</span>
            <h2 className="h2-section mt-3">Everything you need to run professional call campaigns.</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-12 mt-14">
            {[
              { icon: FileSpreadsheet, t: 'CSV / Excel Upload', d: 'Bulk import with column mapping & phone validation.' },
              { icon: Sparkles, t: 'AI Script Generator', d: 'Polite, ready-to-use scripts in seconds.' },
              { icon: Languages, t: 'Hindi & English Voice', d: 'Multilingual scripts with India-native voices.' },
              { icon: CalendarClock, t: 'Campaign Scheduling', d: 'Pick date, time, calling window, retries.' },
              { icon: BarChart, t: 'Real-time Call Tracking', d: 'Live progress dashboard for every campaign.' },
              { icon: Mic, t: 'Call Recordings', d: 'Listen to every call and search by outcome.' },
              { icon: Tag, t: 'Outcome Tagging', d: 'Auto-classified outcomes for clean reporting.' },
              { icon: BarChart3, t: 'Analytics Dashboard', d: 'Answer rate, conversion, cost per outcome.' },
            ].map((f, i) => (
              <div key={i}>
                <div className="w-11 h-11 rounded-xl bg-brand-50 grid place-items-center">
                  <f.icon className="w-5 h-5 text-brand-600" />
                </div>
                <h3 className="font-bold text-ink text-[15px] mt-4">{f.t}</h3>
                <p className="text-[13px] text-ink-muted mt-1.5 leading-relaxed">{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COMPLIANCE */}
      <section id="compliance" className="section-padding">
        <div className="container-max">
          <div className="max-w-2xl">
            <span className="overline">Compliance</span>
            <h2 className="h2-section mt-3">Designed to support responsible customer communication.</h2>
            <p className="mt-4 text-[17px] leading-[1.65] text-ink-muted">
              Receptify includes built-in guardrails for consent-based calling, DND awareness, and calling-hour controls. We recommend consulting your telecom or legal advisor for full regulatory compliance.
            </p>
          </div>
          <div className="mt-8 flex flex-wrap gap-2">
            {['DND-Aware', 'Consent-Based', 'Time Controls', 'Audit Logs'].map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-brand-50 border border-brand-100 text-brand-700 text-[13px] font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" /> {t}
              </span>
            ))}
          </div>
          <p className="mt-6 text-xs text-ink-subtle max-w-2xl">
            Compliance features do not constitute legal advice. Always verify with your telecom provider for your specific use case (TRAI, DLT registration, industry rules).
          </p>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="section-padding bg-canvas-alt border-y border-line">
        <div className="container-max">
          <div className="max-w-2xl mb-12">
            <span className="overline">From our customers</span>
            <h2 className="h2-section mt-3">SMEs across India trust Receptify.</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              { q: 'Our EMI reminder calls used to take 4 days for 2,000 customers. Now it takes 90 minutes. The polite Hindi script our customers actually respond to.', n: 'Rahul Mehta', r: 'Collections Head, Mehta Finance · Pune' },
              { q: 'I save almost ₹40,000/month on call agents and our appointment no-shows dropped from 22% to 7%. Setup took 15 minutes.', n: 'Dr. Priya Iyer', r: 'Director, Iyer Diagnostics · Bengaluru' },
              { q: 'We confirm 300+ COD orders a day before dispatch. Receptify cut our RTO by 30%. The dashboard is genuinely useful, not decorative.', n: 'Aditya Kapoor', r: 'Founder, Kraftly D2C · Mumbai' },
            ].map((t, i) => (
              <div key={i} className="bg-white border border-line rounded-2xl p-7 shadow-card">
                <div className="flex gap-0.5 mb-3">
                  {Array.from({ length: 5 }).map((_, j) => <Star key={j} className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />)}
                </div>
                <p className="text-[15px] text-ink italic leading-relaxed">&ldquo;{t.q}&rdquo;</p>
                <div className="mt-5 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-brand-50 text-brand-600 grid place-items-center text-sm font-bold">{t.n.split(' ').map(x => x[0]).join('').slice(0, 2)}</div>
                  <div>
                    <div className="text-sm font-semibold text-ink">{t.n}</div>
                    <div className="text-xs text-ink-subtle">{t.r}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="section-padding">
        <div className="container-max">
          <div className="text-center max-w-xl mx-auto mb-12">
            <span className="overline">Pricing</span>
            <h2 className="h2-section mt-3">Simple, transparent pricing.</h2>
            <p className="mt-4 text-[17px] leading-[1.65] text-ink-muted">Start free. Upgrade when you grow. Cancel anytime.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-5xl mx-auto">
            {[
              { name: 'Starter', price: '₹999', calls: 250, sub: 'For small teams trying AI calls', features: ['AI script generator', 'CSV / Excel upload', 'Call dashboard', 'Email support'], featured: false },
              { name: 'Growth', price: '₹4,999', calls: 2000, sub: 'For growing businesses with regular calling', features: ['Everything in Starter', 'Recordings + transcripts', 'Multilingual voices', 'Priority email support'], featured: true },
              { name: 'Business', price: '₹19,999', calls: 10000, sub: 'For high-volume calling teams', features: ['Everything in Growth', 'Team members', 'Advanced analytics', 'Priority phone support'], featured: false },
            ].map((p) => (
              <div
                key={p.name}
                className={
                  p.featured
                    ? 'bg-brand-navy text-white border border-brand-900 rounded-2xl p-9 relative'
                    : 'bg-white border border-line rounded-2xl p-9 relative shadow-card'
                }
                data-testid={`pricing-${p.name.toLowerCase()}`}
              >
                {p.featured && (
                  <span className="absolute top-5 right-5 bg-brand-50 text-brand-600 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded">Most Popular</span>
                )}
                <h3 className={p.featured ? 'text-xl font-bold' : 'text-xl font-bold text-ink'}>{p.name}</h3>
                <p className={p.featured ? 'text-sm text-white/70 mt-1.5' : 'text-sm text-ink-muted mt-1.5'}>{p.sub}</p>
                <div className="mt-7 flex items-baseline gap-1.5">
                  <span className={p.featured ? 'text-[40px] font-bold leading-none' : 'text-[40px] font-bold leading-none text-ink'} style={{ letterSpacing: '-0.02em' }}>{p.price}</span>
                  <span className={p.featured ? 'text-sm text-white/60' : 'text-sm text-ink-subtle'}>/ month</span>
                </div>
                <div className={p.featured ? 'mt-1 text-sm font-semibold text-brand-100' : 'mt-1 text-sm font-semibold text-brand-600'}>
                  {p.calls.toLocaleString()} call credits / month
                </div>
                <ul className={p.featured ? 'mt-7 space-y-3 text-sm text-white/85' : 'mt-7 space-y-3 text-sm text-ink-muted'}>
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <CheckCircle2 className={p.featured ? 'w-4 h-4 mt-0.5 shrink-0 text-emerald-400' : 'w-4 h-4 mt-0.5 shrink-0 text-emerald-600'} />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/signup"
                  className={p.featured ? 'mt-8 w-full bg-white text-brand-navy text-sm font-semibold px-5 py-2.5 rounded-lg inline-flex items-center justify-center gap-2 hover:bg-brand-50 transition-colors' : 'btn-primary w-full mt-8'}
                  data-testid={`pricing-cta-${p.name.toLowerCase()}`}
                >
                  {p.name === 'Business' ? 'Contact Sales' : 'Start Free Trial'} <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="section-padding bg-canvas-alt border-y border-line">
        <div className="container-max max-w-3xl">
          <div className="text-center mb-12">
            <span className="overline">FAQ</span>
            <h2 className="h2-section mt-3">Common questions.</h2>
          </div>
          <div className="bg-white border border-line rounded-2xl overflow-hidden divide-y divide-line">
            {[
              { q: 'Is Receptify legal in India?', a: 'Receptify is built to support responsible business-to-customer communication such as appointment reminders, payment follow-ups, and service renewals. Promotional or cold outreach campaigns must follow TRAI and DLT registration requirements. We recommend consulting a telecom compliance advisor for your specific use case.' },
              { q: 'Can I upload customers using Excel?', a: 'Yes. Upload a CSV or Excel file, map your columns, validate phone numbers, and confirm import — all in one guided flow with duplicate detection.' },
              { q: 'Can I customize the call script?', a: 'Absolutely. Generate an AI script, edit it, choose tone and language, and save it as a template for future campaigns.' },
              { q: 'Does it work for payment reminders?', a: 'Yes — payment, EMI, invoice and renewal reminders are core use cases. Use the polite tone templates designed specifically for them.' },
              { q: 'Can I see call recordings and transcripts?', a: 'Yes. Every completed call gets a recording, a transcript, and an AI summary with the recommended next action.' },
              { q: 'Who answers if the customer wants to speak to a person?', a: 'You can configure the AI agent to capture a callback request, transfer to your phone number, or send a WhatsApp/SMS follow-up automatically.' },
              { q: 'What languages are supported?', a: 'Today: Hindi, English, and Gujarati. More Indian languages are on the roadmap.' },
              { q: 'Is this for cold calling?', a: 'No — Receptify is designed for legitimate customer communication only. Cold spam calling is not supported.' },
            ].map((f, i) => (
              <details key={i} className="group" data-testid={`faq-${i}`}>
                <summary className="flex items-center justify-between cursor-pointer list-none px-6 py-5 hover:bg-canvas-alt transition-colors">
                  <span className="text-[15px] font-semibold text-ink">{f.q}</span>
                  <ChevronDown className="w-4 h-4 text-ink-subtle group-open:rotate-180 transition-transform" />
                </summary>
                <p className="px-6 pb-5 -mt-1 text-sm text-ink-muted leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="bg-brand-navy text-white relative overflow-hidden">
        <div className="absolute inset-0 dotgrid opacity-100" aria-hidden />
        <div className="container-max px-6 py-24 lg:py-28 relative text-center max-w-[600px] mx-auto">
          <h2 className="font-bold text-white" style={{ fontSize: 'clamp(28px, 4.4vw, 40px)', lineHeight: 1.15, letterSpacing: '-0.02em' }}>
            Start your first AI call campaign today.
          </h2>
          <p className="mt-5 text-base text-white/65 leading-relaxed">
            Free for your first 50 calls. No credit card. Set up in under 10 minutes.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Link href="/signup" className="btn-primary" data-testid="final-cta-signup">
              Start Free Trial <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/login" className="btn-dark-ghost" data-testid="final-cta-login">
              Talk to Sales
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-brand-navy text-white border-t border-white/10">
        <div className="container-max px-6 py-14 grid grid-cols-2 md:grid-cols-5 gap-8">
          <div className="col-span-2 md:col-span-2">
            <Logo variant="white" />
            <p className="text-sm text-white/55 mt-4 max-w-xs leading-relaxed">
              AI Voice Receptionist. Answer Every Call. Built in India, for Indian businesses.
            </p>
          </div>
          {[
            { h: 'Product', l: [['Features', '#features'], ['Use Cases', '#use-cases'], ['Pricing', '#pricing'], ['Dashboard', '#dashboard-preview']] },
            { h: 'Industries', l: [['NBFCs', '#'], ['Clinics', '#'], ['Real Estate', '#'], ['D2C Brands', '#']] },
            { h: 'Resources', l: [['Help Center', '/help'], ['Compliance', '#compliance'], ['FAQ', '#faq']] },
          ].map((col) => (
            <div key={col.h}>
              <div className="text-[11px] font-bold uppercase tracking-wider text-white/40">{col.h}</div>
              <ul className="mt-4 space-y-2.5">
                {col.l.map(([label, href]) => (
                  <li key={label}><a href={href} className="text-sm text-white/75 hover:text-white">{label}</a></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-white/10">
          <div className="container-max px-6 py-5 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-white/40">
            <span>© 2026 Receptify · All rights reserved.</span>
            <div className="flex gap-5">
              <a href="#" className="hover:text-white/80">Privacy</a>
              <a href="#" className="hover:text-white/80">Terms</a>
              <a href="#compliance" className="hover:text-white/80">Compliance</a>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}

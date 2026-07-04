'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import {
  PhoneCall, Sparkles, Upload, Calendar, BarChart3, Megaphone, ShieldCheck,
  CheckCircle2, ArrowRight, Mic, FileSpreadsheet, Languages, FileText, ChevronDown,
  Wallet, RefreshCw, Bell, MessageSquareHeart, PackageCheck, Play, Pause,
  Clock, TrendingDown, UserX, Star, Tag, BarChart, CalendarClock, Zap, Volume2, ShieldAlert
} from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import LandingDashboardPreview from '@/components/landing/DashboardPreview';
import { Badge } from '@/components/ui/badge';

/* ========================================================================= */
/* CSS Animation & Custom Theme Classes Injection                            */
/* ========================================================================= */

const CSS_INJECTIONS = `
  @keyframes slide-up {
    from { opacity: 0; transform: translateY(24px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes marquee {
    0% { transform: translateX(0); }
    100% { transform: translateX(-50%); }
  }
  @keyframes equal-bar {
    0%, 100% { height: 4px; }
    50% { height: 20px; }
  }
  .animate-slide-up {
    animation: slide-up 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }
  .animate-marquee-slow {
    animation: marquee 50s linear infinite;
  }
  .animate-marquee-fast {
    animation: marquee 30s linear infinite;
  }
  .equal-bar {
    animation: equal-bar 1.2s ease-in-out infinite;
  }
`;

const NAV = [
  { label: 'Features', href: '#features' },
  { label: 'Use Cases', href: '#use-cases' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Compliance', href: '#compliance' },
];

const INDUSTRIES = [
  { label: 'EMI & Collections', icon: Wallet },
  { label: 'Clinics & Healthcare', icon: Calendar },
  { label: 'Real Estate Leads', icon: MessageSquareHeart },
  { label: 'Gyms & Memberships', icon: RefreshCw },
  { label: 'D2C COD Confirmations', icon: PackageCheck },
  { label: 'Subscription Renewals', icon: Zap },
];

const TICKER_ITEMS = [
  { status: 'success', text: '✓ EMI reminder answered · Surat · 12s ago' },
  { status: 'pending', text: '↻ Callback scheduled · Pune · 34s ago' },
  { status: 'success', text: '✓ Appointment confirmed · Bengaluru · 1m ago' },
  { status: 'failed', text: '✗ Busy, retry queued · Delhi · 2m ago' },
  { status: 'success', text: '✓ COD order confirmed · Jaipur · 3m ago' },
  { status: 'success', text: '✓ Membership renewal agreed · Hyderabad · 4m ago' },
];

/* ========================================================================= */
/* Live Call Outcome Ticker Component (Signature Brand Motif)                */
/* ========================================================================= */

function LiveCallTicker() {
  return (
    <div className="w-full bg-white border-y border-[#E7E4DC] py-2.5 overflow-hidden select-none relative z-20">
      <div className="flex whitespace-nowrap gap-16 animate-marquee-slow hover:[animation-play-state:paused]">
        {/* Render multiple times for continuous looping banner */}
        {Array.from({ length: 6 }).flatMap(() => TICKER_ITEMS).map((item, idx) => (
          <div key={idx} className="flex items-center gap-2.5 text-xs font-mono text-[#64748B]">
            <span className={`w-2 h-2 rounded-full ${item.status === 'success' ? 'bg-[#21C17C] shadow-sm shadow-[#21C17C]/20' : item.status === 'failed' ? 'bg-red-500' : 'bg-amber-500'}`} />
            <span>{item.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ========================================================================= */
/* Spotlight Card Element (Mouse Cursor Spotlight Tracking)                   */
/* ========================================================================= */

function SpotlightCard({ children, className }: { children: React.ReactNode; className?: string }) {
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const [hovered, setHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setCoords({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        "relative overflow-hidden bg-white border border-[#E7E4DC] rounded-2xl p-7 group transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 hover:border-[#2F5CFF]",
        className
      )}
    >
      {hovered && (
        <div
          className="absolute pointer-events-none rounded-full blur-[70px] bg-[#2F5CFF]/8 w-[180px] h-[180px] transition-opacity duration-300"
          style={{
            left: `${coords.x - 90}px`,
            top: `${coords.y - 90}px`,
          }}
        />
      )}
      <div className="relative z-10">{children}</div>
    </div>
  );
}

/* ========================================================================= */
/* Auto Count-up Numerical Statistics                                        */
/* ========================================================================= */

function Counter({ value, suffix = '', duration = 1500 }: { value: number; suffix?: string; duration?: number }) {
  const [count, setCount] = useState(0);
  const elementRef = useRef<HTMLSpanElement>(null);
  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !hasStarted) {
        setHasStarted(true);
        let start = 0;
        const end = value;
        const totalSteps = 40;
        const stepTime = duration / totalSteps;
        const increment = Math.ceil(end / totalSteps);

        const timer = setInterval(() => {
          start += increment;
          if (start >= end) {
            setCount(end);
            clearInterval(timer);
          } else {
            setCount(start);
          }
        }, stepTime);
      }
    }, { threshold: 0.1 });

    const current = elementRef.current;
    if (current) observer.observe(current);
    return () => {
      if (current) observer.unobserve(current);
    };
  }, [value, duration, hasStarted]);

  return <span ref={elementRef} className="font-mono">{count.toLocaleString()}{suffix}</span>;
}

/* ========================================================================= */
/* Helper Functions                                                          */
/* ========================================================================= */

function cn(...classes: (string | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

/* ========================================================================= */
/* MAIN LANDING PAGE COMPONENT                                               */
/* ========================================================================= */

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  
  // Audio state
  const [isPlaying, setIsPlaying] = useState(false);
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);
  
  // Interactive Tilt State
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  // 3Pricing state
  const [isAnnual, setIsAnnual] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5; // -0.5 to 0.5
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: x * 6, y: y * -6 }); // subtle 6 degrees max tilt
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
  };

  const togglePlayAudio = () => {
    if (isPlaying) {
      audio?.pause();
      setIsPlaying(false);
    } else {
      const activeAudio = audio || new Audio('/audio/sample-recording.wav');
      if (!audio) setAudio(activeAudio);
      activeAudio.play();
      setIsPlaying(true);
      activeAudio.onended = () => setIsPlaying(false);
    }
  };

  useEffect(() => {
    return () => {
      if (audio) {
        audio.pause();
      }
    };
  }, [audio]);

  return (
    <main className="bg-[#FBFAF7] text-[#14171F] min-h-screen relative selection:bg-brand-100 selection:text-brand-700 overflow-x-hidden">
      
      {/* Self-contained style block for custom premium keyframes */}
      <style>{CSS_INJECTIONS}</style>

      {/* ========================================================================= */}
      {/* A. NAV BAR                                                                */}
      {/* ========================================================================= */}
      <header className={`sticky top-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white/80 backdrop-blur-md border-b border-[#E7E4DC] py-3.5 shadow-sm shadow-brand-900/[0.01]' : 'bg-transparent py-5'}`}>
        <div className="max-w-[1180px] mx-auto flex items-center justify-between px-6">
          <Link href="/" className="inline-block hover:opacity-90 transition-opacity">
            <Logo />
          </Link>
          <nav className="hidden md:flex items-center gap-8">
            {NAV.map((l) => (
              <a 
                key={l.href} 
                href={l.href} 
                className="text-xs font-semibold text-[#64748B] hover:text-[#14171F] uppercase tracking-wider transition-colors"
              >
                {l.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2.5">
            <Link href="/login" className="px-4 py-2 text-xs font-bold text-[#14171F] hover:text-[#2F5CFF] uppercase tracking-wider transition-colors" data-testid="nav-login">
              Log in
            </Link>
            <Link href="/signup" className="px-5 py-2.5 bg-[#2F5CFF] hover:bg-[#1D4ED8] hover:-translate-y-0.5 active:translate-y-0 text-white text-xs font-bold uppercase tracking-wider rounded-lg shadow-sm shadow-[#2F5CFF]/15 transition-all" data-testid="nav-signup">
              Book a demo
            </Link>
          </div>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* B. HERO SECTION                                                           */}
      {/* ========================================================================= */}
      <section className="relative pt-12 pb-20 lg:pt-16 lg:pb-28">
        
        {/* Subtle background ambient glowing blue mesh (Stripe style) */}
        <div className="absolute w-[600px] h-[600px] bg-[#2F5CFF]/[0.05] rounded-full blur-[100px] -top-20 -right-40 pointer-events-none z-0" />
        
        <div className="max-w-[1180px] mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-16 items-center relative z-10">
          
          {/* Hero Copy (Left side) */}
          <div className="lg:col-span-6 space-y-6">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#2F5CFF]/5 border border-[#2F5CFF]/10 text-[10px] font-bold text-[#2F5CFF] uppercase tracking-widest">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#21C17C]"></span>
              </span>
              AI Calling Platform for Indian SMBs
            </span>
            
            <h1 className="text-4xl sm:text-5xl font-extrabold text-[#0B1220] tracking-tight leading-[1.08] lg:max-w-xl">
              Every EMI reminder. Every no-show follow-up. Answered — automatically.
            </h1>
            
            <p className="text-sm sm:text-base leading-relaxed text-[#64748B] max-w-[480px]">
              Stop calling customers by hand. Upload your contacts, pick a custom script, and launch automated call campaigns that achieve a 91% answer rate in clear, professional English.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link href="/signup" className="px-6 py-3.5 bg-[#2F5CFF] hover:bg-[#1D4ED8] hover:-translate-y-0.5 active:translate-y-0 text-white text-xs font-bold uppercase tracking-widest rounded-lg shadow-md shadow-[#2F5CFF]/15 transition-all">
                Start free trial
              </Link>
              
              {/* Interactive Audio Player CTA */}
              <button 
                onClick={togglePlayAudio}
                className="px-5 py-3.5 bg-white border border-[#E7E4DC] text-xs font-bold text-[#14171F] uppercase tracking-widest rounded-lg shadow-sm hover:bg-slate-50 active:translate-y-px transition-all inline-flex items-center gap-2"
              >
                {isPlaying ? (
                  <>
                    <Pause className="w-4 h-4 text-[#2F5CFF]" />
                    Pause voice call
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 text-[#2F5CFF] fill-[#2F5CFF]" />
                    See a live call →
                  </>
                )}
              </button>
            </div>

            {/* Audio Wave / Transcript Box - dynamically shows when voice call is active */}
            {isPlaying && (
              <div className="p-4 rounded-xl border border-[#2F5CFF]/20 bg-[#2F5CFF]/[0.02] space-y-3 animate-slide-up max-w-[480px]">
                <div className="flex items-center gap-3">
                  <Volume2 className="w-4 h-4 text-[#2F5CFF] animate-pulse" />
                  <span className="text-[10px] font-mono text-[#2F5CFF] uppercase tracking-wider">Demo Voice Broadcast in Progress…</span>
                  <div className="flex items-end gap-0.5 h-4 ml-auto">
                    {[6, 12, 18, 8, 14, 5, 16, 9].map((h, i) => (
                      <span key={i} className="w-0.5 bg-[#2F5CFF] rounded-full equal-bar" style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                </div>
                <div className="text-xs font-mono text-[#14171F] bg-white border border-[#E7E4DC] rounded-lg p-3 leading-relaxed shadow-sm">
                  <p className="text-slate-400 text-[10px] mb-1">SCRIPT TRANSCRIPT (ENGLISH):</p>
                  <span className="text-[#2F5CFF]">"Hello, this is Receptify calling. This is a courtesy reminder regarding your upcoming payment..."</span>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] font-bold text-[#64748B] uppercase tracking-wider pt-4 border-t border-[#E7E4DC]/60 max-w-[480px]">
              {['No credit card needed', 'English voice support', 'Time-window smart'].map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-[#21C17C]" /> {t}
                </span>
              ))}
            </div>
          </div>

          {/* Hero Visual (Right side with Parallax Tilt) */}
          <div 
            className="lg:col-span-6 w-full cursor-pointer relative"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={{
              transform: `perspective(1000px) rotateX(${tilt.y}deg) rotateY(${tilt.x}deg)`,
              transition: 'transform 0.15s ease-out'
            }}
          >
            {/* Background blue light bloom */}
            <div className="absolute w-[400px] h-[400px] bg-[#2F5CFF]/10 rounded-full blur-[80px] -top-10 -left-10 pointer-events-none" />
            
            <LandingDashboardPreview />
          </div>

        </div>

      </section>

      {/* Signature Strip element */}
      <LiveCallTicker />

      {/* ========================================================================= */}
      {/* C. TRUST / LOGO STRIP                                                     */}
      {/* ========================================================================= */}
      <section className="bg-[#FBFAF7] py-12 border-b border-[#E7E4DC]">
        <div className="max-w-[1180px] mx-auto px-6 text-center">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#64748B] mb-8">
            Trusted by teams handling 50,000+ monthly automated calls across sectors
          </p>
          
          <div className="w-full overflow-hidden select-none relative">
            <div className="flex whitespace-nowrap gap-16 animate-marquee-fast hover:[animation-play-state:paused]">
              {Array.from({ length: 4 }).flatMap(() => INDUSTRIES).map((ind, idx) => (
                <div key={idx} className="flex items-center gap-3 text-sm font-bold text-[#0B1220]/45">
                  <ind.icon className="w-4 h-4 text-[#2F5CFF]/50" />
                  <span>{ind.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* D. PROBLEM / SOLUTION BAND (Dark Section)                                 */}
      {/* ========================================================================= */}
      <section className="bg-[#0B1220] text-white py-24 border-y border-[#1E3A8A]">
        <div className="max-w-[1180px] mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
            
            <div className="lg:col-span-5 space-y-5">
              <span className="text-[10px] font-bold text-[#2F5CFF] uppercase tracking-widest block">The Scaling Bottleneck</span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
                Manual calling is slowing down your growth.
              </h2>
              <p className="text-sm text-slate-400 leading-relaxed">
                Your team can only place a limited amount of calls a day. Customers block unknown mobile numbers, while follow-ups and payment reminders slip through the cracks.
              </p>
            </div>

            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-6">
              {[
                { label: 'ANSWER RATE', value: 91, suffix: '%', desc: 'Achieved through localized accents & smart retries.' },
                { label: 'CALLS PER MINUTE', value: 350, suffix: '+', desc: 'Symmetric queue handling scaling on demand.' },
                { label: 'RTO DEFAULT REDUCTION', value: 30, suffix: '%', desc: 'RTO losses mitigated on COD shipping confirmations.' }
              ].map((stat, idx) => (
                <div key={idx} className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 shadow-lg shadow-black/20">
                  <div className="text-[10px] font-mono text-slate-400 tracking-wider uppercase">{stat.label}</div>
                  <div className="text-4xl font-extrabold text-white mt-4 tracking-tight">
                    <Counter value={stat.value} suffix={stat.suffix} />
                  </div>
                  <p className="text-xs text-slate-400 mt-2.5 leading-relaxed">{stat.desc}</p>
                </div>
              ))}
            </div>

          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* E. HOW IT WORKS (Connected Steps)                                         */}
      {/* ========================================================================= */}
      <section id="features" className="py-24 bg-[#FBFAF7] relative">
        <div className="max-w-[1180px] mx-auto px-6">
          <div className="text-center max-w-xl mx-auto mb-16 space-y-3">
            <span className="text-[10px] font-bold text-[#2F5CFF] uppercase tracking-widest block">Guided Campaign Pipeline</span>
            <h2 className="text-3xl font-extrabold text-[#0B1220] tracking-tight">
              Launch automated calls in 4 steps.
            </h2>
            <p className="text-sm text-[#64748B]">
              No complex telecom architecture. A simple web dashboard controls everything.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative z-10">
            {[
              { 
                step: '01', 
                title: 'Upload Contacts', 
                desc: 'Upload a CSV of customers. Receptify instantly parses names, phone numbers, and custom parameters.',
                ui: (
                  <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 text-[10px] font-mono text-slate-500">
                    <div className="flex justify-between border-b border-slate-200 pb-1.5 mb-1.5 font-bold text-slate-700">
                      <span>Full Name</span><span>Phone</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Rahul Sen</span><span>+91 98310...</span>
                    </div>
                  </div>
                )
              },
              { 
                step: '02', 
                title: 'Generate Script', 
                desc: 'State your goal and business info. Our AI generates a highly polite, localized call script in seconds.',
                ui: (
                  <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 text-[10px] font-mono text-brand-600">
                    <Sparkles className="w-3.5 h-3.5 mb-1 text-[#2F5CFF]" />
                    <span>{"\"नमस्ते {{name}}, यह कॉल...\""}</span>
                  </div>
                )
              },
              { 
                step: '03', 
                title: 'Trigger Automated Calls', 
                desc: 'Launch the campaign. AI handles outbound streams synchronously with DND-aware compliance blocks.',
                ui: (
                  <div className="flex items-center gap-2 bg-emerald-50 text-emerald-800 rounded-lg p-2.5 border border-emerald-100 text-[10px] font-semibold">
                    <span className="relative flex h-1.5 w-1.5 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                    </span>
                    <span>350 Live calls routing...</span>
                  </div>
                )
              },
              { 
                step: '04', 
                title: 'Track Outcomes', 
                desc: 'Listen to customer recordings, read AI transcripts, and study detailed outcomes inside the portal.',
                ui: (
                  <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 text-[10px] font-mono text-slate-500">
                    <div className="font-bold text-emerald-600">✓ Interested</div>
                    <div className="text-[8px] text-slate-400">Callback: Tomorrow 4 PM</div>
                  </div>
                )
              }
            ].map((s, idx) => (
              <div key={idx} className="flex flex-col bg-white border border-[#E7E4DC] rounded-2xl p-6 shadow-sm shadow-[#0B1220]/[0.02] space-y-4">
                <div className="flex justify-between items-center border-b border-[#E7E4DC] pb-4">
                  <span className="text-xl font-extrabold text-[#2F5CFF] font-mono">{s.step}</span>
                  <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Step</span>
                </div>
                <h3 className="font-bold text-[#0B1220] text-base">{s.title}</h3>
                <p className="text-xs text-[#64748B] leading-relaxed flex-1">{s.desc}</p>
                <div className="pt-2">{s.ui}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* F. FEATURE GRID / USE CASES (Bento Grid)                                  */}
      {/* ========================================================================= */}
      <section id="use-cases" className="py-24 bg-[#FBFAF7] border-t border-[#E7E4DC]">
        <div className="max-w-[1180px] mx-auto px-6">
          <div className="max-w-xl mb-16 space-y-3">
            <span className="text-[10px] font-bold text-[#2F5CFF] uppercase tracking-widest block">Bento Use Cases</span>
            <h2 className="text-3xl font-extrabold text-[#0B1220] tracking-tight">
              One platform, optimized for your specific workflows.
            </h2>
            <p className="text-sm text-[#64748B]">
              Say goodbye to generic message-broadcasting tools. Receptify adapts directly to your business use cases.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            
            {/* LARGE CARD: EMI / Payment Reminders (Flagship) */}
            <SpotlightCard className="md:col-span-8 flex flex-col justify-between min-h-[300px]">
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center text-[#2F5CFF]">
                    <Wallet className="w-5 h-5" />
                  </div>
                  <Badge variant="success">Completed</Badge>
                </div>
                <h3 className="text-xl font-extrabold text-[#0B1220] mt-2">Payment & EMI Reminders</h3>
                <p className="text-xs text-[#64748B] leading-relaxed max-w-xl">
                  Automatically alert loan/EMI accounts ahead of due dates. Our localized AI uses a courteous, polite, non-confrontational voice, prompting a 35% higher response rate compared to automated SMS.
                </p>
              </div>
              <div className="pt-6 border-t border-[#E7E4DC] mt-6 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                <div className="text-[11px] font-mono text-slate-500 leading-normal max-w-sm">
                  <span className="text-[#2F5CFF] font-bold">LIVE TEMPLATE:</span> {"\"नमस्ते {{name}}, हम आपके EMI भुगतान के संबंध में सहायता हेतु...\""}
                </div>
                <div className="flex items-center gap-1.5 select-none font-bold text-[10px]">
                  <span className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-100 text-emerald-700">816 Answered</span>
                  <span className="px-2 py-0.5 rounded bg-amber-50 border border-amber-100 text-amber-700">166 Callback</span>
                </div>
              </div>
            </SpotlightCard>

            {/* CARD 2: Appointment Reminders */}
            <SpotlightCard className="md:col-span-4 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center text-[#2F5CFF]">
                  <Calendar className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-[#0B1220]">Appointment Reminders</h3>
                <p className="text-xs text-[#64748B] leading-relaxed">
                  Clinics & diagnostic labs confirm appointments. Automatically schedules callbacks or marks cancellations.
                </p>
              </div>
              <div className="pt-4 border-t border-[#E7E4DC] mt-4 flex items-center gap-1 text-[10px] font-mono text-[#64748B]">
                <Clock className="w-3.5 h-3.5 text-[#2F5CFF]" />
                <span>Reduced no-shows by 78%</span>
              </div>
            </SpotlightCard>

            {/* CARD 3: Lead Follow-up */}
            <SpotlightCard className="md:col-span-4 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center text-[#2F5CFF]">
                  <MessageSquareHeart className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-[#0B1220]">Lead Follow-up</h3>
                <p className="text-xs text-[#64748B] leading-relaxed">
                  Call fresh real estate or education leads instantly within seconds of enquiry. Boosts site visits and sales velocity.
                </p>
              </div>
              <div className="pt-4 border-t border-[#E7E4DC] mt-4 flex items-center gap-1 text-[10px] font-mono text-[#64748B]">
                <TrendingDown className="w-3.5 h-3.5 text-emerald-600" />
                <span>94% immediate response</span>
              </div>
            </SpotlightCard>

            {/* CARD 4: COD Confirmations */}
            <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-xl shadow-brand-900/[0.02] hover:-translate-y-0.5 hover:shadow-card-hover hover:border-[#2F5CFF] transition-all duration-200 lg:col-span-4 flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center text-[#2F5CFF] mb-4">
                  <PackageCheck className="w-5.5 h-5.5" />
                </div>
                <h3 className="font-bold text-[#0B1220] text-[15px]">COD Confirmations</h3>
                <p className="text-xs text-[#64748B] mt-1.5 leading-relaxed">
                  Verify shipping addresses and customer commitment on Cash on Delivery orders before shipping. Mitigate high RTO product returns completely.
                </p>
              </div>
              <div className="pt-4 border-t border-[#E7E4DC] mt-4 flex items-center gap-1 text-[10px] font-mono text-[#64748B]">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#21C17C]" />
                <span>RTO reduced by 30%</span>
              </div>
            </div>

            {/* CARD 5: Service Renewals */}
            <SpotlightCard className="md:col-span-4 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center text-[#2F5CFF]">
                  <RefreshCw className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-[#0B1220]">Service & Gym Renewals</h3>
                <p className="text-xs text-[#64748B] leading-relaxed">
                  Reach out to subscribers ahead of account expirations with personalized offers and payment instructions.
                </p>
              </div>
              <div className="pt-4 border-t border-[#E7E4DC] mt-4 flex items-center gap-1 text-[10px] font-mono text-[#64748B]">
                <BarChart className="w-3.5 h-3.5 text-[#2F5CFF]" />
                <span>Saves 6 hours daily</span>
              </div>
            </SpotlightCard>

          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* G. LIVE COMPLIANCE SECTION                                                */}
      {/* ========================================================================= */}
      <section id="compliance" className="py-24 bg-[#FBFAF7] border-t border-[#E7E4DC]">
        <div className="max-w-[1180px] mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
            
            <div className="lg:col-span-6 space-y-6">
              <span className="text-[10px] font-bold text-[#2F5CFF] uppercase tracking-widest block">TELECOM REGULATORY COMPLIANCE</span>
              <h2 className="text-3xl font-extrabold text-[#0B1220] tracking-tight leading-tight">
                Built strictly for responsible customer outreach.
              </h2>
              <p className="text-sm text-[#64748B] leading-relaxed">
                Receptify was engineered with regulatory frameworks in mind. We actively prohibit cold-calling spam campaigns. The system utilizes explicit customer consent parameters and adheres completely to TRAI DND configurations.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                {[
                  { title: 'DND Validation', desc: 'Queries the global DND registry before dispatch.' },
                  { title: 'Calling-Hour Limits', desc: 'No calls placed outside standard Indian business hours.' },
                  { title: 'Explicit Opt-In', desc: 'Adheres strictly to customer communication consent.' },
                  { title: 'Transaction Records', desc: 'Every outcome has full call transcripts and audit logs.' }
                ].map((item, idx) => (
                  <div key={idx} className="bg-white border border-[#E7E4DC] p-4 rounded-xl flex gap-3">
                    <CheckCircle2 className="w-4 h-4 text-[#21C17C] shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-[#0B1220]">{item.title}</h4>
                      <p className="text-[11px] text-[#64748B] mt-1 leading-normal">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="bg-white border border-[#E7E4DC] p-7 rounded-2xl shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-[#2F5CFF]/5 rounded-bl-[80px]" />
                <div className="flex items-center gap-3 text-red-600 mb-4 bg-red-50/50 border border-red-100 rounded-lg p-3">
                  <ShieldAlert className="w-5 h-5 shrink-0" />
                  <span className="text-xs font-bold font-mono">No Cold Spam Allowed</span>
                </div>
                <h3 className="font-extrabold text-[#0B1220] text-lg">Ethical Calling Standards</h3>
                <p className="text-xs text-[#64748B] mt-2.5 leading-relaxed">
                  We enforce strong filters to prevent abusive cold robocalling. Receptify works only with existing customer lists where transactional follow-up or scheduled account service reminders have been legally initiated.
                </p>
                <div className="mt-6 flex flex-wrap gap-2 text-[10px] font-mono text-[#64748B]">
                  <span className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-full">TRAI Guidelines Compliant</span>
                  <span className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-full">DLT Headers Supported</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* H. TESTIMONIALS / SOCIAL PROOF                                            */}
      {/* ========================================================================= */}
      <section className="py-24 bg-[#FBFAF7] border-t border-[#E7E4DC]">
        <div className="max-w-[1180px] mx-auto px-6">
          <div className="max-w-xl mb-16 space-y-3">
            <span className="text-[10px] font-bold text-[#2F5CFF] uppercase tracking-widest block">Customer Reviews</span>
            <h2 className="text-3xl font-extrabold text-[#0B1220] tracking-tight">
              SMEs across India save time with Receptify.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { 
                q: 'Our EMI reminder calls used to take 4 days for 2,000 customers. Now it takes 90 minutes. The polite, clear English script our customers actually respond to.', 
                name: 'Rahul Mehta', 
                role: 'Collections Head', 
                company: 'Mehta Finance · Pune', 
                initials: 'RM',
                color: 'bg-indigo-600'
              },
              { 
                q: 'I save almost ₹40,000/month on call agents and our appointment no-shows dropped from 22% to 7%. Setup took 15 minutes.', 
                name: 'Dr. Priya Iyer', 
                role: 'Director', 
                company: 'Iyer Diagnostics · Bengaluru', 
                initials: 'PI',
                color: 'bg-emerald-600'
              },
              { 
                q: 'We confirm 300+ COD orders a day before dispatch. Receptify cut our RTO by 30%. The dashboard is genuinely useful, not decorative.', 
                name: 'Aditya Kapoor', 
                role: 'Founder', 
                company: 'Kraftly D2C · Mumbai', 
                initials: 'AK',
                color: 'bg-amber-600'
              }
            ].map((t, i) => (
              <div key={i} className="bg-white border border-[#E7E4DC] rounded-2xl p-7 shadow-sm shadow-[#0B1220]/[0.01] flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, j) => <Star key={j} className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />)}
                  </div>
                  <p className="text-xs sm:text-sm text-[#14171F] italic leading-relaxed">
                    &ldquo;{t.q}&rdquo;
                  </p>
                </div>
                <div className="mt-6 pt-5 border-t border-[#E7E4DC]/60 flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-full ${t.color} text-white grid place-items-center text-xs font-bold`}>
                    {t.initials}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-[#0B1220]">{t.name}</div>
                    <div className="text-[10px] text-[#64748B] font-mono mt-0.5 truncate">{t.role} · {t.company}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* I. PRICING                                                                */}
      {/* ========================================================================= */}
      <section id="pricing" className="py-24 bg-[#FBFAF7] border-t border-[#E7E4DC]">
        <div className="max-w-[1180px] mx-auto px-6">
          
          <div className="text-center max-w-xl mx-auto mb-12 space-y-4">
            <span className="text-[10px] font-bold text-[#2F5CFF] uppercase tracking-widest block">Flexible Subscriptions</span>
            <h2 className="text-3xl font-extrabold text-[#0B1220] tracking-tight">
              Simple, transparent pricing.
            </h2>
            <p className="text-sm text-[#64748B]">Start completely free. Upgrade when you need more call credits.</p>

            {/* Smooth sliding annual toggle pill */}
            <div className="inline-flex items-center gap-2.5 bg-slate-100 p-1.5 rounded-xl border border-slate-200 mt-2">
              <button 
                onClick={() => setIsAnnual(false)}
                className={`px-4 py-1.5 text-xs font-bold uppercase rounded-lg tracking-wider transition-all select-none cursor-pointer ${!isAnnual ? 'bg-white text-[#14171F] shadow-sm' : 'text-[#64748B] hover:text-[#14171F]'}`}
              >
                Monthly
              </button>
              <button 
                onClick={() => setIsAnnual(true)}
                className={`px-4 py-1.5 text-xs font-bold uppercase rounded-lg tracking-wider transition-all select-none cursor-pointer flex items-center gap-1 ${isAnnual ? 'bg-[#2F5CFF] text-white shadow-sm' : 'text-[#64748B] hover:text-[#14171F]'}`}
              >
                Annual
                <span className="text-[8px] bg-emerald-500 text-white font-bold px-1.5 py-0.5 rounded-md uppercase">20% off</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto items-stretch">
            {[
              { 
                name: 'Starter', 
                price: isAnnual ? '799' : '999', 
                calls: 250, 
                sub: 'For small business teams beginning call campaigns.', 
                features: ['AI script generator', 'CSV / Excel upload', 'Standard call metrics', 'Email support'], 
                featured: false 
              },
              { 
                name: 'Growth', 
                price: isAnnual ? '3,999' : '4,999', 
                calls: 2000, 
                sub: 'Perfect for growing teams placing daily followups.', 
                features: ['Everything in Starter', 'Recorded call downloads', 'English voice scripts', 'Priority email support'], 
                featured: true 
              },
              { 
                name: 'Business', 
                price: isAnnual ? '15,999' : '19,999', 
                calls: 10000, 
                sub: 'For high-volume transaction operations.', 
                features: ['Everything in Growth', 'Multiple team seats', 'Comprehensive calling analytics', '24/7 dedicated support'], 
                featured: false 
              },
            ].map((p, idx) => (
              <div
                key={p.name}
                className={cn(
                  "border rounded-2xl p-8 flex flex-col justify-between relative transition-all duration-300",
                  p.featured
                    ? "bg-[#0B1220] text-white border-[#2F5CFF] md:-translate-y-2 shadow-xl shadow-[#2F5CFF]/10 scale-102"
                    : "bg-white border-[#E2E8F0] shadow-sm shadow-[#0B1220]/[0.01]"
                )}
              >
                {p.featured && (
                  <span className="absolute top-5 right-5 bg-[#2F5CFF] text-white text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded shadow-sm">Popular</span>
                )}
                <div>
                  <h3 className={`text-xl font-bold ${p.featured ? 'text-white' : 'text-[#0B1220]'}`}>{p.name}</h3>
                  <p className={`text-xs mt-1.5 leading-relaxed ${p.featured ? 'text-slate-400' : 'text-[#64748B]'}`}>{p.sub}</p>
                  
                  <div className="mt-8 flex items-baseline gap-1.5">
                    <span className={`text-4xl font-extrabold leading-none ${p.featured ? 'text-white' : 'text-[#0B1220]'}`}>₹{p.price}</span>
                    <span className={`text-xs ${p.featured ? 'text-slate-400' : 'text-[#64748B]'}`}>/ month</span>
                  </div>
                  
                  <div className={`mt-2 text-xs font-mono font-bold ${p.featured ? 'text-[#2F5CFF]' : 'text-[#2F5CFF]'}`}>
                    {p.calls.toLocaleString()} included call credits / mo
                  </div>
                  
                  <ul className="mt-8 space-y-3.5 text-xs">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5">
                        <CheckCircle2 className={`w-4 h-4 mt-0.5 shrink-0 ${p.featured ? 'text-[#21C17C]' : 'text-[#21C17C]'}`} />
                        <span className={p.featured ? 'text-slate-300' : 'text-slate-700'}>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                
                <Link
                  href="/signup"
                  className={cn(
                    "w-full mt-8 py-3 rounded-lg text-xs font-bold uppercase tracking-widest text-center transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer",
                    p.featured
                      ? "bg-[#2F5CFF] text-white hover:bg-[#1D4ED8]"
                      : "bg-white border border-[#E7E4DC] text-[#14171F] hover:bg-slate-50"
                  )}
                >
                  <span>Choose Plan</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* J. FINAL CTA                                                              */}
      {/* ========================================================================= */}
      <section className="bg-[#0B1220] text-white py-24 relative overflow-hidden border-t border-[#1E3A8A]">
        {/* Subtle, premium glowing grid background */}
        <div className="absolute inset-0 dotgrid opacity-5 pointer-events-none" />
        <div className="absolute w-[450px] h-[450px] bg-[#2F5CFF]/10 rounded-full blur-[80px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" />

        <div className="max-w-[1180px] mx-auto px-6 relative z-10 text-center max-w-[650px]">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
            Deploy your first AI voice agent today.
          </h2>
          <p className="mt-4 text-sm text-slate-400 leading-relaxed">
            Free for your first 50 calls. Set up scripts, import contacts, and experience localized calling in under 2 minutes. No credit card required.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Link href="/signup" className="px-6 py-3.5 bg-[#2F5CFF] hover:bg-[#1D4ED8] hover:-translate-y-0.5 active:translate-y-0 text-white text-xs font-bold uppercase tracking-widest rounded-lg shadow-lg shadow-[#2F5CFF]/15 transition-all">
              Start Free Trial
            </Link>
            <Link href="/login" className="px-6 py-3.5 bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] active:translate-y-px text-white text-xs font-bold uppercase tracking-widest rounded-lg transition-all">
              Book a demo
            </Link>
          </div>
        </div>
      </section>

      <LiveCallTicker />

      {/* ========================================================================= */}
      {/* K. FOOTER                                                                 */}
      {/* ========================================================================= */}
      <footer className="bg-[#0B1220] text-white border-t border-white/10 pt-16 pb-12">
        <div className="max-w-[1180px] mx-auto px-6 grid grid-cols-2 md:grid-cols-5 gap-10">
          <div className="col-span-2 space-y-4">
            <Logo variant="white" />
            <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
              Automated AI Voice Platform for Indian Businesses. Experience high-fidelity transactional customer follow-up calls in regional accents.
            </p>
          </div>
          
          {[
            { h: 'Product', l: [['Features', '#features'], ['Use Cases', '#use-cases'], ['Pricing', '#pricing']] },
            { h: 'Industries', l: [['Collections', '#'], ['Clinics', '#'], ['Real Estate', '#'], ['D2C Brands', '#']] },
            { h: 'Resources', l: [['Help Center', '/help'], ['Compliance', '#compliance']] },
          ].map((col) => (
            <div key={col.h}>
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{col.h}</div>
              <ul className="mt-4 space-y-2.5">
                {col.l.map(([label, href]) => (
                  <li key={label}>
                    <a href={href} className="text-xs text-slate-400 hover:text-white transition-colors">
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="max-w-[1180px] mx-auto px-6 mt-16 pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span>© 2026 Receptify · All rights reserved.</span>
            <span className="text-slate-600">·</span>
            <div className="flex items-center gap-1.5 text-[#21C17C] font-mono text-[10px]">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
              </span>
              <span>All systems operational</span>
            </div>
          </div>
          <div className="flex gap-4">
            <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
            <a href="#compliance" className="hover:text-white transition-colors">Compliance</a>
          </div>
        </div>
      </footer>

    </main>
  );
}

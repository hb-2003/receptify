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
import { cn } from '@/lib/utils';
import { motion, useScroll, useTransform, useInView, animate } from 'framer-motion';
import Lenis from 'lenis';
import LandingDashboardPreview from '@/components/landing/DashboardPreview';

/* ========================================================================= */
/* CSS Animation Injection                                                   */
/* ========================================================================= */

const CSS_INJECTIONS = `
  @keyframes marquee {
    0% { transform: translateX(0); }
    100% { transform: translateX(-50%); }
  }
  @keyframes equal-bar {
    0%, 100% { height: 4px; }
    50% { height: 20px; }
  }
  @keyframes pulse-emerald {
    0%, 100% { background-color: #10B981; box-shadow: 0 0 6px #10B981; }
    50% { background-color: rgba(16, 185, 129, 0.35); box-shadow: 0 0 0px transparent; }
  }
  .animate-marquee-slow {
    animation: marquee 45s linear infinite;
  }
  .animate-marquee-fast {
    animation: marquee 25s linear infinite;
  }
  .equal-bar {
    animation: equal-bar 1.2s ease-in-out infinite;
  }
  .animate-pulse-emerald {
    animation: pulse-emerald 1.5s ease-in-out infinite;
  }
  
  /* Glassmorphism Styles per PART 1 */
  .glass-panel-light {
    background: rgba(255, 255, 255, 0.6);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(20, 23, 31, 0.08);
  }
  @supports not (backdrop-filter: blur(1px)) {
    .glass-panel-light {
      background: rgba(255, 255, 255, 0.92);
    }
  }
  
  .glass-panel-dark {
    background: rgba(11, 18, 32, 0.6);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.15);
  }
  @supports not (backdrop-filter: blur(1px)) {
    .glass-panel-dark {
      background: rgba(11, 18, 32, 0.92);
    }
  }
  
  @media (prefers-reduced-transparency: reduce) {
    .glass-panel-light {
      background: rgba(255, 255, 255, 0.98);
      backdrop-filter: none;
      -webkit-backdrop-filter: none;
    }
    .glass-panel-dark {
      background: rgba(11, 18, 32, 0.98);
      backdrop-filter: none;
      -webkit-backdrop-filter: none;
    }
  }
`;

const NAV = [
  { label: 'Features', href: '#features' },
  { label: 'Use Cases', href: '#use-cases' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Compliance', href: '#compliance' },
];

const INDUSTRIES = [
  { label: 'Lending & NBFC', icon: Wallet },
  { label: 'Clinics & Healthcare', icon: Calendar },
  { label: 'Real Estate', icon: MessageSquareHeart },
  { label: 'Gyms & Fitness', icon: RefreshCw },
  { label: 'D2C & Ecommerce', icon: PackageCheck },
];

const TICKER_ITEMS = [
  { textPrefix: '✓ EMI reminder answered · Surat · ', textSuffix: ' ago', num: '12s' },
  { textPrefix: '↻ Callback scheduled · Pune · ', textSuffix: ' ago', num: '34s' },
  { textPrefix: '✓ Appointment confirmed · Bengaluru · ', textSuffix: ' ago', num: '1m' },
  { textPrefix: '✗ Busy, retry queued · Delhi · ', textSuffix: ' ago', num: '2m' },
  { textPrefix: '✓ COD order confirmed · Jaipur · ', textSuffix: ' ago', num: '3m' },
  { textPrefix: '✓ Membership renewal agreed · Hyderabad · ', textSuffix: ' ago', num: '4m' },
];

const USE_CASES = [
  {
    id: 1,
    title: "EMI & Payment Reminders",
    subtitle: "Reach every borrower before the due date, in Hindi, English, or their regional language — and log every promise-to-pay automatically.",
    script: "Namaste, this is a reminder that your EMI of ₹4,200 is due on the 14th…",
    num1: "816",
    label1: " Done",
    class1: "badge-completed",
    num2: "218",
    label2: " Pending",
    class2: "badge-warning",
    stat: "68% reached before due date"
  },
  {
    id: 2,
    title: "Appointment Reminders",
    subtitle: "Cut no-shows at clinics and salons with a call the day before, and an easy reschedule flow.",
    script: "Your appointment with Dr. Mehta is tomorrow at 4 PM…",
    num1: "340",
    label1: " Confirmed",
    class1: "badge-completed",
    num2: "12",
    label2: " Rescheduled",
    class2: "badge-neutral",
    stat: "No-shows reduced from 22% to 7%"
  },
  {
    id: 3,
    title: "Lead Follow-up",
    subtitle: "Real estate and sales teams follow up on every site-visit lead within minutes, not days.",
    script: "Thanks for your interest in the Baner project — when works for a site visit?",
    num1: "580",
    label1: " Contacted",
    class1: "badge-completed",
    num2: "180",
    label2: " Interested",
    class2: "badge-active",
    stat: "91% average campaign answer rate"
  },
  {
    id: 4,
    title: "Service Renewals",
    subtitle: "Gym memberships, AMC contracts, subscriptions — remind customers before they lapse, not after.",
    script: "Your membership renews on the 15th — would you like to continue?",
    num1: "210",
    label1: " Renewed",
    class1: "badge-completed",
    num2: "45",
    label2: " Callbacks",
    class2: "badge-warning",
    stat: "4,200+ automated scale capacity"
  },
  {
    id: 5,
    title: "COD Order Confirmation",
    subtitle: "Cut RTO losses by confirming cash-on-delivery orders with a call before the order ships.",
    script: "Confirming your order of ₹1,499 for delivery on Thursday…",
    num1: "89",
    label1: " Confirmed",
    class1: "badge-completed",
    num2: "14",
    label2: " Cancelled",
    class2: "badge-neutral",
    stat: "30% reduction in D2C RTO losses"
  }
];

/* ========================================================================= */
/* Reusable, React 19-safe Element Intersection Observer Hook                */
/* ========================================================================= */

function useElementInView() {
  const ref = useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsInView(true);
      }
    }, { threshold: 0.05 });
    
    const current = ref.current;
    if (current) observer.observe(current);
    
    return () => {
      if (current) observer.unobserve(current);
    };
  }, []);

  return [ref, isInView] as const;
}

/* ========================================================================= */
/* Stats Framer Motion Counter                                               */
/* ========================================================================= */

function FramerCounter({ value, duration = 0.3 }: { value: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const numericValue = parseInt(value.replace(/[^0-9]/g, ''), 10) || 0;
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  useEffect(() => {
    if (isInView) {
      const controls = animate(0, numericValue, {
        duration: duration,
        ease: "easeOut",
        onUpdate: (latest) => {
          if (ref.current) {
            ref.current.textContent = Math.floor(latest).toLocaleString('en-IN') + (value.includes('+') ? '+' : '') + (value.includes('%') ? '%' : '');
          }
        }
      });
      return () => controls.stop();
    }
  }, [isInView, numericValue, duration, value]);

  return <span ref={ref} className="font-mono font-bold text-5xl sm:text-6xl text-[#2F5CFF]">0</span>;
}

/* ========================================================================= */
/* Live Call Outcome Ticker Component (Signature Brand Motif)                */
/* ========================================================================= */

function LiveCallTicker() {
  return (
    <div className="w-full bg-[#FBFAF7] border-y border-[#E7E4DC] py-3 overflow-hidden select-none relative z-20">
      <div className="flex whitespace-nowrap gap-16 animate-marquee-slow hover:[animation-play-state:paused]">
        {Array.from({ length: 6 }).flatMap(() => TICKER_ITEMS).map((item, idx) => (
          <div key={idx} className="flex items-center gap-2.5 text-xs font-semibold text-[#64748B]">
            <span className="w-2 h-2 rounded-full bg-[#2F5CFF] shadow-[0_0_8px_rgba(47,92,255,0.4)]" />
            <span>{item.textPrefix}</span>
            <span className="font-mono text-[#2F5CFF] font-bold">{item.num}</span>
            <span>{item.textSuffix}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ========================================================================= */
/* Reusable, high-performance Typewriter Text component                     */
/* ========================================================================= */

interface TypewriterTextProps {
  text: string;
  active: boolean;
  duration?: number;
}

function TypewriterText({ text, active, duration = 0.6 }: TypewriterTextProps) {
  const [displayedText, setDisplayedText] = useState(active ? '' : text);

  useEffect(() => {
    if (active) {
      setDisplayedText('');
      let startTime: number | null = null;
      let animationFrameId: number;

      const animate = (timestamp: number) => {
        if (!startTime) startTime = timestamp;
        const elapsed = timestamp - startTime;
        const progress = Math.min(elapsed / (duration * 1000), 1);
        
        const currentChars = Math.floor(text.length * progress);
        setDisplayedText(text.slice(0, currentChars));

        if (progress < 1) {
          animationFrameId = requestAnimationFrame(animate);
        }
      };

      animationFrameId = requestAnimationFrame(animate);
      return () => cancelAnimationFrame(animationFrameId);
    } else {
      setDisplayedText(text);
    }
  }, [active, text, duration]);

  return <span>{displayedText}</span>;
}

/* ========================================================================= */
/* Reusable, React 19-safe Section Eyebrow Label with rule                   */
/* ========================================================================= */

interface SectionEyebrowProps {
  num: string;
  title: string;
  align?: 'center' | 'left';
}

function SectionEyebrow({ num, title, align = 'center' }: SectionEyebrowProps) {
  const isLeft = align === 'left';
  return (
    <motion.div 
      initial={{ opacity: 0, x: -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={cn(
        "flex items-center gap-3 mb-4 w-full",
        isLeft ? "justify-start" : "justify-center"
      )}
    >
      {!isLeft && <span className="h-[1px] w-8 bg-[#2F5CFF]/20"></span>}
      <span className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-[#2F5CFF] whitespace-nowrap">
        {num} / {title}
      </span>
      <span className={cn("h-[1px] bg-[#2F5CFF]/25", isLeft ? "flex-1 max-w-[160px]" : "w-8")}></span>
    </motion.div>
  );
}

/* ========================================================================= */
/* MAIN LANDING PAGE COMPONENT                                               */
/* ========================================================================= */

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  
  // Audio playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Pricing State
  const [isAnnual, setIsAnnual] = useState(false);

  // Sections element-in-view triggers
  const [trustRef, trustInView] = useElementInView();
  const [statsRef, statsInView] = useElementInView();
  const [howItWorksRef, howItWorksInView] = useElementInView();
  const [testimonialsRef, testimonialsInView] = useElementInView();
  const [pricingRef, pricingInView] = useElementInView();
  const [complianceRef, complianceInView] = useElementInView();

  // Use Case sticky showcase state
  const showcaseContainerRef = useRef<HTMLDivElement>(null);
  const useCaseRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [activeCase, setActiveCase] = useState(0);

  // Mouse hover parallax tilt state (Hero Graphic)
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5; // -0.5 to 0.5
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: x * 15, y: -y * 15 }); // Max 15 deg tilt
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
  };

  // Initialize Lenis for smooth momentum inertial scrolling
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.0,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // easeOutQuart
      smoothWheel: true,
    });

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    requestAnimationFrame(raf);

    // Automatically hijack standard hash links to smooth scroll with header offset
    const handleAnchorClick = (e: MouseEvent) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      const anchor = target.closest('a');
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (href && href.startsWith('#')) {
        const element = document.querySelector(href);
        if (element instanceof HTMLElement) {
          e.preventDefault();
          lenis.scrollTo(element, { offset: -80 }); // offset for the sticky header
        }
      }
    };

    document.addEventListener('click', handleAnchorClick);

    return () => {
      lenis.destroy();
      document.removeEventListener('click', handleAnchorClick);
    };
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 80);
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Initialize on mount
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // IntersectionObserver to trace active usecase annotation row
  useEffect(() => {
    const observerOptions = {
      root: null,
      rootMargin: '-35% 0px -35% 0px', // focused near center of viewport
      threshold: 0.1,
    };

    const observerCallback = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const index = parseInt(entry.target.getAttribute('data-case-index') || '0', 10);
          setActiveCase(index);
        }
      });
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);

    useCaseRefs.current.forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  const togglePlayAudio = () => {
    if (isPlaying) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setIsPlaying(false);
    } else {
      if (!audioRef.current) {
        audioRef.current = new Audio('/audio/sample-recording.wav');
        audioRef.current.onended = () => setIsPlaying(false);
      }
      audioRef.current.play().catch((err) => {
        console.error("Audio playback failed:", err);
        setIsPlaying(false);
      });
      setIsPlaying(true);
    }
  };

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  return (
    <main className="bg-[#FBFAF7] text-[#0F172A] min-h-screen relative selection:bg-[#EEF1FE] selection:text-[#2F5CFF] overflow-x-clip font-sans">
      
      {/* Dynamic Keyframe Injection */}
      <style>{CSS_INJECTIONS}</style>

      {/* ========================================================================= */}
      {/* 1. FLOATING PILL NAVIGATION (Premium Glassmorphism Nav)                    */}
      {/* ========================================================================= */}
      <motion.header 
        animate={{
          scale: scrolled ? 0.95 : 1.0,
          y: scrolled ? 12 : 0,
          backgroundColor: scrolled ? "rgba(255, 255, 255, 0.75)" : "rgba(251, 250, 247, 0)",
          backdropFilter: scrolled ? "blur(20px)" : "blur(0px)",
          borderWidth: scrolled ? "1px" : "0px",
          borderColor: scrolled ? "rgba(47, 92, 255, 0.15)" : "rgba(0, 0, 0, 0)",
          boxShadow: scrolled 
            ? "0 20px 40px -15px rgba(47, 92, 255, 0.12), 0 0 0 1px rgba(47, 92, 255, 0.05)" 
            : "0 0px 0px rgba(0, 0, 0, 0)",
        }}
        transition={{ type: "spring", stiffness: 260, damping: 22 }}
        className="fixed top-4 left-4 right-4 mx-auto max-w-[1160px] z-[9999] rounded-full transition-all duration-300 py-3 md:py-3.5 px-6 md:px-8 border border-transparent"
      >
        <div className="flex items-center justify-between w-full">
          <Link href="/" className="inline-block hover:opacity-95 transition-opacity">
            <Logo variant="default" />
          </Link>
          <nav className="hidden md:flex items-center gap-9">
            {NAV.map((l) => (
              <a 
                key={l.href} 
                href={l.href} 
                className="text-xs font-bold uppercase tracking-wider transition-colors relative group py-1 text-[#64748B] hover:text-[#0F172A]"
              >
                {l.label}
                <span className="absolute left-0 bottom-0 w-0 h-[2px] bg-[#2F5CFF] transition-all duration-200 group-hover:w-full" />
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <Link 
              href="/login" 
              className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors text-[#64748B] hover:text-[#0F172A]"
              data-testid="nav-login"
            >
              Log in
            </Link>
            <Link href="/signup" className="px-5 py-2.5 bg-[#2F5CFF] hover:bg-[#1D4ED8] text-white text-xs font-mono font-bold uppercase tracking-wider rounded-full shadow-inner transition-all duration-200" data-testid="nav-signup">
              Book a demo
            </Link>
          </div>
        </div>
      </motion.header>

      {/* ========================================================================= */}
      {/* 2. HERO SECTION (Warm Premium Centered Layout per PART 2)                  */}
      {/* ========================================================================= */}
      <section className="relative pt-24 pb-12 md:pt-32 md:pb-16 bg-[#FBFAF7] overflow-hidden border-b border-[#E7E4DC]">
        
        {/* Large subtle ambient glowing blue mesh in the center for depth */}
        <div className="absolute w-[800px] h-[800px] bg-[#2F5CFF]/[0.04] rounded-full blur-[140px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-0" />
        
        <div className="max-w-[1200px] mx-auto px-6 relative z-10 flex flex-col items-center">
          
          {/* Centered Hero Header Area (max-width ~760px) */}
          <div className="flex flex-col items-center text-center space-y-6 max-w-[760px] mx-auto">
            
            {/* 01 Eyebrow heading label */}
            <div className="flex items-center gap-3 justify-center w-full max-w-[180px]">
              <span className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-[#2F5CFF]">01 / INTRODUCTION</span>
            </div>

            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#2F5CFF]/5 border border-[#2F5CFF]/10 text-[10px] font-bold text-[#2F5CFF] uppercase tracking-widest">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#2F5CFF] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#2F5CFF]"></span>
              </span>
              AI Calling Platform for Indian SMBs
            </span>
            
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-[#0B1220] tracking-tight leading-[1.08] flex flex-wrap justify-center gap-x-[0.2em] gap-y-1">
              {"Every EMI reminder. Every no-show follow-up. Answered —".split(" ").map((word, idx) => (
                <motion.span
                  key={idx}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.3,
                    delay: idx * 0.05,
                    ease: "easeOut",
                  }}
                  className="inline-block text-[#0B1220]"
                >
                  {word}
                </motion.span>
              ))}
              <motion.span
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.3,
                  delay: 8 * 0.05,
                  ease: "easeOut",
                }}
                className="inline-block text-[#2F5CFF]"
              >
                automatically.
              </motion.span>
            </h1>
            
            <p className="text-sm sm:text-base leading-relaxed text-[#64748B] max-w-[560px]">
              Stop calling customers by hand. Upload your contacts, pick a custom script, and launch automated call campaigns that achieve a <span className="font-mono text-[#2F5CFF] font-bold">91%</span> answer rate in clear, professional localized voices.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2 w-full">
              <Link href="/signup" className="px-6 py-3.5 bg-[#2F5CFF] hover:bg-[#1D4ED8] text-white text-xs font-mono font-bold uppercase tracking-widest rounded-lg transition-all shadow-md">
                Start free trial
              </Link>
              
              {/* Interactive Audio Player CTA */}
              <button 
                onClick={togglePlayAudio}
                className="px-5 py-3.5 bg-white border border-[#E7E4DC] text-xs font-mono font-bold text-[#14171F] uppercase tracking-widest rounded-lg hover:bg-slate-50 transition-all inline-flex items-center gap-2 shadow-sm"
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
              <motion.div 
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="p-4 rounded-xl border border-[#2F5CFF]/20 bg-[#2F5CFF]/[0.02] space-y-3 w-full max-w-[480px] mx-auto text-left"
              >
                <div className="flex items-center gap-3">
                  <Volume2 className="w-4 h-4 text-[#2F5CFF] animate-pulse" />
                  <span className="text-[10px] font-mono text-[#2F5CFF] uppercase tracking-wider font-bold">Demo Voice Broadcast in Progress…</span>
                  <div className="flex items-end gap-0.5 h-4 ml-auto">
                    {[6, 12, 18, 8, 14, 5, 16, 9].map((h, i) => (
                      <span key={i} className="w-0.5 bg-[#2F5CFF] rounded-full equal-bar" style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                </div>
                <div className="text-xs font-mono text-[#14171F] bg-white border border-[#E7E4DC] rounded-lg p-3 leading-relaxed shadow-sm">
                  <p className="text-slate-400 text-[9px] font-bold tracking-wider mb-1 uppercase">SCRIPT TRANSCRIPT (ENGLISH):</p>
                  <span className="text-[#2F5CFF] font-medium">&ldquo;Hello, this is Receptify calling. This is a courtesy reminder regarding your upcoming payment due tomorrow. Press <span className="font-mono text-[#2F5CFF] font-bold">1</span> to confirm receipt...&rdquo;</span>
                </div>
              </motion.div>
            )}

            <div className="flex flex-wrap sm:flex-nowrap items-center justify-center gap-x-6 gap-y-2 text-[11px] font-bold text-[#64748B] uppercase tracking-wider pt-4 border-t border-[#E7E4DC]/60 w-full max-w-xl mx-auto">
              {['No credit card needed', 'Localized voice support', 'Time-window smart'].map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5 whitespace-nowrap">
                  <CheckCircle2 className="w-4 h-4 text-[#2F5CFF] shrink-0" /> {t}
                </span>
              ))}
            </div>

          </div>

          {/* Centered Mockup with Depth (Part 3) */}
          <motion.div 
            initial={{ opacity: 0, y: 40, rotateX: 8 }}
            whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-[1000px] mt-20 cursor-pointer relative group mx-auto px-4"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={{
              transform: `perspective(1200px) rotateX(${tilt.y}deg) rotateY(${tilt.x}deg)`,
              transition: 'transform 0.2s ease-out'
            }}
          >
            {/* Ambient glow: soft brand-600 gradient at 9% opacity, blurred (100px) */}
            <div className="absolute inset-0 bg-[#2F5CFF]/10 rounded-2xl blur-[100px] opacity-100 group-hover:scale-105 transition-all duration-300 pointer-events-none z-0" style={{ transform: "scale(0.9)" }} />
            
            {/* Soft, diffuse container shadow */}
            <div className="relative z-10 rounded-2xl shadow-[0_40px_80px_-20px_rgba(20,23,31,0.25)] border border-[#E7E4DC] overflow-hidden bg-white hover:border-[#2F5CFF]/30 transition-colors duration-300">
              <LandingDashboardPreview />
            </div>
          </motion.div>

        </div>

      </section>

      {/* Signature Strip element (Contained to same mockup max-width per PART 4) */}
      <div className="max-w-[1000px] mx-auto px-4 -mt-12 mb-6 relative z-20">
        <div className="rounded-2xl border border-[#E7E4DC] bg-white overflow-hidden shadow-sm">
          <LiveCallTicker />
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. TRUST STRIP                                                            */}
      {/* ========================================================================= */}
      <section ref={trustRef} className="bg-white py-10 border-b border-[#E7E4DC] relative">
        <div className="max-w-[1200px] mx-auto px-6 text-center space-y-8">
          
          <div className={cn("transition-all duration-300 ease-out transform", trustInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4")}>
            {/* Eyebrow label for Trust Section */}
            <div className="flex flex-col items-center justify-center space-y-2 mb-6">
              <span className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-[#2F5CFF]">02 / MARKET ADOPTION</span>
              <div className="w-12 h-[1px] bg-[#2F5CFF]/20" />
            </div>
            
            <p className="text-xs font-bold uppercase tracking-widest text-[#64748B]">
              Trusted by teams handling <span className="font-mono text-[#2F5CFF] font-bold">50,000+</span> automated monthly calls across India
            </p>
          </div>
          
          <div className={cn("transition-all duration-300 ease-out transform delay-100", trustInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4")}>
            <div className="flex flex-wrap justify-center items-center gap-4 md:gap-5">
              {INDUSTRIES.map((ind, idx) => (
                <div 
                  key={idx} 
                  className="flex items-center gap-3 text-xs md:text-sm font-bold text-[#0F172A] glass-panel-light rounded-xl py-3 px-6 shadow-sm border border-slate-200/60 hover:-translate-y-0.5 hover:border-[#2F5CFF] hover:shadow-md cursor-default transition-all duration-300"
                >
                  <ind.icon className="w-4.5 h-4.5 text-[#2F5CFF] shrink-0" />
                  <span>{ind.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* 4. STATS BAND (Frosted Dark Glass over Texture Grid per PART 3)           */}
      {/* ========================================================================= */}
      <section ref={statsRef} className="bg-[#0B1220] py-24 relative overflow-hidden border-b border-slate-900">
        
        {/* Subtle background dot grid texture at ~4% opacity */}
        <div 
          className="absolute inset-0 opacity-[0.04] pointer-events-none" 
          style={{ 
            backgroundImage: 'radial-gradient(#2F5CFF 1.5px, transparent 1px)', 
            backgroundSize: '16px 16px' 
          }} 
        />
        
        <div className="max-w-[1200px] mx-auto px-6 relative z-10">
          
          {/* Eyebrow for Stats */}
          <div className="flex flex-col items-center justify-center space-y-2 mb-16">
            <span className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-[#2F5CFF]">03 / PERFORMANCE INDEX</span>
            <div className="w-12 h-[1px] bg-[#2F5CFF]/30" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              { val: "91%", t: "Calls answered, not ignored", d: "Localized regional accents and DND-aware timing bypass system barriers." },
              { val: "4,200+", t: "Calls handled per day, per business", d: "Scale synchronous queues dynamically without hiring more agents." },
              { val: "68%", t: "EMI customers reached before due date", d: "Mitigate financial loan slippage with automated courteous notifications." }
            ].map((stat, idx) => (
              <div 
                key={idx}
                style={{ transitionDelay: `${idx * 100}ms` }}
                className={cn(
                  "glass-panel-dark rounded-2xl p-8 transform transition-all duration-500 ease-out flex flex-col items-center justify-center text-center space-y-4 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-[#2F5CFF]/5",
                  statsInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                )}
              >
                <div className="mb-2">
                  <FramerCounter value={stat.val} />
                </div>
                <h4 className="text-base font-bold text-white tracking-tight">{stat.t}</h4>
                <p className="text-xs text-slate-300 leading-relaxed max-w-xs">{stat.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 5. HOW IT WORKS (Warm Canvas Background)                                  */}
      {/* ========================================================================= */}
      <section id="features" ref={howItWorksRef} className="py-24 bg-[#FBFAF7] relative border-b border-[#E7E4DC]">
        <div className="max-w-[960px] mx-auto px-6 relative">
          
          {/* Eyebrow for How It Works */}
          <SectionEyebrow num="04" title="OPERATIONAL FLOW" />

          <div className="text-center max-w-xl mx-auto mb-16 space-y-4">
            <motion.h2 
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.3, delay: 0.1, ease: "easeOut" }}
              className="font-sans font-extrabold text-3xl sm:text-4xl text-[#0B1220] tracking-tight"
            >
              How it works
            </motion.h2>
            <motion.p 
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.3, delay: 0.2, ease: "easeOut" }}
              className="text-sm sm:text-base text-[#64748B]"
            >
              From contact list to answered calls in under <span className="font-mono text-[#2F5CFF] font-bold">1</span> hour.
            </motion.p>
          </div>

          <div className="relative">
            {/* Connected line drawing itself as section enters viewport */}
            <div className="absolute top-[24px] left-[12.5%] right-[12.5%] h-[2px] hidden md:block z-0 pointer-events-none">
              <svg className="w-full h-full overflow-visible" fill="none">
                <line x1="0" y1="0" x2="100%" y2="0" stroke="#E7E4DC" strokeWidth="2" />
                <motion.line 
                  x1="0" 
                  y1="0" 
                  x2="100%" 
                  y2="0" 
                  stroke="#2F5CFF" 
                  strokeWidth="2" 
                  initial={{ pathLength: 0 }}
                  whileInView={{ pathLength: 1 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                />
              </svg>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-10 relative z-10">
              {[
                { 
                  step: '1', 
                  title: 'Upload your contacts', 
                  desc: 'Drop in a CSV of customers, or connect your CRM. No formatting gymnastics.' 
                },
                { 
                  step: '2', 
                  title: 'Pick or write a script', 
                  desc: 'Start from an EMI, appointment, or renewal template — or write your own in plain language.' 
                },
                { 
                  step: '3', 
                  title: 'Receptify makes calls', 
                  desc: 'Thousands of calls go out in parallel, in the customer\'s language, at the hours you choose.' 
                },
                { 
                  step: '4', 
                  title: 'Watch results land', 
                  desc: 'Answered, callback, no-answer — every outcome shows up in your dashboard in real time.' 
                }
              ].map((s, idx) => (
                <div 
                  key={idx} 
                  style={{ transitionDelay: `${idx * 100}ms` }}
                  className={cn(
                    "flex flex-col items-center text-center space-y-4 group transform transition-all duration-300 ease-out",
                    howItWorksInView 
                      ? "opacity-100 scale-100 translate-y-0" 
                      : "opacity-0 scale-95 translate-y-4"
                  )}
                >
                  <div className="w-12 h-12 rounded-full border border-[#2F5CFF]/35 bg-white flex items-center justify-center font-mono font-bold text-sm text-[#2F5CFF] shadow-sm group-hover:scale-105 transition-transform duration-200">
                    {s.step}
                  </div>
                  <h3 className="font-bold text-base text-[#0B1220] pt-2">{s.title}</h3>
                  <p className="text-xs text-[#64748B] leading-relaxed max-w-[220px]">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* 6. USE-CASE SHOWCASE (Sticky Pinned Scroll Section, White BG)             */}
      {/* ========================================================================= */}
      <section id="use-cases" className="py-24 bg-white relative border-b border-[#E7E4DC]">
        <div className="max-w-[1200px] mx-auto px-6">
          
          {/* Eyebrow for Use Cases */}
          <SectionEyebrow num="05" title="DEPLOYMENT SCENARIOS" />

          <div className="text-center max-w-xl mx-auto mb-16 space-y-4">
            <motion.h2 
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.3, delay: 0.1, ease: "easeOut" }}
              className="font-sans font-extrabold text-3xl sm:text-4xl text-[#0B1220] tracking-tight"
            >
              Built for how you actually get paid
            </motion.h2>
            <motion.p 
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.3, delay: 0.2, ease: "easeOut" }}
              className="text-sm text-[#64748B]"
            >
              Five use cases. One platform. Pick the ones your business needs.
            </motion.p>
          </div>

          {/* TWO-COLUMN STICKY SCROLL PRODUCT TOUR (Desktop layout) */}
          <div className="flex flex-col md:flex-row gap-12 items-start relative mt-12">
            
            {/* Left Column (55% width, sticky positioned, desktop only) */}
            <div className="w-full md:w-[55%] sticky top-[15vh] self-start py-8 hidden md:block">
              <div className="w-full flex justify-center">
                {/* Stationary browser chrome mockup frame */}
                <div className="bg-white border border-[#E7E4DC] rounded-2xl overflow-hidden w-full max-w-[460px] h-[390px] flex flex-col transition-all duration-200 hover:border-[#2F5CFF] relative shadow-[0_0_20px_rgba(47,92,255,0.03)]">
                  {/* Browser Chrome Header */}
                  <div className="h-9 bg-slate-50 border-b border-[#E7E4DC] flex items-center px-4 gap-2 shrink-0 relative z-20">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#2F5CFF]/30" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[#2F5CFF]/20" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[#2F5CFF]/10" />
                    <div className="flex-1" />
                    <span className="text-[11px] text-[#64748B] font-mono">
                      receptify.ai/dashboard/case-0<span className="font-mono text-[#2F5CFF] font-bold">{USE_CASES[activeCase].id}</span>
                    </span>
                    <div className="flex-1" />
                  </div>
                  
                  {/* Mockup Frame Content - Cross-fade active case study content only */}
                  <div className="flex-1 relative overflow-hidden bg-[#FBFAF7]">
                    {USE_CASES.map((uc, i) => {
                      const isActive = activeCase === i;
                      return (
                        <div
                          key={uc.id}
                          className={cn(
                            "absolute inset-0 p-6 flex flex-col justify-between transition-opacity duration-300 ease-in-out bg-[#FBFAF7]",
                            isActive 
                              ? "opacity-100 pointer-events-auto z-10 animate-fade-in" 
                              : "opacity-0 pointer-events-none z-0"
                          )}
                        >
                          {/* Background decoration */}
                          <div className="absolute inset-0 opacity-[0.02] bg-[radial-gradient(#2F5CFF_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />
                          
                          <div className="relative z-10 space-y-4">
                            <div className="flex justify-between items-center border-b border-[#E7E4DC] pb-3">
                              <div>
                                <span className="text-[9px] font-mono uppercase tracking-wider text-[#64748B] font-bold">Campaign Instance</span>
                                <h4 className="font-sans font-bold text-base text-[#0B1220] mt-0.5">{uc.title}</h4>
                              </div>
                              <span className="px-2 py-0.5 rounded bg-[#2F5CFF]/10 text-[#2F5CFF] font-mono text-[9px] font-bold border border-[#2F5CFF]/20">
                                ACTIVE
                              </span>
                            </div>
                            
                            {/* Outcome Badges (Cross-fade only this box) */}
                            <div className="bg-white p-3.5 rounded-xl border border-[#E7E4DC] shadow-sm space-y-1.5">
                              <span className="text-[8px] font-mono uppercase text-[#64748B] font-bold block">Live Outcomes</span>
                              <div className="flex flex-wrap gap-1.5">
                                {uc.num1 && (
                                  <span className={cn("px-2.5 py-0.5 rounded text-[10px] font-semibold font-mono", uc.class1 || "badge-completed")}>
                                    <span className="font-bold">{uc.num1}</span>{uc.label1}
                                  </span>
                                )}
                                {uc.num2 && (
                                  <span className={cn("px-2.5 py-0.5 rounded text-[10px] font-semibold font-mono", uc.class2 || "badge-neutral")}>
                                    <span className="font-bold">{uc.num2}</span>{uc.label2}
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            {/* Script-Protocol Box (Cross-fade only this box) */}
                            <div className="bg-[#0B1220] border border-slate-800 rounded-xl p-4 text-white font-mono text-[11px] shadow-sm relative overflow-hidden">
                              <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full animate-pulse-emerald shrink-0" />
                                  <span className="text-slate-400 text-[9px] font-bold uppercase tracking-wider">Audio Broadcast</span>
                                </div>
                                <div className="flex items-end gap-0.5 h-3">
                                  {[1, 2, 3, 2, 1, 2, 3].map((_, idx) => (
                                    <span key={idx} className="w-0.5 bg-[#2F5CFF] rounded-full equal-bar h-full" />
                                  ))}
                                </div>
                              </div>
                              <p className="text-[#2F5CFF] leading-relaxed italic font-medium">
                                &ldquo;<TypewriterText text={uc.script} active={isActive} />&rdquo;
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex justify-between items-center border-t border-[#E7E4DC] pt-3 text-[9px] text-[#64748B] font-mono font-bold uppercase tracking-wider">
                            <span>Outbound Channel ACTIVE</span>
                            <span>DND Registry Screened</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column (45% width, normal scroll, desktop & layout fallback) */}
            <div className="w-full md:w-[45%] py-8 flex flex-col justify-start">
              {USE_CASES.map((uc, i) => {
                const isActive = activeCase === i;
                return (
                  <div
                    key={uc.id}
                    ref={(el) => { useCaseRefs.current[i] = el; }}
                    data-case-index={i}
                    className={cn(
                      "pl-6 py-12 border-l-2 my-2 transition-all duration-300",
                      isActive 
                        ? "border-[#2F5CFF] opacity-100 translate-x-2" 
                        : "border-[#E7E4DC]/40 opacity-40 translate-x-0"
                    )}
                  >
                    <span className="text-[10px] font-mono font-bold text-[#2F5CFF] uppercase tracking-widest block mb-2">
                      CASE STUDY 0{uc.id}
                    </span>
                    <h3 className={cn(
                      "text-2xl font-bold tracking-tight transition-all",
                      isActive ? "text-[#0B1220]" : "text-[#64748B]"
                    )}>
                      {uc.title}
                    </h3>

                    {/* Supporting Stat Pill */}
                    {uc.stat && (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#2F5CFF]/5 border border-[#2F5CFF]/10 mt-2 mb-1">
                        <span className="text-[9px] font-mono font-bold text-[#2F5CFF] uppercase tracking-wider">
                          {uc.stat}
                        </span>
                      </div>
                    )}

                    <p className="text-sm text-[#64748B] mt-2 leading-relaxed max-w-[400px]">
                      {uc.subtitle}
                    </p>
                    
                    <div className="mt-4 pt-3 border-t border-[#E7E4DC]/60 text-xs font-mono text-slate-500 max-w-[400px]">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className="w-1.5 h-1.5 rounded-full animate-pulse-emerald shrink-0" />
                        <span className="font-bold text-[#2F5CFF] uppercase text-[10px] tracking-wider">SCRIPT PROTOCOL:</span>
                      </div>
                      <span className="italic font-medium text-[#0B1220]">&ldquo;<TypewriterText text={uc.script} active={isActive} />&rdquo;</span>
                    </div>
                  </div>
                );
              })}
            </div>

          </div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* 7. TESTIMONIALS (Warm Canvas Background)                                  */}
      {/* ========================================================================= */}
      <section ref={testimonialsRef} className="py-24 bg-[#FBFAF7] border-b border-[#E7E4DC]">
        <div className="max-w-[1200px] mx-auto px-6">
          
          {/* Eyebrow for Testimonials */}
          <SectionEyebrow num="06" title="PROVEN IMPACT" />

          <div className="max-w-xl mb-16 text-center mx-auto space-y-4">
            <motion.h2 
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.3, delay: 0.1, ease: "easeOut" }}
              className="font-sans font-extrabold text-3xl sm:text-4xl text-[#0B1220] tracking-tight"
            >
              What teams say
            </motion.h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { 
                qPrefix: "Our EMI reminder calls used to take ", 
                qMid1: " days for ", 
                qMid2: " customers. Now it takes ", 
                qSuffix: " minutes. The polite, clear localized script our customers actually respond to.",
                num1: "4", 
                num2: "2,000", 
                num3: "90",
                name: "Rahul Mehta", 
                role: "Collections Head", 
                company: "Mehta Finance · Pune", 
                initials: "RM"
              },
              { 
                qPrefix: "I save almost ₹", 
                qMid1: "/month on call agents and our appointment no-shows dropped from ", 
                qMid2: " to ", 
                qSuffix: " Setup took ", 
                qSuffix2: " minutes.",
                num1: "40,000", 
                num2: "22%", 
                num3: "7%",
                num4: "15",
                name: "Dr. Priya Iyer", 
                role: "Director", 
                company: "Iyer Diagnostics · Bengaluru", 
                initials: "PI"
              },
              { 
                qPrefix: "We confirm ", 
                qMid1: " COD orders a day before dispatch. Receptify cut our RTO by ", 
                qSuffix: " The dashboard is genuinely useful, not decorative.", 
                num1: "300+", 
                num2: "30%",
                name: "Aditya Kapoor", 
                role: "Founder", 
                company: "Kraftly D2C · Mumbai", 
                initials: "AK"
              }
            ].map((t, i) => (
              <div 
                key={i} 
                style={{ transitionDelay: `${i * 100}ms` }}
                className={cn(
                  "bg-white border border-[#E7E4DC] rounded-2xl p-7 shadow-[0_0_15px_rgba(47,92,255,0.01)] flex flex-col justify-between hover:border-[#2F5CFF] transform transition-all duration-300 ease-out",
                  testimonialsInView 
                    ? "opacity-100 translate-y-0" 
                    : "opacity-0 translate-y-6"
                )}
              >
                <div className="space-y-4">
                  <div className="flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, j) => <Star key={j} className="w-3.5 h-3.5 text-[#2F5CFF] fill-[#2F5CFF]" />)}
                  </div>
                  <p className="text-xs sm:text-sm text-[#0B1220] italic leading-relaxed font-sans">
                    &ldquo;
                    {t.qPrefix}
                    <span className="font-mono text-[#2F5CFF] font-bold">{t.num1}</span>
                    {t.qMid1}
                    <span className="font-mono text-[#2F5CFF] font-bold">{t.num2}</span>
                    {t.qMid2 && (
                      <>
                        {t.qMid2}
                        <span className="font-mono text-[#2F5CFF] font-bold">{t.num3}</span>
                      </>
                    )}
                    {t.num4 && (
                      <>
                        {t.qSuffix}
                        <span className="font-mono text-[#2F5CFF] font-bold">{t.num4}</span>
                        {t.qSuffix2}
                      </>
                    )}
                    {!t.num4 && t.qSuffix}
                    &rdquo;
                  </p>
                </div>
                <div className="mt-8 pt-5 border-t border-[#E7E4DC] flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#2F5CFF]/5 text-[#2F5CFF] grid place-items-center text-xs font-mono font-bold border border-[#2F5CFF]/10">
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
          <div className="text-center mt-8">
            <span className="text-[10px] italic text-[#64748B] font-mono uppercase tracking-wider">*(Placeholder note: replace with real customer quotes before launch)*</span>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 8. PRICING (White Background)                                             */}
      {/* ========================================================================= */}
      <section id="pricing" ref={pricingRef} className="py-24 bg-white relative border-b border-[#E7E4DC]">
        <div className="max-w-[1200px] mx-auto px-6">
          
          {/* Eyebrow for Pricing */}
          <SectionEyebrow num="07" title="PRICING & TIERS" />

          <div className="text-center max-w-xl mx-auto mb-16 space-y-4">
            <motion.h2 
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.3, delay: 0.1, ease: "easeOut" }}
              className="font-sans font-extrabold text-3xl sm:text-4xl text-[#0B1220] tracking-tight"
            >
              Simple, usage-based pricing
            </motion.h2>
            
            {/* Toggle: Monthly / Annual */}
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.3, delay: 0.2, ease: "easeOut" }}
              className="inline-flex items-center gap-2.5 bg-white p-1.5 rounded-xl border border-[#E7E4DC] mt-4 shadow-sm"
            >
              <button 
                onClick={() => setIsAnnual(false)}
                className={`px-4 py-1.5 text-xs font-bold uppercase rounded-lg tracking-wider transition-all select-none cursor-pointer ${!isAnnual ? 'bg-[#2F5CFF] text-white shadow-sm' : 'text-[#64748B] hover:text-[#0B1220]'}`}
              >
                Monthly
              </button>
              <button 
                onClick={() => setIsAnnual(true)}
                className={`px-4 py-1.5 text-xs font-bold uppercase rounded-lg tracking-wider transition-all select-none cursor-pointer flex items-center gap-1.5 ${isAnnual ? 'bg-[#2F5CFF] text-white shadow-sm' : 'text-[#64748B] hover:text-[#0B1220]'}`}
              >
                Annual
                <span className="text-[8px] bg-[#2F5CFF]/10 text-[#2F5CFF] font-mono font-bold px-1.5 py-0.5 rounded border border-[#2F5CFF]/20 uppercase">20% off</span>
              </button>
            </motion.div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto items-stretch">
            {[
              { 
                name: 'Starter', 
                price: isAnnual ? '2,399' : '2,999', 
                sub: 'For a single use case and one team', 
                calls: '1,000', 
                features: ['1 active campaign', 'Email support', 'Standard voices', 'Dashboard analytics'], 
                featured: false,
                btnText: 'Start free trial'
              },
              { 
                name: 'Growth', 
                price: isAnnual ? '7,199' : '8,999', 
                sub: 'For teams running multiple campaigns', 
                calls: '10,000', 
                features: ['Unlimited campaigns', 'Priority support', 'Custom scripts & voices', 'CRM integrations'], 
                featured: true,
                btnText: 'Start free trial'
              },
              { 
                name: 'Scale', 
                price: 'Custom', 
                sub: 'For high-volume, multi-branch businesses', 
                calls: 'Unlimited', 
                features: ['Dedicated account manager', 'Custom integrations', 'SLA & uptime guarantee', 'Custom region accents'], 
                featured: false,
                btnText: 'Talk to sales'
              },
            ].map((p, idx) => (
              <div
                key={p.name}
                style={{ transitionDelay: `${idx * 100}ms` }}
                className={cn(
                  "border rounded-2xl p-8 flex flex-col justify-between relative transform transition-all duration-300 ease-out shadow-[0_0_15px_rgba(47,92,255,0.01)]",
                  p.featured
                    ? "border-[#2F5CFF] md:-translate-y-2.5 shadow-[0_20px_50px_rgba(11,18,32,0.25)] scale-102 border-2 bg-[#0B1220]/90 backdrop-blur-xl text-white"
                    : "border-[#E7E4DC] hover:border-[#2F5CFF] transition-colors bg-white text-[#0B1220]"
                )}
              >
                {p.featured && (
                  <span className="absolute top-5 right-5 bg-[#2F5CFF] text-white text-[9px] font-mono font-bold uppercase tracking-wider px-2.5 py-1 rounded shadow-sm animate-pulse">Most Popular</span>
                )}
                <div>
                  <h3 className={cn("font-bold text-2xl", p.featured ? "text-white" : "text-[#0B1220]")}>{p.name}</h3>
                  <p className={cn("text-xs mt-1.5 leading-relaxed", p.featured ? "text-slate-300" : "text-[#64748B]")}>{p.sub}</p>
                  
                  <div className="mt-8 flex items-baseline gap-1.5">
                    <span className={cn("text-4xl font-extrabold", p.featured ? "text-white" : "text-[#0B1220]")}>₹</span>
                    <span className="text-4xl font-mono font-bold text-[#2F5CFF]">{p.price}</span>
                    {p.price !== 'Custom' && <span className={cn("text-xs", p.featured ? "text-slate-400" : "text-[#64748B]")}>/ month</span>}
                  </div>
                  
                  <div className={cn("mt-3 text-xs font-semibold uppercase", p.featured ? "text-slate-400" : "text-slate-500")}>
                    <span className="font-mono text-[#2F5CFF] font-bold">{p.calls}</span> calls / month included
                  </div>
                  
                  <ul className="mt-8 space-y-4 text-xs">
                    {p.features.map((f) => (
                      <li key={f} className={cn("flex items-start gap-2.5 font-medium", p.featured ? "text-slate-200" : "text-slate-700")}>
                        <CheckCircle2 className="w-4 h-4 text-[#2F5CFF] shrink-0 mt-0.5" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                
                <Link
                  href="/signup"
                  className={cn(
                    "w-full mt-10 py-3.5 rounded-lg text-xs font-mono font-bold uppercase tracking-widest text-center transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer",
                    p.featured
                      ? "bg-[#2F5CFF] text-white hover:bg-[#1D4ED8]"
                      : "bg-white border border-[#E7E4DC] text-[#0B1220] hover:bg-slate-50"
                  )}
                >
                  <span>{p.btnText}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* 8.5 COMPLIANCE INFO (Warm Canvas Background)                              */}
      {/* ========================================================================= */}
      <section id="compliance" ref={complianceRef} className="py-24 bg-[#FBFAF7] border-b border-[#E7E4DC]">
        <div className="max-w-[1200px] mx-auto px-6">
          
          {/* Eyebrow for Compliance */}
          <SectionEyebrow num="08" title="REGULATORY ALIGNMENT" align="left" />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">

            <div className="lg:col-span-6 space-y-6">
              <motion.h2 
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.3, delay: 0.1, ease: "easeOut" }}
                className="text-3xl font-extrabold text-[#0B1220] tracking-tight leading-tight"
              >
                Built strictly for responsible customer outreach.
              </motion.h2>
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
                  <div key={idx} className="bg-white border border-[#E7E4DC] p-4 rounded-xl flex gap-3 shadow-[0_0_15px_rgba(47,92,255,0.01)]">
                    <CheckCircle2 className="w-4 h-4 text-[#2F5CFF] shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-[#0B1220]">{item.title}</h4>
                      <p className="text-[11px] text-[#64748B] mt-1 leading-normal">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="bg-white border border-[#E7E4DC] p-7 rounded-2xl relative overflow-hidden shadow-[0_0_15px_rgba(47,92,255,0.01)]">
                <div className="absolute top-0 right-0 w-24 h-24 bg-[#2F5CFF]/5 rounded-bl-[80px]" />
                <div className="flex items-center gap-3 text-[#2F5CFF] mb-4 bg-[#2F5CFF]/5 border border-[#2F5CFF]/15 rounded-lg p-3">
                  <ShieldAlert className="w-5 h-5 shrink-0" />
                  <span className="text-xs font-bold font-mono uppercase tracking-wider">No Cold Spam Allowed</span>
                </div>
                <h3 className="font-extrabold text-[#0B1220] text-lg">Ethical Calling Standards</h3>
                <p className="text-xs text-[#64748B] mt-2.5 leading-relaxed">
                  We enforce strong filters to prevent abusive cold robocalling. Receptify works only with existing customer lists where transactional follow-up or scheduled account service reminders have been legally initiated.
                </p>
                <div className="mt-6 flex flex-wrap gap-2 text-[10px] font-mono text-[#64748B]">
                  <span className="px-2.5 py-1 bg-[#FBFAF7] border border-[#E7E4DC] rounded-full font-bold">TRAI GUIDELINES COMPLIANT</span>
                  <span className="px-2.5 py-1 bg-[#FBFAF7] border border-[#E7E4DC] rounded-full font-bold">DLT HEADERS SUPPORTED</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 9. FINAL CTA (Atmospheric Navy Contrast Bookend)                           */}
      {/* ========================================================================= */}
      <section className="bg-[#0B1220] text-white py-24 relative overflow-hidden border-t border-slate-900">
        
        {/* Soft, premium glowing blue light bloom */}
        <div className="absolute w-[450px] h-[450px] bg-[#2F5CFF]/[0.08] rounded-full blur-[100px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" />

        <div className="max-w-[1200px] mx-auto px-6 relative z-10 text-center max-w-[650px] space-y-6">
          
          {/* Eyebrow for CTA */}
          <SectionEyebrow num="09" title="GET STARTED" />

          <motion.h2 
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.3, delay: 0.1, ease: "easeOut" }}
            className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight"
          >
            Stop calling customers by hand.
          </motion.h2>
          <p className="text-sm text-slate-400 leading-relaxed">
            Free for your first <span className="font-mono text-[#2F5CFF] font-bold">50</span> calls. Set up scripts, import contacts, and experience region-specific calling in under <span className="font-mono text-[#2F5CFF] font-bold">2</span> minutes. No credit card required.
          </p>
          <div className="pt-4">
            <Link href="/signup" className="px-6 py-3.5 bg-[#2F5CFF] hover:bg-[#1D4ED8] text-white text-xs font-mono font-bold uppercase tracking-widest rounded-lg shadow-inner transition-all">
              Start Free Trial
            </Link>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 10. FOOTER                                                                */}
      {/* ========================================================================= */}
      <footer className="bg-white text-[#0F172A] border-t border-[#E7E4DC] pt-16 pb-12">
        <div className="max-w-[1200px] mx-auto px-6 grid grid-cols-2 md:grid-cols-5 gap-10">
          <div className="col-span-2 space-y-5">
            <Logo />
            <p className="text-xs text-[#64748B] max-w-xs leading-relaxed">
              Automated AI Voice Platform for Indian Businesses. Experience high-fidelity transactional customer follow-up calls in regional accents.
            </p>
          </div>
          
          {[
            { h: 'Product', l: [['Features', '#features'], ['Use Cases', '#use-cases'], ['Pricing', '#pricing']] },
            { h: 'Company', l: [['About Us', '#'], ['Careers', '#'], ['Blog', '#']] },
            { h: 'Legal', l: [['Privacy Policy', '#'], ['Terms of Service', '#'], ['Compliance', '#compliance']] },
          ].map((col) => (
            <div key={col.h}>
              <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#2F5CFF]">{col.h}</div>
              <ul className="mt-4 space-y-2.5">
                {col.l.map(([label, href]) => (
                  <li key={label}>
                    <a href={href} className="text-xs text-[#64748B] hover:text-[#2F5CFF] transition-colors font-medium">
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="max-w-[1200px] mx-auto px-6 mt-16 pt-8 border-t border-[#E7E4DC] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#64748B]">
          <div className="flex items-center gap-2 font-medium">
            <span>© <span className="font-mono text-[#2F5CFF] font-bold">2026</span> Receptify · All rights reserved.</span>
            <span className="text-slate-300">·</span>
            <div className="flex items-center gap-1.5 text-[#2F5CFF] font-mono text-[10px] font-bold">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#2F5CFF] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#2F5CFF]"></span>
              </span>
              <span>All systems operational</span>
            </div>
          </div>
          <div className="flex gap-4 font-semibold text-[11px] uppercase tracking-wider text-[#64748B]">
            <a href="#" className="hover:text-[#2F5CFF] transition-colors">Privacy</a>
            <a href="#" className="hover:text-[#2F5CFF] transition-colors">Terms</a>
          </div>
        </div>
      </footer>

    </main>
  );
}

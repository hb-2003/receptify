'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Users, Megaphone, PlusCircle, Sparkles, History,
  Mic, FileText, BarChart3, FileStack, ShieldCheck, CreditCard, Settings, HelpCircle, LogOut,
} from 'lucide-react';
import { Logo } from './Logo';
import { toast } from 'sonner';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/customers', label: 'Customers', icon: Users },
  { href: '/campaigns', label: 'Campaigns', icon: Megaphone },
  { href: '/campaigns/new', label: 'Create Campaign', icon: PlusCircle },
  { href: '/scripts', label: 'AI Script Generator', icon: Sparkles },
  { href: '/calls', label: 'Call History', icon: History },
  { href: '/calls?has_recording=1', label: 'Recordings', icon: Mic },
  { href: '/calls?has_transcript=1', label: 'Transcripts', icon: FileText },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/templates', label: 'Templates', icon: FileStack },
  { href: '/compliance', label: 'Compliance', icon: ShieldCheck },
  { href: '/billing', label: 'Billing', icon: CreditCard },
  { href: '/settings', label: 'Settings', icon: Settings },
  { href: '/help', label: 'Help', icon: HelpCircle },
];

/* ========================================================================= */
/* composable shadcn/ui base sidebar sub-components                          */
/* ========================================================================= */

export const SidebarHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("px-5 pt-5 pb-4", className)}
    {...props}
  />
));
SidebarHeader.displayName = "SidebarHeader";

export const SidebarContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <nav
    ref={ref}
    className={cn("flex-1 overflow-y-auto px-2.5 py-2 space-y-0.5", className)}
    {...props}
  />
));
SidebarContent.displayName = "SidebarContent";

export const SidebarFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("border-t border-white/10 p-3.5", className)}
    {...props}
  />
));
SidebarFooter.displayName = "SidebarFooter";

/* ========================================================================= */
/* main Sidebar component                                                    */
/* ========================================================================= */

export function Sidebar({ user, business }: { user?: { ownerName: string; email: string }; business?: { name: string; planTier?: string } }) {
  const pathname = usePathname();
  const router = useRouter();

  const isActive = (href: string) => {
    const base = href.split('?')[0];
    if (base === '/dashboard') return pathname === '/dashboard';
    return pathname === base || pathname.startsWith(base + '/');
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    toast.success('Logged out');
    router.push('/login');
  };

  const planLabel = business?.planTier
    ? `${business.planTier.charAt(0).toUpperCase()}${business.planTier.slice(1)} Plan`
    : 'Free Trial';

  return (
    <aside
      className="fixed left-0 top-0 h-screen w-[220px] bg-brand-navy flex flex-col z-30 border-r border-brand-900"
      data-testid="dashboard-sidebar"
    >
      <SidebarHeader>
        <Link href="/dashboard"><Logo variant="white" /></Link>
      </SidebarHeader>

      <SidebarContent>
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href + item.label}
              href={item.href}
              data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors',
                active
                  ? 'bg-brand-900 text-white'
                  : 'text-white/65 hover:bg-white/[0.06] hover:text-white',
              )}
            >
              <Icon className="w-4 h-4 shrink-0" strokeWidth={2} />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </SidebarContent>

      <SidebarFooter>
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-9 h-9 rounded-full bg-brand-600 text-white grid place-items-center font-bold text-sm">
            {(user?.ownerName || 'U').slice(0, 1).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold text-white truncate">{user?.ownerName || 'User'}</div>
            <div className="text-[11px] text-white/55 truncate">{business?.name} · {planLabel}</div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          data-testid="logout-button"
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-[13px] font-medium text-white/70 hover:bg-white/[0.06] hover:text-white transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" /> Sign out
        </button>
      </SidebarFooter>
    </aside>
  );
}

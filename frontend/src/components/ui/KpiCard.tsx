import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

export function KpiCard({
  label, value, icon: Icon, trend, trendType, className, testId,
}: { label: string; value: string | number; icon?: LucideIcon; trend?: string; trendType?: 'up' | 'down' | 'neutral'; className?: string; testId?: string }) {
  const trendColor =
    trendType === 'up' ? 'text-emerald-600' :
    trendType === 'down' ? 'text-red-600' :
    'text-ink-subtle';
  return (
    <div className={cn('bg-white border border-line rounded-xl p-5 hover:shadow-card-hover transition-shadow', className)} data-testid={testId}>
      <div className="flex items-start justify-between mb-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">{label}</span>
        {Icon && (
          <div className="w-7 h-7 rounded-lg bg-brand-50 grid place-items-center">
            <Icon className="w-3.5 h-3.5 text-brand-600" />
          </div>
        )}
      </div>
      <div className="text-[28px] leading-none font-bold text-ink mt-2" style={{ letterSpacing: '-0.02em' }}>{value}</div>
      {trend && <div className={cn('text-xs mt-2', trendColor)}>{trend}</div>}
    </div>
  );
}

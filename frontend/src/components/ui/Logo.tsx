import { cn } from '@/lib/utils';

export function Logo({ className, variant = 'default', showText = true }: { className?: string; variant?: 'default' | 'white'; showText?: boolean }) {
  const isWhite = variant === 'white';
  return (
    <div className={cn('flex items-center gap-2.5', className)} data-testid="receptify-logo">
      {/* SVG signal/phone mark */}
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="url(#receptify-grad)" />
        <path
          d="M11.5 9.5C11.5 8.67 12.17 8 13 8h2.2c.66 0 1.24.43 1.43 1.06l1.06 3.55c.16.53-.04 1.1-.48 1.43l-1.4 1.04c.86 1.66 2.22 3.02 3.88 3.88l1.04-1.4c.33-.44.9-.64 1.43-.48l3.55 1.06c.63.19 1.06.77 1.06 1.43V22c0 .83-.67 1.5-1.5 1.5C14.6 23.5 8.5 17.4 8.5 10.5c0-.55.45-1 1-1z"
          fill="white"
        />
        <circle cx="23.5" cy="9" r="3" fill="#10B981" stroke="white" strokeWidth="1.5" />
        <defs>
          <linearGradient id="receptify-grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
            <stop stopColor="#2563EB" />
            <stop offset="1" stopColor="#1D4ED8" />
          </linearGradient>
        </defs>
      </svg>
      {showText && (
        <span
          className={cn(
            'logo-mark text-[22px] leading-none',
            isWhite ? 'text-white' : 'text-brand-navy',
          )}
        >
          RECEPTIFY
        </span>
      )}
    </div>
  );
}

import { formatInr } from '@susharts/shared';

interface PriceProps {
  paise: number;
  compareAtPaise?: number | null;
  className?: string;
}

export function Price({ paise, compareAtPaise, className = '' }: PriceProps) {
  const hasDiscount = compareAtPaise != null && compareAtPaise > paise;

  return (
    <span className={`inline-flex items-baseline gap-2 ${className}`}>
      <span className={`font-semibold ${hasDiscount ? 'text-red-700' : 'text-cocoa-800'}`}>
        {formatInr(paise)}
      </span>
      {hasDiscount && (
        <span className="text-sm text-cocoa-400 line-through">{formatInr(compareAtPaise)}</span>
      )}
    </span>
  );
}

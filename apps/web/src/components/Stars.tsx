const STAR_PATH =
  'M12 2.6l2.78 5.63 6.22.9-4.5 4.38 1.06 6.19L12 16.78l-5.56 2.92 1.06-6.19-4.5-4.38 6.22-.9L12 2.6Z';

function Star({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d={STAR_PATH} />
    </svg>
  );
}

const SIZES = { sm: 'h-3.5 w-3.5', md: 'h-4 w-4', lg: 'h-6 w-6' } as const;

/** Read-only rating display. Partial stars are shown by clipping an overlay. */
export function Stars({
  value,
  size = 'md',
  className = '',
}: {
  value: number;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(5, value));
  const cls = SIZES[size];
  return (
    <span
      className={`relative inline-flex shrink-0 ${className}`}
      role="img"
      aria-label={`${clamped} out of 5 stars`}
    >
      <span className="flex gap-0.5 text-blush-200">
        {[0, 1, 2, 3, 4].map((i) => (
          <Star key={i} className={cls} />
        ))}
      </span>
      <span
        className="absolute inset-0 overflow-hidden"
        style={{ width: `${(clamped / 5) * 100}%` }}
        aria-hidden="true"
      >
        <span className="flex gap-0.5 text-amber-500">
          {[0, 1, 2, 3, 4].map((i) => (
            <Star key={i} className={cls} />
          ))}
        </span>
      </span>
    </span>
  );
}

/** Interactive 1–5 picker used in the review form. */
export function StarPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex gap-1" role="radiogroup" aria-label="Your rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n === 1 ? '' : 's'}`}
          disabled={disabled}
          onClick={() => onChange(n)}
          className={`rounded-full p-1 transition hover:scale-110 disabled:opacity-50 ${
            n <= value ? 'text-amber-500' : 'text-blush-200 hover:text-amber-300'
          }`}
        >
          <Star className="h-7 w-7" />
        </button>
      ))}
    </div>
  );
}

export function RatingLine({
  average,
  count,
  size = 'sm',
}: {
  average: number;
  count: number;
  size?: keyof typeof SIZES;
}) {
  if (count === 0) return null;
  return (
    <span className="inline-flex items-center gap-1.5">
      <Stars value={average} size={size} />
      <span className="text-xs text-cocoa-400">
        {average.toFixed(1)} ({count})
      </span>
    </span>
  );
}

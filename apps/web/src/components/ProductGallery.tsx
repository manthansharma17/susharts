import type { ProductImage } from '@susharts/shared';
import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import { FlowerIcon } from './Decor.js';

interface Props {
  images: ProductImage[];
  productName: string;
}

function Arrow({
  dir,
  onClick,
  className = '',
}: {
  dir: 'prev' | 'next';
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={dir === 'prev' ? 'Previous photo' : 'Next photo'}
      className={`flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-cocoa-700 shadow-soft transition hover:bg-white hover:text-blush-700 ${className}`}
    >
      <svg
        className="h-5 w-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d={dir === 'prev' ? 'M15 18l-6-6 6-6' : 'M9 6l6 6-6 6'}
        />
      </svg>
    </button>
  );
}

function Lightbox({
  images,
  index,
  productName,
  onIndex,
  onClose,
}: {
  images: ProductImage[];
  index: number;
  productName: string;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const count = images.length;
  const current = images[index]!;
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') onIndex((index - 1 + count) % count);
      if (e.key === 'ArrowRight') onIndex((index + 1) % count);
    };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [index, count, onIndex, onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${productName} photos`}
      className="fixed inset-0 z-50 flex flex-col bg-cocoa-900/95"
      onClick={onClose}
    >
      <div className="flex items-center justify-between px-4 py-3 text-sm text-white/80">
        <span>
          {index + 1} / {count}
        </span>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex h-10 w-10 items-center justify-center rounded-full text-white hover:bg-white/10"
        >
          <svg
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-4">
        <img
          src={current.url}
          alt={current.altText ?? productName}
          className="max-h-full max-w-full rounded-xl object-contain"
          onClick={(e) => e.stopPropagation()}
        />
        {count > 1 && (
          <>
            <Arrow
              dir="prev"
              onClick={() => onIndex((index - 1 + count) % count)}
              className="absolute left-4"
            />
            <Arrow
              dir="next"
              onClick={() => onIndex((index + 1) % count)}
              className="absolute right-4"
            />
          </>
        )}
      </div>
      {count > 1 && (
        <div
          className="flex justify-center gap-2 overflow-x-auto px-4 py-4"
          onClick={(e) => e.stopPropagation()}
        >
          {images.map((img, i) => (
            <button
              key={img.id}
              type="button"
              onClick={() => onIndex(i)}
              aria-label={`Photo ${i + 1}`}
              aria-current={i === index}
              className={`h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 ${i === index ? 'border-white' : 'border-transparent opacity-60 hover:opacity-100'}`}
            >
              <img src={img.url} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ProductGallery({ images, productName }: Props) {
  const sorted = [...images].sort((a, b) => a.position - b.position);
  const count = sorted.length;
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const [lightbox, setLightbox] = useState(false);
  const track = useRef<HTMLDivElement>(null);

  const go = useCallback((i: number) => setIndex(((i % count) + count) % count), [count]);

  // Keep the mobile swipe track in sync when the index changes from dots/arrows.
  useEffect(() => {
    const el = track.current;
    if (el && Math.round(el.scrollLeft / el.clientWidth) !== index) {
      el.scrollTo({ left: index * el.clientWidth, behavior: 'smooth' });
    }
  }, [index]);

  if (count === 0) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-3xl bg-blush-100">
        <FlowerIcon className="h-20 w-20 text-blush-300" />
      </div>
    );
  }

  const current = sorted[index] ?? sorted[0]!;

  function onMove(e: MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    setZoom({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    });
  }

  return (
    <div>
      {/* Desktop: vertical thumbnails + zoomable main image */}
      <div className="hidden gap-3 md:flex">
        {count > 1 && (
          <div className="flex max-h-[34rem] w-20 shrink-0 flex-col gap-2 overflow-y-auto pr-1">
            {sorted.map((img, i) => (
              <button
                key={img.id}
                type="button"
                onMouseEnter={() => setIndex(i)}
                onFocus={() => setIndex(i)}
                onClick={() => setIndex(i)}
                aria-label={`Show photo ${i + 1}`}
                aria-current={i === index}
                className={`aspect-square w-full shrink-0 overflow-hidden rounded-xl border-2 bg-blush-100 transition ${
                  i === index
                    ? 'border-blush-500 shadow-soft'
                    : 'border-blush-100 hover:border-blush-300'
                }`}
              >
                <img src={img.url} alt="" className="h-full w-full object-cover" loading="lazy" />
              </button>
            ))}
          </div>
        )}

        <div
          className="group relative aspect-square flex-1 cursor-zoom-in overflow-hidden rounded-3xl bg-blush-100"
          onMouseMove={onMove}
          onMouseLeave={() => setZoom(null)}
          onClick={() => setLightbox(true)}
        >
          <img
            src={current.url}
            alt={current.altText ?? productName}
            className="h-full w-full object-cover transition-transform duration-150 ease-out"
            style={
              zoom ? { transform: 'scale(2)', transformOrigin: `${zoom.x}% ${zoom.y}%` } : undefined
            }
          />
          {count > 1 && (
            <>
              <Arrow
                dir="prev"
                onClick={() => go(index - 1)}
                className="absolute left-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 focus:opacity-100"
              />
              <Arrow
                dir="next"
                onClick={() => go(index + 1)}
                className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 focus:opacity-100"
              />
            </>
          )}
          <span className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-cocoa-600 shadow-sm">
            {zoom
              ? 'Click to view full screen'
              : count > 1
                ? `${index + 1} / ${count} · Hover to zoom`
                : 'Hover to zoom'}
          </span>
        </div>
      </div>

      {/* Mobile: swipeable carousel */}
      <div className="md:hidden">
        <div className="relative">
          <div
            ref={track}
            className="flex snap-x snap-mandatory overflow-x-auto rounded-3xl bg-blush-100 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            onScroll={(e) => {
              const el = e.currentTarget;
              const i = Math.round(el.scrollLeft / el.clientWidth);
              if (i !== index) setIndex(i);
            }}
          >
            {sorted.map((img, i) => (
              <button
                key={img.id}
                type="button"
                onClick={() => setLightbox(true)}
                className="aspect-square w-full shrink-0 snap-center"
                aria-label={`Open photo ${i + 1} full screen`}
              >
                <img
                  src={img.url}
                  alt={img.altText ?? productName}
                  className="h-full w-full object-cover"
                  loading={i === 0 ? 'eager' : 'lazy'}
                />
              </button>
            ))}
          </div>
          {count > 1 && (
            <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-white/90 px-2.5 py-0.5 text-xs font-semibold text-cocoa-600">
              {index + 1} / {count}
            </span>
          )}
        </div>
        {count > 1 && (
          <div className="mt-3 flex justify-center gap-1.5">
            {sorted.map((img, i) => (
              <button
                key={img.id}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Show photo ${i + 1}`}
                className={`h-2 rounded-full transition-all ${i === index ? 'w-6 bg-blush-500' : 'w-2 bg-blush-200'}`}
              />
            ))}
          </div>
        )}
      </div>

      {lightbox && (
        <Lightbox
          images={sorted}
          index={index}
          productName={productName}
          onIndex={go}
          onClose={() => setLightbox(false)}
        />
      )}
    </div>
  );
}

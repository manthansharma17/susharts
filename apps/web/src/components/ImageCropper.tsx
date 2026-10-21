import { MAX_IMAGE_BYTES } from '@susharts/shared';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent,
  type WheelEvent,
} from 'react';

const ASPECTS = [
  { label: 'Square', value: 1 },
  { label: 'Portrait 4:5', value: 4 / 5 },
  { label: 'Landscape 4:3', value: 4 / 3 },
] as const;

const MAX_OUTPUT_EDGE = 2000;
const MAX_ZOOM = 4;

export type CropResult = { kind: 'edited'; file: File } | { kind: 'original' } | { kind: 'cancel' };

interface Props {
  file: File;
  /** e.g. "Photo 2 of 3" */
  progress?: string | undefined;
  /** Offer "Use original" (new uploads) or only "Discard changes" (editing an existing photo). */
  allowOriginal?: boolean;
  confirmLabel?: string;
  onDone: (result: CropResult) => void;
}

interface Adjust {
  brightness: number;
  contrast: number;
  saturation: number;
}

const NEUTRAL: Adjust = { brightness: 100, contrast: 100, saturation: 100 };

function filterCss(a: Adjust): string {
  return `brightness(${a.brightness}%) contrast(${a.contrast}%) saturate(${a.saturation}%)`;
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Could not process image'))),
      'image/jpeg',
      quality,
    ),
  );
}

function Slider({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  const id = `crop-${label.toLowerCase()}`;
  return (
    <div>
      <div className="flex justify-between text-xs font-semibold text-cocoa-600">
        <label htmlFor={id}>{label}</label>
        <span className="text-cocoa-400">{value}%</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full accent-blush-600"
      />
    </div>
  );
}

export function ImageCropper({
  file,
  progress,
  onDone,
  allowOriginal = true,
  confirmLabel = 'Save & upload',
}: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [aspect, setAspect] = useState<number>(1);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [adjust, setAdjust] = useState<Adjust>(NEUTRAL);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const frameWrap = useRef<HTMLDivElement>(null);
  const [wrapWidth, setWrapWidth] = useState(0);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  // Create and revoke the object URL in one effect so they always pair up,
  // including React StrictMode's mount → unmount → mount in development.
  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    let active = true;
    setImg(null);
    setLoadError(false);
    const image = new Image();
    image.onload = () => {
      if (!active) return;
      setUrl(objectUrl);
      setImg(image);
    };
    image.onerror = () => {
      if (active) setLoadError(true);
    };
    image.src = objectUrl;
    return () => {
      active = false;
      URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  useLayoutEffect(() => {
    const el = frameWrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWrapWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onDone({ kind: 'cancel' });
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDone]);

  // Frame size on screen (fits the panel, at most 420px tall).
  const maxH = 420;
  const frameW = Math.max(1, Math.min(wrapWidth, maxH * aspect));
  const frameH = frameW / aspect;

  const quarterTurn = rotation % 180 !== 0;
  const rw = img ? (quarterTurn ? img.naturalHeight : img.naturalWidth) : 1;
  const rh = img ? (quarterTurn ? img.naturalWidth : img.naturalHeight) : 1;
  const coverScale = Math.max(frameW / rw, frameH / rh);
  const scale = coverScale * zoom;

  // Keep the photo covering the whole frame — no empty edges.
  const clamp = (o: { x: number; y: number }, s = scale) => {
    const maxX = Math.max(0, (rw * s - frameW) / 2);
    const maxY = Math.max(0, (rh * s - frameH) / 2);
    return { x: Math.min(maxX, Math.max(-maxX, o.x)), y: Math.min(maxY, Math.max(-maxY, o.y)) };
  };

  useEffect(() => {
    setOffset((o) => clamp(o));
  }, [scale, frameW, frameH, rotation]);

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  }
  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d) return;
    setOffset(clamp({ x: d.ox + e.clientX - d.x, y: d.oy + e.clientY - d.y }));
  }
  function onWheel(e: WheelEvent<HTMLDivElement>) {
    setZoom((z) => Math.min(MAX_ZOOM, Math.max(1, z - e.deltaY * 0.0015)));
  }

  async function save() {
    if (!img) return;
    setSaving(true);
    setError(null);
    try {
      // Crop region measured in pixels of the (rotated) original.
      const cropW = frameW / scale;
      const cropH = frameH / scale;
      const k = Math.min(1, MAX_OUTPUT_EDGE / Math.max(cropW, cropH));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(cropW * k);
      canvas.height = Math.round(cropH * k);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Your browser cannot edit images');

      ctx.fillStyle = '#fff'; // JPEG has no transparency; avoid black backgrounds from PNGs.
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.filter = filterCss(adjust);
      ctx.imageSmoothingQuality = 'high';
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.scale(k, k);
      ctx.translate(offset.x / scale, offset.y / scale);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);

      let blob = await canvasToBlob(canvas, 0.9);
      if (blob.size > MAX_IMAGE_BYTES) blob = await canvasToBlob(canvas, 0.75);
      if (blob.size > MAX_IMAGE_BYTES)
        throw new Error('Edited image is still over the size limit. Try cropping tighter.');

      const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
      onDone({ kind: 'edited', file: new File([blob], name, { type: 'image/jpeg' }) });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not process image');
      setSaving(false);
    }
  }

  const originalTooBig = file.size > MAX_IMAGE_BYTES;
  const adjusted =
    adjust.brightness !== 100 || adjust.contrast !== 100 || adjust.saturation !== 100;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-cocoa-900/70 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Crop and adjust photo"
    >
      <div className="flex max-h-full w-full max-w-4xl flex-col overflow-hidden rounded-[2rem] bg-white shadow-soft">
        <div className="flex items-center justify-between border-b border-blush-100 px-5 py-3">
          <div>
            <h2 className="font-display text-lg font-semibold text-cocoa-800">Crop &amp; adjust</h2>
            <p className="truncate text-xs text-cocoa-400">
              {progress ? `${progress} · ` : ''}
              {file.name}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onDone({ kind: 'cancel' })}
            className="rounded-full px-3 py-1 text-sm text-cocoa-500 hover:bg-blush-50"
          >
            Cancel
          </button>
        </div>

        <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto p-5 md:grid-cols-[1fr_15rem]">
          <div ref={frameWrap} className="flex min-w-0 items-center justify-center">
            {loadError ? (
              <p className="text-sm text-red-700">This file could not be opened as an image.</p>
            ) : !img || !url || wrapWidth === 0 ? (
              <div className="h-64 w-full animate-pulse rounded-2xl bg-blush-100" />
            ) : (
              <div
                className="relative cursor-grab touch-none select-none overflow-hidden rounded-2xl bg-blush-100 active:cursor-grabbing"
                style={{ width: frameW, height: frameH }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={() => (drag.current = null)}
                onPointerCancel={() => (drag.current = null)}
                onWheel={onWheel}
              >
                <img
                  src={url}
                  alt=""
                  draggable={false}
                  className="pointer-events-none absolute left-1/2 top-1/2 max-w-none"
                  style={{
                    width: img.naturalWidth * scale,
                    height: img.naturalHeight * scale,
                    transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) rotate(${rotation}deg)`,
                    filter: filterCss(adjust),
                  }}
                />
                {/* Rule-of-thirds guide */}
                <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
                  {Array.from({ length: 9 }, (_, i) => (
                    <div key={i} className="border border-white/40" />
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-5">
            <div>
              <p className="text-xs font-semibold text-cocoa-600">Shape</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {ASPECTS.map((a) => (
                  <button
                    key={a.label}
                    type="button"
                    onClick={() => setAspect(a.value)}
                    aria-pressed={aspect === a.value}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                      aspect === a.value
                        ? 'bg-blush-600 text-white'
                        : 'bg-blush-50 text-cocoa-600 hover:bg-blush-100'
                    }`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-cocoa-400">Square looks best on product cards.</p>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold text-cocoa-600">
                <label htmlFor="crop-zoom">Zoom</label>
                <span className="text-cocoa-400">{zoom.toFixed(1)}×</span>
              </div>
              <input
                id="crop-zoom"
                type="range"
                min={1}
                max={MAX_ZOOM}
                step={0.01}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="mt-1 w-full accent-blush-600"
              />
              <p className="mt-1 text-xs text-cocoa-400">Drag the photo to reposition.</p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setRotation((r) => (r + 270) % 360)}
                className="btn-secondary flex-1 px-2 py-1.5 text-xs"
              >
                ⟲ Rotate left
              </button>
              <button
                type="button"
                onClick={() => setRotation((r) => (r + 90) % 360)}
                className="btn-secondary flex-1 px-2 py-1.5 text-xs"
              >
                Rotate right ⟳
              </button>
            </div>

            <div className="space-y-3 rounded-2xl bg-blush-50 p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-cocoa-600">Adjust</p>
                {adjusted && (
                  <button
                    type="button"
                    onClick={() => setAdjust(NEUTRAL)}
                    className="text-xs text-blush-700 hover:underline"
                  >
                    Reset
                  </button>
                )}
              </div>
              <Slider
                label="Brightness"
                value={adjust.brightness}
                min={50}
                max={150}
                onChange={(v) => setAdjust((a) => ({ ...a, brightness: v }))}
              />
              <Slider
                label="Contrast"
                value={adjust.contrast}
                min={50}
                max={150}
                onChange={(v) => setAdjust((a) => ({ ...a, contrast: v }))}
              />
              <Slider
                label="Saturation"
                value={adjust.saturation}
                min={0}
                max={200}
                onChange={(v) => setAdjust((a) => ({ ...a, saturation: v }))}
              />
            </div>
          </div>
        </div>

        {error && <p className="px-5 text-sm text-red-700">{error}</p>}

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-blush-100 px-5 py-3">
          {allowOriginal ? (
            <button
              type="button"
              disabled={originalTooBig || saving}
              onClick={() => onDone({ kind: 'original' })}
              title={originalTooBig ? 'Original is over 5 MB; crop it to upload' : undefined}
              className="btn-secondary"
            >
              Use original
            </button>
          ) : (
            <button
              type="button"
              disabled={saving}
              onClick={() => onDone({ kind: 'cancel' })}
              className="btn-secondary"
            >
              Discard changes
            </button>
          )}
          <button
            type="button"
            disabled={!img || saving}
            onClick={() => void save()}
            className="btn-primary"
          >
            {saving ? 'Saving…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

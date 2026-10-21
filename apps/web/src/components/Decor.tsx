interface IconProps {
  className?: string;
}

export function BowIcon({ className = '' }: IconProps) {
  return (
    <svg viewBox="0 0 64 48" className={className} fill="none" aria-hidden="true">
      <path
        d="M32 22C24 10 8 4 5 12c-3 9 7 18 27 12Z"
        fill="currentColor"
        fillOpacity=".25"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path
        d="M32 22c8-12 24-18 27-10 3 9-7 18-27 12Z"
        fill="currentColor"
        fillOpacity=".25"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path
        d="m29 25-9 19 7-3 3 5 2-19m3-2 9 19-7-3-3 5"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <ellipse cx="32" cy="23" rx="4.5" ry="5" fill="currentColor" />
    </svg>
  );
}

export function HeartIcon({ className = '', filled = false }: IconProps & { filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M12 20.5s-7.5-4.6-9.3-9.3C1.4 7.8 3.6 4.5 7 4.5c2 0 3.6 1.1 5 3 1.4-1.9 3-3 5-3 3.4 0 5.6 3.3 4.3 6.7-1.8 4.7-9.3 9.3-9.3 9.3Z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function FlowerIcon({ className = '', center = '#f6c26b' }: IconProps & { center?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      {[0, 72, 144, 216, 288].map((r) => (
        <ellipse
          key={r}
          cx="20"
          cy="10.5"
          rx="7"
          ry="9.5"
          fill="currentColor"
          transform={`rotate(${r} 20 20)`}
        />
      ))}
      <circle cx="20" cy="20" r="5.5" fill={center} />
    </svg>
  );
}

export function YarnIcon({ className = '' }: IconProps) {
  return (
    <svg viewBox="0 0 48 48" className={className} fill="none" aria-hidden="true">
      <circle cx="24" cy="24" r="18" fill="currentColor" fillOpacity=".3" stroke="currentColor" strokeWidth="2.5" />
      <path
        d="M9 17c8 2 22 12 26 24M14 9c6 5 19 17 22 30M28 7c-6 9-12 24-11 34M40 15c-10 1-24 9-31 19"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

const CATEGORY_ICON_PATHS: Array<{ match: RegExp; path: string }> = [
  {
    match: /key|charm/,
    path: 'M12 3a3 3 0 1 1 0 6 3 3 0 0 1 0-6Zm0 6v3m-3.5 1.5h7l-1 7.5h-5Z',
  },
  {
    match: /bouquet|bunch/,
    path: 'M8 6a2.2 2.2 0 1 1 0 4.4A2.2 2.2 0 0 1 8 6Zm8 0a2.2 2.2 0 1 1 0 4.4A2.2 2.2 0 0 1 16 6Zm-4-2.5a2.2 2.2 0 1 1 0 4.4 2.2 2.2 0 0 1 0-4.4ZM7 12h10l-3.5 9h-3Z',
  },
  {
    match: /plush|amigurumi|toy|doll|animal/,
    path: 'M8.5 3c1.3 0 1.8 2.4 1.8 4.6M15.5 3c-1.3 0-1.8 2.4-1.8 4.6M12 7.5a5 5 0 0 1 5 5V16a4 4 0 0 1-4 4h-2a4 4 0 0 1-4-4v-3.5a5 5 0 0 1 5-5Zm-1.8 5h.01m3.6 0h.01',
  },
  {
    match: /bag|pouch|purse|tote/,
    path: 'M5 9h14l-1.2 11H6.2Zm4 0V7a3 3 0 0 1 6 0v2',
  },
  {
    match: /decor|home|pot|plant|coaster/,
    path: 'M7 13h10l-1.5 7h-7Zm5 0V8m0 0c0-2.5 2-4 4-4 0 2.5-2 4-4 4Zm0 0c0-2.5-2-4-4-4 0 2.5 2 4 4 4Z',
  },
  {
    match: /gift|hamper|combo/,
    path: 'M4 9h16v4H4Zm1.5 4h13v7h-13ZM12 9v11M12 9c-1-3-5-4-5-1.5S12 9 12 9Zm0 0c1-3 5-4 5-1.5S12 9 12 9Z',
  },
  {
    match: /access|clip|band|bow/,
    path: 'M12 12 4.5 7.5v9Zm0 0 7.5-4.5v9ZM12 10.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Z',
  },
  {
    match: /flower|rose|tulip|bloom|floral|sunflower/,
    path: 'M12 9.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Zm0-6c1.7 0 2.5 2.3 2 4m-2-4c-1.7 0-2.5 2.3-2 4m8.5 2c.9 1.5-.5 3.5-2.2 3.5m2.2-3.5c-.5-1.7-3-1.8-4.3-.6M5.5 9.5c-.9 1.5.5 3.5 2.2 3.5M5.5 9.5c.5-1.7 3-1.8 4.3-.6M12 14.5V21',
  },
  {
    match: /pipe|wire|chenille/,
    path: 'M4 18c3-8 5 2 8-6s5 2 8-6',
  },
];

const FALLBACK_ICON =
  'M12 4a8 8 0 1 1 0 16 8 8 0 0 1 0-16ZM5 9c4 1 9 5 11 11M8 5c3 3 8 8 9 13M17 6c-4 3-8 9-8 14';

export function CategoryIcon({ slug, name, className = '' }: { slug: string; name: string } & IconProps) {
  const key = `${slug} ${name}`.toLowerCase();
  const path = CATEGORY_ICON_PATHS.find((i) => i.match.test(key))?.path ?? FALLBACK_ICON;
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
}

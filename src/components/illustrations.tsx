/*
  Original hand-drawn line illustrations for the DESIGN.md look: 2px ink strokes,
  flat sage, rose and sea-foam fills. They are decoration, so each one is aria-hidden.
  Colours come from tokens so the drawings follow the theme.
*/

type Props = { className?: string };

const stroke = {
  stroke: 'var(--ill-ink)',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export function CommuterDoodle({ className }: Props) {
  return (
    <svg className={className} viewBox="0 0 120 224" fill="none" aria-hidden="true" focusable="false">
      <path d="M37 78c-11 3-13 34-2 40l6-2-1-37z" fill="var(--ill-sage)" {...stroke} />
      <path d="M50 132c-2 22-4 46-5 72M68 132c2 24 4 48 6 72" {...stroke} />
      <path d="M45 132h29l3 34-13 1-3-22-4 22-14-1z" fill="var(--ill-navy)" {...stroke} />
      <path d="M33 207c4-5 10-5 14-2l1 5H33zM68 209c3-5 10-6 15-2l2 5H68z" fill="var(--ill-ink)" {...stroke} />
      <path d="M39 72c-3 22-1 44 4 62 10 2 22 2 33-1 4-20 5-41 2-61-9-9-30-9-39 0z" fill="var(--ill-rose)" {...stroke} />
      <path d="M77 80c9 6 15 15 17 24-5 5-11 8-17 9" {...stroke} />
      <path d="M71 101l11-4 5 15-11 4z" fill="var(--ill-foam)" {...stroke} />
      <path d="M52 62v9c4 4 9 4 13 0v-9" fill="var(--ill-paper)" {...stroke} />
      <path d="M42 45c0-11 7-19 17-19s17 8 16 19c0 11-7 20-16 20s-17-9-17-20z" fill="var(--ill-paper)" {...stroke} />
      <path d="M41 46c-3-14 6-24 18-24 11 0 19 8 17 21-6-3-10-8-12-13-5 8-14 14-23 16z" fill="var(--ill-ink)" {...stroke} />
      <path d="M53 55c3 3 8 3 11 0" {...stroke} />
      <path d="M52 46h.01M66 46h.01" {...stroke} strokeWidth={3} />
    </svg>
  );
}

export function BusDoodle({ className }: Props) {
  return (
    <svg className={className} viewBox="0 0 208 116" fill="none" aria-hidden="true" focusable="false">
      <path
        d="M20 16c40-4 124-5 162-1 9 1 15 8 16 17l2 44c0 7-5 12-12 12H18c-7 0-12-5-12-12l1-45c0-8 5-14 13-15z"
        fill="var(--ill-sage)"
        {...stroke}
      />
      <path d="M7 62c60 2 130 2 193 0" {...stroke} />
      <path d="M22 28h30v24H21zM62 28h30v24H62zM102 28h30v24h-30z" fill="var(--ill-paper)" {...stroke} />
      <path d="M144 27h38c4 0 7 3 7 7l1 19h-46z" fill="var(--ill-foam)" {...stroke} />
      <path d="M144 27v61" {...stroke} />
      <circle cx="52" cy="90" r="14" fill="var(--ill-ink)" {...stroke} />
      <circle cx="52" cy="90" r="5" fill="var(--ill-paper)" {...stroke} />
      <circle cx="160" cy="90" r="14" fill="var(--ill-ink)" {...stroke} />
      <circle cx="160" cy="90" r="5" fill="var(--ill-paper)" {...stroke} />
      <path d="M186 72h8" {...stroke} />
    </svg>
  );
}

export function PlantDoodle({ className }: Props) {
  return (
    <svg className={className} viewBox="0 0 80 120" fill="none" aria-hidden="true" focusable="false">
      <path d="M40 80c-2-18-1-34 3-50" {...stroke} />
      <path d="M41 58C28 56 17 46 14 32c14 0 25 9 27 26z" fill="var(--ill-sage)" {...stroke} />
      <path d="M42 46c2-15 11-26 25-30 2 15-8 27-25 30z" fill="var(--ill-sage)" {...stroke} />
      <path d="M40 72c9-9 20-11 30-6-6 10-18 13-30 6z" fill="var(--ill-foam)" {...stroke} />
      <path d="M20 80h41l-5 32c0 3-3 5-6 5H31c-3 0-5-2-6-5z" fill="var(--ill-rose)" {...stroke} />
      <path d="M18 80h45" {...stroke} />
    </svg>
  );
}

export function StarDoodle({ className }: Props) {
  return (
    <svg className={className} viewBox="0 0 40 40" fill="none" aria-hidden="true" focusable="false">
      <path
        d="M20 3c1 9 4 13 16 16-11 3-15 8-16 18-2-10-5-15-17-18 11-2 15-7 17-16z"
        fill="var(--ill-rose)"
        {...stroke}
      />
    </svg>
  );
}

export function PlusDoodle({ className }: Props) {
  return (
    <svg className={className} viewBox="0 0 28 28" fill="none" aria-hidden="true" focusable="false">
      <path d="M14 4c-.4 7-.3 13 .4 20M4 14.5c7-.8 13-.8 20-.2" {...stroke} />
    </svg>
  );
}

export function ArrowDoodle({ className }: Props) {
  return (
    <svg className={className} viewBox="0 0 96 64" fill="none" aria-hidden="true" focusable="false">
      <path d="M6 12c22-8 48-2 60 14 5 7 6 15 4 24" {...stroke} />
      <path d="M58 40c4 5 8 9 12 11 2-6 6-11 11-15" {...stroke} />
    </svg>
  );
}

/* A sketched route: two stops joined by a wandering line. Used as a section mark. */
export function RouteDoodle({ className }: Props) {
  return (
    <svg className={className} viewBox="0 0 220 72" fill="none" aria-hidden="true" focusable="false">
      <path d="M18 52c26-34 52-36 74-14s48 20 70 2c12-10 22-16 40-18" {...stroke} strokeDasharray="1 9" />
      <circle cx="18" cy="52" r="9" fill="var(--ill-sage)" {...stroke} />
      <circle cx="202" cy="22" r="9" fill="var(--ill-rose)" {...stroke} />
    </svg>
  );
}

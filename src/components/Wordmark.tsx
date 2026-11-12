/* The product mark: a route bending between two stops, drawn in the illustration hand. */
export default function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span className={compact ? 'wordmark wordmark--compact' : 'wordmark'}>
      <svg className="wordmark-mark" viewBox="0 0 32 32" fill="none" aria-hidden="true" focusable="false">
        <rect x="1" y="1" width="30" height="30" rx="15" fill="var(--primary)" />
        <path
          d="M9 21c2-9 6-9 8-5s5 3 6-5"
          stroke="var(--on-primary)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="9" cy="21" r="2.4" fill="var(--on-primary)" />
        <circle cx="23" cy="11" r="2.4" fill="var(--on-primary)" />
      </svg>
      <span className="wordmark-text">Bengaluru Transit</span>
    </span>
  );
}

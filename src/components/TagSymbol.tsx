// The app's price-tag symbol: the Generate wait animation and (drawn the same
// way in scripts/icons.mjs) the home-screen icon.
// Shape from Tabler Icons "tag" (MIT licence, https://tabler.io/icons).

/** Path data in a 24 × 24 box; the hole is centred at (7.5, 7.5). */
export const TAG_OUTLINE =
  'M3 6v5.172a2 2 0 0 0 .586 1.414l7.71 7.71a2.41 2.41 0 0 0 3.408 0l5.592 -5.592a2.41 2.41 0 0 0 0 -3.408l-7.71 -7.71a2 2 0 0 0 -1.414 -.586h-5.172a3 3 0 0 0 -3 3z';

export function TagSymbol({ size, className }: { size: number; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="7.5" cy="7.5" r="1" />
      <path d={TAG_OUTLINE} />
    </svg>
  );
}

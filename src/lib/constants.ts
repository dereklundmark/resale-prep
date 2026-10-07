// Platforms, conditions and markets are not here: they're rows in SQL,
// loaded from GET /api/config (see src/data/store.ts).

/** Preselected on the NEW form (a code from dbo.conditions). */
export const DEFAULT_CONDITION = 'very_good';

/** Items listed this many days or more are flagged orange. */
export const STALE_DAYS = 30;

/** Group swatches on the Total screen, cycled in order. */
export const GROUP_SHADES = ['#2a2723', '#6f6a62', '#bdb6aa'];

/** Colours for a platform code the catalog doesn't know (shouldn't happen). */
export const UNKNOWN_PLATFORM_COLORS = { colorStrong: '#bdb6aa', colorTint: '#e8e3da', colorText: '#6f6a62' };

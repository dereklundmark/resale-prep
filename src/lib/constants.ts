import type { Condition, Platform } from './types';

export const PLATFORMS: Platform[] = ['tradera', 'blocket', 'facebook'];

export const PLATFORM_LABEL: Record<Platform, string> = {
  tradera: 'Tradera',
  blocket: 'Blocket',
  facebook: 'Facebook',
};

/** Stripe / bar colour. */
export const PLATFORM_STRONG: Record<Platform, string> = {
  tradera: 'oklch(0.8 0.15 85)',
  blocket: 'oklch(0.6 0.19 27)',
  facebook: 'oklch(0.55 0.16 258)',
};

/** Pill / toggle background. */
export const PLATFORM_TINT: Record<Platform, string> = {
  tradera: 'oklch(0.93 0.05 85)',
  blocket: 'oklch(0.93 0.035 27)',
  facebook: 'oklch(0.93 0.03 258)',
};

/** Text on the tint. */
export const PLATFORM_TEXT: Record<Platform, string> = {
  tradera: 'oklch(0.42 0.09 75)',
  blocket: 'oklch(0.47 0.14 27)',
  facebook: 'oklch(0.44 0.13 258)',
};

export const CONDITIONS: Condition[] = [
  'Ny',
  'Nyskick',
  'Mycket bra skick',
  'Bra skick',
  'Använt skick',
  'Renoveringsobjekt',
];

export const DEFAULT_CONDITION: Condition = 'Mycket bra skick';

/** Items listed this many days or more are flagged orange. */
export const STALE_DAYS = 30;

/** Group swatches on the Total screen, cycled in order. */
export const GROUP_SHADES = ['#2a2723', '#6f6a62', '#bdb6aa'];

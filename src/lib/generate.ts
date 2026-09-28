// The AI suggestion call. Layer 1 uses a local mock with the same contract;
// layer 2 replaces mockGenerate with a POST to the Azure Functions API, which
// calls Gemini server-side (the API key must never reach the browser).
import { PLATFORM_LABEL } from './constants';
import type { Condition, Estimate, Platform } from './types';

export interface GenerateInput {
  name: string;
  condition: Condition;
  /** Only these platforms get a category suggestion. */
  platforms: Platform[];
  photos: Blob[];
}

export interface Suggestion {
  /** Swedish. */
  title: string;
  /** Swedish. */
  description: string;
  /** Best match first; the UI adds "Other…" at the end. */
  categories: Partial<Record<Platform, string[]>>;
  /** Reasoning in English. */
  estimate: Estimate;
}

export function generateSuggestion(input: GenerateInput): Promise<Suggestion> {
  return mockGenerate(input);
}

const MOCK_CATEGORIES: Record<Platform, string[]> = {
  tradera: ['Hem & Hushåll › Möbler › Övrigt', 'Hem & Hushåll › Inredning', 'Övrigt'],
  blocket: ['För hemmet › Möbler & heminredning', 'För hemmet › Övrigt', 'Övrigt'],
  facebook: ['Home & Garden › Furniture', 'Home & Garden', 'Miscellaneous'],
};

function mockGenerate({ name, condition, platforms, photos }: GenerateInput): Promise<Suggestion> {
  const thing = name.trim() || 'Föremål';
  return new Promise((resolve) =>
    setTimeout(
      () =>
        resolve({
          title: `${thing} – ${condition.toLowerCase()}`,
          description:
            `Säljer ${thing.toLowerCase()} i ${condition.toLowerCase()}. ` +
            `Fungerar som den ska, inga större skador. ${photos.length > 1 ? 'Se bilderna för detaljer. ' : ''}` +
            'Rökfritt hem. Hämtas eller skickas mot fraktkostnad.',
          categories: Object.fromEntries(platforms.map((p) => [p, MOCK_CATEGORIES[p]])),
          estimate: {
            low: 300,
            high: 500,
            reasoning: `Placeholder estimate — real Gemini suggestions for ${platforms.map((p) => PLATFORM_LABEL[p]).join(', ') || 'these platforms'} arrive in layer 2.`,
          },
        }),
      1300,
    ),
  );
}

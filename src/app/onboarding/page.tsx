/**
 * @fileOverview This file is neutralized to resolve a route conflict with src/app/(app)/onboarding/page.tsx.
 * Next.js does not allow parallel pages to resolve to the same path.
 * 
 * The active onboarding logic is located in the (app) route group.
 */

export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

// No default export here ensures Next.js ignores this as a page route.

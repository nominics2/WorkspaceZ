/**
 * @fileOverview This file is disabled to resolve a route conflict with src/app/(app)/onboarding/page.tsx.
 * The active onboarding logic is maintained within the (app) route group to inherit workspace providers.
 * 
 * Next.js requires one default export per page path. By removing the default export here,
 * we resolve the "parallel pages" error.
 */

// This file is no longer a page.
export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

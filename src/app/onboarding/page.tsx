// This directory exists as a container for route metadata but must not contain 
// a functional page.tsx file because it conflicts with src/app/(app)/onboarding/page.tsx.
//
// In Next.js, having two page.tsx files that resolve to the same URL (in this case, /onboarding)
// triggers a build error. The functional setup logic is kept within the (app) group 
// to benefit from the WorkspaceProvider and shared layouts.

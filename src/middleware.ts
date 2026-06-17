import { NextResponse, type NextRequest } from 'next/server'

/**
 * @fileOverview Minimal middleware for route handling.
 *
 * To resolve Edge Runtime compatibility issues with certain Supabase/SSR implementations on Vercel,
 * we have moved authentication and session protection to the client-side WorkspaceProvider.
 * This prevents the "Node.js API not supported" error during Edge Runtime execution.
 */

export function middleware(request: NextRequest) {
  // We return a simple next() response to avoid initializing the Supabase client here.
  // Session validation and route protection are handled in:
  // - src/components/providers/WorkspaceProvider.tsx (Redirects unauthenticated users)
  // - Individual API routes (Server-side validation)
  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (svg, png, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

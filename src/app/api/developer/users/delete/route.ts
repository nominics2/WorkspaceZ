import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

/**
 * @fileOverview Secure API route for permanent user deletion by platform developers.
 * Handles database cleanup and Supabase Auth user removal using Service Role privileges.
 */

export async function POST(req: Request) {
  try {
    const { targetUserId, confirmEmail } = await req.json();
    const authHeader = req.headers.get('Authorization');

    if (!targetUserId || !confirmEmail) {
      return NextResponse.json({ error: 'Target User ID and Email confirmation are required.' }, { status: 400 });
    }

    if (!authHeader) {
      console.error('[Delete User API] Missing Authorization header');
      return NextResponse.json({ error: 'Unauthorized: Missing session token.' }, { status: 401 });
    }

    // 1. Initialize Clients
    // We use a normal client with the user's token for developer verification and cleanup RPC
    // This is required because the cleanup RPC uses auth.uid() internally.
    const userClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: { headers: { Authorization: authHeader } }
      }
    );

    // We use an admin client with Service Role ONLY for the actual Auth deletion and profile purge
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // 2. Security Validation
    // Verify the JWT is valid and get the logged-in user (the developer)
    const { data: { user: currentUser }, error: authError } = await userClient.auth.getUser();
    if (authError || !currentUser) {
      console.error('[Delete User API] Requester auth check failed:', authError);
      return NextResponse.json({ error: 'Invalid or expired session.' }, { status: 401 });
    }

    console.log(`[Delete User API] Request by: ${currentUser.email} (${currentUser.id})`);

    // Verify developer permissions via RPC using the user's own client
    const { data: isDev, error: devError } = await userClient.rpc('is_app_developer', {
      p_user_id: currentUser.id
    });

    if (devError || !isDev) {
      console.error('[Delete User API] Access denied for:', currentUser.email, { devError, isDev });
      return NextResponse.json({ error: 'Permission denied: Developer access required.' }, { status: 403 });
    }

    // Prevent self-deletion via API
    if (targetUserId === currentUser.id) {
      return NextResponse.json({ error: 'Security breach: You cannot delete your own account via the developer console.' }, { status: 400 });
    }

    // 3. Execution Flow
    console.log(`[Developer Audit] User ${currentUser.email} initiating deletion of ${confirmEmail} (${targetUserId})`);

    // A. Clean up database records (memberships, tasks, notes, etc)
    // We MUST use userClient here so that auth.uid() is correctly populated in the DB context
    const { data: cleanupSummary, error: cleanupError } = await userClient.rpc('developer_cleanup_user_before_delete', {
      p_target_user_id: targetUserId,
      p_confirm_email: confirmEmail
    });

    if (cleanupError) {
      console.error('[Deletion Error] Cleanup RPC failed:', cleanupError);
      return NextResponse.json({ error: cleanupError.message || 'Database cleanup failed. Deletion aborted.' }, { status: 500 });
    }

    // B. Delete from Supabase Auth (Requires Service Role)
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(targetUserId);
    if (authDeleteError) {
      console.error('[Deletion Error] Auth removal failed:', authDeleteError);
      return NextResponse.json({ error: 'Cleanup was successful, but removing the authentication record failed.' }, { status: 500 });
    }

    // C. Final Profile Wipe (just in case cleanup RPC didn't handle it)
    await supabaseAdmin.from('profiles').delete().eq('id', targetUserId);

    console.log(`[Developer Audit] Deletion complete for ${confirmEmail}. Summary:`, cleanupSummary);

    return NextResponse.json({
      success: true,
      message: `User ${confirmEmail} has been removed.`,
      summary: cleanupSummary
    });

  } catch (err: any) {
    console.error('[User Deletion Fatal Error]:', err.message);
    return NextResponse.json({ 
      error: err.message || 'An internal error occurred during user deletion.' 
    }, { status: 500 });
  }
}

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

/**
 * @fileOverview Secure API route for permanent user deletion by platform developers.
 * Handles database cleanup, Storage file removal, and Supabase Auth user removal.
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
    // User-authenticated client for dev checks and cleanup logic (uses developer context)
    const userClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: { headers: { Authorization: authHeader } }
      }
    );

    // Admin client with Service Role for Auth deletion and Storage management
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
    const { data: { user: currentUser }, error: authError } = await userClient.auth.getUser();
    if (authError || !currentUser) {
      console.error('[Delete User API] Requester auth check failed:', authError);
      return NextResponse.json({ error: 'Invalid or expired session.' }, { status: 401 });
    }

    // Verify developer permissions
    const { data: isDev, error: devError } = await userClient.rpc('is_app_developer', {
      p_user_id: currentUser.id
    });

    if (devError || !isDev) {
      console.error('[Delete User API] Access denied for:', currentUser.email);
      return NextResponse.json({ error: 'Permission denied: Developer access required.' }, { status: 403 });
    }

    // Prevent self-deletion
    if (targetUserId === currentUser.id) {
      return NextResponse.json({ error: 'Security breach: You cannot delete your own account via this console.' }, { status: 400 });
    }

    // 3. Multi-Stage Deletion Flow
    console.log(`[Developer Deletion] Initiated by ${currentUser.email} for ${confirmEmail} (${targetUserId})`);

    // A. Clean up database records and get file paths for storage cleanup
    const { data: cleanupSummary, error: cleanupError } = await userClient.rpc('developer_cleanup_user_before_delete', {
      p_target_user_id: targetUserId,
      p_confirm_email: confirmEmail
    });

    if (cleanupError) {
      console.error('[Deletion Error] Cleanup RPC failed:', cleanupError);
      return NextResponse.json({ error: cleanupError.message || 'Database cleanup failed. Deletion aborted.' }, { status: 500 });
    }

    // B. Clean up files via Storage API (Direct table deletion is forbidden)
    const summary = cleanupSummary as any;
    const paths = summary?.chat_attachment_file_paths || [];

    if (Array.isArray(paths) && paths.length > 0) {
      console.log(`[Developer Deletion] Cleaning up ${paths.length} storage files...`);
      const { error: storageError } = await supabaseAdmin
        .storage
        .from("chat-attachments")
        .remove(paths);

      if (storageError) {
        // We log but don't fail the entire process if storage cleanup hits a snag
        console.error("[Developer Deletion] Storage cleanup encountered an issue:", storageError);
      }
    }

    // C. Delete from Supabase Auth (Requires Service Role)
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(targetUserId);
    if (authDeleteError) {
      console.error('[Deletion Error] Supabase Auth removal failed:', authDeleteError);
      return NextResponse.json({ error: 'Database cleanup was successful, but removing the authentication account failed.' }, { status: 500 });
    }

    // D. Final Profile Wipe (Ensure no dangling records)
    await supabaseAdmin.from('profiles').delete().eq('id', targetUserId);

    console.log(`[Developer Deletion] Successfully purged ${confirmEmail}.`);

    return NextResponse.json({
      success: true,
      message: `User ${confirmEmail} has been permanently removed.`,
      summary: summary
    });

  } catch (err: any) {
    console.error('[User Deletion Fatal Error]:', err.message);
    return NextResponse.json({ 
      error: err.message || 'An internal error occurred during user deletion.' 
    }, { status: 500 });
  }
}
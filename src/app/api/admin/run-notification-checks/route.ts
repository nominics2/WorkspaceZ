
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/**
 * @fileOverview Secure API route for manual notification checks by administrators.
 * Verifies user session and permissions before calling the database automation.
 */

export async function POST(req: Request) {
  try {
    const { workspace_id } = await req.json();
    
    if (!workspace_id) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check user role and permissions in the workspace
    const { data: membership, error: memberError } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspace_id)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (memberError || !membership) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const isSuperAdmin = membership.role === 'superadmin';
    
    // Check for specific permissions if not superadmin
    if (!isSuperAdmin) {
      const { data: permissions } = await supabase
        .from('workspace_role_permissions')
        .select('permission_key')
        .eq('workspace_id', workspace_id)
        .eq('role', membership.role)
        .eq('enabled', true)
        .in('permission_key', ['view_admin_panel', 'manage_workspace_settings']);

      const hasRequiredPermission = permissions && permissions.length > 0;

      if (!hasRequiredPermission) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
      }
    }

    // Execute the notification checks
    const { error: rpcError } = await supabase.rpc('run_notification_checks');

    if (rpcError) {
      throw rpcError;
    }

    return NextResponse.json({
      success: true,
      message: 'Notification checks completed'
    });
  } catch (err: any) {
    console.error('[Admin Notification Check Error]:', err.message);
    return NextResponse.json({ 
      success: false, 
      error: err.message 
    }, { status: 500 });
  }
}

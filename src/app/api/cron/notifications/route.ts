import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

/**
 * @fileOverview Cron API route for automated notification checks.
 * This endpoint is designed to be called by an external cron service (e.g., cron-job.org).
 * It triggers the Supabase RPC 'run_notification_checks' to process due reminders and task deadlines.
 */

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const authHeader = req.headers.get('authorization');

  // Validate CRON_SECRET environment variable
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('[Cron Error]: CRON_SECRET environment variable is not configured.');
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }

  // Check Authorization header
  if (authHeader !== `Bearer ${cronSecret}`) {
    console.warn('[Cron Warning]: Unauthorized attempt to access cron endpoint.');
    return new Response('Unauthorized', { status: 401 });
  }

  // Initialize Supabase client with Service Role Key for elevated privileges
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('[Cron Error]: Supabase service role configuration is missing.');
    return NextResponse.json({ error: 'Supabase configuration missing' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    console.log('[Cron Status]: Starting scheduled notification checks...');
    
    // Call the database RPC that processes notifications
    const { error } = await supabase.rpc('run_notification_checks');

    if (error) {
      console.error('[Cron Error]: RPC run_notification_checks failed:', error.message);
      return NextResponse.json({ 
        success: false, 
        error: error.message 
      }, { status: 500 });
    }

    console.log('[Cron Status]: Notification checks completed successfully.');
    return NextResponse.json({ 
      success: true, 
      message: 'Notification checks completed' 
    });
  } catch (err: any) {
    console.error('[Cron Fatal Error]:', err.message);
    return NextResponse.json({ 
      success: false, 
      error: err.message 
    }, { status: 500 });
  }
}

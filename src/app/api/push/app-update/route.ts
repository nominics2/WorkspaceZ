import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import webpush from 'web-push';

/**
 * @fileOverview Secure API route for sending Web Push notifications for App Updates.
 * Only accessible by platform developers.
 */

export async function POST(req: Request) {
  try {
    const { updateId } = await req.json();
    const authHeader = req.headers.get('Authorization');

    if (!updateId) {
      return NextResponse.json({ error: 'Update ID is required' }, { status: 400 });
    }

    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Initialize Supabase Admin (Service Role)
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 2. Validate Developer Access using the requester's token
    const userClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: { headers: { Authorization: authHeader } }
      }
    );

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized session' }, { status: 401 });
    }

    const { data: isDev, error: devError } = await supabaseAdmin.rpc('is_app_developer', {
      p_user_id: user.id
    });

    if (devError || !isDev) {
      return NextResponse.json({ error: 'Developer access required' }, { status: 403 });
    }

    // 3. Trigger in-app notifications first
    const { data: inAppCount, error: rpcError } = await supabaseAdmin.rpc('push_app_update_to_notifications', {
      p_update_id: updateId
    });

    if (rpcError) throw rpcError;

    // 4. Fetch Update details
    const { data: update, error: updateError } = await supabaseAdmin
      .from('app_updates')
      .select('*')
      .eq('id', updateId)
      .single();

    if (updateError || !update) {
      throw new Error('Update not found');
    }

    // 5. Find targeted users from notifications table
    const { data: recipients, error: recipError } = await supabaseAdmin
      .from('notifications')
      .select('user_id, workspace_id')
      .eq('related_app_update_id', updateId)
      .eq('type', 'app_update')
      .eq('is_deleted', false);

    if (recipError) throw recipError;

    const userIds = Array.from(new Set(recipients.map(r => r.user_id)));
    if (userIds.length === 0) {
      return NextResponse.json({ 
        ok: true, 
        inAppNotificationCount: inAppCount, 
        subscriptionCount: 0,
        message: 'No users were targeted by this update.' 
      });
    }

    // 6. Fetch Push Subscriptions
    const { data: subscriptions, error: subError } = await supabaseAdmin
      .from('push_subscriptions')
      .select('*')
      .in('user_id', userIds)
      .eq('enabled', true)
      .is('revoked_at', null);

    if (subError) throw subError;

    // 7. Configure Web Push
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || 'mailto:admin@zikura.edu.mv',
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!
    );

    const payload = {
      title: update.title,
      body: update.summary || update.banner_message || "New Workspace Z update available.",
      icon: "/brand/logomark.png",
      badge: "/brand/logomark.png",
      url: `/app-updates?id=${update.id}`,
      type: "app_update",
      related_app_update_id: update.id
    };

    let sentCount = 0;
    let failedCount = 0;
    let disabledCount = 0;
    let skippedCount = 0;

    // 8. Process Delivery
    const deliveryPromises = subscriptions.map(async (sub) => {
      // Deduplication check
      const { data: existingLog } = await supabaseAdmin
        .from('push_delivery_logs')
        .select('id')
        .eq('subscription_id', sub.id)
        .eq('related_app_update_id', updateId)
        .eq('status', 'sent')
        .maybeSingle();

      if (existingLog) {
        skippedCount++;
        return;
      }

      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth
            }
          },
          JSON.stringify(payload)
        );

        sentCount++;

        // Update Success Status
        await supabaseAdmin
          .from('push_subscriptions')
          .update({ last_success_at: new Date().toISOString(), last_error: null })
          .eq('id', sub.id);

        // Write Success Log
        await supabaseAdmin.from('push_delivery_logs').insert({
          subscription_id: sub.id,
          user_id: sub.user_id,
          workspace_id: sub.workspace_id,
          notification_type: 'app_update',
          related_app_update_id: updateId,
          title: payload.title,
          body: payload.body,
          target_url: payload.url,
          status: 'sent',
          sent_at: new Date().toISOString()
        });

      } catch (err: any) {
        // Handle expired/invalid subscriptions
        if (err.statusCode === 404 || err.statusCode === 410) {
          disabledCount++;
          await supabaseAdmin
            .from('push_subscriptions')
            .update({ 
              enabled: false, 
              revoked_at: new Date().toISOString(),
              last_error_at: new Date().toISOString(),
              last_error: 'Subscription expired or revoked by provider'
            })
            .eq('id', sub.id);
        } else {
          failedCount++;
          await supabaseAdmin
            .from('push_subscriptions')
            .update({ 
              last_error_at: new Date().toISOString(),
              last_error: err.message
            })
            .eq('id', sub.id);
        }

        // Write Failure Log
        await supabaseAdmin.from('push_delivery_logs').insert({
          subscription_id: sub.id,
          user_id: sub.user_id,
          workspace_id: sub.workspace_id,
          notification_type: 'app_update',
          related_app_update_id: updateId,
          title: payload.title,
          body: payload.body,
          target_url: payload.url,
          status: 'failed',
          error_message: err.message
        });
      }
    });

    await Promise.all(deliveryPromises);

    return NextResponse.json({
      ok: true,
      inAppNotificationCount: inAppCount,
      subscriptionCount: subscriptions.length,
      sentCount,
      failedCount,
      disabledCount,
      skippedCount
    });

  } catch (err: any) {
    console.error('[Push Delivery Fatal Error]:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

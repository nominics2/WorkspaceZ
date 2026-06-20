"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useWorkspace } from './WorkspaceProvider';
import { useToast } from '@/hooks/use-toast';
import { urlBase64ToUint8Array, getPlatformInfo } from '@/lib/push-utils';

interface PushNotificationContextType {
  isSupported: boolean;
  isConfigured: boolean;
  isSubscribed: boolean;
  permissionState: NotificationPermission | 'unsupported';
  isIOS: boolean;
  isStandalone: boolean;
  isLoading: boolean;
  enablePush: () => Promise<void>;
  disablePush: () => Promise<void>;
}

const PushNotificationContext = createContext<PushNotificationContextType | undefined>(undefined);

export function PushNotificationProvider({ children }: { children: React.ReactNode }) {
  const { activeWorkspace, userProfile } = useWorkspace();
  const [isSupported, setIsSupported] = useState(false);
  const [isConfigured, setIsConfigured] = useState(true);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [permissionState, setPermissionState] = useState<NotificationPermission | 'unsupported'>('default');
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const supabase = createClient();
  const { toast } = useToast();

  const checkSupport = useCallback(async () => {
    if (typeof window === 'undefined') return;

    // Check Configuration
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey) {
      console.warn("Missing NEXT_PUBLIC_VAPID_PUBLIC_KEY. Push notifications will be unavailable. Add it to .env.local and restart the dev server.");
      setIsConfigured(false);
    }

    const hasSW = 'serviceWorker' in navigator;
    const hasPush = 'PushManager' in window;
    const hasNotif = 'Notification' in window;
    
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const standalone = window.matchMedia('(display-mode: standalone)').matches;
    
    setIsIOS(ios);
    setIsStandalone(standalone);
    
    if (!hasSW || !hasPush || !hasNotif) {
      setIsSupported(false);
      setPermissionState('unsupported');
      setIsLoading(false);
      return;
    }

    setIsSupported(true);
    setPermissionState(Notification.permission);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    } catch (err) {
      console.error('[Push] Check error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkSupport();
  }, [checkSupport]);

  const enablePush = async () => {
    if (!isSupported) {
      toast({ 
        variant: "destructive", 
        title: "Unsupported", 
        description: isIOS && !isStandalone 
          ? "Please install Workspace Z to your Home Screen to enable notifications." 
          : "Push notifications are not supported on this browser." 
      });
      return;
    }

    if (!isConfigured) {
      toast({ 
        variant: "destructive", 
        title: "Configuration Missing", 
        description: "Push notifications are not configured on the server yet." 
      });
      return;
    }

    setIsLoading(true);
    try {
      const permission = await Notification.requestPermission();
      setPermissionState(permission);

      if (permission !== 'granted') {
        throw new Error('Permission denied');
      }

      const registration = await navigator.serviceWorker.ready;
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

      if (!publicKey) {
        throw new Error('VAPID public key is missing in environment.');
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });

      const { userAgent, platform } = getPlatformInfo();
      const keys = subscription.toJSON().keys;

      if (!keys?.p256dh || !keys?.auth) {
        throw new Error('Failed to extract subscription keys.');
      }

      const { error } = await supabase.rpc('upsert_push_subscription', {
        p_workspace_id: activeWorkspace?.id || null,
        p_endpoint: subscription.endpoint,
        p_p256dh: keys.p256dh,
        p_auth: keys.auth,
        p_user_agent: userAgent,
        p_platform: platform,
        p_device_label: 'Web Browser'
      });

      if (error) throw error;

      setIsSubscribed(true);
      toast({ title: "Notifications enabled", description: "You will now receive push alerts on this device." });
    } catch (err: any) {
      console.error('[Push] Enable failed:', err);
      toast({ 
        variant: "destructive", 
        title: "Activation failed", 
        description: err.message === 'Permission denied' 
          ? "Notification permission was blocked. Check your browser settings." 
          : "Unable to sync subscription with server." 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const disablePush = async () => {
    setIsLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await supabase.rpc('disable_push_subscription', {
          p_endpoint: subscription.endpoint
        });
        await subscription.unsubscribe();
      }

      setIsSubscribed(false);
      toast({ title: "Notifications disabled", description: "You will no longer receive push alerts on this device." });
    } catch (err: any) {
      console.error('[Push] Disable failed:', err);
      toast({ variant: "destructive", title: "Error", description: "Unable to disable push notifications." });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PushNotificationContext.Provider value={{
      isSupported,
      isConfigured,
      isSubscribed,
      permissionState,
      isIOS,
      isStandalone,
      isLoading,
      enablePush,
      disablePush
    }}>
      {children}
    </PushNotificationContext.Provider>
  );
}

export const usePushNotifications = () => {
  const context = useContext(PushNotificationContext);
  if (context === undefined) {
    throw new Error('usePushNotifications must be used within a PushNotificationProvider');
  }
  return context;
};

"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface PwaInstallContextType {
  installAvailable: boolean;
  isInstalled: boolean;
  isIOS: boolean;
  isStandalone: boolean;
  isDismissed: boolean;
  promptInstall: () => Promise<void>;
  dismissBanner: () => void;
}

const PwaInstallContext = createContext<PwaInstallContextType | undefined>(undefined);

const DISMISSAL_KEY = 'workspacez_install_banner_dismissed_until';

export function PwaInstallProvider({ children }: { children: React.ReactNode }) {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [installAvailable, setInstallAvailable] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Detect Standalone Mode
    const checkStandalone = () => {
      const standalone = window.matchMedia('(display-mode: standalone)').matches || 
                        (window.navigator as any).standalone === true;
      setIsStandalone(standalone);
    };

    // Detect iOS
    const checkIOS = () => {
      const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
      setIsIOS(ios);
    };

    // Check Dismissal
    const checkDismissal = () => {
      const dismissedUntil = localStorage.getItem(DISMISSAL_KEY);
      if (dismissedUntil) {
        const until = parseInt(dismissedUntil, 10);
        if (Date.now() < until) {
          setIsDismissed(true);
        } else {
          localStorage.removeItem(DISMISSAL_KEY);
        }
      }
    };

    checkStandalone();
    checkIOS();
    checkDismissal();

    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      setInstallAvailable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Also detect if the app was installed successfully
    window.addEventListener('appinstalled', () => {
      setDeferredPrompt(null);
      setInstallAvailable(false);
      setIsStandalone(true);
      console.log('[PWA] WorkspaceZ was installed');
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return;

    // Show the native install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`[PWA] User response to install prompt: ${outcome}`);

    // We've used the prompt, and can't use it again, throw it away
    setDeferredPrompt(null);
    setInstallAvailable(false);
    
    if (outcome === 'accepted') {
      setIsStandalone(true);
    } else {
      // If they rejected it, consider it a temporary dismissal
      dismissBanner();
    }
  }, [deferredPrompt]);

  const dismissBanner = useCallback(() => {
    setIsDismissed(true);
    // Dismiss for 7 days
    const nextWeek = Date.now() + (7 * 24 * 60 * 60 * 1000);
    localStorage.setItem(DISMISSAL_KEY, nextWeek.toString());
  }, []);

  return (
    <PwaInstallContext.Provider value={{
      installAvailable,
      isInstalled: isStandalone,
      isIOS,
      isStandalone,
      isDismissed,
      promptInstall,
      dismissBanner
    }}>
      {children}
    </PwaInstallContext.Provider>
  );
}

export const usePwaInstall = () => {
  const context = useContext(PwaInstallContext);
  if (context === undefined) {
    throw new Error('usePwaInstall must be used within a PwaInstallProvider');
  }
  return context;
};

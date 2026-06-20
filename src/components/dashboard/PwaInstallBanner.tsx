"use client";

import { usePwaInstall } from "@/components/providers/PwaInstallProvider";
import { Button } from "@/components/ui/button";
import { Smartphone, X, Download } from "lucide-react";
import { cn } from "@/lib/utils";

export function PwaInstallBanner() {
  const { installAvailable, isStandalone, isDismissed, promptInstall, dismissBanner } = usePwaInstall();

  // Do not show if:
  // 1. Already running in standalone (installed) mode
  // 2. Install prompt hasn't fired yet
  // 3. User recently dismissed the banner
  if (isStandalone || !installAvailable || isDismissed) {
    return null;
  }

  return (
    <div className="px-4 md:px-8 pt-4 animate-in slide-in-from-top-4 duration-500">
      <div className="bg-slate-900 dark:bg-primary text-white p-4 rounded-2xl shadow-xl border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4 text-center sm:text-left">
          <div className="p-3 bg-white/10 rounded-xl shrink-0">
            <Smartphone className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold">Install Workspace Z</h3>
            <p className="text-xs text-white/70">Faster access, native notifications, and a distraction-free window.</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button 
            onClick={promptInstall}
            className="flex-1 sm:flex-none bg-white text-slate-900 hover:bg-white/90 font-bold h-9 rounded-xl px-6 gap-2"
          >
            <Download className="w-4 h-4" />
            Install App
          </Button>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={dismissBanner}
            className="text-white/60 hover:text-white hover:bg-white/10 h-9 w-9 rounded-xl"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

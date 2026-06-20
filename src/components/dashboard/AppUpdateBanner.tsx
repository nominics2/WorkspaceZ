"use client";

import { useState, useEffect, useCallback } from "react";
import { Megaphone, X, ArrowRight, Loader2, Sparkles, Wrench, Info, Zap, FileText, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

const typeIcons: Record<string, any> = {
  update: RefreshCw,
  feature: Zap,
  maintenance: Wrench,
  announcement: Megaphone,
  memo: FileText,
};

export function AppUpdateBanner() {
  const { userProfile, activeWorkspace } = useWorkspace();
  const [update, setUpdate] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dismissing, setDismissing] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  const fetchActiveBanner = useCallback(async () => {
    if (!userProfile) return;
    try {
      // Fetch latest published update that has banner enabled and hasn't been read by user
      const { data, error } = await supabase
        .from('app_updates')
        .select(`
          *,
          app_update_reads!left(user_id)
        `)
        .eq('status', 'published')
        .eq('banner_enabled', true)
        .is('app_update_reads.user_id', null)
        .order('published_at', { ascending: false })
        .limit(1);

      if (error) throw error;
      
      if (data && data.length > 0) {
        setUpdate(data[0]);
      } else {
        setUpdate(null);
      }
    } catch (err) {
      console.error("[Banner] Fetch failed:", err);
    } finally {
      setLoading(false);
    }
  }, [userProfile, supabase]);

  useEffect(() => {
    fetchActiveBanner();
  }, [fetchActiveBanner]);

  const handleDismiss = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!update || dismissing) return;
    setDismissing(true);
    try {
      const { error } = await supabase.rpc('dismiss_app_update', { 
        p_update_id: update.id 
      });
      if (error) throw error;
      setUpdate(null);
    } catch (err) {
      console.error("[Banner] Dismiss failed:", err);
    } finally {
      setDismissing(false);
    }
  };

  const handleViewDetails = () => {
    router.push(`/app-updates?id=${update.id}`);
    handleDismiss();
  };

  if (loading || !update) return null;

  return (
    <div className="bg-primary text-white py-2 px-4 md:px-8 flex items-center justify-between gap-4 animate-in slide-in-from-top duration-500 sticky top-0 z-[100] shadow-lg">
      <div className="flex items-center gap-3 overflow-hidden">
        <div className="p-1.5 bg-white/20 rounded-lg shrink-0">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold truncate uppercase tracking-widest opacity-90">
            {update.banner_title || "System Update"}
          </p>
          <p className="text-sm font-medium truncate">
            {update.banner_message || update.summary}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button 
          variant="secondary" 
          size="sm" 
          onClick={handleViewDetails}
          className="h-8 text-xs font-bold rounded-lg bg-white text-primary hover:bg-white/90 hidden sm:flex"
        >
          View Details <ArrowRight className="w-3 h-3 ml-1.5" />
        </Button>
        <button 
          onClick={handleDismiss}
          disabled={dismissing}
          className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
          aria-label="Dismiss"
        >
          {dismissing ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
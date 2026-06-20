"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { 
  Sparkles, 
  RefreshCw, 
  Zap, 
  Megaphone, 
  Wrench, 
  FileText, 
  ChevronRight, 
  Loader2, 
  Clock,
  Layout,
  Info,
  ExternalLink,
  ChevronDown,
  MessageSquare
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from "@/components/ui/accordion";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useSearchParams } from "next/navigation";

const typeConfig: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  update: { label: "System Update", icon: RefreshCw, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-500/10" },
  feature: { label: "New Feature", icon: Zap, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-500/10" },
  maintenance: { label: "Maintenance", icon: Wrench, color: "text-slate-500", bg: "bg-slate-50 dark:bg-slate-800" },
  announcement: { label: "Announcement", icon: Megaphone, color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-500/10" },
  memo: { label: "Memo", icon: FileText, color: "text-indigo-500", bg: "bg-indigo-50 dark:bg-indigo-500/10" },
};

export default function AppUpdatesPage() {
  const { userProfile } = useWorkspace();
  const searchParams = useSearchParams();
  const highlightId = searchParams.get("id");
  const [updates, setUpdates] = useState<any[]>([]);
  const [features, setFeatures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDeveloper, setIsDeveloper] = useState(false);
  const supabase = createClient();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [updatesRes, featuresRes, devRes] = await Promise.all([
        supabase
          .from('app_updates')
          .select('*')
          .eq('status', 'published')
          .lte('published_at', new Date().toISOString())
          .order('published_at', { ascending: false }),
        supabase
          .from('app_features')
          .select('*')
          .eq('is_active', true)
          .order('category', { ascending: true })
          .order('sort_order', { ascending: true }),
        supabase.rpc('is_app_developer')
      ]);

      if (updatesRes.error) throw updatesRes.error;
      if (featuresRes.error) throw featuresRes.error;

      setUpdates(updatesRes.data || []);
      setFeatures(featuresRes.data || []);
      setIsDeveloper(!!devRes.data);
    } catch (err) {
      console.error("[Updates] Fetch failed:", err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!loading && highlightId && updates.length > 0) {
      setTimeout(() => {
        const el = document.getElementById(`update-${highlightId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 300);
    }
  }, [loading, highlightId, updates]);

  const groupedFeatures = features.reduce((acc: any, feature) => {
    const cat = feature.category || "General";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(feature);
    return acc;
  }, {});

  return (
    <div className="max-w-6xl mx-auto space-y-12 animate-in fade-in duration-700 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-primary" /> What's New
          </h1>
          <p className="text-muted-foreground font-medium mt-1">Discover the latest improvements and master WorkspaceZ.</p>
        </div>
        {isDeveloper && (
          <Button asChild variant="outline" className="rounded-xl h-10 border-primary/20 hover:bg-primary/5 text-primary font-bold">
            <a href="/app-updates/admin">Admin Console</a>
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Updates Timeline */}
        <div className="lg:col-span-7 space-y-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="h-8 w-1.5 bg-primary rounded-full" />
              <h2 className="text-xl font-bold dark:text-white">Recent Releases</h2>
            </div>
            {updates.length > 0 && (
              <Badge variant="outline" className="rounded-lg px-2 text-[10px] uppercase font-bold border-slate-200 dark:border-slate-800 text-slate-500">
                {updates.length} Updates
              </Badge>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
          ) : updates.length === 0 ? (
            <div className="p-16 text-center bg-white dark:bg-slate-900 rounded-[2.5rem] border-2 border-dashed dark:border-slate-800 opacity-60">
              <Info className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <p className="text-base font-bold">No system updates yet.</p>
              <p className="text-sm text-muted-foreground mt-1">We'll announce new features here as they launch.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {updates.map((update) => {
                const config = typeConfig[update.update_type] || typeConfig.update;
                const isHighlighted = highlightId === update.id;
                return (
                  <Card 
                    key={update.id} 
                    id={`update-${update.id}`}
                    className={cn(
                      "border-none shadow-md overflow-hidden bg-white dark:bg-slate-900 hover:shadow-xl transition-all group",
                      isHighlighted && "ring-2 ring-primary ring-offset-4 dark:ring-offset-slate-950 scale-[1.01]"
                    )}
                  >
                    <CardHeader className="p-6 pb-2">
                      <div className="flex items-center justify-between mb-4">
                        <Badge className={cn("rounded-lg px-2.5 py-0.5 border-none font-bold uppercase text-[10px] tracking-widest", config.bg, config.color)}>
                          <config.icon className="w-3 h-3 mr-1.5" />
                          {config.label}
                        </Badge>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                          <Clock className="w-3 h-3" />
                          {format(new Date(update.published_at), "MMM d, yyyy")}
                        </span>
                      </div>
                      <CardTitle className="text-2xl font-extrabold group-hover:text-primary transition-colors">{update.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 pt-2 space-y-4">
                      <p className="text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                        {update.summary}
                      </p>
                      {update.details && (
                        <div className="prose prose-sm dark:prose-invert max-w-none pt-4 border-t dark:border-slate-800 mt-4 text-sm text-slate-500 dark:text-slate-400 whitespace-pre-wrap leading-relaxed">
                          {update.details}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Features Directory */}
        <div className="lg:col-span-5 space-y-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-8 w-1.5 bg-amber-500 rounded-full" />
            <h2 className="text-xl font-bold dark:text-white">Workspace Features</h2>
          </div>

          <Card className="border-none shadow-lg bg-white dark:bg-slate-900 rounded-[2.5rem] overflow-hidden">
            <CardContent className="p-6">
              {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-amber-500" /></div>
              ) : features.length === 0 ? (
                <div className="text-center py-16 opacity-60">
                   <Zap className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                   <p className="text-sm font-bold">Directory Empty</p>
                   <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">Feature catalog coming soon</p>
                </div>
              ) : (
                <Accordion type="multiple" className="w-full space-y-6">
                  {Object.keys(groupedFeatures).map((category) => (
                    <div key={category} className="space-y-3">
                      <div className="flex items-center gap-2 px-1">
                        <p className="text-[10px] font-extrabold text-primary uppercase tracking-[0.2em]">{category}</p>
                        <div className="flex-1 h-px bg-slate-100 dark:bg-slate-800" />
                      </div>
                      {groupedFeatures[category].map((feature: any) => (
                        <AccordionItem 
                          key={feature.id} 
                          value={feature.id} 
                          className="border rounded-[1.5rem] px-5 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 hover:bg-white dark:hover:bg-slate-900 hover:shadow-sm transition-all overflow-hidden"
                        >
                          <AccordionTrigger className="hover:no-underline py-5 group/item">
                            <div className="flex items-start gap-4 text-left">
                              <div className="p-2.5 bg-white dark:bg-slate-800 rounded-xl shadow-sm border dark:border-slate-700 shrink-0 group-hover/item:scale-110 transition-transform">
                                <Zap className="w-4 h-4 text-amber-500 fill-amber-500/10" />
                              </div>
                              <div className="min-w-0 pr-4">
                                <p className="font-bold text-sm dark:text-slate-200 group-hover/item:text-primary transition-colors">{feature.title}</p>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5 leading-normal">{feature.short_description}</p>
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="pb-6 px-1">
                            <div className="pl-[3.25rem] space-y-4">
                               <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                                 {feature.details || feature.short_description}
                               </div>
                               <div className="flex items-center gap-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                  <Badge variant="outline" className="h-4 py-0 text-[8px] border-slate-200 dark:border-slate-800">Stable</Badge>
                                  <span>Feature Key: {feature.feature_key}</span>
                               </div>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </div>
                  ))}
                </Accordion>
              )}
            </CardContent>
          </Card>

          <Card className="border-none shadow-md bg-gradient-to-br from-indigo-600 to-primary text-white rounded-[2.5rem] overflow-hidden relative group">
             <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl group-hover:scale-150 transition-transform duration-700" />
             <CardContent className="p-8 text-center space-y-5 relative z-10">
                <div className="mx-auto w-14 h-14 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-md shadow-inner">
                   <MessageSquare className="w-6 h-6" />
                </div>
                <div>
                   <h3 className="text-xl font-bold">Have a suggestion?</h3>
                   <p className="text-sm opacity-80 leading-relaxed mt-2">
                      WorkspaceZ grows through your feedback. Share your ideas for new tools or enhancements.
                   </p>
                </div>
                <Button variant="secondary" className="w-full rounded-xl h-11 font-bold text-primary bg-white hover:bg-slate-50 shadow-xl shadow-black/10 border-none">
                   Suggest a Feature
                </Button>
             </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

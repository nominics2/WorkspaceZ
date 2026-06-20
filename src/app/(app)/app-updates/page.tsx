"use client";

import { useState, useEffect, useCallback } from "react";
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
  ChevronDown
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

const typeConfig: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  update: { label: "System Update", icon: RefreshCw, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-500/10" },
  feature: { label: "New Feature", icon: Zap, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-500/10" },
  maintenance: { label: "Maintenance", icon: Wrench, color: "text-slate-500", bg: "bg-slate-50 dark:bg-slate-800" },
  announcement: { label: "Announcement", icon: Megaphone, color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-500/10" },
  memo: { label: "Memo", icon: FileText, color: "text-indigo-500", bg: "bg-indigo-50 dark:bg-indigo-500/10" },
};

export default function AppUpdatesPage() {
  const { userProfile } = useWorkspace();
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

  const groupedFeatures = features.reduce((acc: any, feature) => {
    const cat = feature.category || "General";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(feature);
    return acc;
  }, {});

  return (
    <div className="max-w-5xl mx-auto space-y-12 animate-in fade-in duration-700 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-primary" /> What's New
          </h1>
          <p className="text-muted-foreground font-medium mt-1">Stay updated with the latest workspace features and system logs.</p>
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
          <div className="flex items-center gap-3 mb-6">
            <div className="h-8 w-1.5 bg-primary rounded-full" />
            <h2 className="text-xl font-bold dark:text-white">Recent Releases</h2>
          </div>

          {loading ? (
            <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
          ) : updates.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-[2rem] border-2 border-dashed dark:border-slate-800 opacity-60">
              <Info className="w-10 h-10 mx-auto mb-3 text-slate-300" />
              <p className="text-sm font-medium">No system updates yet.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {updates.map((update) => {
                const config = typeConfig[update.update_type] || typeConfig.update;
                return (
                  <Card key={update.id} className="border-none shadow-md overflow-hidden bg-white dark:bg-slate-900 hover:shadow-xl transition-all group">
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
                        <div className="prose prose-sm dark:prose-invert max-w-none pt-4 border-t dark:border-slate-800 mt-4 text-sm text-slate-500 dark:text-slate-400 whitespace-pre-wrap">
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

          <Card className="border-none shadow-lg bg-white dark:bg-slate-900 rounded-[2rem] overflow-hidden">
            <CardContent className="p-6">
              {loading ? (
                <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-amber-500" /></div>
              ) : features.length === 0 ? (
                <p className="text-sm text-slate-400 italic text-center py-10">No feature details available.</p>
              ) : (
                <Accordion type="multiple" className="w-full space-y-4">
                  {Object.keys(groupedFeatures).map((category) => (
                    <div key={category} className="space-y-3">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] px-1">{category}</p>
                      {groupedFeatures[category].map((feature: any) => (
                        <AccordionItem 
                          key={feature.id} 
                          value={feature.id} 
                          className="border rounded-2xl px-4 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40"
                        >
                          <AccordionTrigger className="hover:no-underline py-4">
                            <div className="flex items-center gap-3 text-left">
                              <div className="p-2 bg-white dark:bg-slate-800 rounded-xl shadow-sm border dark:border-slate-700">
                                <Zap className="w-4 h-4 text-amber-500 fill-amber-500/10" />
                              </div>
                              <div>
                                <p className="font-bold text-sm dark:text-slate-200">{feature.title}</p>
                                <p className="text-[10px] text-slate-500 line-clamp-1">{feature.short_description}</p>
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="pb-4 text-xs text-slate-500 dark:text-slate-400 leading-relaxed whitespace-pre-wrap">
                            {feature.details || feature.short_description}
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </div>
                  ))}
                </Accordion>
              )}
            </CardContent>
          </Card>

          <Card className="border-none shadow-md bg-gradient-to-br from-indigo-500 to-primary text-white rounded-[2rem] overflow-hidden">
             <CardContent className="p-8 text-center space-y-4">
                <div className="mx-auto w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-md">
                   <Info className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold">Request a Feature?</h3>
                <p className="text-sm opacity-90 leading-relaxed">
                   Have ideas to improve WorkspaceZ? Reach out to your admin or developer team to suggest new capabilities.
                </p>
                <Button variant="secondary" className="w-full rounded-xl font-bold text-primary bg-white shadow-xl shadow-black/10">
                   Contact Support
                </Button>
             </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback, Suspense, useMemo } from "react";
import { 
  Sparkles, 
  Zap, 
  Loader2, 
  Info,
  MessageSquare,
  Calendar,
  ChevronDown,
  ExternalLink,
  ShieldCheck,
  Search,
  X,
  FilterX,
  Check,
  Send,
  ChevronRight,
  Plus,
  ArrowRight,
  Maximize2,
  Minimize2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from "@/components/ui/accordion";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription 
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const CATEGORY_ORDER = ["Workspace", "Productivity", "Chat", "Communication", "System", "Other"];

export default function AppUpdatesPage() {
  const { activeWorkspace } = useWorkspace();
  const [features, setFeatures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDeveloper, setIsDeveloper] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  
  const [isSuggestModalOpen, setIsSuggestModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [suggestForm, setSuggestForm] = useState({
    title: "",
    details: "",
    category: "Productivity"
  });

  const supabase = createClient();
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [featuresRes, devRes] = await Promise.all([
        supabase
          .from('app_features')
          .select('*')
          .eq('is_active', true),
        supabase.rpc('is_app_developer')
      ]);

      if (featuresRes.error) throw featuresRes.error;

      const sortedFeatures = (featuresRes.data || []).sort((a, b) => {
        // First sort by Category Order
        const catIdxA = CATEGORY_ORDER.indexOf(a.category || "Other");
        const catIdxB = CATEGORY_ORDER.indexOf(b.category || "Other");
        const adjustedA = catIdxA === -1 ? 99 : catIdxA;
        const adjustedB = catIdxB === -1 ? 99 : catIdxB;

        if (adjustedA !== adjustedB) return adjustedA - adjustedB;

        // Then by sort_order
        if ((a.sort_order || 0) !== (b.sort_order || 0)) {
          return (a.sort_order || 0) - (b.sort_order || 0);
        }

        // Then by release_date descending
        const dateA = new Date(a.release_date || 0).getTime();
        const dateB = new Date(b.release_date || 0).getTime();
        if (dateB !== dateA) return dateB - dateA;

        // Then by title
        return (a.title || "").localeCompare(b.title || "");
      });

      setFeatures(sortedFeatures);
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

  const filteredFeatures = useMemo(() => {
    if (!searchQuery.trim()) return features;
    const lowerQuery = searchQuery.toLowerCase();
    return features.filter(f => 
      f.title?.toLowerCase().includes(lowerQuery) ||
      f.short_description?.toLowerCase().includes(lowerQuery) ||
      f.details?.toLowerCase().includes(lowerQuery) ||
      f.category?.toLowerCase().includes(lowerQuery)
    );
  }, [features, searchQuery]);

  const groupedFeatures = useMemo(() => {
    const acc = filteredFeatures.reduce((acc: any, feature) => {
      const cat = feature.category || "Other";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(feature);
      return acc;
    }, {});

    // Sort the keys based on our defined order
    return Object.keys(acc)
      .sort((a, b) => {
        const idxA = CATEGORY_ORDER.indexOf(a);
        const idxB = CATEGORY_ORDER.indexOf(b);
        const adjA = idxA === -1 ? 99 : idxA;
        const adjB = idxB === -1 ? 99 : idxB;
        return adjA - adjB;
      })
      .reduce((sorted: any, key) => {
        sorted[key] = acc[key];
        return sorted;
      }, {});
  }, [filteredFeatures]);

  const handleSuggestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!suggestForm.title.trim() || !suggestForm.details.trim()) return;

    setSubmitting(true);
    try {
      const { error } = await supabase.rpc("submit_app_feature_request", {
        p_workspace_id: activeWorkspace?.id || null,
        p_title: suggestForm.title.trim(),
        p_details: suggestForm.details.trim(),
        p_category: suggestForm.category
      });

      if (error) throw error;

      toast({
        title: "Suggestion Received",
        description: "Your feature request has been sent to our development team for review."
      });
      setIsSuggestModalOpen(false);
      setSuggestForm({ title: "", details: "", category: "Productivity" });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Submission Failed",
        description: err.message || "Unable to submit feature request at this time."
      });
    } finally {
      setSubmitting(false);
    }
  };

  const toggleAll = (expand: boolean) => {
    if (expand) {
      setExpandedCategories(Object.keys(groupedFeatures));
    } else {
      setExpandedCategories([]);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-12 animate-in fade-in duration-700 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-primary" /> Workspace Z Features
          </h1>
          <p className="text-muted-foreground font-medium">Master your workspace with the latest platform capabilities.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={() => setIsSuggestModalOpen(true)} variant="outline" className="rounded-xl h-10 border-primary/20 hover:bg-primary/5 text-primary font-bold">
            <Plus className="w-4 h-4 mr-2" /> Suggest Feature
          </Button>
          {isDeveloper && (
            <Button asChild className="rounded-xl h-10 shadow-lg shadow-primary/20">
              <a href="/app-updates/admin">Admin Console</a>
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative group w-full md:max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500 transition-colors group-focus-within:text-primary" />
            <Input 
              placeholder="Search feature catalog..." 
              className="pl-11 h-12 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm focus-visible:ring-primary/20 focus-visible:ring-2"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => toggleAll(true)} className="text-[10px] font-bold uppercase tracking-widest text-slate-500 gap-1.5">
              <Maximize2 className="w-3 h-3" /> Expand All
            </Button>
            <span className="w-1 h-1 bg-slate-300 rounded-full" />
            <Button variant="ghost" size="sm" onClick={() => toggleAll(false)} className="text-[10px] font-bold uppercase tracking-widest text-slate-500 gap-1.5">
              <Minimize2 className="w-3 h-3" /> Collapse All
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4 text-slate-400">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="text-xs font-bold uppercase tracking-[0.2em]">Syncing Feature Engine</p>
          </div>
        ) : Object.keys(groupedFeatures).length === 0 ? (
          <div className="p-20 text-center bg-white dark:bg-slate-900 rounded-[3rem] border-2 border-dashed dark:border-slate-800 opacity-60">
            {searchQuery ? (
              <>
                <FilterX className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                <p className="text-lg font-bold">No features match "{searchQuery}"</p>
                <Button variant="link" onClick={() => setSearchQuery("")} className="text-primary mt-2">Clear search filters</Button>
              </>
            ) : (
              <>
                <Info className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                <p className="text-lg font-bold">No features documented yet.</p>
                <p className="text-sm text-muted-foreground mt-1">Check back later for platform updates.</p>
              </>
            )}
          </div>
        ) : (
          <Accordion 
            type="multiple" 
            value={expandedCategories} 
            onValueChange={setExpandedCategories} 
            className="space-y-4"
          >
            {Object.keys(groupedFeatures).map((category) => (
              <AccordionItem key={category} value={category} className="border-none">
                <Card className="border-none shadow-sm overflow-hidden dark:bg-slate-900">
                  <AccordionTrigger className="px-6 py-5 hover:no-underline group">
                    <div className="flex items-center justify-between w-full pr-4">
                      <div className="flex items-center gap-4">
                        <div className="w-1.5 h-6 bg-primary rounded-full group-data-[state=open]:scale-y-125 transition-transform" />
                        <div className="text-left">
                          <h2 className="text-lg font-bold dark:text-slate-100 group-hover:text-primary transition-colors">{category}</h2>
                        </div>
                      </div>
                      <Badge variant="secondary" className="bg-slate-100 dark:bg-slate-800 text-[10px] font-bold px-3 py-1 rounded-full">
                        {groupedFeatures[category].length} Features
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-6 pb-6 pt-2">
                    <div className="grid grid-cols-1 gap-4">
                      {groupedFeatures[category].map((feature: any) => (
                        <Card key={feature.id} className="border dark:border-slate-800 shadow-none bg-slate-50/50 dark:bg-slate-950/40 rounded-2xl overflow-hidden group/feature">
                          <Accordion type="single" collapsible className="w-full">
                            <AccordionItem value="details" className="border-none">
                              <AccordionTrigger className="px-5 py-5 hover:no-underline text-left">
                                <div className="flex items-start gap-4 flex-1 min-w-0">
                                  <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border dark:border-slate-800 shadow-sm group-hover/feature:border-primary/30 transition-colors">
                                    <Zap className="w-4 h-4 text-primary" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <h3 className="font-bold text-base dark:text-slate-100 group-hover/feature:text-primary transition-colors">{feature.title}</h3>
                                      {feature.release_date && (
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                                          {format(parseISO(feature.release_date), "dd-MMM-yyyy")}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 leading-relaxed">
                                      {feature.short_description}
                                    </p>
                                  </div>
                                </div>
                              </AccordionTrigger>
                              <AccordionContent className="px-5 pb-5">
                                <div className="pl-[3.25rem] space-y-4">
                                  <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-800 text-sm leading-relaxed text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
                                    {feature.details}
                                  </div>
                                  <div className="flex items-center gap-4 pt-1">
                                    <Badge variant="outline" className="text-[9px] font-bold border-slate-200 dark:border-slate-800 text-slate-400 h-5 px-2">
                                      KEY: {feature.feature_key}
                                    </Badge>
                                    <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                      <Calendar className="w-3 h-3" />
                                      Released {feature.release_date ? format(parseISO(feature.release_date), "PP") : 'Unknown'}
                                    </div>
                                  </div>
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          </Accordion>
                        </Card>
                      ))}
                    </div>
                  </AccordionContent>
                </Card>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </div>

      {/* Suggest Feature CTA Card */}
      {!loading && (
        <Card className="border-none shadow-2xl bg-gradient-to-br from-indigo-600 to-primary text-white rounded-[3rem] overflow-hidden relative group mt-16">
          <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl group-hover:scale-150 transition-transform duration-1000" />
          <CardContent className="p-12 text-center space-y-8 relative z-10">
            <div className="mx-auto w-20 h-20 bg-white/20 rounded-3xl flex items-center justify-center backdrop-blur-md shadow-inner">
              <MessageSquare className="w-10 h-10" />
            </div>
            <div className="max-w-md mx-auto space-y-3">
              <h3 className="text-3xl font-extrabold tracking-tight">Have a brilliant idea?</h3>
              <p className="text-base opacity-80 leading-relaxed font-medium">
                Workspace Z grows through your feedback. Share your vision for new tools, workflow enhancements, or productivity hacks.
              </p>
            </div>
            <Button 
              variant="secondary" 
              className="px-12 rounded-2xl h-14 font-extrabold text-lg text-primary bg-white hover:bg-slate-50 shadow-2xl shadow-black/20 border-none transition-all active:scale-95"
              onClick={() => setIsSuggestModalOpen(true)}
            >
              Suggest a Feature
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Suggest Modal */}
      <Dialog open={isSuggestModalOpen} onOpenChange={setIsSuggestModalOpen}>
        <DialogContent className="max-w-md dark:bg-slate-950 dark:border-slate-800 rounded-[2rem] p-0 overflow-hidden">
          <div className="p-8">
            <DialogHeader className="mb-6">
              <DialogTitle className="text-2xl font-bold">Share your Idea</DialogTitle>
              <DialogDescription>What functionality would make your team even more productive?</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSuggestSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Feature Title</Label>
                <Input 
                  value={suggestForm.title}
                  onChange={e => setSuggestForm({...suggestForm, title: e.target.value})}
                  placeholder="e.g. Dark mode themes..."
                  required
                  className="rounded-xl h-11 dark:bg-slate-900 border-none"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Category</Label>
                <Select 
                  value={suggestForm.category}
                  onValueChange={v => setSuggestForm({...suggestForm, category: v})}
                >
                  <SelectTrigger className="rounded-xl h-11 dark:bg-slate-900 border-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-slate-900">
                    <SelectItem value="Workspace">Workspace</SelectItem>
                    <SelectItem value="Productivity">Productivity</SelectItem>
                    <SelectItem value="Chat">Chat</SelectItem>
                    <SelectItem value="Communication">Communication</SelectItem>
                    <SelectItem value="System">System</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Details</Label>
                <Textarea 
                  value={suggestForm.details}
                  onChange={e => setSuggestForm({...suggestForm, details: e.target.value})}
                  placeholder="Tell us more about how this would work..."
                  rows={5}
                  required
                  className="rounded-xl dark:bg-slate-900 border-none resize-none"
                />
              </div>

              <DialogFooter className="pt-4 border-t dark:border-slate-800">
                <Button type="button" variant="ghost" onClick={() => setIsSuggestModalOpen(false)} disabled={submitting} className="rounded-xl">Cancel</Button>
                <Button type="submit" disabled={submitting || !suggestForm.title.trim()} className="rounded-xl shadow-lg shadow-primary/20 px-8">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                  Submit Suggestion
                </Button>
              </DialogFooter>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

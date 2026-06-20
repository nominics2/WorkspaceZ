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
  Send
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

export default function AppUpdatesPage() {
  const { activeWorkspace } = useWorkspace();
  const [features, setFeatures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDeveloper, setIsDeveloper] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
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
        const catA = a.category || "General";
        const catB = b.category || "General";
        if (catA < catB) return -1;
        if (catA > catB) return 1;

        if (a.sort_order !== b.sort_order) {
          return (a.sort_order || 0) - (b.sort_order || 0);
        }

        const dateA = new Date(a.release_date || 0).getTime();
        const dateB = new Date(b.release_date || 0).getTime();
        if (dateB !== dateA) return dateB - dateA;

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

  const groupedFeatures = filteredFeatures.reduce((acc: any, feature) => {
    const cat = feature.category || "General";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(feature);
    return acc;
  }, {});

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

  return (
    <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in duration-700 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-primary" /> Workspace Z Features
          </h1>
          <p className="text-muted-foreground font-medium mt-1">Master your workspace with the latest platform capabilities.</p>
        </div>
        {isDeveloper && (
          <Button asChild variant="outline" className="rounded-xl h-10 border-primary/20 hover:bg-primary/5 text-primary font-bold">
            <a href="/app-updates/admin">Admin Console</a>
          </Button>
        )}
      </div>

      <div className="space-y-6">
        <div className="relative group max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500 transition-colors group-focus-within:text-primary" />
          <Input 
            placeholder="Search features..." 
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

        <div className="space-y-10">
          {loading ? (
            <div className="flex justify-center py-32"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>
          ) : filteredFeatures.length === 0 ? (
            <div className="p-16 text-center bg-white dark:bg-slate-900 rounded-[2.5rem] border-2 border-dashed dark:border-slate-800 opacity-60">
              {searchQuery ? (
                <>
                  <FilterX className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                  <p className="text-base font-bold">No features match your search.</p>
                  <Button variant="link" onClick={() => setSearchQuery("")} className="text-primary mt-2">Clear search</Button>
                </>
              ) : (
                <>
                  <Info className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                  <p className="text-base font-bold">No feature data available.</p>
                  <p className="text-sm text-muted-foreground mt-1">Check back later for platform updates.</p>
                </>
              )}
            </div>
          ) : (
            Object.keys(groupedFeatures).map((category) => (
              <div key={category} className="space-y-4">
                <div className="flex items-center gap-4 px-2">
                  <h2 className="text-xs font-extrabold text-primary uppercase tracking-[0.2em] whitespace-nowrap">{category}</h2>
                  <div className="flex-1 h-px bg-slate-100 dark:bg-slate-800" />
                </div>
                
                <div className="grid grid-cols-1 gap-4">
                  {groupedFeatures[category].map((feature: any) => (
                    <Card key={feature.id} className="border-none shadow-sm bg-white dark:bg-slate-900 rounded-[2rem] overflow-hidden group">
                      <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value={feature.id} className="border-none">
                          <AccordionTrigger className="px-6 py-6 hover:no-underline group/trigger">
                            <div className="flex items-start gap-4 text-left w-full pr-4">
                              <div className="p-3 bg-primary/5 dark:bg-primary/10 rounded-2xl shrink-0 group-hover/trigger:scale-110 transition-transform">
                                <Zap className="w-5 h-5 text-primary fill-primary/10" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2 mb-1">
                                  <p className="font-extrabold text-lg dark:text-slate-100 group-hover/trigger:text-primary transition-colors">{feature.title}</p>
                                  {feature.release_date && (
                                    <Badge variant="outline" className="text-[10px] font-mono border-slate-200 dark:border-slate-800 text-slate-400">
                                      {format(parseISO(feature.release_date), "dd-MMM-yyyy")}
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                                  {feature.short_description}
                                </p>
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="px-6 pb-8 animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="pl-0 md:pl-[4.25rem] space-y-6">
                              <div className="p-6 bg-slate-50 dark:bg-slate-950/50 rounded-[2rem] border dark:border-slate-800">
                                <div className="prose prose-sm dark:prose-invert max-w-none text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                                  {feature.details}
                                </div>
                              </div>
                              
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="flex items-center gap-4">
                                  <Badge variant="secondary" className="bg-primary/5 text-primary border-none text-[9px] font-bold uppercase tracking-wider h-5">
                                    Feature Key: {feature.feature_key}
                                  </Badge>
                                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                    <Calendar className="w-3 h-3" />
                                    Released on {feature.release_date ? format(parseISO(feature.release_date), "PP") : 'Unknown'}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    </Card>
                  ))}
                </div>
              </div>
            ))
          )}

          <Card className="border-none shadow-xl bg-gradient-to-br from-indigo-600 to-primary text-white rounded-[3rem] overflow-hidden relative group mt-16">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl group-hover:scale-150 transition-transform duration-1000" />
            <CardContent className="p-10 text-center space-y-6 relative z-10">
              <div className="mx-auto w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md shadow-inner">
                <MessageSquare className="w-8 h-8" />
              </div>
              <div className="max-w-md mx-auto space-y-2">
                <h3 className="text-2xl font-bold">Have a suggestion?</h3>
                <p className="text-sm opacity-80 leading-relaxed">
                  WorkspaceZ grows through your feedback. Share your ideas for new tools, enhancements, or productivity hacks.
                </p>
              </div>
              <Button 
                variant="secondary" 
                className="px-10 rounded-2xl h-12 font-bold text-primary bg-white hover:bg-slate-50 shadow-xl shadow-black/10 border-none"
                onClick={() => setIsSuggestModalOpen(true)}
              >
                Suggest a Feature
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

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
                    <SelectItem value="Chat">Chat</SelectItem>
                    <SelectItem value="Communication">Communication</SelectItem>
                    <SelectItem value="Productivity">Productivity</SelectItem>
                    <SelectItem value="System">System</SelectItem>
                    <SelectItem value="Workspace">Workspace</SelectItem>
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

"use client";

import { useState, useEffect } from "react";
import { Search, Loader2, FileText, CheckSquare, MessageSquare, Users, Layout, Paperclip, X, Calendar as CalendarIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const { activeWorkspace } = useWorkspace();
  const supabase = createClient();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      if (!activeWorkspace) return;
      setLoading(true);
      try {
        const { data, error } = await supabase.rpc("global_workspace_search", {
          p_workspace_id: activeWorkspace.id,
          p_query: query,
        });

        if (error) throw error;
        setResults(data || []);
      } catch (err: any) {
        console.error("Search error:", err);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query, activeWorkspace, supabase]);

  const handleResultClick = async (result: any) => {
    setIsOpen(false);
    setQuery("");

    const resType = result.result_type || "unknown";
    const resId = result.result_id;

    if (!resId) return;

    switch (resType) {
      case "task":
        router.push(`/tasks?taskId=${resId}`);
        break;
      case "note":
        router.push(`/notes?noteId=${resId}`);
        break;
      case "chat_message":
        router.push(`/chat?messageId=${resId}`);
        break;
      case "member":
        router.push(`/workspace?tab=members&userId=${resId}`);
        break;
      case "sub_workspace":
        router.push(`/tasks?teamId=${resId}`);
        break;
      case "attachment":
        try {
          const { data, error } = await supabase.storage
            .from('workspace-attachments')
            .createSignedUrl(result.subtitle || "", 600);
          if (error) throw error;
          if (data?.signedUrl) window.open(data.signedUrl, '_blank');
        } catch (err: any) {
          toast({ variant: "destructive", title: "Error opening file", description: err.message });
        }
        break;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "task": return <CheckSquare className="w-4 h-4" />;
      case "note": return <FileText className="w-4 h-4" />;
      case "chat_message": return <MessageSquare className="w-4 h-4" />;
      case "member": return <Users className="w-4 h-4" />;
      case "sub_workspace": return <Layout className="w-4 h-4" />;
      case "attachment": return <Paperclip className="w-4 h-4" />;
      default: return <Search className="w-4 h-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "task": return "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400";
      case "note": return "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400";
      case "chat_message": return "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400";
      case "member": return "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400";
      case "sub_workspace": return "bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400";
      case "attachment": return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400";
      default: return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400";
    }
  };

  return (
    <div className="relative w-full max-w-xl group">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500 transition-colors group-focus-within:text-primary" />
        <Input
          className="pl-10 h-10 md:h-11 bg-slate-100 dark:bg-slate-900 border-none shadow-none focus-visible:ring-2 focus-visible:ring-primary/20 rounded-xl transition-all w-full text-base md:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
          placeholder="Search everything..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
        />
        {query && (
          <button 
            onClick={() => { setQuery(""); setResults([]); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {isOpen && (query.length >= 2 || loading) && (
        <Card className="absolute top-full left-0 right-0 mt-2 p-2 shadow-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 z-[100] max-h-[70vh] overflow-y-auto animate-in fade-in slide-in-from-top-2 w-[calc(100vw-2rem)] md:w-full">
          {loading ? (
            <div className="flex items-center justify-center p-8 gap-3 text-slate-500 dark:text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm font-medium">Searching...</span>
            </div>
          ) : results.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">No results found for "{query}"</p>
            </div>
          ) : (
            <div className="space-y-1">
              {results.map((result, index) => {
                const resType = result.result_type || "unknown";
                const resId = result.result_id || index;
                const title = result.title || "Untitled";
                
                return (
                  <button
                    key={`${resType}-${resId}`}
                    className="w-full flex items-start gap-4 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left group/item"
                    onClick={() => handleResultClick(result)}
                  >
                    <div className={cn("p-2 rounded-lg shrink-0", getTypeColor(resType))}>
                      {getTypeIcon(resType)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-bold text-sm truncate text-slate-900 dark:text-slate-100">{title}</span>
                        <Badge variant="outline" className="text-[9px] uppercase tracking-wider py-0 h-4 bg-white dark:bg-slate-800 dark:border-slate-700 shrink-0">
                          {resType.replaceAll("_", " ")}
                        </Badge>
                      </div>
                      {result.description && (
                        <p className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mb-1">{result.description}</p>
                      )}
                      <div className="flex items-center gap-3">
                        <span className="text-[9px] md:text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                          <CalendarIcon className="w-3 h-3" />
                          {result.created_at ? new Date(result.created_at).toLocaleDateString() : 'N/A'}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

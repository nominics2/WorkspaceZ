
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { 
  Trash2, 
  RefreshCcw, 
  Trash, 
  Loader2, 
  CheckSquare, 
  StickyNote, 
  Bell, 
  User, 
  AlertCircle, 
  Clock,
  ShieldAlert
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

export default function TrashPage() {
  const { activeWorkspace, hasPermission, userRole } = useWorkspace();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  
  const supabase = createClient();
  const { toast } = useToast();

  const forceUnlockUI = useCallback(() => {
    if (typeof document !== 'undefined') {
      document.body.style.pointerEvents = "";
      document.body.style.overflow = "";
    }
  }, []);

  useEffect(() => {
    return () => forceUnlockUI();
  }, [forceUnlockUI]);

  const canManageTrash = hasPermission('manage_trash') || userRole === 'superadmin' || userRole === 'admin';

  const fetchTrash = useCallback(async () => {
    if (!activeWorkspace || !canManageTrash) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('workspace_trash_items', {
        p_workspace_id: activeWorkspace.id
      });
      if (error) throw error;
      setItems(data || []);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace, canManageTrash, supabase, toast]);

  useEffect(() => {
    fetchTrash();
  }, [fetchTrash]);

  const handleRestore = async (item: any) => {
    if (!canManageTrash || !item.item_id) return;
    setActionLoading(item.item_id);
    try {
      let rpcName = "";
      let params: any = {};
      if (item.item_type === 'task') { rpcName = 'restore_task_from_trash'; params = { p_task_id: item.item_id }; }
      else if (item.item_type === 'note') { rpcName = 'restore_note_from_trash'; params = { p_note_id: item.item_id }; }
      else if (item.item_type === 'notification') { rpcName = 'restore_notification_from_trash'; params = { p_notification_id: item.item_id }; }
      
      if (!rpcName) throw new Error("Unsupported item type for restoration");

      const { error } = await supabase.rpc(rpcName, params);
      
      if (error) {
        console.error(`[Trash] Restore error (${item.item_type}):`, {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw error;
      }
      
      toast({ title: "Item restored", description: `${item.title} has been moved back.` });
      
      // Optimistic update
      setItems(prev => prev.filter(i => i.item_id !== item.item_id));
      fetchTrash();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Restore failed", description: err.message });
    } finally {
      setActionLoading(null);
      forceUnlockUI();
    }
  };

  const handlePermanentDelete = async (item: any) => {
    if (!canManageTrash || !item.item_id) return;
    setActionLoading(item.item_id);
    try {
      let rpcName = "";
      let params: any = {};
      
      if (item.item_type === 'task') { 
        rpcName = 'permanently_delete_task'; 
        params = { p_task_id: item.item_id }; 
      }
      else if (item.item_type === 'note') { 
        rpcName = 'permanently_delete_note'; 
        params = { p_note_id: item.item_id }; 
      }
      else if (item.item_type === 'notification') { 
        rpcName = 'permanently_delete_notification'; 
        params = { p_notification_id: item.item_id }; 
      }
      
      if (!rpcName) throw new Error("Unsupported item type for deletion");

      // We strictly use the RPC to handle deletion and avoid any frontend inserts 
      // into task_activity_logs or other meta tables which might cause constraint errors.
      const { error } = await supabase.rpc(rpcName, params);
      
      if (error) {
        console.error(`[Trash] Permanent delete error (${item.item_type}):`, {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw error;
      }
      
      toast({ title: "Item deleted permanently" });
      
      // Optimistic update
      setItems(prev => prev.filter(i => i.item_id !== item.item_id));
      fetchTrash();
    } catch (err: any) {
      toast({ 
        variant: "destructive", 
        title: "Deletion failed", 
        description: err.message || "An unexpected error occurred during permanent deletion." 
      });
    } finally {
      setActionLoading(null);
      forceUnlockUI();
    }
  };

  const filteredItems = useMemo(() => {
    if (filter === 'all') return items;
    return items.filter(i => i.item_type === filter);
  }, [items, filter]);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'task': return <CheckSquare className="w-4 h-4" />;
      case 'note': return <StickyNote className="w-4 h-4" />;
      case 'notification': return <Bell className="w-4 h-4" />;
      default: return <Trash className="w-4 h-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'task': return "text-blue-500 bg-blue-50 dark:bg-blue-500/10";
      case 'note': return "text-amber-500 bg-amber-50 dark:bg-amber-500/10";
      case 'notification': return "text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10";
      default: return "text-slate-500 bg-slate-50 dark:bg-slate-800";
    }
  };

  if (!canManageTrash && !loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <ShieldAlert className="w-12 h-12 text-rose-500" />
        <h1 className="text-xl font-bold dark:text-slate-100">Access Denied</h1>
        <p className="text-muted-foreground text-sm text-center max-w-xs">You do not have permission to manage the workspace trash. Contact your administrator.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div><h1 className="text-3xl font-bold flex items-center gap-3 text-slate-950 dark:text-slate-100"><Trash2 className="w-8 h-8 text-rose-500" />Trash</h1><p className="text-muted-foreground">Recover deleted items or delete them permanently.</p></div>
      </div>
      <Tabs defaultValue="all" onValueChange={setFilter} className="space-y-6">
        <TabsList className="bg-white dark:bg-slate-900 border dark:border-slate-800 p-1 rounded-xl w-full md:w-auto flex overflow-x-auto h-auto no-scrollbar"><TabsTrigger value="all" className="flex-1 md:flex-none dark:data-[state=active]:bg-slate-800 dark:text-slate-400 dark:data-[state=active]:text-slate-100">All Items</TabsTrigger><TabsTrigger value="task" className="flex-1 md:flex-none dark:data-[state=active]:bg-slate-800 dark:text-slate-400 dark:data-[state=active]:text-slate-100">Tasks</TabsTrigger><TabsTrigger value="note" className="flex-1 md:flex-none dark:data-[state=active]:bg-slate-800 dark:text-slate-400 dark:data-[state=active]:text-slate-100">Notes</TabsTrigger><TabsTrigger value="notification" className="flex-1 md:flex-none dark:data-[state=active]:bg-slate-800 dark:text-slate-400 dark:data-[state=active]:text-slate-100">Notifications</TabsTrigger></TabsList>
        <TabsContent value={filter} className="space-y-4">
          {loading ? (<div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>) : filteredItems.length === 0 ? (<div className="text-center py-20 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center gap-4"><Trash className="w-12 h-12 text-slate-300 dark:text-slate-600" /><div className="space-y-1"><p className="font-bold text-lg text-slate-900 dark:text-slate-100">Trash is empty</p><p className="text-muted-foreground text-sm">Items deleted within the workspace will appear here.</p></div></div>) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredItems.map((item, index) => (
                <Card key={`${item.item_type}-${item.item_id || index}`} className="border-none shadow-sm hover:shadow-md transition-all overflow-hidden group dark:bg-slate-900">
                  <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-4"><div className={cn("p-3 rounded-xl shrink-0 w-fit", getTypeColor(item.item_type))}>{getTypeIcon(item.item_type)}</div><div className="flex-1 min-w-0 space-y-1"><div className="flex items-center gap-2 flex-wrap"><h3 className="font-bold truncate text-sm md:text-base text-slate-950 dark:text-slate-100">{item.title}</h3><Badge variant="outline" className="text-[10px] uppercase tracking-wider h-4 py-0 shrink-0 dark:border-slate-800 dark:text-slate-400">{item.item_type}</Badge></div><p className="text-xs text-muted-foreground line-clamp-1">{item.description || "No description provided."}</p><div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-muted-foreground"><span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Deleted {new Date(item.deleted_at).toLocaleString()}</span><span className="flex items-center gap-1"><User className="w-3 h-3" /> By {item.deleted_by_name || "Unknown"}</span></div></div><div className="flex items-center gap-2 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"><Button variant="ghost" size="sm" onClick={() => handleRestore(item)} disabled={!!actionLoading} className="h-8 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 gap-2 px-2">{actionLoading === item.item_id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCcw className="w-3.5 h-3.5" />}Restore</Button><AlertDialog><AlertDialogTrigger asChild><Button variant="ghost" size="sm" className="h-8 text-rose-500 dark:text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 gap-2 px-2" disabled={!!actionLoading}><Trash className="w-3.5 h-3.5" />Delete</Button></AlertDialogTrigger><AlertDialogContent className="w-[95vw] max-w-md dark:bg-slate-950 dark:border-slate-800"><AlertDialogHeader><AlertDialogTitle className="dark:text-slate-100">Permanently delete?</AlertDialogTitle><AlertDialogDescription className="dark:text-slate-400">This action cannot be undone. This will permanently remove the {item.item_type} <strong>{item.title}</strong> from the workspace.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter className="flex-row gap-2"><AlertDialogCancel className="flex-1 mt-0 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300" onClick={() => forceUnlockUI()}>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handlePermanentDelete(item)} className="bg-rose-500 hover:bg-rose-600 dark:bg-rose-600 dark:hover:bg-rose-700 flex-1">Delete Forever</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></div></CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

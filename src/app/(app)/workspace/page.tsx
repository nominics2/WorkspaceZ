"use client";

import React, { useState, useEffect, useCallback, Fragment } from "react";
import { 
  Users, 
  Layers, 
  HardDrive, 
  Shield, 
  Copy, 
  Plus, 
  MoreVertical, 
  Trash2, 
  Loader2, 
  UserPlus,
  ShieldCheck,
  Briefcase,
  ShieldAlert,
  Lock,
  CheckCircle2,
  History,
  Info,
  UserX,
  UserCheck,
  Filter,
  XCircle,
  Clock,
  Layout
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export default function WorkspaceAdminPage() {
  const { activeWorkspace, workspaces, refreshWorkspaces, userProfile, userRole, hasPermission } = useWorkspace();
  const [members, setMembers] = useState<any[]>([]);
  const [allocations, setAllocations] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [subWorkspaces, setSubWorkspaces] = useState<any[]>([]);
  const [storage, setStorage] = useState<any>(null);
  const [permissionDefs, setPermissionDefs] = useState<any[]>([]);
  const [wsPermissions, setWsPermissions] = useState<any[]>([]);
  const [workspaceInfo, setWorkspaceInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isAllocating, setIsAllocating] = useState(false);
  const [isCreatingTeam, setIsCreatingTeam] = useState(false);
  const [editingTeam, setEditingTeam] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [updatingRole, setUpdatingRole] = useState<string | null>(null);
  const [updatingPerm, setUpdatingPerm] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive" | "pending">("active");
  const [deactivatingMember, setDeactivatingMember] = useState<any>(null);
  const [deletingTeam, setDeletingTeam] = useState<any>(null);
  const [isStatusUpdating, setIsStatusUpdating] = useState<string | null>(null);
  
  const supabase = createClient();
  const { toast } = useToast();

  const forceUnlockUI = useCallback(() => {
    if (typeof document !== 'undefined') {
      setTimeout(() => {
        document.body.style.pointerEvents = "";
      }, 100);
    }
  }, []);

  useEffect(() => {
    forceUnlockUI();
    return () => forceUnlockUI();
  }, [forceUnlockUI]);

  const fetchData = useCallback(async () => {
    if (!activeWorkspace || !userProfile) return;
    setLoading(true);

    try {
      // 1. Fetch workspace settings
      const { data: wsData } = await supabase
        .from('workspaces')
        .select('*')
        .eq('id', activeWorkspace.id)
        .single();
      setWorkspaceInfo(wsData);

      // 2. Fetch members
      const { data: membersList } = await supabase
        .from('workspace_members')
        .select('*, profiles(full_name, username, avatar_url, email)')
        .eq('workspace_id', activeWorkspace.id);
      setMembers(membersList || []);

      // 3. Fetch storage usage
      const { data: storageInfo } = await supabase
        .from('workspace_storage_usage')
        .select('*')
        .eq('workspace_id', activeWorkspace.id)
        .maybeSingle();
      setStorage(storageInfo);

      // 4. Fetch work allocations
      const { data: allocList } = await supabase
        .from('work_allocations')
        .select('*, profiles!work_allocations_user_id_fkey(full_name), creator:profiles!work_allocations_assigned_by_fkey(full_name)')
        .eq('workspace_id', activeWorkspace.id)
        .order('created_at', { ascending: false });
      setAllocations(allocList || []);

      // 5. Fetch sub-workspaces
      const { data: swList } = await supabase
        .from('sub_workspaces')
        .select('*')
        .eq('workspace_id', activeWorkspace.id)
        .order('name', { ascending: true });
      setSubWorkspaces(swList || []);

      // 6. Fetch Permission Definitions
      const { data: defs } = await supabase
        .from('role_permission_definitions')
        .select('*')
        .order('category', { ascending: true });
      setPermissionDefs(defs || []);

      // 7. Fetch Workspace Role Permissions
      const { data: perms } = await supabase
        .from('workspace_role_permissions')
        .select('*')
        .eq('workspace_id', activeWorkspace.id);
      setWsPermissions(perms || []);

      // 8. Fetch Audit Logs
      const { data: logs } = await supabase
        .from('admin_audit_logs')
        .select('*, actor:profiles!actor_id(full_name), target:profiles!target_user_id(full_name)')
        .eq('workspace_id', activeWorkspace.id)
        .order('created_at', { ascending: false })
        .limit(50);
      setAuditLogs(logs || []);

    } catch (err: any) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
      forceUnlockUI();
    }
  }, [activeWorkspace, userProfile, supabase, forceUnlockUI]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCopyJoinCode = () => {
    if (activeWorkspace?.join_code) {
      navigator.clipboard.writeText(activeWorkspace.join_code);
      toast({ title: "Join code copied!" });
    }
  };

  const handleToggleJoinApproval = async (required: boolean) => {
    if (!hasPermission('manage_members') && userRole !== 'superadmin') return;
    try {
      const { error } = await supabase.rpc('set_workspace_join_approval', {
        p_workspace_id: activeWorkspace?.id,
        p_required: required
      });
      if (error) throw error;
      toast({ title: "Setting Updated", description: required ? "Join requests now require approval." : "Users can now join immediately." });
      fetchData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  const handleUpdateRole = async (memberUserId: string, newRole: string) => {
    if (userRole !== 'superadmin') {
      toast({ variant: "destructive", title: "Unauthorized", description: "Only superadmins can change member roles." });
      return;
    }

    setUpdatingRole(memberUserId);
    try {
      const { error } = await supabase.rpc('update_workspace_member_role', {
        p_workspace_id: activeWorkspace?.id,
        p_member_user_id: memberUserId,
        p_new_role: newRole
      });
      
      if (error) throw error;
      
      toast({ title: "Role Updated", description: `The member's role has been changed to ${newRole}.` });
      fetchData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Update Failed", description: err.message || "Failed to update member role." });
    } finally {
      setUpdatingRole(null);
      forceUnlockUI();
    }
  };

  const handleDeactivate = async (memberUserId: string) => {
    setIsStatusUpdating(memberUserId);
    try {
      const { error } = await supabase.rpc("deactivate_workspace_member", {
        p_workspace_id: activeWorkspace?.id,
        p_member_user_id: memberUserId,
      });

      if (error) throw error;

      toast({ title: "Member Deactivated", description: "User can no longer access the workspace." });
      setDeactivatingMember(null);
      fetchData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Action Failed", description: err.message });
    } finally {
      setIsStatusUpdating(null);
      forceUnlockUI();
    }
  };

  const handleReactivate = async (memberUserId: string) => {
    setIsStatusUpdating(memberUserId);
    try {
      const { error } = await supabase.rpc("reactivate_workspace_member", {
        p_workspace_id: activeWorkspace?.id,
        p_member_user_id: memberUserId,
      });

      if (error) throw error;

      toast({ title: "Member Reactivated", description: "User access has been restored." });
      fetchData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Action Failed", description: err.message });
    } finally {
      setIsStatusUpdating(null);
      forceUnlockUI();
    }
  };

  const handleApproveJoin = async (memberUserId: string) => {
    setIsStatusUpdating(memberUserId);
    try {
      const { error } = await supabase.rpc("approve_workspace_join_request", {
        p_workspace_id: activeWorkspace?.id,
        p_member_user_id: memberUserId,
      });
      if (error) throw error;
      toast({ title: "Request Approved", description: "User has been admitted to the workspace." });
      fetchData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Approval Failed", description: err.message });
    } finally {
      setIsStatusUpdating(null);
      forceUnlockUI();
    }
  };

  const handleRejectJoin = async (memberUserId: string) => {
    setIsStatusUpdating(memberUserId);
    try {
      const { error } = await supabase.rpc("reject_workspace_join_request", {
        p_workspace_id: activeWorkspace?.id,
        p_member_user_id: memberUserId,
      });
      if (error) throw error;
      toast({ title: "Request Rejected", description: "User request has been removed." });
      fetchData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Rejection Failed", description: err.message });
    } finally {
      setIsStatusUpdating(null);
      forceUnlockUI();
    }
  };

  const handleCreateAllocation = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!activeWorkspace || !userProfile) return;
    
    setSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const targetUserId = formData.get("user_id") as string;
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;

    try {
      const { data: allocation, error } = await supabase.from('work_allocations').insert({
        workspace_id: activeWorkspace.id,
        user_id: targetUserId,
        assigned_by: userProfile.id,
        title,
        description
      }).select().single();

      if (error) throw error;

      await supabase.rpc('create_admin_audit_log', {
        p_workspace_id: activeWorkspace.id,
        p_action: 'work_allocation_created',
        p_target_user_id: targetUserId,
        p_details: { allocation_id: allocation.id, title }
      });

      toast({ title: "Work allocated successfully" });
      setIsAllocating(false);
      fetchData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setSubmitting(false);
      forceUnlockUI();
    }
  };

  const handleDeleteAllocation = async (id: string) => {
    const alloc = allocations.find(a => a.id === id);
    try {
      const { error } = await supabase.from('work_allocations').delete().eq('id', id);
      if (error) throw error;

      await supabase.rpc('create_admin_audit_log', {
        p_workspace_id: activeWorkspace?.id,
        p_action: 'work_allocation_deleted',
        p_target_user_id: alloc?.user_id,
        p_details: { allocation_id: id, title: alloc?.title }
      });

      toast({ title: "Allocation removed" });
      fetchData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  const handleCreateTeam = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!activeWorkspace || !userProfile) return;
    setSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;

    try {
      if (editingTeam) {
        const { error } = await supabase
          .from('sub_workspaces')
          .update({ name, description })
          .eq('id', editingTeam.id);
        
        if (error) throw error;

        await supabase.rpc('create_admin_audit_log', {
          p_workspace_id: activeWorkspace.id,
          p_action: 'sub_workspace_updated',
          p_details: { id: editingTeam.id, name }
        });

        toast({ title: "Team updated" });
      } else {
        const { data, error } = await supabase.from('sub_workspaces').insert({
          workspace_id: activeWorkspace.id,
          name,
          description,
          created_by: userProfile.id
        }).select().single();

        if (error) throw error;

        await supabase.rpc('create_admin_audit_log', {
          p_workspace_id: activeWorkspace.id,
          p_action: 'sub_workspace_created',
          p_details: { id: data.id, name }
        });

        toast({ title: "Team created" });
      }
      setIsCreatingTeam(false);
      setEditingTeam(null);
      fetchData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setSubmitting(false);
      forceUnlockUI();
    }
  };

  const handleDeleteTeam = async (id: string) => {
    try {
      // Clean up task references first
      await supabase.from('tasks').update({ sub_workspace_id: null }).eq('sub_workspace_id', id);
      
      const { error } = await supabase.from('sub_workspaces').delete().eq('id', id);
      if (error) throw error;

      await supabase.rpc('create_admin_audit_log', {
        p_workspace_id: activeWorkspace?.id,
        p_action: 'sub_workspace_deleted',
        p_details: { id }
      });

      toast({ title: "Team removed" });
      setDeletingTeam(null);
      fetchData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      forceUnlockUI();
    }
  };

  const handleTogglePermission = async (role: string, permissionKey: string, currentEnabled: boolean) => {
    if (userRole !== 'superadmin') return;
    if (!activeWorkspace || !userProfile) return;

    const id = `${role}-${permissionKey}`;
    setUpdatingPerm(id);

    try {
      const { error } = await supabase.rpc('set_workspace_role_permission', {
        p_workspace_id: activeWorkspace.id,
        p_role: role,
        p_permission_key: permissionKey,
        p_enabled: !currentEnabled
      });

      if (error) throw error;
      
      toast({ title: "Permission Updated" });
      fetchData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setUpdatingPerm(null);
      forceUnlockUI();
    }
  };

  const isSuper = userRole === 'superadmin';
  const isAdminOrSuper = isSuper || userRole === 'admin';
  const canManageMembers = hasPermission('manage_members');
  const canManageAllocations = hasPermission('manage_work_allocations');
  const canManageSettings = hasPermission('manage_workspace_settings');
  const canViewAuditLog = isSuper || hasPermission('view_admin_panel');

  const filteredMembers = members.filter(m => {
    if (statusFilter === "all") return true;
    return m.status === statusFilter;
  });

  const groupedPermissions = permissionDefs.reduce((acc: any, def) => {
    const cat = def.category || 'General';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(def);
    return acc;
  }, {});

  if (loading && !activeWorkspace) {
    return <div className="flex h-[80vh] items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Layers className="w-8 h-8 text-primary" />
            Admin Panel
          </h1>
          <p className="text-muted-foreground">Manage workspace settings, members, roles, allocations, and storage.</p>
        </div>
        {isAdminOrSuper && (
          <div className="flex items-center gap-2 bg-white p-2 pr-4 rounded-xl border shadow-sm">
            <div className="px-3 py-1 bg-slate-100 rounded-lg text-xs font-bold font-mono text-primary">
              {activeWorkspace?.join_code}
            </div>
            <Button variant="ghost" size="icon" onClick={handleCopyJoinCode} title="Copy Join Code">
              <Copy className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="border-none shadow-sm">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-blue-50 rounded-xl">
              <Users className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium">Members</p>
              <p className="text-2xl font-bold">{members.filter(m => m.status === 'active').length}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-violet-50 rounded-xl">
              <Layout className="w-6 h-6 text-violet-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium">Teams</p>
              <p className="text-2xl font-bold">{subWorkspaces.length}</p>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-none shadow-sm">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-emerald-50 rounded-xl">
              <Briefcase className="w-6 h-6 text-emerald-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium">Allocations</p>
              <p className="text-2xl font-bold">{allocations.length}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardContent className="p-6">
             <div className="flex items-center justify-between mb-2">
               <div className="flex items-center gap-3">
                 <div className="p-2 bg-amber-50 rounded-lg">
                   <HardDrive className="w-4 h-4 text-amber-500" />
                 </div>
                 <p className="text-sm text-muted-foreground font-medium">Storage</p>
               </div>
               <p className="text-xs font-bold text-muted-foreground">
                 {((storage?.total_bytes_used || 0) / (1024 * 1024)).toFixed(1)} MB / 1 GB
               </p>
             </div>
             <Progress value={((storage?.total_bytes_used || 0) / (1024 * 1024 * 1024)) * 100} className="h-2" />
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="members" className="space-y-6">
        <TabsList className="bg-white border p-1 rounded-xl overflow-x-auto h-auto whitespace-nowrap">
          <TabsTrigger value="members" className="rounded-lg px-6">Members</TabsTrigger>
          <TabsTrigger value="teams" className="rounded-lg px-6">Teams</TabsTrigger>
          <TabsTrigger value="allocations" className="rounded-lg px-6">Allocations</TabsTrigger>
          <TabsTrigger value="permissions" className="rounded-lg px-6">Permissions</TabsTrigger>
          {canViewAuditLog && <TabsTrigger value="audit" className="rounded-lg px-6">Audit Log</TabsTrigger>}
          {isAdminOrSuper && <TabsTrigger value="settings" className="rounded-lg px-6">Access Control</TabsTrigger>}
        </TabsList>

        <TabsContent value="members" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
            <h2 className="text-xl font-bold">Workspace Members</h2>
            <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
              <Button 
                variant={statusFilter === "all" ? "secondary" : "ghost"} 
                size="sm" 
                onClick={() => setStatusFilter("all")}
                className="text-xs h-8"
              >
                All
              </Button>
              <Button 
                variant={statusFilter === "active" ? "secondary" : "ghost"} 
                size="sm" 
                onClick={() => setStatusFilter("active")}
                className="text-xs h-8"
              >
                Active
              </Button>
              <Button 
                variant={statusFilter === "pending" ? "secondary" : "ghost"} 
                size="sm" 
                onClick={() => setStatusFilter("pending")}
                className="text-xs h-8"
              >
                Pending {members.filter(m => m.status === 'pending').length > 0 && <Badge className="ml-1 h-4 w-4 p-0 flex items-center justify-center bg-primary text-[8px]">{members.filter(m => m.status === 'pending').length}</Badge>}
              </Button>
              <Button 
                variant={statusFilter === "inactive" ? "secondary" : "ghost"} 
                size="sm" 
                onClick={() => setStatusFilter("inactive")}
                className="text-xs h-8"
              >
                Inactive
              </Button>
            </div>
          </div>

          {!canManageMembers && !isSuper ? (
             <div className="py-20 text-center bg-slate-50 rounded-2xl border-2 border-dashed">
                <Shield className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-muted-foreground">You do not have permission to manage members.</p>
             </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {filteredMembers.length === 0 ? (
                <p className="py-12 text-center text-muted-foreground italic bg-slate-50 rounded-xl border-2 border-dashed">
                  No {statusFilter} members found.
                </p>
              ) : (
                filteredMembers.map((member) => (
                  <Card key={member.id} className={cn("border-none shadow-sm group", member.status === 'inactive' && "opacity-75")}>
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center border shadow-sm overflow-hidden">
                          {member.profiles?.avatar_url ? (
                            <img src={member.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-primary font-bold">{member.profiles?.full_name?.[0]}</span>
                          )}
                        </div>
                        <div className="font-bold text-foreground flex items-center gap-2">
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              <span>{member.profiles?.full_name}</span>
                              {member.user_id === userProfile?.id && <Badge variant="secondary" className="text-[10px] h-4">You</Badge>}
                              <Badge variant={member.status === 'active' ? 'default' : 'outline'} className={cn(
                                "text-[10px] h-4",
                                member.status === 'active' ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : 
                                member.status === 'pending' ? "bg-amber-500/10 text-amber-600 border-amber-500/20" :
                                "bg-slate-50 text-slate-400"
                              )}>
                                {member.status}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground font-normal">{member.profiles?.username} • {member.profiles?.email}</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-6">
                        <div className="text-right hidden sm:block">
                          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Role</p>
                          {member.role === 'superadmin' ? (
                            <Badge variant="default" className="mt-1">Superadmin - Full Access</Badge>
                          ) : member.status === 'pending' ? (
                            <Badge variant="outline" className="mt-1">Requesting Access</Badge>
                          ) : (
                            <Badge 
                              variant={member.role === 'admin' ? 'secondary' : 'outline'} 
                              className="capitalize mt-1"
                            >
                              {member.role}
                            </Badge>
                          )}
                        </div>

                        {(isSuper || canManageMembers) && (
                          <div className="flex items-center gap-2">
                            {member.status === 'pending' ? (
                              <>
                                <Button 
                                  size="sm" 
                                  variant="default" 
                                  className="h-8 gap-1 bg-emerald-600 hover:bg-emerald-700"
                                  onClick={() => handleApproveJoin(member.user_id)}
                                  disabled={isStatusUpdating === member.user_id}
                                >
                                  {isStatusUpdating === member.user_id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
                                  Approve
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  className="h-8 gap-1 text-rose-600 border-rose-200 hover:bg-rose-50"
                                  onClick={() => handleRejectJoin(member.user_id)}
                                  disabled={isStatusUpdating === member.user_id}
                                >
                                  {isStatusUpdating === member.user_id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                                  Reject
                                </Button>
                              </>
                            ) : (
                              <DropdownMenu onOpenChange={(open) => !open && forceUnlockUI()}>
                                <DropdownMenuTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="text-muted-foreground hover:text-foreground"
                                    disabled={updatingRole === member.user_id || isStatusUpdating === member.user_id}
                                  >
                                    {updatingRole === member.user_id || isStatusUpdating === member.user_id ? 
                                      <Loader2 className="w-4 h-4 animate-spin" /> : 
                                      <MoreVertical className="w-4 h-4" />
                                    }
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-56">
                                  {isSuper && member.role !== 'superadmin' && (
                                    <>
                                      <DropdownMenuLabel>Change Role</DropdownMenuLabel>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem onClick={() => handleUpdateRole(member.user_id, 'admin')} className="gap-2">
                                        <Shield className="w-3.5 h-3.5" /> Admin
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => handleUpdateRole(member.user_id, 'manager')} className="gap-2">
                                        <Briefcase className="w-3.5 h-3.5" /> Manager
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => handleUpdateRole(member.user_id, 'member')} className="gap-2">
                                        <Users className="w-3.5 h-3.5" /> Member
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                    </>
                                  )}
                                  
                                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                  {member.status === 'active' ? (
                                    <DropdownMenuItem 
                                      className="text-rose-500 gap-2"
                                      onClick={() => setDeactivatingMember(member)}
                                      disabled={
                                        member.user_id === userProfile?.id || 
                                        member.role === 'superadmin' || 
                                        (member.role === 'admin' && !isSuper)
                                      }
                                    >
                                      <UserX className="w-3.5 h-3.5" /> Deactivate
                                    </DropdownMenuItem>
                                  ) : (
                                    <DropdownMenuItem 
                                      className="text-emerald-500 gap-2"
                                      onClick={() => handleReactivate(member.user_id)}
                                    >
                                      <UserCheck className="w-3.5 h-3.5" /> Reactivate
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="teams" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Workspace Teams</h2>
            {(canManageSettings || isSuper) && (
              <Button onClick={() => { setEditingTeam(null); setIsCreatingTeam(true); }} className="flex items-center gap-2">
                <Plus className="w-4 h-4" /> Create Team
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {subWorkspaces.length === 0 ? (
              <div className="md:col-span-3 py-20 text-center bg-slate-50 rounded-2xl border-2 border-dashed">
                <Layout className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-muted-foreground">No teams defined yet.</p>
              </div>
            ) : (
              subWorkspaces.map((team) => (
                <Card key={team.id} className="border-none shadow-sm group">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary" className="bg-violet-50 text-violet-600 hover:bg-violet-100 border-none">Team</Badge>
                      {(canManageSettings || isSuper) && (
                        <DropdownMenu onOpenChange={(open) => !open && forceUnlockUI()}>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setEditingTeam(team); setIsCreatingTeam(true); }}>Edit Team</DropdownMenuItem>
                            <DropdownMenuItem className="text-rose-500" onClick={() => setDeletingTeam(team)}>Delete Team</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                    <CardTitle className="text-lg mt-2">{team.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground line-clamp-2">{team.description || 'No description provided.'}</p>
                    <p className="text-[10px] text-muted-foreground mt-4 pt-4 border-t flex items-center gap-1.5">
                      <Clock className="w-3 h-3" /> Created {new Date(team.created_at).toLocaleDateString()}
                    </p>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="allocations" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Member Work Allocations</h2>
            {(canManageAllocations || isSuper) && (
              <Button onClick={() => setIsAllocating(true)} className="flex items-center gap-2">
                <Plus className="w-4 h-4" /> Create Allocation
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {allocations.length === 0 ? (
              <div className="md:col-span-2 py-20 text-center bg-slate-50 rounded-2xl border-2 border-dashed">
                <Briefcase className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-4" />
                <p className="text-muted-foreground">No work allocations defined yet.</p>
              </div>
            ) : (
              allocations.map((alloc) => (
                <Card key={alloc.id} className="border-none shadow-sm relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-widest text-primary border-primary/20">Allocation</Badge>
                      {(canManageAllocations || isSuper) && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleDeleteAllocation(alloc.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                    <CardTitle className="text-lg mt-2">{alloc.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground line-clamp-2">{alloc.description}</p>
                    <div className="flex items-center justify-between pt-4 border-t">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold">
                          {alloc.profiles?.full_name?.[0]}
                        </div>
                        <span className="text-xs font-bold">{alloc.profiles?.full_name}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground font-medium">By {alloc.creator?.full_name}</span>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="permissions" className="space-y-6">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-primary" /> Role Permissions Matrix
              </CardTitle>
              <CardDescription>
                {isSuper ? "Configure granular access for different workspace roles." : "View current workspace permissions."}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b">
                      <th className="text-left p-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Permission</th>
                      <th className="text-center p-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Superadmin</th>
                      <th className="text-center p-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Admin</th>
                      <th className="text-center p-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Manager</th>
                      <th className="text-center p-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Member</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.keys(groupedPermissions).map((cat) => (
                      <Fragment key={cat}>
                        <tr className="bg-slate-100/50">
                          <td colSpan={5} className="p-2 px-4 text-[10px] font-bold uppercase tracking-widest text-primary">{cat}</td>
                        </tr>
                        {groupedPermissions[cat].map((def: any) => (
                          <tr key={def.permission_key} className="border-b hover:bg-slate-50 transition-colors">
                            <td className="p-4">
                              <p className="text-sm font-bold">{def.label}</p>
                              <p className="text-[10px] text-muted-foreground">{def.description}</p>
                            </td>
                            <td className="p-4 text-center">
                              <div className="flex justify-center">
                                <Badge variant="secondary" className="gap-1.5 opacity-60">
                                  <Lock className="w-2.5 h-2.5" /> Full Access - Locked
                                </Badge>
                              </div>
                            </td>
                            {['admin', 'manager', 'member'].map(role => {
                              const perm = wsPermissions.find(p => p.role === role && p.permission_key === def.permission_key);
                              const enabled = !!perm?.enabled;
                              const isUpdating = updatingPerm === `${role}-${def.permission_key}`;
                              return (
                                <td key={role} className="p-4 text-center">
                                  <div className="flex justify-center">
                                    {isSuper ? (
                                      <Switch 
                                        checked={enabled} 
                                        onCheckedChange={() => handleTogglePermission(role, def.permission_key, enabled)}
                                        disabled={isUpdating}
                                      />
                                    ) : (
                                      enabled ? <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto" /> : <ShieldAlert className="w-5 h-5 text-slate-200 mx-auto" />
                                    )}
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          {!canViewAuditLog ? (
             <div className="py-20 text-center bg-slate-50 rounded-2xl border-2 border-dashed">
                <History className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-muted-foreground">You do not have permission to view audit logs.</p>
             </div>
          ) : (
            <div className="space-y-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <History className="w-5 h-5 text-primary" /> Admin Activity
              </h2>
              {auditLogs.length === 0 ? (
                <Card className="p-12 text-center text-muted-foreground bg-slate-50 border-dashed border-2">
                   No admin activity yet.
                </Card>
              ) : (
                <div className="space-y-3">
                   {auditLogs.map((log) => (
                     <Card key={log.id} className="border-none shadow-sm overflow-hidden">
                       <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="flex items-start gap-3">
                             <div className="p-2 bg-primary/5 rounded-lg mt-1">
                                <Shield className="w-4 h-4 text-primary" />
                             </div>
                             <div>
                                <div className="flex items-center gap-2 mb-1">
                                   <p className="text-sm font-bold text-foreground capitalize">{log.action.replace(/_/g, ' ')}</p>
                                   <span className="text-[10px] text-muted-foreground">{new Date(log.created_at).toLocaleString()}</span>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                   <span className="font-bold text-foreground">{(log.actor as any)?.full_name || 'System'}</span>
                                   {log.target_user_id ? (
                                     <> performed action for <span className="font-bold text-foreground">{(log.target as any)?.full_name}</span></>
                                   ) : (
                                     <> updated workspace settings</>
                                   )}
                                </p>
                                {log.details && (
                                   <div className="mt-3 p-2 bg-slate-50 rounded border text-[10px] font-mono flex items-center gap-2">
                                      <Info className="w-3 h-3 text-primary" />
                                      <span>
                                         {JSON.stringify(log.details).substring(0, 100)}
                                      </span>
                                   </div>
                                )}
                             </div>
                          </div>
                       </CardContent>
                     </Card>
                   ))}
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
           <Card className="border-none shadow-sm">
             <CardHeader>
               <CardTitle className="flex items-center gap-2">
                 <Shield className="w-5 h-5 text-primary" /> Workspace Security
               </CardTitle>
               <CardDescription>Configure how users access this workspace</CardDescription>
             </CardHeader>
             <CardContent className="space-y-6">
                <div className="p-6 bg-slate-50 rounded-xl border space-y-4">
                   <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-bold">Join Code Access</p>
                        <p className="text-xs text-muted-foreground">Members can join using this unique code.</p>
                      </div>
                      <div className="flex items-center gap-3">
                         <div className="px-6 py-2 bg-white border rounded-lg font-bold font-mono text-primary tracking-widest">
                           {activeWorkspace?.join_code}
                         </div>
                         <Button variant="outline" size="icon" onClick={handleCopyJoinCode}>
                           <Copy className="w-4 h-4" />
                         </Button>
                      </div>
                   </div>
                   
                   <div className="pt-4 border-t flex items-center justify-between gap-4">
                      <div className="space-y-0.5">
                        <Label className="text-sm font-bold">Require Join Approval</Label>
                        <p className="text-xs text-muted-foreground">
                          New members must be manually approved before joining.
                        </p>
                      </div>
                      <Switch 
                        checked={workspaceInfo?.require_join_approval || false} 
                        onCheckedChange={handleToggleJoinApproval}
                        disabled={!isAdminOrSuper && !canManageMembers}
                      />
                   </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 border rounded-xl space-y-2">
                    <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center mb-2">
                      <ShieldCheck className="w-5 h-5 text-emerald-600" />
                    </div>
                    <p className="font-bold text-sm">Role Based Permissions</p>
                    <p className="text-xs text-muted-foreground">Admin functions are restricted to verified roles only.</p>
                  </div>
                  <div className="p-4 border rounded-xl space-y-2">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center mb-2">
                      <UserPlus className="w-5 h-5 text-blue-600" />
                    </div>
                    <p className="font-bold text-sm">Invite Only Mode</p>
                    <p className="text-xs text-muted-foreground">When join approval is on, code access is restricted.</p>
                  </div>
                </div>
             </CardContent>
           </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isAllocating} onOpenChange={(open) => { setIsAllocating(open); if (!open) forceUnlockUI(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Work Allocation</DialogTitle>
            <DialogDescription>Assign a high-level focus area to a member.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateAllocation} className="space-y-4 py-4">
             <div className="space-y-2">
               <Label>Assign To Member</Label>
               <Select name="user_id" required>
                 <SelectTrigger><SelectValue placeholder="Select member" /></SelectTrigger>
                 <SelectContent>
                   {members.filter(m => m.status === 'active').map(m => (
                     <SelectItem key={m.user_id} value={m.user_id}>{m.profiles?.full_name}</SelectItem>
                   ))}
                 </SelectContent>
               </Select>
             </div>
             <div className="space-y-2">
               <Label>Allocation Title</Label>
               <Input name="title" placeholder="e.g. Backend Development Focus" required disabled={submitting} />
             </div>
             <div className="space-y-2">
               <Label>Focus Details</Label>
               <Textarea name="description" placeholder="What should this member focus on?" rows={4} disabled={submitting} />
             </div>
             <DialogFooter className="pt-4">
                <Button type="button" variant="ghost" onClick={() => { setIsAllocating(false); forceUnlockUI(); }} disabled={submitting}>Cancel</Button>
                <Button type="submit" disabled={submitting}>
                  {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Assign Allocation
                </Button>
             </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isCreatingTeam} onOpenChange={(open) => { setIsCreatingTeam(open); if (!open) { setEditingTeam(null); forceUnlockUI(); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingTeam ? 'Edit Team' : 'Create New Team'}</DialogTitle>
            <DialogDescription>Organize your workspace into functional sub-groups.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateTeam} className="space-y-4 py-4">
             <div className="space-y-2">
               <Label>Team Name</Label>
               <Input name="name" defaultValue={editingTeam?.name} placeholder="e.g. Engineering, Marketing..." required disabled={submitting} />
             </div>
             <div className="space-y-2">
               <Label>Description</Label>
               <Textarea name="description" defaultValue={editingTeam?.description} placeholder="What does this team focus on?" rows={4} disabled={submitting} />
             </div>
             <DialogFooter className="pt-4">
                <Button type="button" variant="ghost" onClick={() => { setIsCreatingTeam(false); setEditingTeam(null); forceUnlockUI(); }} disabled={submitting}>Cancel</Button>
                <Button type="submit" disabled={submitting}>
                  {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  {editingTeam ? 'Update Team' : 'Create Team'}
                </Button>
             </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deactivatingMember} onOpenChange={(open) => { if (!open) { setDeactivatingMember(null); forceUnlockUI(); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will deactivate <span className="font-bold text-foreground">{deactivatingMember?.profiles?.full_name}</span>. 
              They will lose all access to this workspace until reactivated.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeactivatingMember(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deactivatingMember && handleDeactivate(deactivatingMember.user_id)}
              className="bg-rose-600 hover:bg-rose-700"
            >
              Confirm Deactivation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deletingTeam} onOpenChange={(open) => { if (!open) { setDeletingTeam(null); forceUnlockUI(); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Team?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <span className="font-bold text-foreground">{deletingTeam?.name}</span>? 
              Deleting this team will remove the grouping from related tasks. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingTeam(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deletingTeam && handleDeleteTeam(deletingTeam.id)}
              className="bg-rose-600 hover:bg-rose-700"
            >
              Confirm Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

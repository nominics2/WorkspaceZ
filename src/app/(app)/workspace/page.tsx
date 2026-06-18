"use client";

import React, { useState, useEffect, useCallback, Fragment, useMemo } from "react";
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
  Layout,
  RefreshCw,
  BellRing,
  BadgeCheck,
  UserMinus,
  Search,
  Save,
  PlaneTakeoff
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function WorkspaceAdminPage() {
  const { activeWorkspace, workspaces, refreshWorkspaces, userProfile, userRole, hasPermission } = useWorkspace();
  const [members, setMembers] = useState<any[]>([]);
  const [allocations, setAllocations] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [subWorkspaces, setSubWorkspaces] = useState<any[]>([]);
  const [allSubWorkspaceMembers, setAllSubWorkspaceMembers] = useState<any[]>([]);
  const [storage, setStorage] = useState<any>(null);
  const [permissionDefs, setPermissionDefs] = useState<any[]>([]);
  const [wsPermissions, setWsPermissions] = useState<any[]>([]);
  const [workspaceInfo, setWorkspaceInfo] = useState<any>(null);
  const [wsNameInput, setWsNameInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [isAllocating, setIsAllocating] = useState(false);
  const [isCreatingTeam, setIsCreatingTeam] = useState(false);
  const [editingTeam, setEditingTeam] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [updatingRole, setUpdatingRole] = useState<string | null>(null);
  const [updatingPerm, setUpdatingPerm] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive" | "pending">("active");
  const [deactivatingMember, setDeactivatingMember] = useState<any>(null);
  const [deactivatingLoading, setDeactivatingLoading] = useState(false);
  const [deletingTeam, setDeletingTeam] = useState<any>(null);
  const [isStatusUpdating, setIsStatusUpdating] = useState<string | null>(null);
  const [isRunningChecks, setIsRunningChecks] = useState(false);

  // Team Member Management
  const [isManagingMembers, setIsManagingMembers] = useState(false);
  const [selectedTeamForMembers, setSelectedTeamForMembers] = useState<any>(null);
  const [teamMemberSearch, setTeamMemberSearch] = useState("");
  const [memberToTeamId, setMemberToTeamId] = useState<string | null>(null);
  
  const supabase = createClient();
  const { toast } = useToast();

  const isAdminOrSuper = userRole === 'superadmin' || userRole === 'admin';
  const canManageMembers = hasPermission('manage_members') || userRole === 'superadmin';
  const canManageVerified = hasPermission('manage_verified_badges') || userRole === 'superadmin';
  const canManageAllocations = hasPermission('manage_work_allocations') || userRole === 'superadmin';
  const canManageSettings = hasPermission('manage_workspace_settings') || userRole === 'superadmin';
  const canManageTeamMembers = hasPermission('manage_team_members') || userRole === 'superadmin';
  const canViewAuditLog = userRole === 'superadmin' || hasPermission('view_admin_panel');

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
    
    if (!hasPermission('view_admin_panel') && userRole !== 'superadmin') {
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const { data: wsData } = await supabase
        .from('workspaces')
        .select('*')
        .eq('id', activeWorkspace.id)
        .single();
      setWorkspaceInfo(wsData);
      if (wsData) {
        setWsNameInput(wsData.name);
      }

      // Fetch members and profiles
      const { data: wsMembers, error: wsMembersError } = await supabase
        .from('workspace_members')
        .select('*')
        .eq('workspace_id', activeWorkspace.id);

      if (wsMembersError) throw wsMembersError;

      if (wsMembers && wsMembers.length > 0) {
        const memberUserIds = wsMembers.map(m => m.user_id);
        const { data: memberProfiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name, username, avatar_url, avatar_preset, email')
          .in('id', memberUserIds);
        
        if (profilesError) throw profilesError;

        const mergedMembers = wsMembers.map(member => ({
          ...member,
          profiles: memberProfiles?.find(p => p.id === member.user_id) || null
        }));
        setMembers(mergedMembers);
      } else {
        setMembers([]);
      }

      // Storage Usage
      const { data: storageInfo } = await supabase
        .from('workspace_storage_usage')
        .select('*')
        .eq('workspace_id', activeWorkspace.id)
        .maybeSingle();
      setStorage(storageInfo);

      // Work Allocations
      const { data: allocList, error: allocError } = await supabase
        .from('work_allocations')
        .select('*')
        .eq('workspace_id', activeWorkspace.id)
        .order('created_at', { ascending: false });
      
      if (allocError) throw allocError;

      if (allocList && allocList.length > 0) {
        const allocUserIds = [...new Set([
          ...allocList.map(a => a.user_id),
          ...allocList.map(a => a.assigned_by)
        ])];
        
        const { data: allocProfiles } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, avatar_preset')
          .in('id', allocUserIds);
          
        const mergedAllocations = allocList.map(alloc => ({
          ...alloc,
          profiles: allocProfiles?.find(p => p.id === alloc.user_id) || null,
          creator: allocProfiles?.find(p => p.id === alloc.assigned_by) || null
        }));
        setAllocations(mergedAllocations);
      } else {
        setAllocations([]);
      }

      // Teams and All Team Members
      const [swListRes, swMembersRes] = await Promise.all([
        supabase
          .from('sub_workspaces')
          .select('*')
          .eq('workspace_id', activeWorkspace.id)
          .order('name', { ascending: true }),
        supabase
          .from('sub_workspace_members_view')
          .select('*')
          .eq('workspace_id', activeWorkspace.id)
      ]);

      setSubWorkspaces(swListRes.data || []);
      setAllSubWorkspaceMembers(swMembersRes.data || []);

      // Permission Definitions
      const { data: defs } = await supabase
        .from('role_permission_definitions')
        .select('*')
        .order('category', { ascending: true });
      setPermissionDefs(defs || []);

      // Workspace Role Permissions
      const { data: perms } = await supabase
        .from('workspace_role_permissions')
        .select('*')
        .eq('workspace_id', activeWorkspace.id);
      setWsPermissions(perms || []);

      // Audit Logs
      const { data: logs } = await supabase
        .from('admin_audit_logs')
        .select('*, actor:profiles!actor_id(full_name), target:profiles!target_user_id(full_name)')
        .eq('workspace_id', activeWorkspace.id)
        .order('created_at', { ascending: false })
        .limit(50);
      setAuditLogs(logs || []);

    } catch (err: any) {
      console.error("Fetch error:", err);
      toast({ variant: "destructive", title: "Data Fetch Error", description: err.message });
    } finally {
      setLoading(false);
      forceUnlockUI();
    }
  }, [activeWorkspace, userProfile, userRole, hasPermission, supabase, forceUnlockUI, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCopyJoinCode = () => {
    if (activeWorkspace?.join_code) {
      navigator.clipboard.writeText(activeWorkspace.join_code);
      toast({ title: "Join code copied!" });
    }
  };

  const handleUpdateWorkspaceName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace || !canManageSettings || !wsNameInput.trim()) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.rpc("update_workspace_name", {
        p_workspace_id: activeWorkspace.id,
        p_name: wsNameInput.trim(),
      });
      if (error) throw error;
      toast({ title: "Workspace name updated" });
      await refreshWorkspaces();
      await fetchData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setSubmitting(false);
      forceUnlockUI();
    }
  };

  const handleToggleVerified = async (memberUserId: string, currentVerified: boolean) => {
    if (!canManageVerified) return;
    setIsStatusUpdating(memberUserId);
    try {
      const { error } = await supabase.rpc('set_workspace_member_verified', {
        p_workspace_id: activeWorkspace?.id,
        p_member_user_id: memberUserId,
        p_verified: !currentVerified
      });
      if (error) throw error;
      toast({ 
        title: !currentVerified ? "Member Verified" : "Verification Removed", 
        description: `Status updated for the selected member.` 
      });
      fetchData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setIsStatusUpdating(null);
      forceUnlockUI();
    }
  };

  const handleToggleJoinApproval = async (required: boolean) => {
    if (!canManageMembers) return;
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
    } finally {
      forceUnlockUI();
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
    if (!canManageMembers) return;
    setDeactivatingLoading(true);
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
      setDeactivatingLoading(false);
      setIsStatusUpdating(null);
      forceUnlockUI();
    }
  };

  const handleReactivate = async (memberUserId: string) => {
    if (!canManageMembers) return;
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
    if (!canManageMembers) return;
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
    if (!canManageMembers) return;
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
    if (!activeWorkspace || !userProfile || !canManageAllocations) return;
    
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

  const handleCreateTeam = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!activeWorkspace || !userProfile || !canManageSettings) return;
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

  const handleDeleteTeam = async () => {
    if (!activeWorkspace || !deletingTeam || !canManageSettings) return;
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('sub_workspaces')
        .delete()
        .eq('id', deletingTeam.id);

      if (error) throw error;

      await supabase.rpc('create_admin_audit_log', {
        p_workspace_id: activeWorkspace.id,
        p_action: 'sub_workspace_deleted',
        p_details: { id: deletingTeam.id, name: deletingTeam.name }
      });

      toast({ title: "Team deleted" });
      setDeletingTeam(null);
      fetchData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setSubmitting(false);
      forceUnlockUI();
    }
  };

  const handleAddTeamMember = async (userId: string) => {
    if (!activeWorkspace || !selectedTeamForMembers || !canManageTeamMembers) return;
    setIsStatusUpdating(userId);
    try {
      const { error } = await supabase.rpc('add_member_to_sub_workspace', {
        p_workspace_id: activeWorkspace.id,
        p_sub_workspace_id: selectedTeamForMembers.id,
        p_user_id: userId
      });

      if (error) throw error;

      toast({ title: "Member added to team" });
      await fetchData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setIsStatusUpdating(null);
      forceUnlockUI();
    }
  };

  const handleRemoveTeamMember = async (userId: string) => {
    if (!activeWorkspace || !selectedTeamForMembers || !canManageTeamMembers) return;
    setIsStatusUpdating(userId);
    try {
      const { error } = await supabase.rpc('remove_member_from_sub_workspace', {
        p_workspace_id: activeWorkspace.id,
        p_sub_workspace_id: selectedTeamForMembers.id,
        p_user_id: userId
      });

      if (error) throw error;

      toast({ title: "Member removed from team" });
      await fetchData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setIsStatusUpdating(null);
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

  const handleRunNotificationChecks = async () => {
    if (!activeWorkspace || !canManageSettings) return;
    setIsRunningChecks(true);
    try {
      const response = await fetch("/api/admin/run-notification-checks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id: activeWorkspace.id }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to run checks");
      }

      toast({ 
        title: "Success", 
        description: "Notification checks completed successfully." 
      });

      refreshWorkspaces();
      fetchData();
      
    } catch (err: any) {
      toast({ 
        variant: "destructive", 
        title: "Error running checks", 
        description: err.message 
      });
    } finally {
      setIsRunningChecks(false);
      forceUnlockUI();
    }
  };

  if (loading && !activeWorkspace) {
    return <div className="flex h-[80vh] items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (!canViewAuditLog && !loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <ShieldAlert className="w-12 h-12 text-rose-500" />
        <h1 className="text-xl font-bold dark:text-slate-100">Access Denied</h1>
        <p className="text-muted-foreground text-sm text-center max-w-xs">You do not have permission to access the workspace admin panel.</p>
      </div>
    );
  }

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

  const currentTeamMembers = allSubWorkspaceMembers.filter(m => m.sub_workspace_id === selectedTeamForMembers?.id);
  const addableMembers = members.filter(m => 
    m.status === 'active' && 
    !currentTeamMembers.some(tm => tm.user_id === m.user_id)
  );

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3 text-slate-950 dark:text-slate-100">
            <Layers className="w-6 h-6 md:w-8 md:h-8 text-primary" />
            Admin Panel
          </h1>
          <p className="text-sm text-muted-foreground">Manage workspace settings, members, and access.</p>
        </div>
        {isAdminOrSuper && (
          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-2 pr-4 rounded-xl border dark:border-slate-800 shadow-sm w-full md:w-auto">
            <div className="px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-bold font-mono text-primary flex-1 text-center">
              {activeWorkspace?.join_code}
            </div>
            <Button variant="ghost" size="icon" onClick={handleCopyJoinCode} title="Copy Join Code" className="shrink-0 dark:text-slate-400">
              <Copy className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        <Card className="border-none shadow-sm dark:bg-slate-900">
          <CardContent className="p-4 md:p-6 flex items-center gap-3 md:gap-4">
            <div className="p-2 md:p-3 bg-blue-50 dark:bg-blue-500/10 rounded-xl">
              <Users className="w-4 h-4 md:w-6 md:h-6 text-blue-500" />
            </div>
            <div>
              <p className="text-[10px] md:text-sm text-muted-foreground font-medium uppercase md:capitalize">Members</p>
              <p className="text-lg md:text-2xl font-bold dark:text-slate-100">{members.filter(m => m.status === 'active').length}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm dark:bg-slate-900">
          <CardContent className="p-4 md:p-6 flex items-center gap-3 md:gap-4">
            <div className="p-2 md:p-3 bg-violet-50 dark:bg-violet-500/10 rounded-xl">
              <Layout className="w-4 h-4 md:w-6 md:h-6 text-violet-500" />
            </div>
            <div>
              <p className="text-[10px] md:text-sm text-muted-foreground font-medium uppercase md:capitalize">Teams</p>
              <p className="text-lg md:text-2xl font-bold dark:text-slate-100">{subWorkspaces.length}</p>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-none shadow-sm dark:bg-slate-900">
          <CardContent className="p-4 md:p-6 flex items-center gap-3 md:gap-4">
            <div className="p-2 md:p-3 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl">
              <Briefcase className="w-4 h-4 md:w-6 md:h-6 text-emerald-500" />
            </div>
            <div>
              <p className="text-[10px] md:text-sm text-muted-foreground font-medium uppercase md:capitalize">Allocations</p>
              <p className="text-lg md:text-2xl font-bold dark:text-slate-100">{allocations.length}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm dark:bg-slate-900">
          <CardContent className="p-4 md:p-6">
             <div className="flex items-center justify-between mb-2">
               <div className="flex items-center gap-2">
                 <HardDrive className="w-3 h-3 md:w-4 md:h-4 text-amber-500" />
                 <p className="text-[10px] md:text-sm text-muted-foreground font-medium uppercase md:capitalize">Storage</p>
               </div>
               <p className="text-[10px] font-bold text-muted-foreground">
                 {((storage?.total_bytes_used || 0) / (1024 * 1024)).toFixed(0) || 0}MB
               </p>
             </div>
             <Progress value={((storage?.total_bytes_used || 0) / (1024 * 1024 * 1024)) * 100} className="h-1.5" />
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="members" className="space-y-6">
        <TabsList className="bg-white dark:bg-slate-900 border dark:border-slate-800 p-1 rounded-xl w-full flex overflow-x-auto h-auto no-scrollbar">
          <TabsTrigger value="members" className="rounded-lg px-4 flex-1 md:flex-none dark:data-[state=active]:bg-slate-800 dark:text-slate-400 dark:data-[state=active]:text-slate-100">Members</TabsTrigger>
          <TabsTrigger value="teams" className="rounded-lg px-4 flex-1 md:flex-none dark:data-[state=active]:bg-slate-800 dark:text-slate-400 dark:data-[state=active]:text-slate-100">Teams</TabsTrigger>
          <TabsTrigger value="allocations" className="rounded-lg px-4 flex-1 md:flex-none dark:data-[state=active]:bg-slate-800 dark:text-slate-400 dark:data-[state=active]:text-slate-100">Allocations</TabsTrigger>
          <TabsTrigger value="permissions" className="rounded-lg px-4 flex-1 md:flex-none dark:data-[state=active]:bg-slate-800 dark:text-slate-400 dark:data-[state=active]:text-slate-100">Permissions</TabsTrigger>
          {canViewAuditLog && <TabsTrigger value="audit" className="rounded-lg px-4 flex-1 md:flex-none dark:data-[state=active]:bg-slate-800 dark:text-slate-400 dark:data-[state=active]:text-slate-100">Audit</TabsTrigger>}
          {isAdminOrSuper && <TabsTrigger value="settings" className="rounded-lg px-4 flex-1 md:flex-none dark:data-[state=active]:bg-slate-800 dark:text-slate-400 dark:data-[state=active]:text-slate-100">Settings</TabsTrigger>}
        </TabsList>

        <TabsContent value="members" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
            <h2 className="text-xl font-bold dark:text-slate-100">Workspace Members</h2>
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg overflow-x-auto no-scrollbar">
              <Button variant={statusFilter === "all" ? "secondary" : "ghost"} size="sm" onClick={() => setStatusFilter("all")} className="text-xs h-7 px-3 dark:text-slate-400 dark:hover:text-slate-100">All</Button>
              <Button variant={statusFilter === "active" ? "secondary" : "ghost"} size="sm" onClick={() => setStatusFilter("active")} className="text-xs h-7 px-3 dark:text-slate-400 dark:hover:text-slate-100">Active</Button>
              <Button variant={statusFilter === "pending" ? "secondary" : "ghost"} size="sm" onClick={() => setStatusFilter("pending")} className="text-xs h-7 px-3 dark:text-slate-400 dark:hover:text-slate-100">
                Pending {members.filter(m => m.status === 'pending').length > 0 && <span className="ml-1 w-1.5 h-1.5 bg-primary rounded-full" />}
              </Button>
              <Button variant={statusFilter === "inactive" ? "secondary" : "ghost"} size="sm" onClick={() => setStatusFilter("inactive")} className="text-xs h-7 px-3 dark:text-slate-400 dark:hover:text-slate-100">Inactive</Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {filteredMembers.length === 0 ? (
              <p className="py-12 text-center text-muted-foreground italic bg-slate-50 dark:bg-slate-900/40 rounded-xl border-2 border-dashed dark:border-slate-800">No members found.</p>
            ) : (
              filteredMembers.map((member) => (
                <Card key={member.id} className={cn("border-none shadow-sm dark:bg-slate-900", member.status === 'inactive' && "opacity-60")}>
                  <CardContent className="p-3 md:p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3 md:gap-4 overflow-hidden">
                      <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center border dark:border-slate-700 shadow-sm shrink-0 overflow-hidden">
                        <Avatar className="w-full h-full border-none shadow-none">
                          <AvatarImage src={member.profiles?.avatar_preset ? `/avatars/${member.profiles.avatar_preset}.png` : member.profiles?.avatar_url} />
                          <AvatarFallback className="bg-primary/5 text-primary text-sm font-bold">
                            {member.profiles?.full_name?.[0] || 'U'}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm md:text-base truncate dark:text-slate-100">{member.profiles?.full_name || member.profiles?.username || member.profiles?.email || 'Unknown User'}</span>
                          {member.is_verified && <BadgeCheck className="w-4 h-4 text-primary shrink-0" />}
                          <Badge variant={member.status === 'active' ? 'default' : 'outline'} className="text-[9px] h-3.5 px-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 capitalize">
                            {member.status}
                          </Badge>
                        </div>
                        <p className="text-[10px] md:text-xs text-muted-foreground truncate">{member.profiles?.username || member.profiles?.email} • {member.role}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {member.status === 'pending' ? (
                        <div className="flex items-center gap-1">
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-600 dark:text-emerald-400" onClick={() => handleApproveJoin(member.user_id)} disabled={isStatusUpdating === member.user_id}><UserCheck className="w-4 h-4" /></Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-rose-600 dark:text-rose-400" onClick={() => handleRejectJoin(member.user_id)} disabled={isStatusUpdating === member.user_id}><XCircle className="w-4 h-4" /></Button>
                        </div>
                      ) : (
                        <DropdownMenu onOpenChange={(open) => !open && forceUnlockUI()}>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 dark:text-slate-400" disabled={updatingRole === member.user_id || isStatusUpdating === member.user_id}>
                              {updatingRole === member.user_id || isStatusUpdating === member.user_id ? <Loader2 className="w-4 h-4 animate-spin" /> : <MoreVertical className="w-4 h-4" />}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56 dark:bg-slate-900 dark:border-slate-800">
                            {userRole === 'superadmin' && member.role !== 'superadmin' && (
                              <>
                                <DropdownMenuLabel className="dark:text-slate-100">Role</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => handleUpdateRole(member.user_id, 'admin')} className="dark:text-slate-300">Admin</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleUpdateRole(member.user_id, 'manager')} className="dark:text-slate-300">Manager</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleUpdateRole(member.user_id, 'member')} className="dark:text-slate-300">Member</DropdownMenuItem>
                                <DropdownMenuSeparator className="dark:bg-slate-800" />
                              </>
                            )}
                            <DropdownMenuLabel className="dark:text-slate-100">Actions</DropdownMenuLabel>
                            {canManageVerified && (
                              <DropdownMenuItem onClick={() => handleToggleVerified(member.user_id, !!member.is_verified)} className="dark:text-slate-300">
                                <BadgeCheck className="w-4 h-4 mr-2" />
                                {member.is_verified ? "Remove Verification" : "Verify Member"}
                              </DropdownMenuItem>
                            )}
                            {member.status === 'active' ? (
                              <DropdownMenuItem className="text-rose-500 dark:hover:bg-rose-500/10" onClick={() => setDeactivatingMember(member)} disabled={member.user_id === userProfile?.id || member.role === 'superadmin'}><UserX className="w-4 h-4 mr-2" /> Deactivate</DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem className="text-emerald-500 dark:hover:bg-emerald-500/10" onClick={() => handleReactivate(member.user_id)}><UserCheck className="w-4 h-4 mr-2" /> Reactivate</DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            ))}
          </div>
        </TabsContent>

        <TabsContent value="teams" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold dark:text-slate-100">Workspace Teams</h2>
            {canManageSettings && (
              <Button size="sm" onClick={() => { setEditingTeam(null); setIsCreatingTeam(true); }} className="gap-2 shadow-lg shadow-primary/20">
                <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Create Team</span>
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {subWorkspaces.length === 0 ? (
              <div className="md:col-span-3 py-12 text-center bg-slate-50 dark:bg-slate-900/40 rounded-2xl border-2 border-dashed dark:border-slate-800">
                <Layout className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No teams defined.</p>
              </div>
            ) : (
              subWorkspaces.map((team) => {
                const teamMembers = allSubWorkspaceMembers.filter(m => m.sub_workspace_id === team.id);
                return (
                  <Card key={team.id} className="border-none shadow-sm dark:bg-slate-900">
                    <CardHeader className="p-4 pb-2">
                      <div className="flex items-center justify-between">
                        <Badge variant="secondary" className="bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 text-[10px] h-4">Team</Badge>
                        <DropdownMenu onOpenChange={(open) => !open && forceUnlockUI()}>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 dark:text-slate-400"><MoreVertical className="w-4 h-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="dark:bg-slate-900 dark:border-slate-800">
                            <DropdownMenuItem onClick={() => { setSelectedTeamForMembers(team); setIsManagingMembers(true); }} className="dark:text-slate-300">Manage Members</DropdownMenuItem>
                            {canManageSettings && (
                              <>
                                <DropdownMenuSeparator className="dark:bg-slate-800" />
                                <DropdownMenuItem onClick={() => { setEditingTeam(team); setIsCreatingTeam(true); }} className="dark:text-slate-300">Edit Details</DropdownMenuItem>
                                <DropdownMenuItem className="text-rose-500 dark:hover:bg-rose-500/10" onClick={() => setDeletingTeam(team)}>Delete Team</DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <CardTitle className="text-base mt-1 dark:text-slate-100">{team.name}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0 space-y-4">
                      <p className="text-xs text-muted-foreground line-clamp-2 min-h-[2.5rem]">{team.description || 'No description.'}</p>
                      
                      <div className="flex items-center justify-between pt-2 border-t dark:border-slate-800">
                        <div className="flex -space-x-2 overflow-hidden">
                          {teamMembers.slice(0, 4).map((tm) => {
                            const avatar = tm.avatar_preset ? `/avatars/${tm.avatar_preset}.png` : tm.avatar_url;
                            return (
                              <Avatar key={tm.id} className="w-6 h-6 border-2 border-white dark:border-slate-900 shadow-sm shrink-0">
                                <AvatarImage src={avatar} />
                                <AvatarFallback className="text-[8px] bg-primary/5 text-primary">
                                  {tm.full_name?.[0] || 'U'}
                                </AvatarFallback>
                              </Avatar>
                            );
                          })}
                          {teamMembers.length > 4 && (
                            <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[8px] font-bold text-muted-foreground border-2 border-white dark:border-slate-900">
                              +{teamMembers.length - 4}
                            </div>
                          )}
                        </div>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{teamMembers.length} members</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </TabsContent>

        <TabsContent value="allocations" className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-xl font-bold dark:text-slate-100">Work Allocations</h2>
            {canManageAllocations && (
              <Button size="sm" onClick={() => setIsAllocating(true)} className="gap-2 shadow-lg shadow-primary/20">
                <Plus className="w-4 h-4" /> New Allocation
              </Button>
            )}
          </div>
          
          <div className="grid grid-cols-1 gap-4">
            {allocations.length === 0 ? (
              <div className="py-12 text-center bg-slate-50 dark:bg-slate-900/40 rounded-2xl border-2 border-dashed dark:border-slate-800">
                <Briefcase className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground italic">No work allocations yet.</p>
              </div>
            ) : (
              allocations.map((alloc) => (
                <Card key={alloc.id} className="border-none shadow-sm dark:bg-slate-900 overflow-hidden">
                  <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="p-2.5 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl shrink-0">
                        <Briefcase className="w-5 h-5 text-emerald-500" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-sm md:text-base dark:text-slate-100">{alloc.title}</h3>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1 leading-relaxed">{alloc.description || 'No detailed focus provided.'}</p>
                        <div className="flex items-center gap-3 mt-3">
                           <div className="flex items-center gap-2">
                             <Avatar className="w-5 h-5 border dark:border-slate-800">
                               <AvatarImage src={alloc.profiles?.avatar_preset ? `/avatars/${alloc.profiles.avatar_preset}.png` : alloc.profiles?.avatar_url} />
                               <AvatarFallback className="text-[8px] font-bold bg-primary/5 text-primary">
                                 {alloc.profiles?.full_name?.[0]}
                               </AvatarFallback>
                             </Avatar>
                             <span className="text-[11px] font-bold dark:text-slate-300">{alloc.profiles?.full_name || 'Unknown Member'}</span>
                           </div>
                           <span className="text-[10px] text-slate-300 dark:text-slate-700">|</span>
                           <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                             <Clock className="w-3 h-3" />
                             {new Date(alloc.created_at).toLocaleDateString()}
                           </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0 border-t md:border-t-0 pt-3 md:pt-0 border-slate-100 dark:border-slate-800">
                       <div className="text-right hidden sm:block">
                         <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Assigned By</p>
                         <div className="flex items-center justify-end gap-1.5">
                            <span className="text-[10px] font-medium dark:text-slate-400">{alloc.creator?.full_name || 'Workspace'}</span>
                         </div>
                       </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="permissions" className="space-y-6 overflow-x-auto">
          <Card className="border-none shadow-sm min-w-[600px] dark:bg-slate-900">
            <CardHeader className="p-4 md:p-6">
              <CardTitle className="text-lg flex items-center gap-2 dark:text-slate-100"><ShieldCheck className="w-5 h-5 text-primary" /> Permissions Matrix</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-950/50 border-b dark:border-slate-800">
                    <tr>
                      <th className="text-left p-3 font-bold uppercase tracking-wider text-muted-foreground">Permission</th>
                      <th className="text-center p-3 font-bold uppercase tracking-wider text-muted-foreground">Superadmin</th>
                      <th className="text-center p-3 font-bold uppercase tracking-wider text-muted-foreground">Admin</th>
                      <th className="text-center p-3 font-bold uppercase tracking-wider text-muted-foreground">Manager</th>
                      <th className="text-center p-3 font-bold uppercase tracking-wider text-muted-foreground">Member</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.keys(groupedPermissions).map((cat) => (
                      <Fragment key={cat}>
                        <tr className="bg-slate-100/50 dark:bg-slate-800/30"><td colSpan={5} className="p-2 px-3 text-[10px] font-bold uppercase tracking-widest text-primary">{cat}</td></tr>
                        {groupedPermissions[cat].map((def: any) => (
                          <tr key={def.permission_key} className="border-b dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                            <td className="p-3"><p className="font-bold dark:text-slate-200">{def.label}</p><p className="text-[10px] text-muted-foreground">{def.description}</p></td>
                            <td className="p-3 text-center"><Badge variant="outline" className="text-[8px] opacity-60 dark:text-slate-500">Locked</Badge></td>
                            {['admin', 'manager', 'member'].map(role => {
                              const perm = wsPermissions.find(p => p.role === role && p.permission_key === def.permission_key);
                              const enabled = !!perm?.enabled;
                              const isUpdating = updatingPerm === `${role}-${def.permission_key}`;
                              return (
                                <td key={role} className="p-3 text-center">
                                  <div className="flex justify-center">
                                    {userRole === 'superadmin' ? (
                                      <Switch checked={enabled} onCheckedChange={() => handleTogglePermission(role, def.permission_key, enabled)} disabled={isUpdating} className="scale-75 md:scale-100" />
                                    ) : (
                                      enabled ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" /> : <ShieldAlert className="w-4 h-4 text-slate-200 dark:text-slate-700 mx-auto" />
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
          <div className="space-y-3">
            {auditLogs.length === 0 ? (
              <p className="py-12 text-center text-muted-foreground italic bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-100 dark:border-slate-800">No logs found.</p>
            ) : (
              auditLogs.map((log) => (
                <Card key={log.id} className="border-none shadow-sm dark:bg-slate-900">
                  <CardContent className="p-3 md:p-4 flex gap-3">
                    <History className="w-4 h-4 text-primary shrink-0 mt-1" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold capitalize dark:text-slate-200">{log.action.replace(/_/g, ' ')}</p>
                      <p className="text-[10px] text-muted-foreground leading-snug">
                        <span className="font-bold text-foreground dark:text-slate-300">{(log.actor as any)?.full_name}</span> performed action 
                        {log.target_user_id && <> for <span className="font-bold text-foreground dark:text-slate-300">{(log.target as any)?.full_name}</span></>}
                      </p>
                      <p className="text-[8px] text-muted-foreground mt-1">{new Date(log.created_at).toLocaleString()}</p>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <Card className="border-none shadow-sm dark:bg-slate-900">
            <CardHeader className="p-4 md:p-6">
              <CardTitle className="text-lg dark:text-slate-100">General Details</CardTitle>
              <CardDescription>Update the primary identification of this workspace.</CardDescription>
            </CardHeader>
            <CardContent className="p-4 md:p-6 space-y-4">
              <form onSubmit={handleUpdateWorkspaceName} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="wsName" className="dark:text-slate-300">Workspace Name</Label>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Input 
                      id="wsName"
                      value={wsNameInput}
                      onChange={(e) => setWsNameInput(e.target.value)}
                      placeholder="Workspace Name"
                      className="flex-1 dark:bg-slate-950 dark:border-slate-800"
                      required
                      disabled={!canManageSettings || submitting}
                    />
                    <Button 
                      type="submit" 
                      disabled={!canManageSettings || submitting || !wsNameInput.trim() || wsNameInput === workspaceInfo?.name}
                      className="gap-2 shadow-lg shadow-primary/20"
                    >
                      {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Update Name
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground italic">Renaming the workspace will update the display name for all members.</p>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm dark:bg-slate-900">
            <CardHeader className="p-4 md:p-6"><CardTitle className="text-lg dark:text-slate-100">Access Control</CardTitle></CardHeader>
            <CardContent className="p-4 md:p-6 space-y-4">
                <div className="flex items-center justify-between gap-4 p-3 bg-slate-50 dark:bg-slate-950/40 rounded-lg border dark:border-slate-800">
                  <div><p className="text-sm font-bold dark:text-slate-200">Join Approval</p><p className="text-[10px] text-muted-foreground">Require review for code-joining users.</p></div>
                  <Switch checked={workspaceInfo?.require_join_approval || false} onCheckedChange={handleToggleJoinApproval} disabled={!canManageMembers} />
                </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm dark:bg-slate-900">
            <CardHeader className="p-4 md:p-6">
                <div className="flex items-center gap-2">
                  <BellRing className="w-5 h-5 text-primary" />
                  <CardTitle className="text-lg dark:text-slate-100">Notification Automation</CardTitle>
                </div>
                <CardDescription>Manually trigger scheduled system checks for task deadlines and reminders.</CardDescription>
            </CardHeader>
            <CardContent className="p-4 md:p-6 space-y-4">
                <div className="p-4 bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-sm font-bold dark:text-slate-200">Process Deadlines & Reminders</p>
                    <p className="text-[10px] text-muted-foreground max-w-md">
                      Checks for due reminders, tasks due within 3 days, and overdue assignments to generate relevant system notifications.
                    </p>
                  </div>
                  <Button 
                    onClick={handleRunNotificationChecks} 
                    disabled={isRunningChecks}
                    className="w-full sm:w-auto gap-2 shadow-lg shadow-primary/20"
                  >
                    {isRunningChecks ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                    Run Checks
                  </Button>
                </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* New Allocation Dialog */}
      <Dialog open={isAllocating} onOpenChange={(open) => { setIsAllocating(open); if (!open) forceUnlockUI(); }}>
        <DialogContent className="w-[95vw] max-w-md p-6 rounded-2xl dark:bg-slate-950 dark:border-slate-800">
          <DialogHeader><DialogTitle className="dark:text-slate-100">New Allocation</DialogTitle></DialogHeader>
          <form onSubmit={handleCreateAllocation} className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs font-bold dark:text-slate-300">Member</Label>
              <Select name="user_id" required onOpenChange={(open) => !open && forceUnlockUI()}>
                <SelectTrigger className="h-11 text-base md:text-sm dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100"><SelectValue placeholder="Choose member" /></SelectTrigger>
                <SelectContent className="dark:bg-slate-900 dark:border-slate-800">{members.filter(m => m.status === 'active').map(m => (<SelectItem key={m.user_id} value={m.user_id}>{m.profiles?.full_name}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-bold dark:text-slate-300">Title</Label>
              <Input name="title" className="h-11 text-base md:text-sm dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100" required disabled={submitting} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-bold dark:text-slate-300">Focus</Label>
              <Textarea name="description" className="text-base md:text-sm dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100" rows={3} disabled={submitting} />
            </div>
            <DialogFooter className="flex-row gap-2">
                <Button type="button" variant="ghost" onClick={() => { setIsAllocating(false); forceUnlockUI(); }} className="flex-1 dark:text-slate-300 dark:hover:bg-slate-800">Cancel</Button>
                <Button type="submit" className="flex-1 shadow-lg shadow-primary/20" disabled={submitting}>Assign</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Team Dialog */}
      <Dialog open={isCreatingTeam} onOpenChange={(open) => { setIsCreatingTeam(open); if (!open) { setEditingTeam(null); forceUnlockUI(); } }}>
        <DialogContent className="w-[95vw] max-w-md p-6 rounded-2xl dark:bg-slate-950 dark:border-slate-800">
          <DialogHeader><DialogTitle className="dark:text-slate-100">{editingTeam ? 'Edit Team' : 'New Team'}</DialogTitle></DialogHeader>
          <form onSubmit={handleCreateTeam} className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs font-bold dark:text-slate-300">Name</Label>
              <Input name="name" defaultValue={editingTeam?.name} className="h-11 text-base md:text-sm dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100" required disabled={submitting} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-bold dark:text-slate-300">Description</Label>
              <Textarea name="description" defaultValue={editingTeam?.description} className="text-base md:text-sm dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100" rows={3} disabled={submitting} />
            </div>
            <DialogFooter className="flex-row gap-2">
                <Button type="button" variant="ghost" onClick={() => { setIsCreatingTeam(false); forceUnlockUI(); }} className="flex-1 dark:text-slate-300 dark:hover:bg-slate-800">Cancel</Button>
                <Button type="submit" className="flex-1 shadow-lg shadow-primary/20" disabled={submitting}>{editingTeam ? 'Update' : 'Create'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Deactivate Member AlertDialog */}
      <AlertDialog open={!!deactivatingMember} onOpenChange={(open) => { if (!open) { setDeactivatingMember(null); forceUnlockUI(); } }}>
        <AlertDialogContent className="dark:bg-slate-950 dark:border-slate-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="dark:text-slate-100">Deactivate Member?</AlertDialogTitle>
            <AlertDialogDescription className="dark:text-slate-400">
              Are you sure you want to deactivate <strong>{deactivatingMember?.profiles?.full_name}</strong>? They will no longer be able to access this workspace.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deactivatingLoading} onClick={() => { setDeactivatingMember(null); forceUnlockUI(); }} className="dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300">Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={deactivatingLoading} onClick={() => handleDeactivate(deactivatingMember?.user_id)} className="bg-rose-500 hover:bg-rose-600">
              {deactivatingLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <UserX className="w-4 h-4 mr-2" />}
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Team AlertDialog */}
      <AlertDialog open={!!deletingTeam} onOpenChange={(open) => { if (!open) { setDeletingTeam(null); forceUnlockUI(); } }}>
        <AlertDialogContent className="dark:bg-slate-950 dark:border-slate-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="dark:text-slate-100">Delete Team?</AlertDialogTitle>
            <AlertDialogDescription className="dark:text-slate-400">
              Are you sure you want to delete the team <strong>{deletingTeam?.name}</strong>? This will remove all member assignments within the team. Tasks assigned to this team will remain but will no longer be linked to it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setDeletingTeam(null); forceUnlockUI(); }} className="dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTeam} className="bg-rose-500 hover:bg-rose-600">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Delete Team
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Team Member Management Dialog */}
      <Dialog open={isManagingMembers} onOpenChange={(open) => { setIsManagingMembers(open); if (!open) { setSelectedTeamForMembers(null); forceUnlockUI(); } }}>
        <DialogContent className="w-[95vw] max-w-xl p-0 overflow-hidden rounded-2xl dark:bg-slate-950 dark:border-slate-800">
          <div className="p-6 pb-0">
            <DialogHeader>
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="secondary" className="bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400">Team</Badge>
                </div>
                <DialogTitle className="text-2xl font-bold dark:text-slate-100">{selectedTeamForMembers?.name}</DialogTitle>
                <DialogDescription className="dark:text-slate-400">Manage which members are assigned to this focus team.</DialogDescription>
            </DialogHeader>
          </div>

          <div className="p-6 space-y-6">
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <Users className="w-3.5 h-3.5" />
                    Team Roster ({currentTeamMembers.length})
                  </h4>
                </div>

                <ScrollArea className="h-[300px] rounded-xl border dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 p-4">
                  {currentTeamMembers.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-2 opacity-60 py-12">
                        <Users className="w-8 h-8" />
                        <p className="text-sm font-medium">No members in this team yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                        {currentTeamMembers.map((tm) => {
                          const isUpdating = isStatusUpdating === tm.user_id;
                          return (
                            <div key={tm.id} className="flex items-center justify-between group bg-white dark:bg-slate-900 p-3 rounded-lg border dark:border-slate-800 shadow-sm">
                              <div className="flex items-center gap-3 overflow-hidden">
                                  <Avatar className="w-8 h-8 border dark:border-slate-800 shadow-sm shrink-0">
                                    <AvatarImage src={tm.avatar_preset ? `/avatars/${tm.avatar_preset}.png` : tm.avatar_url} />
                                    <AvatarFallback className="text-[10px] font-bold bg-primary/5 text-primary">{tm.full_name?.[0]}</AvatarFallback>
                                  </Avatar>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        <p className="text-sm font-bold truncate dark:text-slate-200">{tm.full_name}</p>
                                        {tm.is_verified && <BadgeCheck className="w-3.5 h-3.5 text-primary shrink-0" />}
                                    </div>
                                    <p className="text-[10px] text-muted-foreground truncate uppercase">{tm.role}</p>
                                  </div>
                              </div>
                              {canManageTeamMembers && (
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={() => handleRemoveTeamMember(tm.user_id)}
                                  disabled={isUpdating}
                                >
                                    {isUpdating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserMinus className="w-3.5 h-3.5" />}
                                </Button>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  )}
                </ScrollArea>
            </div>

            {canManageTeamMembers && (
              <div className="space-y-3 pt-2">
                  <Label className="text-xs font-bold dark:text-slate-300">Add Team Member</Label>
                  <div className="flex gap-2">
                    <Select value={memberToTeamId || ""} onValueChange={setMemberToTeamId} onOpenChange={(open) => !open && forceUnlockUI()}>
                        <SelectTrigger className="flex-1 h-11 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100">
                          <SelectValue placeholder="Select workspace member..." />
                        </SelectTrigger>
                        <SelectContent className="dark:bg-slate-900 dark:border-slate-800">
                          <div className="p-2 border-b dark:border-slate-800">
                              <div className="relative">
                                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                                <Input 
                                  placeholder="Search members..." 
                                  className="h-8 pl-8 text-xs dark:bg-slate-950" 
                                  value={teamMemberSearch}
                                  onChange={e => setTeamMemberSearch(e.target.value)}
                                />
                              </div>
                          </div>
                          <ScrollArea className="max-h-[200px]">
                              {addableMembers
                                .filter(m => m.profiles?.full_name?.toLowerCase().includes(teamMemberSearch.toLowerCase()))
                                .length === 0 ? (
                                <div className="p-4 text-center text-xs text-muted-foreground italic">No addable members found.</div>
                              ) : (
                                addableMembers
                                  .filter(m => m.profiles?.full_name?.toLowerCase().includes(teamMemberSearch.toLowerCase()))
                                  .map(m => (
                                    <SelectItem key={m.user_id} value={m.user_id}>
                                      <div className="flex items-center gap-2">
                                          <Avatar className="w-5 h-5 shrink-0">
                                            <AvatarImage src={m.profiles?.avatar_preset ? `/avatars/${m.profiles.avatar_preset}.png` : m.profiles?.avatar_url} />
                                            <AvatarFallback className="text-[8px]">{m.profiles?.full_name?.[0]}</AvatarFallback>
                                          </Avatar>
                                          <span className="truncate">{m.profiles?.full_name}</span>
                                          {m.is_verified && <BadgeCheck className="w-3 h-3 text-primary shrink-0" />}
                                      </div>
                                    </SelectItem>
                                  ))
                              )}
                          </ScrollArea>
                        </SelectContent>
                    </Select>
                    <Button 
                      className="h-11 shadow-lg shadow-primary/20 px-6 gap-2" 
                      disabled={!memberToTeamId || isStatusUpdating === memberToTeamId}
                      onClick={() => { if(memberToTeamId) handleAddTeamMember(memberToTeamId); setMemberToTeamId(null); }}
                    >
                        {isStatusUpdating === memberToTeamId ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                        Add
                    </Button>
                  </div>
              </div>
            )}
          </div>

          <DialogFooter className="p-6 pt-0 bg-slate-50 dark:bg-slate-900/40 border-t dark:border-slate-800">
            <Button variant="ghost" onClick={() => { setIsManagingMembers(false); forceUnlockUI(); }} className="dark:text-slate-300">Close Panel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
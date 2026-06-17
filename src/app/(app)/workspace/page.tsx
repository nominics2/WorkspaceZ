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
  ArrowRight,
  ShieldCheck,
  Briefcase,
  ShieldAlert,
  Lock,
  CheckCircle2,
  History,
  Info
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export default function WorkspaceAdminPage() {
  const { activeWorkspace, userProfile, userRole, hasPermission } = useWorkspace();
  const [members, setMembers] = useState<any[]>([]);
  const [allocations, setAllocations] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [storage, setStorage] = useState<any>(null);
  const [permissionDefs, setPermissionDefs] = useState<any[]>([]);
  const [wsPermissions, setWsPermissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAllocating, setIsAllocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [updatingRole, setUpdatingRole] = useState<string | null>(null);
  const [updatingPerm, setUpdatingPerm] = useState<string | null>(null);
  
  const supabase = createClient();
  const { toast } = useToast();

  const forceUnlockUI = useCallback(() => {
    if (typeof document !== 'undefined') {
      setTimeout(() => {
        document.body.style.pointerEvents = "";
      }, 0);
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
      // 1. Fetch members
      const { data: membersList } = await supabase
        .from('workspace_members')
        .select('*, profiles(full_name, username, avatar_url, email)')
        .eq('workspace_id', activeWorkspace.id);
      setMembers(membersList || []);

      // 2. Fetch storage usage
      const { data: storageInfo } = await supabase
        .from('workspace_storage_usage')
        .select('*')
        .eq('workspace_id', activeWorkspace.id)
        .maybeSingle();
      setStorage(storageInfo);

      // 3. Fetch work allocations
      const { data: allocList } = await supabase
        .from('work_allocations')
        .select('*, profiles!work_allocations_user_id_fkey(full_name), creator:profiles!work_allocations_assigned_by_fkey(full_name)')
        .eq('workspace_id', activeWorkspace.id)
        .order('created_at', { ascending: false });
      setAllocations(allocList || []);

      // 4. Fetch Permission Definitions
      const { data: defs } = await supabase
        .from('role_permission_definitions')
        .select('*')
        .order('category', { ascending: true });
      setPermissionDefs(defs || []);

      // 5. Fetch Workspace Role Permissions
      const { data: perms } = await supabase
        .from('workspace_role_permissions')
        .select('*')
        .eq('workspace_id', activeWorkspace.id);
      setWsPermissions(perms || []);

      // 6. Fetch Audit Logs
      if (userRole === 'superadmin' || hasPermission('view_admin_panel')) {
        const { data: logs } = await supabase
          .from('admin_audit_logs')
          .select('*, actor:profiles!actor_id(full_name), target:profiles!target_user_id(full_name)')
          .eq('workspace_id', activeWorkspace.id)
          .order('created_at', { ascending: false })
          .limit(50);
        setAuditLogs(logs || []);
      }

    } catch (err: any) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
      forceUnlockUI();
    }
  }, [activeWorkspace, userProfile, supabase, forceUnlockUI, userRole, hasPermission]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCopyJoinCode = () => {
    if (activeWorkspace?.join_code) {
      navigator.clipboard.writeText(activeWorkspace.join_code);
      toast({ title: "Join code copied!" });
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

      // Audit Log for allocations still using RPC logging helper
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

      // Audit Log
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

  // Permission Checks
  const canManageMembers = hasPermission('manage_members');
  const canManageAllocations = hasPermission('manage_work_allocations');
  const canViewAuditLog = isSuper || hasPermission('view_admin_panel');

  if (loading && !activeWorkspace) {
    return <div className="flex h-[80vh] items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  const groupedPermissions = permissionDefs.reduce((acc: any, def) => {
    const cat = def.category || 'General';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(def);
    return acc;
  }, {});

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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-none shadow-sm">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-blue-50 rounded-xl">
              <Users className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium">Total Members</p>
              <p className="text-2xl font-bold">{members.length}</p>
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
                 <p className="text-sm text-muted-foreground font-medium">Storage Used</p>
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
        <TabsList className="bg-white border p-1 rounded-xl">
          <TabsTrigger value="members" className="rounded-lg px-6">Members</TabsTrigger>
          <TabsTrigger value="allocations" className="rounded-lg px-6">Allocations</TabsTrigger>
          <TabsTrigger value="permissions" className="rounded-lg px-6">Permissions</TabsTrigger>
          {canViewAuditLog && <TabsTrigger value="audit" className="rounded-lg px-6">Audit Log</TabsTrigger>}
          {isAdminOrSuper && <TabsTrigger value="settings" className="rounded-lg px-6">Access Control</TabsTrigger>}
        </TabsList>

        <TabsContent value="members" className="space-y-4">
          {!canManageMembers && !isSuper ? (
             <div className="py-20 text-center bg-slate-50 rounded-2xl border-2 border-dashed">
                <Shield className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-4" />
                <p className="text-muted-foreground">You do not have permission to manage members.</p>
             </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {members.map((member) => (
                <Card key={member.id} className="border-none shadow-sm group">
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
                        ) : (
                          <Badge 
                            variant={member.role === 'admin' ? 'secondary' : 'outline'} 
                            className="capitalize mt-1"
                          >
                            {member.role}
                          </Badge>
                        )}
                      </div>

                      {isSuper && member.role !== 'superadmin' && (
                        <DropdownMenu onOpenChange={(open) => !open && forceUnlockUI()}>
                          <DropdownMenuTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="text-muted-foreground hover:text-foreground"
                              disabled={updatingRole === member.user_id}
                            >
                              {updatingRole === member.user_id ? <Loader2 className="w-4 h-4 animate-spin" /> : <MoreVertical className="w-4 h-4" />}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
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
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
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
                <div className="p-4 bg-slate-50 rounded-xl border flex flex-col sm:flex-row items-center justify-between gap-4">
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
                    <p className="font-bold text-sm">Open Invites</p>
                    <p className="text-xs text-muted-foreground">Anyone with the code can join as a standard Member.</p>
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
                   {members.map(m => (
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
    </div>
  );
}


"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { HardDrive, Shield, Bell, User, Cloud, Loader2 } from "lucide-react";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { createClient } from "@/lib/supabase/client";

export default function SettingsPage() {
  const { activeWorkspace, userProfile } = useWorkspace();
  const [storageUsage, setStorageUsage] = useState({ used: 0, limit: 1024 * 1024 * 1024 }); // Default 1GB
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchStorageUsage = useCallback(async () => {
    if (!activeWorkspace) return;
    setLoading(true);
    try {
      // Fetch total bytes from attachments table for this workspace
      const { data, error } = await supabase
        .from('attachments')
        .select('file_size_bytes')
        .eq('workspace_id', activeWorkspace.id);

      if (error) throw error;

      const totalUsed = data?.reduce((acc, curr) => acc + (curr.file_size_bytes || 0), 0) || 0;
      setStorageUsage(prev => ({ ...prev, used: totalUsed }));
    } catch (err) {
      console.error("Error fetching storage usage:", err);
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace, supabase]);

  useEffect(() => {
    fetchStorageUsage();
  }, [fetchStorageUsage]);

  const usagePercentage = (storageUsage.used / storageUsage.limit) * 100;
  const usedMB = (storageUsage.used / (1024 * 1024)).toFixed(2);
  const totalGB = (storageUsage.limit / (1024 * 1024 * 1024)).toFixed(1);

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your account and workspace preferences</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-2">
          <button className="w-full flex items-center gap-3 p-3 rounded-lg bg-primary/10 text-primary font-medium text-left">
            <User className="w-5 h-5" /> Account Profile
          </button>
          <button className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-100 text-muted-foreground transition-colors text-left">
            <Cloud className="w-5 h-5" /> Workspace Storage
          </button>
          <button className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-100 text-muted-foreground transition-colors text-left">
            <Bell className="w-5 h-5" /> Notifications
          </button>
          <button className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-100 text-muted-foreground transition-colors text-left">
            <Shield className="w-5 h-5" /> Team Management
          </button>
        </div>

        <div className="md:col-span-2 space-y-6">
          {/* Account Card */}
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle>Account Information</CardTitle>
              <CardDescription>Personal details and role</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-slate-200 overflow-hidden">
                  {userProfile?.avatar_url ? (
                    <img src={userProfile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary font-bold text-xl">
                      {userProfile?.full_name?.[0]}
                    </div>
                  )}
                </div>
                <div>
                  <p className="font-bold text-lg">{userProfile?.full_name}</p>
                  <p className="text-sm text-muted-foreground">{userProfile?.username}</p>
                  <div className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-primary/10 text-primary mt-1">
                    {activeWorkspace?.name} Member
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Storage Usage */}
          <Card className="border-none shadow-sm">
            <CardHeader className="flex flex-row items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <HardDrive className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle>Workspace Storage</CardTitle>
                <CardDescription>Resource usage for {activeWorkspace?.name || 'Workspace'}</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <div className="flex justify-center py-4"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
              ) : (
                <>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium">Used Space</span>
                    <span className="text-muted-foreground">{usedMB} MB of {totalGB} GB ({usagePercentage.toFixed(1)}%)</span>
                  </div>
                  <Progress value={usagePercentage} className="h-3" />
                  <p className="text-xs text-muted-foreground italic">
                    Workspace storage is limited to 1GB. Contact support for upgrades.
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

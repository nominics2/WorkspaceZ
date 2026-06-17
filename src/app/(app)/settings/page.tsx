"use client";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { HardDrive, Shield, Bell, User, Cloud } from "lucide-react";
import { MOCK_WORKSPACE, MOCK_USER } from "@/lib/mock-data";

export default function SettingsPage() {
  const usagePercentage = (MOCK_WORKSPACE.storageUsed / MOCK_WORKSPACE.storageLimit) * 100;
  const usedGB = (MOCK_WORKSPACE.storageUsed / (1024 * 1024 * 1024)).toFixed(2);
  const totalGB = (MOCK_WORKSPACE.storageLimit / (1024 * 1024 * 1024)).toFixed(1);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
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
                <div className="w-16 h-16 rounded-full bg-slate-200" />
                <div>
                  <p className="font-bold text-lg">{MOCK_USER.name}</p>
                  <p className="text-sm text-muted-foreground">{MOCK_USER.email}</p>
                  <div className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-primary/10 text-primary mt-1">
                    {MOCK_USER.role}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Storage Usage (Only for Superadmin) */}
          {MOCK_USER.role === 'Superadmin' && (
            <Card className="border-none shadow-sm">
              <CardHeader className="flex flex-row items-center gap-3">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <HardDrive className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle>Workspace Storage</CardTitle>
                  <CardDescription>Resource usage for {MOCK_WORKSPACE.name}</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium">Used Space</span>
                  <span className="text-muted-foreground">{usedGB} GB of {totalGB} GB ({usagePercentage.toFixed(1)}%)</span>
                </div>
                <Progress value={usagePercentage} className="h-3" />
                <p className="text-xs text-muted-foreground italic">
                  Need more space? Contact WorkspaceZ support to upgrade your limits.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
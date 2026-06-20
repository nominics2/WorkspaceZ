"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { PlusCircle, Users, Loader2, ArrowLeft, Clock, LogOut, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { WORKSPACE_ICON_PRESETS } from "@/lib/workspace-icons";
import { cn } from "@/lib/utils";

/**
 * Normalizes the join status returned from the Supabase RPC.
 * The RPC might return a string or an object containing status keys.
 */
function normalizeJoinStatus(result: unknown): string | null {
  if (typeof result === "string") return result;
  
  if (result && typeof result === "object") {
    const value = result as Record<string, unknown>;
    // Check various common result keys
    if (typeof value.status === "string") return value.status;
    if (typeof value.join_status === "string") return value.join_status;
    if (typeof value.member_status === "string") return value.member_status;
  }
  
  return null;
}

export default function WorkspaceSetupPage() {
  const [mode, setMode] = useState<"choice" | "create" | "join" | "pending">("choice");
  const [workspaceName, setWorkspaceName] = useState("");
  const [selectedIcon, setSelectedIcon] = useState(WORKSPACE_ICON_PRESETS[0].id);
  const [joinCode, setJoinCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const router = useRouter();
  const supabase = createClient();
  const { toast } = useToast();

  useEffect(() => {
    async function checkUser() {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session?.user) {
        router.push("/");
        return;
      }
      setUser(session.user);
      setLoading(false);
    }
    checkUser();
  }, [router, supabase.auth]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/");
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !currentUser) {
        toast({
          variant: "destructive",
          title: "Authentication Error",
          description: "Not authenticated. Please login again.",
        });
        router.push("/");
        return;
      }

      // 1. Create workspace
      const { data: wsId, error } = await supabase.rpc("create_workspace", {
        p_name: workspaceName,
      });

      if (error) throw error;

      // 2. Set icon preset
      if (wsId) {
        const { error: iconError } = await supabase.rpc("update_workspace_icon_preset", {
          p_workspace_id: wsId,
          p_icon_preset: selectedIcon
        });
        if (iconError) console.error("[Icon Setup] Failed to set preset:", iconError);
      }
      
      toast({ title: "Success", description: "Workspace created successfully!" });
      router.replace("/dashboard");
      return;
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) throw new Error("Not authenticated");

      const { data, error } = await supabase.rpc('request_join_workspace_by_code', {
        p_join_code: joinCode
      });

      if (error) throw error;

      const joinStatus = normalizeJoinStatus(data);

      if (joinStatus === 'active' || joinStatus === 'joined' || joinStatus === 'approved' || joinStatus === 'already_member') {
        toast({ title: "Welcome!", description: "You have joined the workspace." });
        router.replace("/dashboard");
      } else if (joinStatus === 'pending' || joinStatus === 'pending_approval') {
        setMode("pending");
        toast({ title: "Request Sent", description: "Your join request is pending approval." });
      } else {
        throw new Error("Unable to join workspace. Please check the code and try again.");
      }
    } catch (err: any) {
      toast({ 
        variant: "destructive", 
        title: "Error joining workspace", 
        description: err.message || "Invalid join code" 
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (mode === "pending") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-950">
        <Card className="w-full max-w-md shadow-xl border-none dark:bg-slate-900">
          <CardHeader className="text-center pt-8">
            <div className="mx-auto w-16 h-16 bg-amber-50 dark:bg-amber-500/10 rounded-full flex items-center justify-center mb-4">
              <Clock className="text-amber-500 w-8 h-8 animate-pulse" />
            </div>
            <CardTitle className="text-2xl font-bold dark:text-slate-100">Request Pending</CardTitle>
            <CardDescription className="pt-2 dark:text-slate-400">
              Your request to join the workspace has been sent to the administrators. 
              You will be able to access the dashboard once your request is approved.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 pb-8">
            <Button variant="outline" className="w-full dark:border-slate-800 dark:text-slate-300" onClick={() => setMode("choice")}>
              Try another code
            </Button>
            <Button variant="ghost" className="w-full text-muted-foreground dark:hover:bg-slate-800" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" /> Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (mode === "choice") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-950 gap-8">
        <div className="flex justify-center items-center">
             <img src="/brand/full-logo.png" alt="WorkspaceZ" className="w-[180px] h-auto object-contain dark:hidden" />
             <img src="/brand/full-logo-dark.png" alt="WorkspaceZ" className="w-[180px] h-auto object-contain hidden dark:block" />
        </div>
        <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card 
            className="hover:border-primary cursor-pointer transition-all hover:shadow-lg group dark:bg-slate-900 dark:border-slate-800"
            onClick={() => setMode("create")}
          >
            <CardHeader className="text-center pt-8">
              <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center group-hover:bg-primary transition-colors">
                <PlusCircle className="text-primary w-8 h-8 group-hover:text-white" />
              </div>
              <CardTitle className="text-2xl mt-4 dark:text-slate-100">Create Workspace</CardTitle>
              <CardDescription className="dark:text-slate-400">Set up a new space for your team</CardDescription>
            </CardHeader>
            <CardContent className="text-center text-sm text-muted-foreground pb-8 dark:text-slate-500">
              Become a Superadmin. Manage users, tasks, and settings.
            </CardContent>
          </Card>

          <Card 
            className="hover:border-accent cursor-pointer transition-all hover:shadow-lg group dark:bg-slate-900 dark:border-slate-800"
            onClick={() => setMode("join")}
          >
            <CardHeader className="text-center pt-8">
              <div className="mx-auto w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center group-hover:bg-accent transition-colors">
                <Users className="text-accent w-8 h-8 group-hover:text-white" />
              </div>
              <CardTitle className="text-2xl mt-4 dark:text-slate-100">Join Workspace</CardTitle>
              <CardDescription className="dark:text-slate-400">Connect with an existing team</CardDescription>
            </CardHeader>
            <CardContent className="text-center text-sm text-muted-foreground pb-8 dark:text-slate-500">
              Enter a unique code provided by your workspace admin.
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-950">
      <Card className="w-full max-w-md shadow-xl border-none dark:bg-slate-900">
        <CardHeader>
          <div className="flex items-center gap-2 mb-4">
            <Button variant="ghost" size="icon" onClick={() => setMode("choice")} className="dark:text-slate-400">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <CardTitle className="text-2xl font-bold dark:text-slate-100">
              {mode === "create" ? "Setup New Workspace" : "Join Existing Team"}
            </CardTitle>
          </div>
          <CardDescription className="dark:text-slate-400">
            {mode === "create" ? "Just a few details to get started" : "Enter the code provided by your admin"}
          </CardDescription>
        </CardHeader>
        <form onSubmit={mode === "create" ? handleCreate : handleJoin}>
          <CardContent className="space-y-6 pb-10">
            {mode === "create" ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="wsName" className="dark:text-slate-300">Workspace Name</Label>
                  <Input 
                    id="wsName" 
                    placeholder="e.g. Acme Tech Corp" 
                    required 
                    value={workspaceName}
                    onChange={(e) => setWorkspaceName(e.target.value)}
                    disabled={loading}
                    className="h-11 dark:bg-slate-800 dark:border-slate-700"
                  />
                </div>
                <div className="space-y-3">
                  <Label className="dark:text-slate-300">Workspace Icon</Label>
                  <div className="grid grid-cols-5 gap-3">
                    {WORKSPACE_ICON_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setSelectedIcon(preset.id)}
                        className={cn(
                          "aspect-square rounded-xl overflow-hidden border-2 transition-all hover:scale-105 relative bg-white",
                          selectedIcon === preset.id 
                            ? "border-primary ring-2 ring-primary/20 shadow-md scale-105" 
                            : "border-slate-100 dark:border-slate-800 opacity-70 grayscale-[0.5] hover:grayscale-0 hover:opacity-100"
                        )}
                      >
                        <img src={preset.src} alt={preset.label} className="w-full h-full object-cover" />
                        {selectedIcon === preset.id && (
                          <div className="absolute inset-0 bg-primary/10 flex items-center justify-center">
                            <Check className="w-5 h-5 text-primary" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="code" className="dark:text-slate-300">Join Code</Label>
                <Input 
                  id="code" 
                  placeholder="e.g. ABC-12345" 
                  required 
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  disabled={loading}
                  className="h-11 dark:bg-slate-800 dark:border-slate-700 font-mono"
                />
              </div>
            )}
            <Button type="submit" className="w-full py-6 text-lg font-semibold shadow-lg shadow-primary/20 mt-4" disabled={loading}>
              {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
              {mode === "create" ? "Create Workspace" : "Continue"}
            </Button>
          </CardContent>
        </form>
      </Card>
    </div>
  );
}

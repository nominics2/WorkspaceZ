
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { PlusCircle, Users, Loader2, ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function WorkspaceSetupPage() {
  const [mode, setMode] = useState<"choice" | "create" | "join">("choice");
  const [workspaceName, setWorkspaceName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();
  const { toast } = useToast();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from('workspaces')
        .insert({
          name: workspaceName,
          created_by: user.id
        })
        .select()
        .single();

      if (error) throw error;
      
      toast({ title: "Success", description: "Workspace created successfully!" });
      router.push("/dashboard");
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
      const { data, error } = await supabase.rpc('join_workspace_by_code', {
        p_join_code: joinCode
      });

      if (error) throw error;
      
      toast({ title: "Welcome!", description: "You have joined the workspace." });
      router.push("/dashboard");
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message || "Invalid join code" });
    } finally {
      setLoading(false);
    }
  };

  if (mode === "choice") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
        <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card 
            className="hover:border-primary cursor-pointer transition-all hover:shadow-lg group"
            onClick={() => setMode("create")}
          >
            <CardHeader className="text-center pt-8">
              <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center group-hover:bg-primary transition-colors">
                <PlusCircle className="text-primary w-8 h-8 group-hover:text-white" />
              </div>
              <CardTitle className="text-2xl mt-4">Create Workspace</CardTitle>
              <CardDescription>Set up a new space for your team</CardDescription>
            </CardHeader>
            <CardContent className="text-center text-sm text-muted-foreground pb-8">
              Become a Superadmin. Manage users, tasks, and settings.
            </CardContent>
          </Card>

          <Card 
            className="hover:border-accent cursor-pointer transition-all hover:shadow-lg group"
            onClick={() => setMode("join")}
          >
            <CardHeader className="text-center pt-8">
              <div className="mx-auto w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center group-hover:bg-accent transition-colors">
                <Users className="text-accent w-8 h-8 group-hover:text-white" />
              </div>
              <CardTitle className="text-2xl mt-4">Join Workspace</CardTitle>
              <CardDescription>Connect with an existing team</CardDescription>
            </CardHeader>
            <CardContent className="text-center text-sm text-muted-foreground pb-8">
              Enter a unique code provided by your workspace admin.
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
      <Card className="w-full max-w-md shadow-xl border-none">
        <CardHeader>
          <div className="flex items-center gap-2 mb-2">
            <Button variant="ghost" size="icon" onClick={() => setMode("choice")}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <CardTitle className="text-2xl font-bold">
              {mode === "create" ? "Setup New Workspace" : "Join Existing Team"}
            </CardTitle>
          </div>
          <CardDescription>
            {mode === "create" ? "Just a few details to get started" : "Enter the code provided by your admin"}
          </CardDescription>
        </CardHeader>
        <form onSubmit={mode === "create" ? handleCreate : handleJoin}>
          <CardContent className="space-y-4">
            {mode === "create" ? (
              <div className="space-y-2">
                <Label htmlFor="wsName">Workspace Name</Label>
                <Input 
                  id="wsName" 
                  placeholder="e.g. Acme Tech Corp" 
                  required 
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  disabled={loading}
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="code">Join Code</Label>
                <Input 
                  id="code" 
                  placeholder="e.g. ABC-12345" 
                  required 
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  disabled={loading}
                />
              </div>
            )}
          </CardContent>
          <CardContent className="flex flex-col gap-3 pt-0">
            <Button type="submit" className="w-full py-6 text-lg" disabled={loading}>
              {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
              Continue
            </Button>
          </CardContent>
        </form>
      </Card>
    </div>
  );
}

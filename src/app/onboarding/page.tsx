"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { PlusCircle, Users } from "lucide-react";

export default function OnboardingPage() {
  const [mode, setMode] = useState<"choice" | "create" | "join">("choice");
  const [workspaceName, setWorkspaceName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const router = useRouter();

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    router.push("/dashboard");
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    router.push("/dashboard");
  };

  if (mode === "choice") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-950 gap-8">
        <div className="flex justify-center items-center">
           <img 
             src="/brand/full-logo.png" 
             alt="WorkspaceZ" 
             className="w-[200px] h-auto object-contain dark:hidden"
           />
           <img 
             src="/brand/full-logo-dark.png" 
             alt="WorkspaceZ" 
             className="w-[200px] h-auto object-contain hidden dark:block"
           />
        </div>
        <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card 
            className="hover:border-primary cursor-pointer transition-all hover:shadow-lg group dark:bg-slate-900"
            onClick={() => setMode("create")}
          >
            <CardHeader className="text-center pt-8">
              <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center group-hover:bg-primary transition-colors">
                <PlusCircle className="text-primary w-8 h-8 group-hover:text-white" />
              </div>
              <CardTitle className="text-2xl mt-4 dark:text-slate-100">Create Workspace</CardTitle>
              <CardDescription className="dark:text-slate-400">Set up a new space for your team</CardDescription>
            </CardHeader>
            <CardContent className="text-center text-sm text-muted-foreground pb-8">
              Become a Superadmin. Manage users, tasks, and settings.
            </CardContent>
          </Card>

          <Card 
            className="hover:border-accent cursor-pointer transition-all hover:shadow-lg group dark:bg-slate-900"
            onClick={() => setMode("join")}
          >
            <CardHeader className="text-center pt-8">
              <div className="mx-auto w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center group-hover:bg-accent transition-colors">
                <Users className="text-accent w-8 h-8 group-hover:text-white" />
              </div>
              <CardTitle className="text-2xl mt-4 dark:text-slate-100">Join Workspace</CardTitle>
              <CardDescription className="dark:text-slate-400">Connect with an existing team</CardDescription>
            </CardHeader>
            <CardContent className="text-center text-sm text-muted-foreground pb-8">
              Enter a unique code provided by your workspace admin.
            </CardContent>
          </Card>
        </div>
        
        <div className="mt-4 text-center">
           <p className="text-[10px] text-slate-400 dark:text-slate-600 font-bold uppercase tracking-widest">
             Powered by Eos Studios | Creation of Maldives
           </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-950">
      <div className="mb-8">
         <img src="/brand/full-logo.png" alt="WorkspaceZ" className="w-[180px] h-auto object-contain dark:hidden" />
         <img src="/brand/full-logo-dark.png" alt="WorkspaceZ" className="w-[180px] h-auto object-contain hidden dark:block" />
      </div>
      <Card className="w-full max-w-md shadow-xl border-none dark:bg-slate-900">
        <CardHeader>
          <CardTitle className="text-2xl font-bold dark:text-slate-100">
            {mode === "create" ? "Setup New Workspace" : "Join Existing Team"}
          </CardTitle>
          <CardDescription className="dark:text-slate-400">
            {mode === "create" ? "Just a few details to get started" : "Enter the code provided by your admin"}
          </CardDescription>
        </CardHeader>
        <form onSubmit={mode === "create" ? handleCreate : handleJoin}>
          <CardContent className="space-y-4">
            {mode === "create" ? (
              <div className="space-y-2">
                <Label htmlFor="wsName" className="dark:text-slate-300">Workspace Name</Label>
                <Input 
                  id="wsName" 
                  placeholder="e.g. Acme Tech Corp" 
                  required 
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  className="h-11 dark:bg-slate-800"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="code" className="dark:text-slate-300">Join Code</Label>
                <Input 
                  id="code" 
                  placeholder="e.g. ABC-12345" 
                  required 
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  className="h-11 dark:bg-slate-800"
                />
              </div>
            )}
          </CardContent>
          <CardContent className="flex flex-col gap-3 pt-0">
            <Button type="submit" className="w-full py-6 text-lg shadow-lg shadow-primary/20">Continue</Button>
            <Button variant="ghost" onClick={() => setMode("choice")} className="dark:text-slate-400">Back to selection</Button>
          </CardContent>
        </form>
      </Card>
      
      <div className="mt-8 text-center">
         <p className="text-[10px] text-slate-400 dark:text-slate-600 font-bold uppercase tracking-widest">
           Powered by Eos Studios | Creation of Maldives
         </p>
      </div>
    </div>
  );
}

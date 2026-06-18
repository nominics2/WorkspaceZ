"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const router = useRouter();
  const supabase = createClient();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isRegister) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              username: username.toLowerCase(),
            },
          },
        });
        if (error) throw error;
        toast({ 
          title: "Registration successful", 
          description: "Please check your email to verify your account." 
        });
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          throw error;
        }

        if (!data.user) {
          throw new Error("Login failed. Please try again.");
        }

        // Wait a brief moment for session to sync
        await new Promise(resolve => setTimeout(resolve, 500));

        // Check if user has an active workspace membership
        const { data: memberData, error: memberError } = await supabase
          .from('workspace_members')
          .select('workspace_id')
          .eq('user_id', data.user.id)
          .eq('status', 'active')
          .limit(1);

        if (memberError) {
          console.error("Error checking workspace membership:", memberError);
          toast({
            variant: "destructive",
            title: "Workspace check failed",
            description: memberError.message,
          });
          return;
        }

        if (!memberData || memberData.length === 0) {
          router.replace("/workspace-setup");
          return;
        }

        router.replace("/dashboard");
        return;
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "An unexpected error occurred",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsRegister(!isRegister);
    setEmail("");
    setPassword("");
    setFullName("");
    setUsername("");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950">
      <Card className="w-full max-w-md shadow-xl border-none dark:bg-slate-900">
        <CardHeader className="text-center space-y-6 pt-10">
          <div className="mx-auto flex justify-center items-center">
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
          <div className="space-y-1">
            <CardTitle className="text-2xl font-bold dark:text-slate-100">
              {isRegister ? "Create Account" : "Welcome Back"}
            </CardTitle>
            <p className="text-sm font-normal text-muted-foreground">
               {isRegister ? "Join teams and manage tasks effectively" : "Modern workspace management for teams"}
            </p>
          </div>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {isRegister && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="fullName" className="dark:text-slate-300">Full Name</Label>
                  <Input 
                    id="fullName" 
                    placeholder="Alex Johnson" 
                    required 
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    disabled={loading}
                    className="dark:bg-slate-800 dark:border-slate-700"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="username" className="dark:text-slate-300">Username</Label>
                  <Input 
                    id="username" 
                    placeholder="alexj" 
                    required 
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={loading}
                    className="dark:bg-slate-800 dark:border-slate-700"
                  />
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="email" className="dark:text-slate-300">Email</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="alex@example.com" 
                required 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                className="dark:bg-slate-800 dark:border-slate-700"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="dark:text-slate-300">Password</Label>
              <Input 
                id="password" 
                type="password" 
                required 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="dark:bg-slate-800 dark:border-slate-700"
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4 pb-10">
            <Button type="submit" className="w-full py-6 text-lg font-semibold shadow-lg shadow-primary/20" disabled={loading}>
              {loading && <Loader2 className="w-5 h-5 animate-spin mr-2" />}
              {isRegister ? "Sign Up" : "Sign In"}
            </Button>
            <p className="text-sm text-center text-muted-foreground">
              {isRegister ? "Already have an account?" : "Don't have an account?"} {" "}
              <Button 
                variant="link" 
                className="p-0 h-auto font-semibold text-primary" 
                type="button"
                onClick={toggleMode}
              >
                {isRegister ? "Sign In" : "Register"}
              </Button>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

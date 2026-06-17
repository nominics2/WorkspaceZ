
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Layers, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
        });
        if (error) throw error;
        toast({ title: "Check your email", description: "Confirmation link sent." });
      } else {
        const { error, data } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        
        // Success login
        router.refresh();
        router.push("/dashboard");
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
      <Card className="w-full max-w-md shadow-xl border-none">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-12 h-12 bg-primary rounded-xl flex items-center justify-center">
            <Layers className="text-white w-7 h-7" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">
              {isRegister ? "Create Account" : "Welcome to WorkspaceZ"}
            </CardTitle>
            <CardDescription>Modern workspace management for teams</CardDescription>
          </div>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="alex@example.com" 
                required 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input 
                id="password" 
                type="password" 
                required 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full py-6 text-lg font-semibold" disabled={loading}>
              {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
              {isRegister ? "Sign Up" : "Sign In"}
            </Button>
            <p className="text-sm text-center text-muted-foreground">
              {isRegister ? "Already have an account?" : "Don't have an account?"} {" "}
              <Button 
                variant="link" 
                className="p-0 h-auto font-semibold" 
                type="button"
                onClick={() => setIsRegister(!isRegister)}
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

"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Loader2, 
  ChevronRight, 
  ChevronLeft, 
  Check, 
  Sparkles, 
  User, 
  Layout, 
  Smartphone, 
  Bell, 
  Flag,
  UserCircle,
  AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";

const ONBOARDING_STEPS = [
  { id: 'welcome', title: 'Welcome', description: 'Welcome to WorkspaceZ', icon: Sparkles },
  { id: 'profile', title: 'Profile', description: 'Set up your identity', icon: User },
  { id: 'workspace', title: 'Workspace', description: 'Create or join a team', icon: Layout },
  { id: 'install', title: 'Install App', description: 'Get the best experience', icon: Smartphone },
  { id: 'notifications', title: 'Notifications', description: 'Stay in the loop', icon: Bell },
  { id: 'features', title: 'Updates & Features', description: 'Explore what is new', icon: Flag },
  { id: 'finish', title: 'Finish', description: 'You are all set!', icon: Check },
];

const AVATAR_PRESETS = Array.from({ length: 10 }, (_, i) => `character_${i + 1}`);

export default function OnboardingPage() {
  const { loading, workspaces, userProfile, refreshWorkspaces } = useWorkspace();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const supabase = createClient();
  const { toast } = useToast();

  // Profile Form State
  const [profileForm, setProfileForm] = useState({
    full_name: "",
    username: "",
    avatar_preset: "" as string | null
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Initialize form from userProfile
  useEffect(() => {
    if (userProfile) {
      setProfileForm({
        full_name: userProfile.full_name || "",
        username: userProfile.username || "",
        avatar_preset: userProfile.avatar_preset || null
      });
    }
  }, [userProfile]);

  // Routing Logic: Skip onboarding if workspace exists
  useEffect(() => {
    if (!loading && workspaces && workspaces.length > 0) {
      router.replace('/dashboard');
    }
  }, [loading, workspaces, router]);

  const currentStep = ONBOARDING_STEPS[currentStepIndex];
  const progress = ((currentStepIndex + 1) / ONBOARDING_STEPS.length) * 100;

  const validateProfile = async () => {
    const newErrors: Record<string, string> = {};
    
    if (!profileForm.full_name.trim()) {
      newErrors.full_name = "Full name is required";
    }

    const username = profileForm.username.toLowerCase().trim();
    if (!username) {
      newErrors.username = "Username is required";
    } else if (username.includes(" ")) {
      newErrors.username = "Username cannot contain spaces";
    } else if (!/^[a-z0-9_]{3,20}$/.test(username)) {
      newErrors.username = "3-20 characters, lowercase, numbers, or underscores only";
    } else {
      // Uniqueness check
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username)
        .neq('id', userProfile?.id)
        .maybeSingle();
      
      if (data) {
        newErrors.username = "This username is already taken";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleProfileSave = async () => {
    if (saving || !userProfile) return;
    
    setSaving(true);
    try {
      const isValid = await validateProfile();
      if (!isValid) return;

      // 1. Update Profile in DB
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: profileForm.full_name.trim(),
          username: profileForm.username.toLowerCase().trim(),
          avatar_preset: profileForm.avatar_preset,
          updated_at: new Date().toISOString()
        })
        .eq('id', userProfile.id);

      if (profileError) throw profileError;

      // 2. Update Onboarding Progress
      const { error: onboardingError } = await supabase.rpc('update_my_onboarding', {
        p_current_step: 'workspace_choice',
        p_profile_completed: true
      });

      if (onboardingError) throw onboardingError;

      // Refresh global state so providers know profile is updated
      await refreshWorkspaces();
      
      // Advance to next step
      setCurrentStepIndex(currentStepIndex + 1);
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Setup Failed",
        description: err.message || "An unexpected error occurred while saving your profile."
      });
    } finally {
      setSaving(false);
    }
  };

  const handleNext = async () => {
    if (currentStep.id === 'profile') {
      await handleProfileSave();
    } else if (currentStepIndex < ONBOARDING_STEPS.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    } else {
      router.push('/dashboard');
    }
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Syncing Journey...</p>
      </div>
    );
  }

  const StepIcon = currentStep.icon;

  return (
    <div className="w-full max-w-5xl mx-auto py-12 px-6 space-y-12 animate-in fade-in duration-700">
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-2xl shadow-inner">
              <img src="/brand/logomark.png" alt="Z" className="w-8 h-8 object-contain" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">Begin your adventure</h1>
              <p className="text-xs text-muted-foreground font-bold uppercase tracking-[0.2em]">WorkspaceZ Onboarding</p>
            </div>
          </div>
          <div className="md:text-right space-y-1">
            <p className="text-lg font-extrabold text-primary">{Math.round(progress)}%</p>
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Stage {currentStepIndex + 1} of {ONBOARDING_STEPS.length}</p>
          </div>
        </div>
        <Progress value={progress} className="h-2.5 bg-slate-100 dark:bg-slate-800" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border dark:border-slate-800 p-8 shadow-xl">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-8 px-2">Journey Overview</h3>
            <div className="space-y-2">
              {ONBOARDING_STEPS.map((step, idx) => {
                const isActive = idx === currentStepIndex;
                const isCompleted = idx < currentStepIndex;
                const StepIco = step.icon;
                
                return (
                  <div 
                    key={step.id} 
                    className={cn(
                      "flex items-center gap-4 p-3.5 rounded-2xl transition-all duration-300",
                      isActive ? "bg-primary/10 text-primary font-bold shadow-sm" : 
                      isCompleted ? "text-emerald-500 opacity-60" : "text-slate-400 opacity-40"
                    )}
                  >
                    <div className={cn(
                      "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border-2 transition-all",
                      isActive ? "border-primary bg-primary text-white shadow-lg shadow-primary/20 scale-105" : 
                      isCompleted ? "border-emerald-500 bg-emerald-500 text-white" : 
                      "border-slate-200 dark:border-slate-800"
                    )}>
                      {isCompleted ? <Check className="w-5 h-5" /> : <StepIco className={cn("w-4 h-4", isActive ? "animate-pulse" : "")} />}
                    </div>
                    <span className="text-sm font-medium truncate">{step.title}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="lg:col-span-8">
          <Card className="border-none shadow-[0_32px_64px_-12px_rgba(0,0,0,0.1)] dark:shadow-none bg-white dark:bg-slate-900 rounded-[3.5rem] overflow-hidden min-h-[550px] flex flex-col relative group">
            <div className="absolute top-0 right-0 w-80 h-80 bg-primary/5 rounded-full -mr-40 -mt-40 blur-[100px] group-hover:bg-primary/10 transition-colors duration-1000" />
            
            <CardHeader className="p-12 pb-6 relative z-10">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-4 bg-primary/10 rounded-2xl shadow-sm">
                  <StepIcon className="w-10 h-10 text-primary" />
                </div>
                <Badge variant="secondary" className="bg-primary/5 text-primary border-none uppercase text-[10px] px-4 py-1 font-bold tracking-[0.2em]">Step {currentStepIndex + 1}</Badge>
              </div>
              <CardTitle className="text-4xl font-black tracking-tight text-slate-900 dark:text-white leading-tight">
                {currentStep.title}
              </CardTitle>
              <CardDescription className="text-xl font-medium text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                {currentStep.description}
              </CardDescription>
            </CardHeader>
            
            <CardContent className="p-12 pt-8 flex-1 flex flex-col relative z-10">
              {currentStep.id === 'welcome' && (
                <div className="flex flex-col items-center justify-center text-center">
                   <div className="p-16 rounded-[4rem] bg-slate-50 dark:bg-slate-800/40 mb-12 border dark:border-slate-800 shadow-inner group-hover:scale-105 transition-transform duration-700">
                    <Sparkles className="w-24 h-24 text-primary animate-pulse" />
                  </div>
                  <div className="max-w-md space-y-6">
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">
                      Welcome to WorkspaceZ
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 leading-relaxed text-lg">
                      Let's customize your experience. This setup will only take a moment and ensures your team stays organized from day one.
                    </p>
                  </div>
                </div>
              )}

              {currentStep.id === 'profile' && (
                <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">Full Name</Label>
                      <Input 
                        placeholder="Alex Johnson"
                        value={profileForm.full_name}
                        onChange={e => setProfileForm(f => ({ ...f, full_name: e.target.value }))}
                        className={cn("h-12 text-lg rounded-xl border-none bg-slate-50 dark:bg-slate-800 transition-all", errors.full_name && "ring-2 ring-rose-500")}
                        disabled={saving}
                      />
                      {errors.full_name && (
                        <p className="text-xs text-rose-500 font-medium flex items-center gap-1 ml-1">
                          <AlertCircle className="w-3 h-3" /> {errors.full_name}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">Username</Label>
                      <div className="relative">
                         <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">@</span>
                         <Input 
                          placeholder="unique_handle"
                          value={profileForm.username}
                          onChange={e => setProfileForm(f => ({ ...f, username: e.target.value }))}
                          className={cn("h-12 pl-9 text-lg rounded-xl border-none bg-slate-50 dark:bg-slate-800 transition-all", errors.username && "ring-2 ring-rose-500")}
                          disabled={saving}
                        />
                      </div>
                      {errors.username ? (
                        <p className="text-xs text-rose-500 font-medium flex items-center gap-1 ml-1">
                          <AlertCircle className="w-3 h-3" /> {errors.username}
                        </p>
                      ) : (
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight ml-1">Teammates will mention you using this handle</p>
                      )}
                    </div>

                    <div className="space-y-4">
                      <Label className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">Identity Icon</Label>
                      <div className="grid grid-cols-6 sm:grid-cols-11 gap-3">
                        <button
                          type="button"
                          onClick={() => setProfileForm(f => ({ ...f, avatar_preset: null }))}
                          className={cn(
                            "aspect-square rounded-xl border-2 flex items-center justify-center transition-all hover:scale-105 shadow-sm",
                            profileForm.avatar_preset === null 
                              ? "border-primary bg-primary/5 ring-2 ring-primary/20" 
                              : "border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950"
                          )}
                        >
                          <UserCircle className={cn("w-6 h-6", profileForm.avatar_preset === null ? "text-primary" : "text-slate-400")} />
                        </button>
                        {AVATAR_PRESETS.map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setProfileForm(f => ({ ...f, avatar_preset: preset }))}
                            className={cn(
                              "aspect-square rounded-xl border-2 overflow-hidden transition-all hover:scale-105 shadow-sm",
                              profileForm.avatar_preset === preset ? "border-primary ring-2 ring-primary/20" : "border-slate-100 dark:border-slate-800"
                            )}
                          >
                            <img src={`/avatars/${preset}.png`} alt={preset} className="w-full h-full object-cover" />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {currentStepIndex > 1 && (
                <div className="flex flex-col items-center justify-center text-center">
                  <div className="p-16 rounded-[4rem] bg-slate-50 dark:bg-slate-800/40 mb-12 border dark:border-slate-800 shadow-inner group-hover:scale-105 transition-transform duration-700">
                    <StepIcon className="w-24 h-20 text-slate-300 dark:text-slate-700 animate-pulse" />
                  </div>
                  <div className="max-w-md space-y-6">
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">
                      Feature Initializing
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 leading-relaxed text-lg">
                      We're configuring <strong>{currentStep.title}</strong> for your workspace. 
                      Click "Next Step" to continue the journey.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>

            <CardFooter className="p-12 border-t dark:border-slate-800 flex flex-col sm:flex-row justify-between gap-6 relative z-10 bg-slate-50/30 dark:bg-slate-950/20 backdrop-blur-sm">
              <Button 
                variant="ghost" 
                onClick={handleBack} 
                disabled={currentStepIndex === 0 || saving}
                className="rounded-2xl h-16 px-10 font-bold text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-all"
              >
                <ChevronLeft className="w-5 h-5 mr-3" /> Back
              </Button>
              
              <Button 
                onClick={handleNext}
                disabled={saving}
                className="rounded-2xl h-16 px-16 shadow-2xl shadow-primary/30 font-black text-xl transition-all active:scale-95 group/btn"
              >
                {saving ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <>
                    {currentStepIndex === ONBOARDING_STEPS.length - 1 ? 'Go to Dashboard' : 'Next Step'}
                    {currentStepIndex !== ONBOARDING_STEPS.length - 1 && <ChevronRight className="w-6 h-6 ml-3 group-hover/btn:translate-x-1 transition-transform" />}
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}

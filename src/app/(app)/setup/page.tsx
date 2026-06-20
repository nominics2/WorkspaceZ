"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { usePwaInstall } from "@/components/providers/PwaInstallProvider";
import { usePushNotifications } from "@/components/providers/PushNotificationProvider";
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
  AlertCircle,
  PlusCircle,
  Users,
  Info,
  X,
  Copy,
  Download,
  Share,
  PlusSquare,
  CheckCircle2,
  BellRing,
  Globe,
  MessageSquare,
  StickyNote,
  Zap,
  LayoutGrid,
  ExternalLink,
  Plus
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { WORKSPACE_ICON_PRESETS, getWorkspaceIconSrc } from "@/lib/workspace-icons";

const ONBOARDING_STEPS = [
  { id: 'welcome', title: 'Welcome', description: 'Welcome to WorkspaceZ', icon: Sparkles },
  { id: 'profile', title: 'Profile', description: 'Set up your identity', icon: User },
  { id: 'workspace', title: 'Workspace', description: 'Create or join a team', icon: Layout },
  { id: 'teams', title: 'Setup Teams', description: 'Organize your focus', icon: Flag },
  { id: 'invite', title: 'Invite Members', description: 'Grow your community', icon: Users },
  { id: 'install', title: 'Install App', description: 'Get the best experience', icon: Smartphone },
  { id: 'notifications', title: 'Notifications', description: 'Stay in the loop', icon: Bell },
  { id: 'features', title: 'Learn Features', description: 'Discover capabilities', icon: Zap },
  { id: 'finish', title: 'Get Started', description: 'You are all set!', icon: Check },
];

const AVATAR_PRESETS = Array.from({ length: 10 }, (_, i) => `character_${i + 1}`);

const SUGGESTED_TEAMS = ['Management', 'Operations', 'Sales', 'HR', 'Finance', 'Projects', 'Support'];

function normalizeJoinStatus(result: unknown): string | null {
  if (typeof result === "string") return result;
  if (result && typeof result === "object") {
    const value = result as Record<string, unknown>;
    if (typeof value.status === "string") return value.status;
    if (typeof value.join_status === "string") return value.join_status;
    if (typeof value.member_status === "string") return value.member_status;
  }
  return null;
}

export default function OnboardingPage() {
  const { loading, workspaces, userProfile, refreshWorkspaces, activeWorkspace } = useWorkspace();
  const { installAvailable, isStandalone, isIOS, promptInstall } = usePwaInstall();
  const { isSupported, isConfigured, isSubscribed, permissionState, isLoading: pushLoading, enablePush } = usePushNotifications();
  
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [hasSynced, setHasSynced] = useState(false);
  const router = useRouter();
  const supabase = createClient();
  const { toast } = useToast();

  const [profileForm, setProfileForm] = useState({
    full_name: "",
    username: "",
    avatar_preset: "" as string | null
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [workspaceMode, setWorkspaceMode] = useState<"choice" | "create" | "join">("choice");
  const [workspaceForm, setWorkspaceForm] = useState({
    name: "",
    icon_preset: "preset_1",
    join_code: ""
  });

  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [customTeamName, setCustomTeamName] = useState("");

  useEffect(() => {
    if (userProfile) {
      setProfileForm({
        full_name: userProfile.full_name || "",
        username: userProfile.username || "",
        avatar_preset: userProfile.avatar_preset || null
      });
    }
  }, [userProfile]);

  // Initial Sync with DB state to prevent "reset to Welcome" on re-renders
  useEffect(() => {
    if (!userProfile || hasSynced) return;
    
    async function syncOnboarding() {
      try {
        const { data, error } = await supabase.rpc('get_my_onboarding');
        if (error) throw error;
        
        if (data && data.current_step) {
          const stepIdx = ONBOARDING_STEPS.findIndex(s => {
            if (data.current_step === 'workspace_choice') return s.id === 'workspace';
            if (data.current_step === 'install_app') return s.id === 'install';
            if (data.current_step === 'features_intro') return s.id === 'features';
            if (data.current_step === 'first_action') return s.id === 'finish';
            return s.id === data.current_step;
          });
          
          if (stepIdx !== -1) {
            setCurrentStepIndex(stepIdx);
          }
        }
        setHasSynced(true);
      } catch (err) {
        setHasSynced(true);
      }
    }
    
    syncOnboarding();
  }, [userProfile, hasSynced, supabase]);

  const currentStep = ONBOARDING_STEPS[currentStepIndex];
  const progress = ((currentStepIndex + 1) / ONBOARDING_STEPS.length) * 100;

  const validateProfile = async () => {
    const newErrors: Record<string, string> = {};
    if (!profileForm.full_name.trim()) newErrors.full_name = "Full name is required";
    const username = profileForm.username.toLowerCase().trim();
    if (!username) {
      newErrors.username = "Username is required";
    } else if (username.includes(" ")) {
      newErrors.username = "Username cannot contain spaces";
    } else if (!/^[a-z0-9_]{3,20}$/.test(username)) {
      newErrors.username = "3-20 characters, lowercase, numbers, or underscores only";
    } else {
      const { data } = await supabase.from('profiles').select('id').eq('username', username).neq('id', userProfile?.id).maybeSingle();
      if (data) newErrors.username = "This username is already taken";
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
      
      const { error: profileError } = await supabase.from('profiles').update({
        full_name: profileForm.full_name.trim(),
        username: profileForm.username.toLowerCase().trim(),
        avatar_preset: profileForm.avatar_preset,
        updated_at: new Date().toISOString()
      }).eq('id', userProfile.id);
      
      if (profileError) throw profileError;
      
      const { error: onboardingError } = await supabase.rpc('update_my_onboarding', { 
        p_current_step: 'workspace_choice', 
        p_profile_completed: true 
      });
      
      if (onboardingError) throw onboardingError;
      
      // Update local state first to ensure UI moves forward immediately
      const workspaceIdx = ONBOARDING_STEPS.findIndex(s => s.id === 'workspace');
      if (workspaceIdx !== -1) {
        setCurrentStepIndex(workspaceIdx);
      }
      
      await refreshWorkspaces();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Setup Failed", description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleWorkspaceCreate = async () => {
    if (saving || !workspaceForm.name.trim()) return;
    setSaving(true);
    try {
      const { data: wsId, error } = await supabase.rpc("create_workspace", { p_name: workspaceForm.name.trim() });
      if (error) throw error;
      if (wsId) {
        await supabase.rpc("update_workspace_icon_preset", { p_workspace_id: wsId, p_icon_preset: workspaceForm.icon_preset });
      }
      await supabase.rpc('update_my_onboarding', { p_current_step: 'teams', p_workspace_completed: true });
      await refreshWorkspaces();
      toast({ title: "Workspace Created", description: `Welcome to ${workspaceForm.name}!` });
      setCurrentStepIndex(ONBOARDING_STEPS.findIndex(s => s.id === 'teams'));
    } catch (err: any) {
      toast({ variant: "destructive", title: "Creation Failed", description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleWorkspaceJoin = async () => {
    if (saving || !workspaceForm.join_code.trim()) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.rpc('request_join_workspace_by_code', { p_join_code: workspaceForm.join_code.trim().toUpperCase() });
      if (error) throw error;
      const joinStatus = normalizeJoinStatus(data);
      const successStatuses = ['joined', 'active', 'already_member', 'success', 'approved'];
      if (successStatuses.includes(joinStatus || '')) {
        await supabase.rpc('update_my_onboarding', { p_current_step: 'install_app', p_workspace_completed: true });
        await refreshWorkspaces();
        toast({ title: "Connection Established", description: "You have joined the team workspace." });
        setCurrentStepIndex(ONBOARDING_STEPS.findIndex(s => s.id === 'install'));
      } else {
        toast({ variant: "destructive", title: "Invalid Code", description: "Please check your workspace code." });
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Join Error", description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleTeamsSave = async (isSkipping = false) => {
    if (saving) return;
    setSaving(true);
    try {
      if (!isSkipping && selectedTeams.length > 0 && activeWorkspace) {
        const teamPromises = selectedTeams.map(name => supabase.from('sub_workspaces').insert({ workspace_id: activeWorkspace.id, name: name.trim(), created_by: userProfile.id }));
        const results = await Promise.all(teamPromises);
        const error = results.find(r => r.error)?.error;
        if (error) throw error;
      }
      await supabase.rpc('update_my_onboarding', { p_current_step: 'invite', p_teams_completed: true });
      setCurrentStepIndex(ONBOARDING_STEPS.findIndex(s => s.id === 'invite'));
    } catch (err: any) {
      toast({ variant: "destructive", title: "Setup Error", description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleCopyInviteCode = () => {
    if (activeWorkspace?.join_code) {
      navigator.clipboard.writeText(activeWorkspace.join_code);
      toast({ title: "Workspace code copied" });
    }
  };

  const handleInviteNext = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await supabase.rpc('update_my_onboarding', { p_current_step: 'install_app', p_invite_completed: true });
      setCurrentStepIndex(ONBOARDING_STEPS.findIndex(s => s.id === 'install'));
    } catch (err: any) {
      toast({ variant: "destructive", title: "Setup Error", description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleInstallNext = async (isSkipping = false) => {
    if (saving) return;
    setSaving(true);
    try {
      await supabase.rpc('update_my_onboarding', { p_current_step: 'notifications', [isSkipping ? 'p_install_app_skipped' : 'p_install_app_completed']: true });
      setCurrentStepIndex(ONBOARDING_STEPS.findIndex(s => s.id === 'notifications'));
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleNotificationsNext = async (isSkipping = false) => {
    if (saving) return;
    setSaving(true);
    try {
      if (!isSkipping) await enablePush();
      await supabase.rpc('update_my_onboarding', { p_current_step: 'features_intro', [isSkipping ? 'p_notifications_skipped' : 'p_notifications_completed']: true });
      setCurrentStepIndex(ONBOARDING_STEPS.findIndex(s => s.id === 'features'));
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleFeaturesNext = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await supabase.rpc('update_my_onboarding', { p_current_step: 'first_action', p_features_intro_completed: true });
      setCurrentStepIndex(ONBOARDING_STEPS.findIndex(s => s.id === 'finish'));
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleFinalFinish = async (actionPath?: string) => {
    if (saving) return;
    setSaving(true);
    try {
      const { error } = await supabase.rpc('update_my_onboarding', { p_current_step: 'complete', p_first_action_completed: true, p_dismissed: true });
      if (error) throw error;
      await refreshWorkspaces();
      if (actionPath) router.push(actionPath);
      else router.push('/dashboard');
    } catch (err: any) {
      toast({ variant: "destructive", title: "Unable to finish onboarding", description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleNext = async () => {
    if (currentStep.id === 'welcome') setCurrentStepIndex(currentStepIndex + 1);
    else if (currentStep.id === 'profile') await handleProfileSave();
    else if (currentStep.id === 'workspace') {
      if (workspaceMode === 'choice') toast({ title: "Workspace Required", description: "Create or join a workspace." });
      else if (workspaceMode === 'create') await handleWorkspaceCreate();
      else await handleWorkspaceJoin();
    } else if (currentStep.id === 'teams') await handleTeamsSave();
    else if (currentStep.id === 'invite') await handleInviteNext();
    else if (currentStep.id === 'install') await handleInstallNext();
    else if (currentStep.id === 'notifications') await handleNotificationsNext();
    else if (currentStep.id === 'features') await handleFeaturesNext();
    else await handleFinalFinish();
  };

  const handleBack = () => {
    if (currentStep.id === 'workspace' && workspaceMode !== 'choice') { setWorkspaceMode('choice'); return; }
    if (currentStepIndex > 0) setCurrentStepIndex(currentStepIndex - 1);
  };

  if (loading && !hasSynced) return (<div className="flex flex-col items-center justify-center min-h-[60vh] gap-4"><Loader2 className="w-10 h-10 animate-spin text-primary" /><p className="text-xs font-bold uppercase tracking-widest text-slate-400">Syncing Journey...</p></div>);

  const StepIcon = currentStep.icon;

  return (
    <div className="w-full max-w-5xl mx-auto py-12 px-4 sm:px-6 space-y-12 animate-in fade-in duration-700">
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-2xl shadow-inner"><img src="/brand/logomark.png" alt="Z" className="w-8 h-8 object-contain" /></div>
            <div><h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">Begin your adventure</h1><p className="text-xs text-muted-foreground font-bold uppercase tracking-[0.2em]">WorkspaceZ Onboarding</p></div>
          </div>
          <div className="md:text-right space-y-1"><p className="text-lg font-extrabold text-primary">{Math.round(progress)}%</p><p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Stage {currentStepIndex + 1} of {ONBOARDING_STEPS.length}</p></div>
        </div>
        <Progress value={progress} className="h-2.5 bg-slate-100 dark:bg-slate-800" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
        <div className="lg:col-span-4 space-y-4 hidden lg:block">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border dark:border-slate-800 p-8 shadow-xl">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-8 px-2">Journey Overview</h3>
            <div className="space-y-2">{ONBOARDING_STEPS.map((step, idx) => { const isActive = idx === currentStepIndex; const isCompleted = idx < currentStepIndex; const StepIco = step.icon; return (<div key={step.id} className={cn("flex items-center gap-4 p-3.5 rounded-2xl transition-all duration-300", isActive ? "bg-primary/10 text-primary font-bold shadow-sm" : isCompleted ? "text-emerald-500 opacity-60" : "text-slate-400 opacity-40")}><div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border-2 transition-all", isActive ? "border-primary bg-primary text-white shadow-lg shadow-primary/20 scale-105" : isCompleted ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-200 dark:border-slate-800")}>{isCompleted ? <Check className="w-5 h-5" /> : <StepIco className={cn("w-4 h-4", isActive ? "animate-pulse" : "")} />}</div><span className="text-sm font-medium truncate">{step.title}</span></div>); })}</div>
          </div>
        </div>
        <div className="lg:col-span-8">
          <Card className="border-none shadow-[0_32px_64px_-12px_rgba(0,0,0,0.1)] dark:shadow-none bg-white dark:bg-slate-900 rounded-[2.5rem] sm:rounded-[3.5rem] overflow-hidden min-h-[500px] flex flex-col relative group">
            <div className="absolute top-0 right-0 w-80 h-80 bg-primary/5 rounded-full -mr-40 -mt-40 blur-[100px] transition-colors duration-1000" />
            <CardHeader className="p-8 sm:p-12 pb-4 sm:pb-6 relative z-10"><div className="flex items-center gap-4 mb-4"><div className="p-3 sm:p-4 bg-primary/10 rounded-2xl shadow-sm"><StepIcon className="w-8 h-8 sm:w-10 sm:h-10 text-primary" /></div><Badge variant="secondary" className="bg-primary/5 text-primary border-none uppercase text-[10px] px-4 py-1 font-bold tracking-[0.2em]">Step {currentStepIndex + 1}</Badge></div><CardTitle className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white leading-tight">{currentStep.title}</CardTitle><CardDescription className="text-lg sm:text-xl font-medium text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">{currentStep.description}</CardDescription></CardHeader>
            <CardContent className="p-8 sm:p-12 pt-6 sm:pt-8 flex-1 flex flex-col relative z-10">
              {currentStep.id === 'welcome' && (<div className="flex flex-col items-center justify-center text-center"><div className="p-12 sm:p-16 rounded-[4rem] bg-slate-50 dark:bg-slate-800/40 mb-8 sm:mb-12 border dark:border-slate-800 shadow-inner group-hover:scale-105 transition-transform duration-700"><Sparkles className="w-20 h-20 sm:w-24 sm:h-24 text-primary animate-pulse" /></div><div className="max-w-md space-y-6"><h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">Welcome to WorkspaceZ</h2><p className="text-slate-500 dark:text-slate-400 leading-relaxed text-base sm:text-lg">Let's customize your experience. This setup will only take a moment and ensures your team stays organized from day one.</p></div></div>)}
              {currentStep.id === 'profile' && (
                <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
                  <div className="flex flex-col items-center gap-4 mb-6">
                    <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-3xl bg-slate-50 dark:bg-slate-800 border-4 border-white dark:border-slate-700 shadow-xl overflow-hidden flex items-center justify-center relative transition-all duration-300 hover:scale-105 group/preview">
                      {profileForm.avatar_preset ? (
                        <img 
                          src={`/avatars/${profileForm.avatar_preset}.png`} 
                          alt="Preview" 
                          className="w-full h-full object-cover animate-in fade-in zoom-in-95 duration-500" 
                        />
                      ) : (
                        <UserCircle className="w-16 h-16 sm:w-20 sm:h-20 text-slate-300 dark:text-slate-600" />
                      )}
                      <div className="absolute inset-0 bg-black/5 opacity-0 group-hover/preview:opacity-100 transition-opacity" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-bold text-slate-900 dark:text-white">Profile Preview</p>
                      <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">Identity selected</p>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">Full Name</Label>
                      <Input placeholder="Alex Johnson" value={profileForm.full_name} onChange={e => setProfileForm(f => ({ ...f, full_name: e.target.value }))} className={cn("h-12 text-lg rounded-xl border-none bg-slate-50 dark:bg-slate-800 transition-all", errors.full_name && "ring-2 ring-rose-500")} disabled={saving} />
                      {errors.full_name && <p className="text-xs text-rose-500 font-medium flex items-center gap-1 ml-1"><AlertCircle className="w-3 h-3" /> {errors.full_name}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">Username</Label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">@</span>
                        <Input placeholder="unique_handle" value={profileForm.username} onChange={e => setProfileForm(f => ({ ...f, username: e.target.value }))} className={cn("h-12 pl-9 text-lg rounded-xl border-none bg-slate-50 dark:bg-slate-800 transition-all", errors.username && "ring-2 ring-rose-500")} disabled={saving} />
                      </div>
                      {errors.username ? <p className="text-xs text-rose-500 font-medium flex items-center gap-1 ml-1"><AlertCircle className="w-3 h-3" /> {errors.username}</p> : <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight ml-1">Teammates will mention you using this handle</p>}
                    </div>
                    <div className="space-y-4">
                      <Label className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">Identity Icon</Label>
                      <div className="grid grid-cols-6 sm:grid-cols-11 gap-3">
                        <button type="button" onClick={() => setProfileForm(f => ({ ...f, avatar_preset: null }))} className={cn("aspect-square rounded-xl border-2 flex items-center justify-center transition-all hover:scale-105 shadow-sm", profileForm.avatar_preset === null ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950")}><UserCircle className={cn("w-6 h-6", profileForm.avatar_preset === null ? "text-primary" : "text-slate-400")} /></button>
                        {AVATAR_PRESETS.map((preset) => (
                          <button key={preset} type="button" onClick={() => setProfileForm(f => ({ ...f, avatar_preset: preset }))} className={cn("aspect-square rounded-xl border-2 overflow-hidden transition-all hover:scale-105 shadow-sm", profileForm.avatar_preset === preset ? "border-primary ring-2 ring-primary/20" : "border-slate-100 dark:border-slate-800")}>
                            <img src={`/avatars/${preset}.png`} alt={preset} className="w-full h-full object-cover" />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {currentStep.id === 'workspace' && (<div className="space-y-8 animate-in slide-in-from-right-4 duration-500">{workspaceMode === 'choice' && (<div className="grid grid-cols-1 sm:grid-cols-2 gap-6"><button onClick={() => setWorkspaceMode('create')} className="p-8 rounded-[2.5rem] bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 hover:border-primary transition-all flex flex-col items-center text-center gap-6 group/choice shadow-xl"><div className="p-6 bg-primary/10 rounded-[2rem] group-hover/choice:bg-primary group-hover/choice:text-white transition-all"><PlusCircle className="w-12 h-12" /></div><div className="space-y-2"><h3 className="text-xl font-bold dark:text-white">Create New</h3><p className="text-sm text-slate-500 leading-relaxed">Establish a dedicated space for your team projects.</p></div></button><button onClick={() => setWorkspaceMode('join')} className="p-8 rounded-[2.5rem] bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 hover:border-accent transition-all flex flex-col items-center text-center gap-6 group/choice shadow-xl"><div className="p-6 bg-accent/10 rounded-[2rem] group-hover/choice:bg-accent group-hover/choice:text-white transition-all"><Users className="w-12 h-12" /></div><div className="space-y-2"><h3 className="text-xl font-bold dark:text-white">Join Existing</h3><p className="text-sm text-slate-500 leading-relaxed">Enter a workspace code provided by your administrator.</p></div></button></div>)}{workspaceMode === 'create' && (<div className="space-y-8 animate-in slide-in-from-right-4"><div className="space-y-6"><div className="space-y-2"><Label className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">Workspace Name</Label><Input placeholder="e.g. Acme Creative Agency" value={workspaceForm.name} onChange={e => setWorkspaceForm(f => ({ ...f, name: e.target.value }))} className="h-12 text-lg rounded-xl border-none bg-slate-50 dark:bg-slate-800" disabled={saving} /></div><div className="space-y-4"><Label className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">Workspace Identity</Label><div className="grid grid-cols-5 gap-4">{WORKSPACE_ICON_PRESETS.map((preset) => (<button key={preset.id} type="button" onClick={() => setWorkspaceForm(f => ({ ...f, icon_preset: preset.id }))} className={cn("aspect-square rounded-2xl overflow-hidden border-4 transition-all hover:scale-105 relative bg-white", workspaceForm.icon_preset === preset.id ? "border-primary ring-4 ring-primary/20 shadow-xl scale-105" : "border-slate-100 dark:border-slate-800 opacity-60 grayscale-[0.5]")}><img src={preset.src} alt={preset.label} className="w-full h-full object-cover" />{workspaceForm.icon_preset === preset.id && (<div className="absolute inset-0 bg-primary/10 flex items-center justify-center"><Check className="w-6 h-6 text-primary" /></div>)}</button>))}</div></div></div></div>)}{workspaceMode === 'join' && (<div className="space-y-8 animate-in slide-in-from-right-4"><div className="space-y-6"><div className="space-y-2 text-center max-w-sm mx-auto"><Label className="text-xs font-bold uppercase tracking-widest text-slate-500 block mb-4">Workspace Code</Label><Input placeholder="ABC-12345" value={workspaceForm.join_code} onChange={e => setWorkspaceForm(f => ({ ...f, join_code: e.target.value }))} className="h-16 text-2xl font-mono text-center tracking-widest rounded-2xl border-none bg-slate-50 dark:bg-slate-800 uppercase" disabled={saving} maxLength={10} /><p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tight mt-3">Enter the unique code shared by your admin</p></div><div className="p-6 bg-amber-50 dark:bg-amber-950/20 rounded-[2rem] border border-amber-100 dark:border-amber-900/30 flex gap-4 max-w-md mx-auto"><Info className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" /><div className="space-y-1"><p className="text-sm font-bold text-amber-900 dark:text-amber-400">Join Request Status</p><p className="text-xs text-amber-700 dark:text-amber-500 leading-relaxed">You will join the workspace immediately. Some features may be restricted until an admin verifies your account.</p></div></div></div></div>)}</div>)}
              {currentStep.id === 'teams' && (<div className="space-y-8 animate-in slide-in-from-right-4 duration-500"><div className="space-y-6"><div className="space-y-2"><Label className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">Team Suggestions</Label><div className="flex flex-wrap gap-2">{SUGGESTED_TEAMS.map(team => (<Button key={team} variant="outline" size="sm" onClick={() => setSelectedTeams(prev => prev.includes(team) ? prev.filter(t => t !== team) : [...prev, team])} className={cn("rounded-full px-4 border-slate-200 dark:border-slate-800 transition-all", selectedTeams.includes(team) ? "bg-primary text-white border-primary shadow-lg shadow-primary/20" : "hover:bg-slate-50 dark:hover:bg-slate-800")}>{selectedTeams.includes(team) && <Check className="w-3 h-3 mr-1.5" />}{team}</Button>))}</div></div><div className="space-y-2"><Label className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">Add Custom Team</Label><div className="flex gap-2"><Input placeholder="e.g. Engineering" value={customTeamName} onChange={e => setCustomTeamName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (customTeamName.trim() && !selectedTeams.includes(customTeamName.trim())) { setSelectedTeams(prev => [...prev, customTeamName.trim()]); setCustomTeamName(""); } } }} className="h-11 rounded-xl border-none bg-slate-50 dark:bg-slate-800" /><Button type="button" variant="secondary" onClick={() => { if (customTeamName.trim() && !selectedTeams.includes(customTeamName.trim())) { setSelectedTeams(prev => [...prev, customTeamName.trim()]); setCustomTeamName(""); } }} className="h-11 rounded-xl px-6">Add</Button></div></div>{selectedTeams.length > 0 && (<div className="space-y-2"><Label className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">Your Selection ({selectedTeams.length})</Label><div className="flex flex-wrap gap-2 p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border-2 border-dashed dark:border-slate-800">{selectedTeams.map(team => (<Badge key={team} className="h-8 pl-3 pr-1 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border dark:border-slate-800 rounded-lg group">{team}<button onClick={() => setSelectedTeams(prev => prev.filter(t => t !== team))} className="ml-2 p-1 hover:bg-rose-50 hover:text-rose-500 rounded-md transition-colors"><X className="w-3 h-3" /></button></Badge>))}</div></div>)}</div></div>)}
              {currentStep.id === 'invite' && (<div className="space-y-8 animate-in slide-in-from-right-4 duration-500"><div className="flex flex-col items-center justify-center text-center space-y-8"><div className="p-8 bg-slate-50 dark:bg-slate-800/40 rounded-[2.5rem] border dark:border-slate-800 shadow-inner w-full max-w-sm"><p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-4">Workspace Code</p><h2 className="text-5xl font-black text-primary tracking-tighter mb-6">{activeWorkspace?.join_code || '---'}</h2><Button onClick={handleCopyInviteCode} className="w-full h-14 rounded-2xl gap-3 text-lg shadow-xl shadow-primary/20"><Copy className="w-5 h-5" />Copy Invite Code</Button></div><div className="p-6 bg-amber-50 dark:bg-amber-950/20 rounded-[2rem] border border-amber-100 dark:border-amber-900/30 flex gap-4 max-w-md"><div className="p-3 bg-amber-100 dark:bg-amber-900/40 rounded-xl h-fit"><Info className="w-6 h-6 text-amber-600 dark:text-amber-500" /></div><div className="text-left space-y-1"><p className="text-sm font-bold text-amber-900 dark:text-amber-400">Membership Policy</p><p className="text-xs text-amber-700 dark:text-amber-500 leading-relaxed">Members will join immediately using this code. To protect your data, they will remain unverified until you confirm their identity in the Admin Panel.</p></div></div></div></div>)}
              {currentStep.id === 'install' && (<div className="space-y-8 animate-in slide-in-from-right-4 duration-500"><div className="flex flex-col items-center justify-center text-center space-y-6">{isStandalone ? (<div className="space-y-6"><div className="w-24 h-24 bg-emerald-50 dark:bg-emerald-500/10 rounded-3xl flex items-center justify-center mx-auto border-2 border-emerald-500/20 shadow-xl shadow-emerald-500/5"><CheckCircle2 className="w-12 h-12 text-emerald-500" /></div><div className="space-y-2"><h3 className="text-2xl font-bold dark:text-white">Successfully Installed!</h3><p className="text-slate-500 dark:text-slate-400 max-w-sm">WorkspaceZ is already running as a standalone app on your device.</p></div></div>) : (<><div className="p-12 bg-slate-50 dark:bg-slate-800/40 rounded-[3rem] border-2 border-dashed dark:border-slate-800 shadow-inner group-hover:scale-105 transition-transform duration-700"><Download className="w-24 h-24 text-primary animate-bounce" /></div><div className="max-w-md space-y-4">{installAvailable ? (<div className="space-y-6"><p className="text-lg font-medium text-slate-600 dark:text-slate-300">WorkspaceZ is ready to be added to your home screen or dock.</p><Button onClick={promptInstall} className="w-full h-16 rounded-2xl gap-3 text-xl shadow-xl shadow-primary/30"><Smartphone className="w-6 h-6" />Install Now</Button></div>) : isIOS ? (<div className="space-y-6 text-left"><div className="p-6 bg-white dark:bg-slate-950 rounded-3xl border dark:border-slate-800 space-y-5 shadow-sm"><div className="flex items-start gap-4"><div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-black shrink-0">1</div><p className="text-sm leading-relaxed dark:text-slate-200">Ensure you are viewing this in <strong>Safari</strong>.</p></div><div className="flex items-start gap-4"><div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-black shrink-0">2</div><p className="text-sm leading-relaxed flex items-center flex-wrap gap-2 dark:text-slate-200">Tap the <Share className="w-4 h-4 text-blue-500" /> Share button in the bottom menu.</p></div><div className="flex items-start gap-4"><div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-black shrink-0">3</div><p className="text-sm leading-relaxed flex items-center flex-wrap gap-2 dark:text-slate-200">Scroll down and tap <PlusSquare className="w-4 h-4 text-slate-500" /> <strong>Add to Home Screen</strong>.</p></div></div><p className="text-xs text-center text-muted-foreground font-medium px-4">Apple requires this manual setup for all web applications.</p></div>) : (<div className="p-8 bg-slate-50 dark:bg-slate-800/40 rounded-3xl border dark:border-slate-800 text-center"><AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-4" /><p className="text-slate-500 dark:text-slate-400 leading-relaxed font-medium">Native installation isn't supported on this browser. You can always install WorkspaceZ from Chrome or Edge on Desktop.</p></div>)}</div></>)}</div></div>)}
              {currentStep.id === 'notifications' && (<div className="space-y-8 animate-in slide-in-from-right-4 duration-500"><div className="flex flex-col items-center justify-center text-center space-y-8"><div className="relative group"><div className="p-16 bg-primary/5 rounded-[4rem] border dark:border-slate-800 shadow-inner group-hover:bg-primary/10 transition-colors">{isSubscribed ? <BellRing className="w-24 h-24 text-emerald-500 animate-pulse" /> : <Bell className="w-24 h-24 text-primary" />}</div>{isSubscribed && <div className="absolute -top-4 -right-4 bg-emerald-500 text-white rounded-full p-3 shadow-xl animate-in zoom-in duration-300"><Check className="w-8 h-8" /></div>}</div><div className="max-w-md space-y-6"><div className="space-y-2"><h2 className="text-2xl font-bold dark:text-white">Push Notifications</h2><p className="text-slate-500 dark:text-slate-400 leading-relaxed font-medium">Stay connected with real-time alerts for task deadlines, chat messages, and workspace updates.</p></div>{!isConfigured ? (<div className="p-6 bg-slate-50 dark:bg-slate-800/40 rounded-[2rem] border dark:border-slate-800 flex gap-4"><Info className="w-6 h-6 text-slate-400 shrink-0" /><p className="text-xs text-left text-slate-500 font-medium">Server communication is not configured. Notifications will be available once the system completes setup.</p></div>) : !isSupported ? (<div className="p-6 bg-amber-50 dark:bg-amber-950/20 rounded-[2rem] border border-amber-100 dark:border-amber-900/30 flex gap-4 text-left"><AlertCircle className="w-6 h-6 text-amber-500 shrink-0" /><p className="text-xs text-amber-800 dark:text-amber-400 font-medium">Push notifications are not supported on this device/browser combination.</p></div>) : isSubscribed ? (<div className="p-6 bg-emerald-50 dark:bg-emerald-500/10 rounded-3xl border border-emerald-500/20 flex items-center justify-center gap-3"><CheckCircle2 className="w-5 h-5 text-emerald-500" /><span className="text-sm font-bold text-emerald-600">Notifications are enabled!</span></div>) : (<div className="space-y-3"><Button onClick={() => handleNotificationsNext(false)} disabled={pushLoading} className="w-full h-16 rounded-2xl gap-3 text-xl shadow-xl shadow-primary/30">{pushLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Globe className="w-6 h-6" />}Enable Notifications</Button>{permissionState === 'denied' && <p className="text-[10px] text-rose-500 font-bold uppercase tracking-tight">Access blocked in browser settings</p>}</div>)}</div></div></div>)}
              {currentStep.id === 'features' && (<div className="space-y-10 animate-in slide-in-from-right-4 duration-500"><div className="grid grid-cols-1 sm:grid-cols-3 gap-6">{[{ title: "Browse Features", desc: "Understand platform capabilities.", icon: LayoutGrid }, { title: "Read Updates", desc: "Stay informed on new releases.", icon: Zap }, { title: "Suggest Ideas", desc: "Help us shape the future.", icon: MessageSquare }].map((item, idx) => (<div key={idx} className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-800/40 border dark:border-slate-800 flex flex-col items-center text-center gap-4 hover:border-primary/50 transition-colors"><div className="p-3 bg-white dark:bg-slate-900 rounded-2xl shadow-sm"><item.icon className="w-6 h-6 text-primary" /></div><div className="space-y-1"><p className="font-bold text-sm dark:text-white">{item.title}</p><p className="text-[10px] text-slate-500 dark:text-slate-400">{item.desc}</p></div></div>))}</div><div className="flex flex-col items-center gap-4 pt-4"><Button variant="outline" onClick={() => window.open('/app-updates', '_blank')} className="rounded-xl h-12 px-8 border-primary/20 text-primary hover:bg-primary/5">Open Features Catalog <ExternalLink className="w-4 h-4 ml-2" /></Button><p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Available anytime from the sidebar</p></div></div>)}
              {currentStep.id === 'finish' && (<div className="space-y-8 animate-in slide-in-from-right-4 duration-500"><div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><button onClick={() => handleFinalFinish('/tasks?new=true')} className="p-6 rounded-[2rem] bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 hover:border-blue-500 transition-all text-left flex items-center gap-4 group/action"><div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl group-hover/action:bg-blue-500 group-hover/action:text-white transition-all"><Plus className="w-6 h-6" /></div><div><p className="font-bold dark:text-white">Create first task</p><p className="text-[10px] text-slate-500">Start organizing work</p></div><ChevronRight className="w-4 h-4 ml-auto text-slate-300 opacity-0 group-hover/action:opacity-100 transition-all" /></button><button onClick={() => handleFinalFinish('/notes?new=true')} className="p-6 rounded-[2rem] bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 hover:border-amber-500 transition-all text-left flex items-center gap-4 group/action"><div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-2xl group-hover/action:bg-amber-500 group-hover/action:text-white transition-all"><StickyNote className="w-6 h-6" /></div><div><p className="font-bold dark:text-white">Capture a note</p><p className="text-[10px] text-slate-500">Save your initial thoughts</p></div><ChevronRight className="w-4 h-4 ml-auto text-slate-300 opacity-0 group-hover/action:opacity-100 transition-all" /></button><button onClick={() => handleFinalFinish('/chat')} className="p-6 rounded-[2rem] bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 hover:border-emerald-500 transition-all text-left flex items-center gap-4 group/action"><div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl group-hover/action:bg-emerald-500 group-hover/action:text-white transition-all"><MessageSquare className="w-6 h-6" /></div><div><p className="font-bold dark:text-white">Say hello</p><p className="text-[10px] text-slate-500">Open General Chat</p></div><ChevronRight className="w-4 h-4 ml-auto text-slate-300 opacity-0 group-hover/action:opacity-100 transition-all" /></button><button onClick={() => handleFinalFinish('/dashboard')} className="p-6 rounded-[2rem] bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 hover:border-primary transition-all text-left flex items-center gap-4 group/action"><div className="p-4 bg-primary/10 rounded-2xl group-hover/action:bg-primary group-hover/action:text-white transition-all"><LayoutGrid className="w-6 h-6" /></div><div><p className="font-bold dark:text-white">Go to Dashboard</p><p className="text-[10px] text-slate-500">Full system overview</p></div><ChevronRight className="w-4 h-4 ml-auto text-slate-300 opacity-0 group-hover/action:opacity-100 transition-all" /></button></div></div>)}
            </CardContent>
            <CardFooter className="p-8 sm:p-12 border-t dark:border-slate-800 flex flex-col sm:flex-row justify-between gap-6 relative z-10 bg-slate-50/30 dark:bg-slate-950/20 backdrop-blur-sm"><Button variant="ghost" onClick={handleBack} disabled={currentStepIndex === 0 || saving} className="rounded-2xl h-14 sm:h-16 px-8 sm:px-10 font-bold text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-all"><ChevronLeft className="w-5 h-5 mr-3" /> Back</Button><div className="flex flex-col sm:flex-row gap-4">{(currentStep.id === 'teams' || currentStep.id === 'invite' || currentStep.id === 'install' || currentStep.id === 'notifications' || currentStep.id === 'features') && (<Button variant="ghost" onClick={() => { if (currentStep.id === 'teams') handleTeamsSave(true); else if (currentStep.id === 'invite') handleInviteNext(); else if (currentStep.id === 'install') handleInstallNext(true); else if (currentStep.id === 'notifications') handleNotificationsNext(true); else handleFeaturesNext(); }} disabled={saving} className="rounded-2xl h-14 sm:h-16 px-8 sm:px-10 font-bold text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">Skip for now</Button>)}<Button onClick={handleNext} disabled={saving || pushLoading || (currentStep.id === 'workspace' && workspaceMode === 'choice')} className="rounded-2xl h-14 sm:h-16 px-12 sm:px-16 shadow-2xl shadow-primary/30 font-black text-lg sm:text-xl transition-all active:scale-95 group/btn">{saving || pushLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <>{currentStepIndex === ONBOARDING_STEPS.length - 1 ? 'Go to Dashboard' : (currentStep.id === 'workspace' && workspaceMode === 'join' ? 'Join Workspace' : currentStep.id === 'workspace' && workspaceMode === 'create' ? 'Create Workspace' : currentStep.id === 'teams' ? 'Launch Teams' : currentStep.id === 'install' ? (isStandalone ? 'Continue' : 'Install App') : currentStep.id === 'notifications' ? (isSubscribed ? 'Continue' : 'Enable Setup') : currentStep.id === 'features' ? 'Got it, Continue' : 'Next Step')}{currentStepIndex !== ONBOARDING_STEPS.length - 1 && <ChevronRight className="w-6 h-6 ml-3 group-hover/btn:translate-x-1 transition-transform" />}</>}</Button></div></CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWorkspace, WorkspaceProvider } from "@/components/providers/WorkspaceProvider";
import { FloatingChatProvider } from "@/components/chat/FloatingChatProvider";
import { PushNotificationProvider } from "@/components/providers/PushNotificationProvider";
import { PwaInstallProvider } from "@/components/providers/PwaInstallProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
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
  Flag 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const ONBOARDING_STEPS = [
  { id: 'welcome', title: 'Welcome', description: 'Welcome to WorkspaceZ', icon: Sparkles },
  { id: 'profile', title: 'Profile', description: 'Set up your identity', icon: User },
  { id: 'workspace', title: 'Workspace', description: 'Create or join a team', icon: Layout },
  { id: 'install', title: 'Install App', description: 'Get the best experience', icon: Smartphone },
  { id: 'notifications', title: 'Notifications', description: 'Stay in the loop', icon: Bell },
  { id: 'features', title: 'Updates & Features', description: 'Explore what is new', icon: Flag },
  { id: 'finish', title: 'Finish', description: 'You are all set!', icon: Check },
];

function OnboardingContent() {
  const { loading, workspaces } = useWorkspace();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const router = useRouter();

  useEffect(() => {
    // If user already has a workspace, skip onboarding foundation
    if (!loading && workspaces && workspaces.length > 0) {
      router.replace('/dashboard');
    }
  }, [loading, workspaces, router]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-slate-50 dark:bg-slate-950">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Loading Journey...</p>
      </div>
    );
  }

  const currentStep = ONBOARDING_STEPS[currentStepIndex];
  const progress = ((currentStepIndex + 1) / ONBOARDING_STEPS.length) * 100;

  const handleNext = () => {
    if (currentStepIndex < ONBOARDING_STEPS.length - 1) {
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

  const StepIcon = currentStep.icon;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="w-full max-w-5xl mx-auto py-12 px-6 space-y-12 animate-in fade-in duration-700">
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-2xl shadow-inner">
                <img src="/brand/logomark.png" alt="Z" className="w-8 h-8 object-contain" />
              </div>
              <div>
                <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">Start your journey</h1>
                <p className="text-xs text-muted-foreground font-bold uppercase tracking-[0.2em]">WorkspaceZ Foundation</p>
              </div>
            </div>
            <div className="md:text-right space-y-1">
              <p className="text-lg font-extrabold text-primary">{Math.round(progress)}%</p>
              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Step {currentStepIndex + 1} of {ONBOARDING_STEPS.length}</p>
            </div>
          </div>
          <Progress value={progress} className="h-2.5 bg-slate-100 dark:bg-slate-800" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border dark:border-slate-800 p-8 shadow-xl">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-8 px-2">Setup Progress</h3>
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
                  <Badge variant="secondary" className="bg-primary/5 text-primary border-none uppercase text-[10px] px-4 py-1 font-bold tracking-[0.2em]">Module {currentStepIndex + 1}</Badge>
                </div>
                <CardTitle className="text-4xl font-black tracking-tight text-slate-900 dark:text-white leading-tight">
                  {currentStep.title}
                </CardTitle>
                <CardDescription className="text-xl font-medium text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                  {currentStep.description}
                </CardDescription>
              </CardHeader>
              
              <CardContent className="p-12 pt-8 flex-1 flex flex-col items-center justify-center text-center relative z-10">
                <div className="p-16 rounded-[4rem] bg-slate-50 dark:bg-slate-800/40 mb-12 border dark:border-slate-800 shadow-inner group-hover:scale-105 transition-transform duration-700">
                  <StepIcon className="w-24 h-20 text-slate-300 dark:text-slate-700 animate-pulse" />
                </div>
                <div className="max-w-md space-y-6">
                  <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">
                    Onboarding Step Ready
                  </h2>
                  <p className="text-slate-500 dark:text-slate-400 leading-relaxed text-lg">
                    We're building your WorkspaceZ environment. 
                    The interactive logic for <strong>{currentStep.title}</strong> will be implemented 
                    in the next development phase.
                  </p>
                </div>
              </CardContent>

              <CardFooter className="p-12 border-t dark:border-slate-800 flex flex-col sm:flex-row justify-between gap-6 relative z-10 bg-slate-50/30 dark:bg-slate-950/20 backdrop-blur-sm">
                <Button 
                  variant="ghost" 
                  onClick={handleBack} 
                  disabled={currentStepIndex === 0}
                  className="rounded-2xl h-16 px-10 font-bold text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-all"
                >
                  <ChevronLeft className="w-5 h-5 mr-3" /> Previous
                </Button>
                
                <Button 
                  onClick={handleNext}
                  className="rounded-2xl h-16 px-16 shadow-2xl shadow-primary/30 font-black text-xl transition-all active:scale-95 group/btn"
                >
                  {currentStepIndex === ONBOARDING_STEPS.length - 1 ? 'Go to Dashboard' : 'Next Step'}
                  {currentStepIndex !== ONBOARDING_STEPS.length - 1 && <ChevronRight className="w-6 h-6 ml-3 group-hover/btn:translate-x-1 transition-transform" />}
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <WorkspaceProvider>
      <PwaInstallProvider>
        <FloatingChatProvider>
          <PushNotificationProvider>
            <OnboardingContent />
          </PushNotificationProvider>
        </FloatingChatProvider>
      </PwaInstallProvider>
    </WorkspaceProvider>
  );
}

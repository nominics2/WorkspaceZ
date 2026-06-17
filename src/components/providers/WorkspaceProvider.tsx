"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, usePathname } from 'next/navigation';

interface Workspace {
  id: string;
  name: string;
  join_code: string;
}

interface WorkspaceContextType {
  activeWorkspace: Workspace | null;
  workspaces: Workspace[];
  userProfile: any | null;
  loading: boolean;
  switchWorkspace: (id: string) => void;
  refreshWorkspaces: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [userProfile, setUserProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const router = useRouter();
  const pathname = usePathname();

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (pathname !== '/' && !pathname.startsWith('/onboarding') && pathname !== '/workspace-setup') {
          router.push('/');
        }
        setLoading(false);
        return;
      }

      // Fetch Profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      setUserProfile(profile);

      // Fetch Workspaces
      const { data: members, error } = await supabase
        .from('workspace_members')
        .select(`
          workspace_id,
          role,
          workspaces (
            id,
            name,
            join_code
          )
        `)
        .eq('user_id', user.id)
        .eq('status', 'active');

      if (error) throw error;

      const wsList = (members as any[]).map(m => m.workspaces).filter(Boolean);
      setWorkspaces(wsList);

      if (wsList.length > 0) {
        if (!activeWorkspace) {
          setActiveWorkspace(wsList[0]);
        }
      } else if (pathname !== '/workspace-setup' && !pathname.startsWith('/onboarding') && pathname !== '/') {
        router.push('/workspace-setup');
      }
    } catch (err) {
      console.error('Error fetching workspace data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    
    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') {
        fetchData();
      } else if (event === 'SIGNED_OUT') {
        setActiveWorkspace(null);
        setWorkspaces([]);
        setUserProfile(null);
        router.push('/');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [pathname]);

  const switchWorkspace = (id: string) => {
    const ws = workspaces.find(w => w.id === id);
    if (ws) setActiveWorkspace(ws);
  };

  return (
    <WorkspaceContext.Provider value={{ 
      activeWorkspace, 
      workspaces, 
      userProfile, 
      loading, 
      switchWorkspace, 
      refreshWorkspaces: fetchData 
    }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
};

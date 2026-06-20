"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, usePathname } from 'next/navigation';

interface Workspace {
  id: string;
  name: string;
  join_code: string;
}

type ThemePreference = 'light' | 'dark' | 'system';

interface WorkspaceContextType {
  activeWorkspace: Workspace | null;
  workspaces: Workspace[];
  userProfile: any | null;
  userRole: string | null;
  isVerified: boolean;
  permissions: string[];
  loading: boolean;
  switchWorkspace: (id: string) => void;
  refreshWorkspaces: () => Promise<void>;
  hasPermission: (permissionKey: string) => boolean;
  themePreference: ThemePreference;
  setThemePreference: (theme: ThemePreference) => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [userProfile, setUserProfile] = useState<any | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>('system');
  const supabase = createClient();
  const router = useRouter();
  const pathname = usePathname();

  const applyTheme = useCallback((theme: ThemePreference) => {
    if (typeof window === 'undefined') return;

    const root = window.document.documentElement;
    let effectiveTheme = theme;

    if (theme === 'system') {
      effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    if (effectiveTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        if (pathname !== '/' && !pathname.startsWith('/onboarding') && pathname !== '/workspace-setup') {
          router.push('/');
        }
        setLoading(false);
        return;
      }

      const user = session.user;

      // Fetch Profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      setUserProfile(profile);
      
      if (profile?.theme_preference) {
        setThemePreferenceState(profile.theme_preference as ThemePreference);
        applyTheme(profile.theme_preference as ThemePreference);
      }

      // Fetch Workspace Memberships
      const { data: members, error } = await supabase
        .from('workspace_members')
        .select(`
          workspace_id,
          role,
          is_verified,
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
        const currentWsId = typeof window !== 'undefined' ? localStorage.getItem('last_workspace_id') : null;
        const currentWs = (currentWsId ? wsList.find(w => w.id === currentWsId) : wsList[0]) || wsList[0];
        
        setActiveWorkspace(currentWs);

        // Get role for the active workspace
        const currentMembership = members.find(m => m.workspace_id === currentWs.id);
        const role = currentMembership?.role || 'member';
        setUserRole(role);
        setIsVerified(!!currentMembership?.is_verified);

        // Fetch Permissions for this role in this workspace
        if (role === 'superadmin') {
          setPermissions(['all']);
        } else {
          const { data: perms } = await supabase
            .from('workspace_role_permissions')
            .select('permission_key')
            .eq('workspace_id', currentWs.id)
            .eq('role', role)
            .eq('enabled', true);
          
          setPermissions(perms?.map(p => p.permission_key) || []);
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

  const setThemePreference = async (theme: ThemePreference) => {
    if (!userProfile) return;
    
    setThemePreferenceState(theme);
    applyTheme(theme);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ theme_preference: theme })
        .eq('id', userProfile.id);
      
      if (error) throw error;
    } catch (err) {
      console.error('Error saving theme preference:', err);
    }
  };

  useEffect(() => {
    fetchData();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') {
        fetchData();
      } else if (event === 'SIGNED_OUT') {
        setActiveWorkspace(null);
        setWorkspaces([]);
        setUserProfile(null);
        setUserRole(null);
        setIsVerified(false);
        setPermissions([]);
        router.push('/');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [pathname]);

  // Presence Heartbeat: Call update_my_last_seen periodically
  useEffect(() => {
    if (!userProfile) return;

    const updateLastSeen = async () => {
      try {
        await supabase.rpc('update_my_last_seen');
      } catch (err) {
        console.error("Error updating last seen heartbeat:", err);
      }
    };

    // Immediate ping
    updateLastSeen();

    // Occasional heartbeat every 2 minutes
    const interval = setInterval(updateLastSeen, 120000);

    // Visibility change triggers (re-focusing tab)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' || document.visibilityState === 'hidden') {
        updateLastSeen();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [userProfile, supabase]);

  // Listen for system theme changes
  useEffect(() => {
    if (themePreference !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => applyTheme('system');

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [themePreference, applyTheme]);

  const switchWorkspace = (id: string) => {
    const ws = workspaces.find(w => w.id === id);
    if (ws) {
      localStorage.setItem('last_workspace_id', id);
      setActiveWorkspace(ws);
      fetchData();
    }
  };

  const hasPermission = (key: string) => {
    if (userRole === 'superadmin') return true;
    return permissions.includes(key);
  };

  return (
    <WorkspaceContext.Provider value={{ 
      activeWorkspace, 
      workspaces, 
      userProfile, 
      userRole,
      isVerified,
      permissions,
      loading, 
      switchWorkspace, 
      refreshWorkspaces: fetchData,
      hasPermission,
      themePreference,
      setThemePreference
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

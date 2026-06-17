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
  userRole: string | null;
  permissions: string[];
  loading: boolean;
  switchWorkspace: (id: string) => void;
  refreshWorkspaces: () => Promise<void>;
  hasPermission: (permissionKey: string) => boolean;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [userProfile, setUserProfile] = useState<any | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const router = useRouter();
  const pathname = usePathname();

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

      // Fetch Workspace Memberships
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
        const currentWs = activeWorkspace || wsList[0];
        setActiveWorkspace(currentWs);

        // Get role for the active workspace
        const currentMembership = members.find(m => m.workspace_id === currentWs.id);
        const role = currentMembership?.role || 'member';
        setUserRole(role);

        // Fetch Permissions for this role in this workspace
        if (role === 'superadmin') {
          setPermissions(['all']); // Superadmin has pseudo-permission 'all'
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
        setPermissions([]);
        router.push('/');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [pathname]);

  const switchWorkspace = (id: string) => {
    const ws = workspaces.find(w => w.id === id);
    if (ws) {
      setActiveWorkspace(ws);
      // fetchData will re-run via pathname dependency if needed, 
      // but manually calling it ensures role/perms update immediately
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
      permissions,
      loading, 
      switchWorkspace, 
      refreshWorkspaces: fetchData,
      hasPermission
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

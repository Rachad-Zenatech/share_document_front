import React, { createContext, useCallback, useContext, useEffect, useState, useRef } from 'react';
import { apiClient } from '../services/apiClient';

export interface User {
  id: string;
  email: string;
  full_name: string;
  is_super_admin: boolean;
  is_active?: boolean;
  department?: string;
  job_title?: string;
}

export interface Role {
  id: string;
  name: string;
  code: string;
  description?: string;
  is_active?: boolean;
  is_system_role?: boolean;
  parent_role_id?: string | null;
  display_order?: number;
  department?: string;
  children?: Role[];
}

interface PermissionsData {
  user: User;
  roles: Role[];
  workflow_roles?: string[];
  navigation_permissions: Record<string, string[]>;
  mcp_tool_permissions: string[];
}

interface AuthContextType {
  user: User | null;
  roles: Role[];
  workflow_roles: string[];
  isLoading: boolean;
  canAccessNavigationItem: (navigationCode: string, actionCode?: string) => boolean;
  hasPermission: (permissionCode: string) => boolean;
  canUseMcpTool: (toolCode: string) => boolean;
  hasRole: (roleCode: string) => boolean;
  logout: () => Promise<void>;
  refreshPermissions: () => Promise<PermissionsData | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [permissions, setPermissions] = useState<PermissionsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchRequestId = useRef(0);

  const fetchPermissions = useCallback(async () => {
    const requestId = ++fetchRequestId.current;
    setIsLoading(true);
    try {
      const data = await apiClient.get<PermissionsData>('/api/me/permissions');
      if (requestId === fetchRequestId.current) {
        setPermissions(data);
      }
      return data;
    } catch {
      if (requestId === fetchRequestId.current) {
        setPermissions(null);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('ms_id_token');
        sessionStorage.clear();
      }
      return null;
    } finally {
      if (requestId === fetchRequestId.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchPermissions();

    const handleBeforeUnload = () => {
      const token = sessionStorage.getItem('token');
      if (token) {
        const data = new FormData();
        data.append('token', token);
        const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
        const url = `${baseUrl.replace(/\/$/, '')}/api/auth/logout`;
        navigator.sendBeacon(url, data);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [fetchPermissions]);



  const canAccessNavigationItem = (navigationCode: string, actionCode = 'VIEW') => {
    if (!permissions) return false;
    if (permissions.user.is_super_admin) return true;
    if (permissions.roles.some((r) => r.code === 'SUPER_ADMIN')) return true;
    
    const pageActions = permissions.navigation_permissions[navigationCode];
    if (!pageActions) return false;
    
    return pageActions.includes(actionCode);
  };

  const hasPermission = (permissionCode: string) => {
    if (!permissions) return false;
    if (permissions.user.is_super_admin) return true;
    if (permissions.roles.some((r) => r.code === 'SUPER_ADMIN')) return true;
    
    const lastUnderscoreIndex = permissionCode.lastIndexOf('_');
    let navigationCode = permissionCode;
    let actionCode = 'PAGE_ACCESS';
    
    if (lastUnderscoreIndex !== -1) {
      navigationCode = permissionCode.substring(0, lastUnderscoreIndex);
      actionCode = permissionCode.substring(lastUnderscoreIndex + 1);
    }
    
    const actionMap: Record<string, string> = {
      "READ": "VIEW",
      "UPDATE": "UPDATE",
      "CREATE": "CREATE",
      "DELETE": "DELETE",
      "IMPORT": "CREATE",
      "EXPORT": "VIEW",
      "PROCESS": "UPDATE",
      "PAGE_ACCESS": "VIEW"
    };
    
    const dbActionCode = actionMap[actionCode] || actionCode;
    const pageActions = permissions.navigation_permissions[navigationCode];
    
    if (!pageActions) return false;
    return pageActions.includes(dbActionCode);
  };

  const canUseMcpTool = (toolCode: string) => {
    if (!permissions) return false;
    if (permissions.user.is_super_admin) return true;
    if (permissions.roles.some((r) => r.code === 'SUPER_ADMIN')) return true;
    
    return permissions.mcp_tool_permissions.includes(toolCode);
  };

  const hasRole = (roleCode: string) => {
    if (!permissions) return false;
    return permissions.roles.some((r) => r.code === roleCode);
  };

  const logout = async () => {

    try {
      await apiClient.post('/api/auth/logout', {});
    } catch (e) {
      console.error('Failed to logout on backend', e);
    }
    

    
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('ms_id_token');
    sessionStorage.removeItem('auth_provider');
    setPermissions(null);
    
    // Always perform SSO logout redirect
    const postLogoutUri = encodeURIComponent(window.location.origin + '/login');
    window.location.href = `https://login.microsoftonline.com/common/oauth2/v2.0/logout?post_logout_redirect_uri=${postLogoutUri}`;
  };

  return (
    <AuthContext.Provider
      value={{
        user: permissions?.user || null,
        roles: permissions?.roles || [],
        workflow_roles: permissions?.workflow_roles || [],
        isLoading,
        canAccessNavigationItem,
        hasPermission,
        canUseMcpTool,
        hasRole,
        logout,
        refreshPermissions: fetchPermissions,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

import React from 'react';
import { Navigate, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { Loader2, ShieldAlert, ArrowLeft } from 'lucide-react';
import { Button } from './ui/button';

interface ProtectedRouteProps {
  navigationCode?: string;
  actionCode?: string;
  children?: React.ReactNode;
}

export default function ProtectedRoute({ navigationCode, actionCode = 'VIEW', children }: ProtectedRouteProps) {
  const { user, roles, isLoading, hasPermission } = useAuth();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50 dark:bg-zinc-950">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Check if user is pending (has only PENDING_USER role or no roles)
  const isPending = !user.is_super_admin && (
    roles.length === 0 || 
    roles.every(r => r.code === 'PENDING_USER')
  );

  if (isPending) {
    return <Navigate to="/pending-access" replace />;
  }

  const actionMap: Record<string, string> = {
    "VIEW": "READ",
    "CREATE": "CREATE",
    "EDIT": "UPDATE",
    "UPDATE": "UPDATE",
    "DELETE": "DELETE"
  };
  const mappedAction = actionMap[actionCode] || actionCode;
  const permissionCode = navigationCode ? `${navigationCode}_${mappedAction}` : null;

  if (permissionCode && !hasPermission(permissionCode)) {
    return (
      <div className="flex flex-col items-center justify-center p-8 sm:p-12 text-center bg-card rounded-xl border border-border shadow-xs my-6 max-w-lg mx-auto">
        <div className="w-14 h-14 bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mb-4">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-foreground mb-1.5">Access Denied</h2>
        <p className="text-sm text-muted-foreground mb-6 max-w-md">
          You do not have permission (<code className="font-mono text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 px-1.5 py-0.5 rounded">{permissionCode}</code>) to view this page. If you believe this is an error, please contact your system administrator.
        </p>
        <Button onClick={() => navigate("/dashboard")} variant="outline" className="gap-2 text-xs">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Dashboard</span>
        </Button>
      </div>
    );
  }

  return <>{children ? children : <Outlet />}</>;
}

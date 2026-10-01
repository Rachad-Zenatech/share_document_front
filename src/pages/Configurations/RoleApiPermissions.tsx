import { useState, useEffect, useMemo } from "react";
import HelpIcon from "@/components/ui/HelpIcon";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/services/apiClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Check, Loader2, ArrowUpDown, Search } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/AuthContext";
import type { Role } from "@/lib/AuthContext";
import { useSearchParams } from "react-router-dom";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const EXCLUDED_MODULE_CODES = [
  "AUDIT_LOG",
  "LOGIN_ACTIVITIES",
  "LOGGED_APIS",
  "CONFIG_ROLE_PAGE_PERMISSIONS",
  "CONFIG_ROLE_MCP_TOOL_PERMISSIONS",
  "CONFIG_ROLE_API_PERMISSIONS",
];

// We order actions so they appear logically: CREATE, READ (VIEW), UPDATE, DELETE
const ACTION_ORDER: Record<string, number> = {
  "CREATE": 1,
  "VIEW": 2, // We treat VIEW as Read
  "UPDATE": 3,
  "DELETE": 4,
};

const MODULE_ACTION_OVERRIDES: Record<string, string[]> = {
  "UPLOAD_FILES": ["VIEW", "DELETE"],
  "GENERAL_LEDGER_UPLOAD": ["VIEW", "DELETE"],
};

const isActionSupported = (moduleCode: string, actionCode: string) => {
  if (MODULE_ACTION_OVERRIDES[moduleCode]) {
    return MODULE_ACTION_OVERRIDES[moduleCode].includes(actionCode);
  }
  return true;
};

export default function RoleApiPermissions() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(searchParams.get("roleId"));
  const [permissions, setPermissions] = useState<Record<string, Record<string, boolean>>>({});
  
  // Left panel search
  const [roleSearchQuery, setRoleSearchQuery] = useState("");
  // Right panel search
  const [moduleSearchQuery, setModuleSearchQuery] = useState("");

  const { data: roles, isLoading: loadingRoles } = useQuery({
    queryKey: ["roles"],
    queryFn: () => apiClient.get<Role[]>("/api/configuration/roles"),
  });

  const { data: allModules, isLoading: loadingModules } = useQuery({
    queryKey: ["navigation-items"],
    queryFn: () => apiClient.get<any[]>("/api/configuration/navigation-items"),
  });

  const { data: allActions, isLoading: loadingActions } = useQuery({
    queryKey: ["actions"],
    queryFn: () => apiClient.get<any[]>("/api/configuration/actions"),
  });

  const { data: rolePermissions, isLoading: loadingRolePermissions } = useQuery({
    queryKey: ["roleNavigationPermissions", selectedRoleId],
    queryFn: () => apiClient.get<any[]>(`/api/configuration/roles/${selectedRoleId}/navigation-permissions`),
    enabled: !!selectedRoleId,
  });

  // Filter out excluded modules
  const modules = useMemo(() => {
    if (!allModules) return [];
    return allModules.filter(m => !EXCLUDED_MODULE_CODES.includes(m.code));
  }, [allModules]);

  const actions = useMemo(() => {
    if (!allActions) return [];
    // Filter out VIEW because it is handled by Role Navigation Permissions
    const filteredActions = allActions.filter(a => a.code !== "VIEW");
    // Sort actions according to ACTION_ORDER
    return filteredActions.sort((a, b) => {
      const orderA = ACTION_ORDER[a.code] || 99;
      const orderB = ACTION_ORDER[b.code] || 99;
      return orderA - orderB;
    });
  }, [allActions]);

  // Hydrate local state from DB
  useEffect(() => {
    if (modules.length > 0 && actions.length > 0 && selectedRoleId) {
      const state: Record<string, Record<string, boolean>> = {};
      modules.forEach(p => {
        state[p.id] = {};
        actions.forEach(a => {
          state[p.id][a.id] = false;
        });
      });

      if (rolePermissions) {
        rolePermissions.forEach(rp => {
          if (state[rp.navigation_item_id] && state[rp.navigation_item_id][rp.action_id] !== undefined) {
            state[rp.navigation_item_id][rp.action_id] = rp.is_allowed;
          }
        });
      }
      setPermissions(state);
    }
  }, [modules, actions, rolePermissions, selectedRoleId]);

  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>({ key: 'name', direction: 'asc' });

  const sortedModules = useMemo(() => {
    if (!modules) return [];
    let sortableItems = [...modules.filter(p => p.is_active)];
    
    if (moduleSearchQuery.trim()) {
      const lowerQuery = moduleSearchQuery.toLowerCase();
      sortableItems = sortableItems.filter(p => 
        p.name.toLowerCase().includes(lowerQuery) || 
        p.code.toLowerCase().includes(lowerQuery)
      );
    }

    if (sortConfig !== null) {
      sortableItems.sort((a: any, b: any) => {
        let aValue = a[sortConfig.key] || "";
        let bValue = b[sortConfig.key] || "";
        
        if (typeof aValue === 'string') aValue = aValue.toLowerCase();
        if (typeof bValue === 'string') bValue = bValue.toLowerCase();

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [modules, sortConfig, moduleSearchQuery]);

  const filteredRoles = useMemo(() => {
    if (!roles) return [];
    const activeRoles = roles.filter(r => r.is_active);
    if (!roleSearchQuery.trim()) return activeRoles;
    
    const lower = roleSearchQuery.toLowerCase();
    return activeRoles.filter(r => 
      r.name.toLowerCase().includes(lower) || 
      r.code.toLowerCase().includes(lower)
    );
  }, [roles, roleSearchQuery]);

  const requestSort = (key: string) => {
    setSortConfig({ key, direction: 'asc' });
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      // Fetch current db state first, so we only merge our updates, avoiding deleting stuff we excluded (like Audit Logs)
      return apiClient.get<any[]>(`/api/configuration/roles/${selectedRoleId}/navigation-permissions`).then(existingPerms => {
          // Keep existing perms that are for excluded modules, because our UI doesn't edit them
          const finalPayload: any[] = [];
          const existingMap = new Map();
          
          existingPerms.forEach(rp => {
            existingMap.set(`${rp.navigation_item_id}_${rp.action_id}`, rp.is_allowed);
          });
          
          // Re-add everything we are NOT managing here
          existingPerms.forEach(rp => {
             const mod = allModules?.find(m => m.id === rp.navigation_item_id);
             if (mod && EXCLUDED_MODULE_CODES.includes(mod.code)) {
                 finalPayload.push({
                    navigation_item_id: rp.navigation_item_id,
                    action_id: rp.action_id,
                    is_allowed: rp.is_allowed
                 });
             }
          });

          // Add our new state
          Object.keys(permissions).forEach(moduleId => {
            Object.keys(permissions[moduleId]).forEach(actionId => {
              finalPayload.push({
                navigation_item_id: moduleId,
                action_id: actionId,
                is_allowed: permissions[moduleId][actionId]
              });
            });
          });

          return apiClient.put(`/api/configuration/roles/${selectedRoleId}/navigation-permissions`, finalPayload);
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roleNavigationPermissions", selectedRoleId] });
      toast.success("API permissions saved successfully");
    },
    onError: () => toast.error("Failed to save API permissions"),
  });

  const togglePermission = (moduleId: string, actionId: string) => {
    setPermissions(prev => ({
      ...prev,
      [moduleId]: {
        ...prev[moduleId],
        [actionId]: !prev[moduleId][actionId]
      }
    }));
  };

  const handleRoleSelect = (id: string) => {
    setSelectedRoleId(id);
    setSearchParams({ roleId: id });
  };

  if (loadingRoles || loadingModules || loadingActions) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const selectedRole = roles?.find(r => r.id === selectedRoleId);

  // We only allow editing if they have CONFIG_ROLE_API_PERMISSIONS EDIT
  const canEdit = hasPermission("CONFIG_ROLE_API_PERMISSIONS_UPDATE");

  return (
    <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out p-6 w-full">
      
      {/* Left Panel: Roles List */}
      <div className="w-full lg:w-80 flex-shrink-0 flex flex-col gap-4 lg:border-r border-slate-200 dark:border-zinc-800 lg:pr-6 pb-6 lg:pb-0 border-b lg:border-b-0 min-h-0">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">Roles</h2>
          <p className="text-sm text-slate-500 dark:text-zinc-400">Select a role to configure API access.</p>
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500 dark:text-zinc-400" />
          <Input 
            placeholder="Search roles..." 
            className="pl-9 h-10 bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 focus-visible:ring-blue-500/30 rounded-xl"
            value={roleSearchQuery}
            onChange={(e) => setRoleSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[300px]">
          {filteredRoles.length === 0 ? (
            <div className="text-center p-4 text-slate-500 text-sm">No roles found.</div>
          ) : (
            filteredRoles.map(role => (
              <button
                key={role.id}
                onClick={() => handleRoleSelect(role.id)}
                className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                  selectedRoleId === role.id 
                    ? 'bg-blue-50 border-blue-300 dark:bg-blue-900/20 dark:border-blue-700 ring-1 ring-blue-500/20'
                    : 'bg-white border-slate-200 hover:border-blue-300 dark:bg-zinc-900 dark:border-zinc-800 dark:hover:border-zinc-700'
                }`}
              >
                <div className="font-semibold text-slate-900 dark:text-zinc-100 truncate text-sm">
                  {role.name}
                </div>
                <div className="text-xs text-slate-500 dark:text-zinc-400 truncate mt-0.5">{role.code}</div>
                {role.is_system_role && (
                  <Badge variant="secondary" className="mt-2 text-[9px] h-4 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 px-1.5 uppercase font-bold tracking-wider">
                    System Role
                  </Badge>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right Panel: Permissions Configuration */}
      <div className="flex-1 flex flex-col min-h-0">
        <div>
          <div className="flex items-center gap-2"><h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">Role API Permissions</h2><HelpIcon text="Grant or restrict API routes that are allowed for each specific user role." /></div>
          <p className="text-sm text-slate-500 dark:text-zinc-400">
             {selectedRole ? `Configuring CRUD API permissions for ${selectedRole.name}` : "Select a role from the list to begin."}
          </p>
          <div className="mt-3 p-3 bg-blue-50/80 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-sm text-blue-800 dark:text-blue-300">
              <strong className="font-semibold">Super Admin Override:</strong> Users with the "Super Admin" flag automatically bypass role restrictions and have full access to all rules and modules.
            </p>
          </div>
        </div>

        {selectedRoleId ? (
          <div className="flex-1 min-h-0 flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2 w-full mt-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500 dark:text-zinc-400" />
                <Input 
                  placeholder="Search APIs/Modules..." 
                  className="pl-9 bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 focus-visible:ring-blue-500/30 rounded-xl"
                  value={moduleSearchQuery}
                  onChange={(e) => setModuleSearchQuery(e.target.value)}
                />
              </div>
              {loadingRolePermissions && (
                <div className="flex justify-end text-sm text-slate-500 items-center">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600 mr-2" /> Loading permissions...
                </div>
              )}
            </div>
            
            <div className={`flex-1 min-h-0 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden flex flex-col transition-opacity duration-200 ${loadingRolePermissions || saveMutation.isPending ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
              <div className="flex-1 overflow-y-auto relative">
                <Table>
                  <TableHeader className="bg-slate-50/80 dark:bg-zinc-950/90 ">
                    <TableRow>
                      <TableHead 
                        className="cursor-pointer hover:bg-slate-100 dark:hover:bg-zinc-900 transition-colors bg-inherit"
                        onClick={() => requestSort("name")}
                      >
                        <div className="flex items-center text-slate-900 dark:text-zinc-100 font-semibold">API Module <ArrowUpDown className="ml-2 h-3.5 w-3.5 text-slate-400" /></div>
                      </TableHead>
                      {actions?.map(action => {
                        // Rename VIEW to Read for the UI
                        const label = action.code === 'VIEW' ? 'Read' : action.name;
                        return (
                          <TableHead key={action.id} className="text-center font-semibold text-slate-900 dark:text-zinc-100 bg-inherit min-w-[100px]">
                            {label}
                          </TableHead>
                        );
                      })}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedModules.length === 0 ? (
                       <TableRow>
                          <TableCell colSpan={actions ? actions.length + 1 : 2} className="h-24 text-center text-slate-500">
                             No APIs found matching your search.
                          </TableCell>
                       </TableRow>
                    ) : (
                      sortedModules.map((module, _index) => (
                        <TableRow key={module.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-900/50">
                          <TableCell className="font-medium text-slate-900 dark:text-zinc-200 border-r border-slate-100 dark:border-zinc-800/50">
                            {module.name}
                            <div className="text-[10px] text-slate-500 font-normal uppercase tracking-wider mt-0.5">{module.code}</div>
                          </TableCell>
                          {actions?.map(action => {
                            const supported = isActionSupported(module.code, action.code);
                            return (
                              <TableCell key={action.id} className="text-center border-r border-slate-100 dark:border-zinc-800/50 last:border-r-0">
                                <input 
                                  type="checkbox"
                                  checked={permissions[module.id]?.[action.id] || false}
                                  onChange={() => togglePermission(module.id, action.id)}
                                  disabled={!canEdit || !supported}
                                  className="w-4 h-4 text-blue-600 bg-slate-100 border-slate-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-slate-800 focus:ring-2 dark:bg-slate-700 dark:border-slate-600 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                  title={supported ? "" : "Action not supported for this module"}
                                />
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            {canEdit && (
              <div className="pt-4 flex justify-end">
                <Button 
                  onClick={() => saveMutation.mutate()} 
                  className="w-full sm:w-auto h-11 px-8 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20"
                  disabled={saveMutation.isPending || loadingRolePermissions}
                >
                  {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save API Permissions
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex items-center justify-center mt-6">
             <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-slate-200 dark:border-zinc-800 rounded-2xl bg-slate-50 dark:bg-zinc-900/20 text-center max-w-md mx-auto">
               <div className="w-16 h-16 bg-slate-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-4">
                 <Check className="h-8 w-8 text-slate-300 dark:text-zinc-600" />
               </div>
               <h3 className="text-lg font-bold text-slate-900 dark:text-zinc-100 mb-2">No Role Selected</h3>
               <p className="text-sm text-slate-500 dark:text-zinc-400">Choose a role from the list on the left to view and modify its API access permissions.</p>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}

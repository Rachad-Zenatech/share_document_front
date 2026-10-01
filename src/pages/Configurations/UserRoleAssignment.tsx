import { useState, useEffect, useMemo } from "react";
import HelpIcon from "@/components/ui/HelpIcon";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/services/apiClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Check, Loader2, Search, Folder, FolderOpen, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/AuthContext";
import type { User, Role } from "@/lib/AuthContext";
import { useSearchParams } from "react-router-dom";

export default function UserRoleAssignment() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [selectedUserId, setSelectedUserId] = useState<string | null>(searchParams.get("userId"));
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [userSearchQuery, setUserSearchQuery] = useState("");

  const { data: users, isLoading: loadingUsers } = useQuery({
    queryKey: ["users"],
    queryFn: () => apiClient.get<User[]>("/api/configuration/users"),
  });

  const { data: allRoles, isLoading: loadingRoles } = useQuery({
    queryKey: ["roles"],
    queryFn: () => apiClient.get<Role[]>("/api/configuration/roles"),
  });

  const { data: userRoles, isLoading: loadingUserRoles } = useQuery({
    queryKey: ["userRoles", selectedUserId],
    queryFn: () => apiClient.get<any[]>(`/api/configuration/users/${selectedUserId}/roles`),
    enabled: !!selectedUserId,
  });

  // When userRoles is fetched, populate the selectedRoleId state
  useEffect(() => {
    if (userRoles && userRoles.length > 0) {
      setSelectedRoleId(userRoles[0].id);
    } else {
      setSelectedRoleId(null);
    }
  }, [userRoles]);

  const saveMutation = useMutation({
    mutationFn: () => apiClient.put(`/api/configuration/users/${selectedUserId}/roles`, {
      role_ids: selectedRoleId ? [selectedRoleId] : []
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userRoles", selectedUserId] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("Role assignment saved successfully");
    },
    onError: () => toast.error("Failed to save role assignment"),
  });

  const setRole = (roleId: string) => {
    if (selectedRoleId === roleId) {
      setSelectedRoleId(null); // Allow unselecting
    } else {
      setSelectedRoleId(roleId);
    }
  };

  const handleUserSelect = (id: string) => {
    setSelectedUserId(id);
    setSearchParams({ userId: id });
  };

  const filteredUsers = useMemo(() => {
    if (!users) return [];
    const activeUsers = users.filter(u => u.is_active !== false);
    if (!userSearchQuery.trim()) return activeUsers;
    const lower = userSearchQuery.toLowerCase();
    return activeUsers.filter(u => 
      (u.full_name && u.full_name.toLowerCase().includes(lower)) || 
      u.email.toLowerCase().includes(lower)
    );
  }, [users, userSearchQuery]);

  if (loadingUsers || loadingRoles) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const selectedUser = users?.find(u => u.id === selectedUserId);
  const isSuperAdmin = selectedUser?.is_super_admin === true;
  const activeRoles = allRoles?.filter(r => r.is_active && r.code !== 'PENDING_USER') || [];
  return (
    <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out pb-4 w-full">
      {/* Left Panel: Users List */}
      <div className="w-full lg:w-80 flex-shrink-0 flex flex-col gap-4 lg:border-r border-slate-200 dark:border-zinc-800 lg:pr-6 pb-6 lg:pb-0 border-b lg:border-b-0 min-h-0">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">Users</h2>
          <p className="text-sm text-slate-500 dark:text-zinc-400">Select a user to configure access.</p>
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500 dark:text-zinc-400" />
          <Input 
            placeholder="Search users..." 
            className="pl-9 h-10 bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 focus-visible:ring-blue-500/30 rounded-xl"
            value={userSearchQuery}
            onChange={(e) => setUserSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[300px]">
          {filteredUsers.length === 0 ? (
            <div className="text-center p-4 text-slate-500 text-sm">No users found.</div>
          ) : (
            filteredUsers.map(user => (
              <button
                key={user.id}
                onClick={() => handleUserSelect(user.id)}
                className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                  selectedUserId === user.id 
                    ? 'bg-blue-50 border-blue-300 dark:bg-blue-900/20 dark:border-blue-700 ring-1 ring-blue-500/20'
                    : 'bg-white border-slate-200 hover:border-blue-300 dark:bg-zinc-900 dark:border-zinc-800 dark:hover:border-zinc-700'
                }`}
              >
                <div className="font-semibold text-slate-900 dark:text-zinc-100 truncate text-sm">
                  {user.full_name || user.email.split('@')[0]}
                </div>
                <div className="text-xs text-slate-500 dark:text-zinc-400 truncate mt-0.5">{user.email}</div>
                {user.is_super_admin && (
                  <Badge variant="secondary" className="mt-2 text-[9px] h-4 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 px-1.5 uppercase font-bold tracking-wider">
                    Super Admin
                  </Badge>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right Panel: Role Assignment */}
      <div className="flex-1 flex flex-col min-h-0">
        <div>
          <div className="flex items-center gap-2"><h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">Role Assignment</h2><HelpIcon text="Assign custom roles to specific portal users to control their system access." /></div>
          <p className="text-sm text-slate-500 dark:text-zinc-400">
            {selectedUser ? `Configuring permissions for ${selectedUser.full_name || selectedUser.email}` : "Select a user from the list to begin."}
          </p>
        </div>

        {selectedUserId ? (
          <div className="flex-1 min-h-0 flex flex-col mt-6 gap-4 relative">
            {isSuperAdmin && (
              <div className="p-4 rounded-xl bg-blue-50 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50 text-sm flex items-center mb-2">
                <span className="font-semibold mr-2">Note:</span> This user is a Super Admin and inherently has all permissions. Role assignments are visual only.
              </div>
            )}
            
            <div className={`flex-1 min-h-0 flex flex-col transition-opacity duration-200 ${loadingUserRoles || saveMutation.isPending || isSuperAdmin ? 'opacity-60 pointer-events-none' : 'opacity-100'}`}>
              
              {/* Dropdown for role assignment */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <div className="flex-1 max-w-sm">
                  <label className="text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-1.5 block uppercase tracking-wider">Quick Assign Role</label>
                  <select 
                    value={selectedRoleId || ""}
                    onChange={(e) => {
                      if (e.target.value) setRole(e.target.value);
                    }}
                    className="w-full h-10 px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-slate-900 dark:text-zinc-100 text-sm"
                  >
                    <option value="" disabled>-- Select a role --</option>
                    {activeRoles.map(r => (
                      <option key={r.id} value={r.id}>
                        {selectedRoleId === r.id ? `✓ Selected: ${r.name}` : r.name}
                      </option>
                    ))}
                  </select>
                </div>
                
                {loadingUserRoles && (
                  <div className="flex items-center text-sm text-slate-500 mt-5">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading assignments...
                  </div>
                )}
              </div>

              {/* Tree Diagram Rendering */}
              <div className="flex-1 overflow-y-auto bg-slate-50/50 dark:bg-zinc-900/30 border border-slate-200 dark:border-zinc-800 rounded-xl p-6 relative flex flex-col items-start min-h-[300px]">
                <RoleTree roles={activeRoles} selectedRoleId={selectedRoleId} setRole={setRole} />
              </div>

              {hasPermission("CONFIG_USER_ROLE_ASSIGNMENT_UPDATE") && !isSuperAdmin && (
                <div className="pt-6 flex justify-end">
                  <Button 
                    onClick={() => saveMutation.mutate()} 
                    className="w-full sm:w-auto h-11 px-8 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20"
                    disabled={saveMutation.isPending || loadingUserRoles}
                  >
                    {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Assignment
                  </Button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex items-center justify-center mt-6">
             <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-slate-200 dark:border-zinc-800 rounded-2xl bg-slate-50 dark:bg-zinc-900/20 text-center max-w-md mx-auto">
               <div className="w-16 h-16 bg-slate-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-4">
                 <Check className="h-8 w-8 text-slate-300 dark:text-zinc-600" />
               </div>
               <h3 className="text-lg font-bold text-slate-900 dark:text-zinc-100 mb-2">No User Selected</h3>
               <p className="text-sm text-slate-500 dark:text-zinc-400">Choose a user from the list on the left to view and modify their security role assignments.</p>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Recursive component for Tree Node in UserRoleAssignment
const SelectableTreeNode = ({ 
  role, 
  level, 
  selectedRoleId, 
  onSelect, 
  expandedNodes, 
  toggleNode,
  childrenMap
}: { 
  role: Role; 
  level: number; 
  selectedRoleId: string | null; 
  onSelect: (roleId: string) => void;
  expandedNodes: Set<string>;
  toggleNode: (id: string, e: React.MouseEvent) => void;
  childrenMap: Map<string | null, Role[]>;
}) => {
  const isExpanded = expandedNodes.has(role.id);
  const isSelected = selectedRoleId === role.id;
  const children = childrenMap.get(role.id) || [];
  const hasChildren = children.length > 0;
  
  return (
    <div className="w-full">
      <div 
        className={`relative flex items-center py-2 px-2 rounded-md cursor-pointer group transition-colors ${
          isSelected 
            ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 ring-1 ring-blue-500/20' 
            : 'hover:bg-slate-50 dark:hover:bg-zinc-800/50 text-slate-700 dark:text-zinc-300'
        }`}
        style={{ paddingLeft: `${(level * 16) + 8}px` }}
        onClick={() => onSelect(role.id)}
      >
        <div 
          className={`w-6 h-6 flex items-center justify-center mr-1 rounded hover:bg-slate-200 dark:hover:bg-zinc-700 ${hasChildren ? 'cursor-pointer' : 'opacity-0'}`}
          onClick={(e) => {
            if (hasChildren) toggleNode(role.id, e);
          }}
        >
          {isExpanded ? <ChevronDown className="w-4 h-4 pointer-events-none" /> : <ChevronRight className="w-4 h-4 pointer-events-none" />}
        </div>
        
        {isExpanded ? (
          <FolderOpen className="w-4 h-4 mr-2 text-blue-500 pointer-events-none" />
        ) : (
          <Folder className="w-4 h-4 mr-2 text-blue-500 pointer-events-none" />
        )}
        
        <div className="flex flex-col flex-1 min-w-0 pointer-events-none">
          <span className="text-sm font-medium truncate">
            {role.name}
            {role.is_system_role && (
              <Badge variant="secondary" className={`text-[9px] h-4 px-1.5 ml-2 ${isSelected ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>SYS</Badge>
            )}
          </span>
          {role.description && <span className={`text-[10px] leading-tight mt-0.5 truncate ${isSelected ? 'text-blue-500' : 'text-slate-500 dark:text-zinc-500'}`}>{role.description}</span>}
        </div>
        
        {isSelected && <Check className="w-4 h-4 ml-2 text-blue-600 dark:text-blue-400" />}
      </div>

      {isExpanded && hasChildren && (
        <div className="flex flex-col w-full">
          {children.map(child => (
            <SelectableTreeNode 
              key={child.id} 
              role={child} 
              level={level + 1} 
              selectedRoleId={selectedRoleId} 
              onSelect={onSelect} 
              expandedNodes={expandedNodes} 
              toggleNode={toggleNode} 
              childrenMap={childrenMap}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// Tree Diagram Component
function RoleTree({ roles, selectedRoleId, setRole }: { roles: Role[], selectedRoleId: string | null, setRole: (id: string) => void }) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  const childrenMap = useMemo(() => {
    const map = new Map<string | null, Role[]>();
    
    // Create a set of all valid role IDs to ensure parents exist
    const allRoleIds = new Set(roles.map(r => r.id));

    for (const r of roles) {
      // If the parent ID doesn't exist in our active roles list, treat it as a root node!
      let pid = r.parent_role_id;
      if (!pid || !allRoleIds.has(pid)) {
        pid = null;
      }
      
      if (!map.has(pid)) map.set(pid, []);
      map.get(pid)!.push(r);
    }
    
    // Sort children by display_order, then by name
    for (const arr of map.values()) {
        arr.sort((a, b) => {
            const aOrder = a.display_order ?? 0;
            const bOrder = b.display_order ?? 0;
            if (aOrder !== bOrder) return aOrder - bOrder;
            return a.name.localeCompare(b.name);
        });
    }
    
    return map;
  }, [roles]);

  // Auto-expand all on load
  useEffect(() => {
    if (roles.length > 0 && expandedNodes.size === 0) {
      setExpandedNodes(new Set(roles.map(r => r.id)));
    }
  }, [roles]);

  const toggleNode = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedNodes(newExpanded);
  };

  const rootRoles = childrenMap.get(null) || [];

  if (roles.length === 0) {
    return <div className="text-sm text-slate-500 italic p-4">No active roles available to assign.</div>;
  }

  if (rootRoles.length === 0) {
    return <div className="text-sm text-red-500 italic p-4">Error: Could not render role hierarchy.</div>;
  }

  return (
    <div className="flex flex-col w-full min-h-full pb-8">
      <div className="relative z-10 flex flex-col">
        {rootRoles.map((root) => (
          <SelectableTreeNode
            key={root.id}
            role={root}
            level={0}
            selectedRoleId={selectedRoleId}
            onSelect={setRole}
            expandedNodes={expandedNodes}
            toggleNode={toggleNode}
            childrenMap={childrenMap}
          />
        ))}
      </div>
    </div>
  );
}

import { useState, useEffect, useMemo } from "react";
import HelpIcon from "@/components/ui/HelpIcon";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/services/apiClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Check, Loader2, ArrowUpDown, Search, Wrench } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/AuthContext";
import type { Role } from "@/lib/AuthContext";
import { useSearchParams } from "react-router-dom";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function RoleMcpToolPermissions() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(searchParams.get("roleId"));
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  
  // Left panel search
  const [roleSearchQuery, setRoleSearchQuery] = useState("");
  // Right panel search
  const [toolSearchQuery, setToolSearchQuery] = useState("");

  const { data: roles, isLoading: loadingRoles } = useQuery({
    queryKey: ["roles"],
    queryFn: () => apiClient.get<Role[]>("/api/configuration/roles"),
  });

  const { data: mcpTools, isLoading: loadingTools } = useQuery({
    queryKey: ["mcpTools"],
    queryFn: () => apiClient.get<any[]>("/api/configuration/mcp-tools"),
  });

  const { data: rolePermissions, isLoading: loadingRolePermissions } = useQuery({
    queryKey: ["roleMcpPermissions", selectedRoleId],
    queryFn: () => apiClient.get<any[]>(`/api/configuration/roles/${selectedRoleId}/mcp-tool-permissions`),
    enabled: !!selectedRoleId,
  });

  // Hydrate local state from DB
  useEffect(() => {
    if (mcpTools && selectedRoleId) {
      const state: Record<string, boolean> = {};
      mcpTools.forEach(t => {
        state[t.id] = false;
      });

      if (rolePermissions) {
        rolePermissions.forEach(rp => {
          if (state[rp.mcp_tool_id] !== undefined) {
            state[rp.mcp_tool_id] = rp.is_allowed;
          }
        });
      }
      setPermissions(state);
    }
  }, [mcpTools, rolePermissions, selectedRoleId]);

  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>({ key: 'name', direction: 'asc' });

  const sortedTools = useMemo(() => {
    if (!mcpTools) return [];
    let sortableItems = [...mcpTools.filter(t => t.is_active)];

    if (toolSearchQuery.trim()) {
      const lowerQuery = toolSearchQuery.toLowerCase();
      sortableItems = sortableItems.filter(t => 
        t.name.toLowerCase().includes(lowerQuery) || 
        t.code.toLowerCase().includes(lowerQuery) ||
        (t.description && t.description.toLowerCase().includes(lowerQuery))
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
  }, [mcpTools, sortConfig, toolSearchQuery]);

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
      const payload = Object.keys(permissions).map(toolId => ({
        mcp_tool_id: toolId,
        is_allowed: permissions[toolId]
      }));
      return apiClient.put(`/api/configuration/roles/${selectedRoleId}/mcp-tool-permissions`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roleMcpPermissions", selectedRoleId] });
      toast.success("MCP Tool permissions saved successfully");
    },
    onError: () => toast.error("Failed to save tool permissions"),
  });

  const togglePermission = (toolId: string) => {
    setPermissions(prev => ({
      ...prev,
      [toolId]: !prev[toolId]
    }));
  };

  const handleRoleSelect = (id: string) => {
    setSelectedRoleId(id);
    setSearchParams({ roleId: id });
  };

  if (loadingRoles || loadingTools) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const selectedRole = roles?.find(r => r.id === selectedRoleId);

  return (
    <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out p-6 w-full">
      
      {/* Left Panel: Roles List */}
      <div className="w-full lg:w-80 flex-shrink-0 flex flex-col gap-4 lg:border-r border-slate-200 dark:border-zinc-800 lg:pr-6 pb-6 lg:pb-0 border-b lg:border-b-0 min-h-0">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">Roles</h2>
          <p className="text-sm text-slate-500 dark:text-zinc-400">Select a role to configure AI tool access.</p>
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
          <div className="flex items-center gap-2"><h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">Role MCP Tool Permissions</h2><HelpIcon text="Define which MCP tools are accessible by each role to restrict AI code actions." /></div>
          <p className="text-sm text-slate-500 dark:text-zinc-400">
             {selectedRole ? `Configuring MCP tools for ${selectedRole.name}` : "Select a role from the list to begin."}
          </p>
        </div>

        {selectedRoleId ? (
          <div className="flex-1 min-h-0 flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2 w-full mt-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500 dark:text-zinc-400" />
                <Input 
                  placeholder="Search tools..." 
                  className="pl-9 bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 focus-visible:ring-blue-500/30 rounded-xl"
                  value={toolSearchQuery}
                  onChange={(e) => setToolSearchQuery(e.target.value)}
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
                      <TableHead className="w-16 text-center bg-inherit">Access</TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-slate-100 dark:hover:bg-zinc-900 transition-colors bg-inherit"
                        onClick={() => requestSort("name")}
                      >
                        <div className="flex items-center text-slate-900 dark:text-zinc-100 font-semibold">Tool <ArrowUpDown className="ml-2 h-3.5 w-3.5 text-slate-400" /></div>
                      </TableHead>
                      <TableHead className="bg-inherit font-semibold text-slate-900 dark:text-zinc-100 hidden md:table-cell">
                        Description
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedTools.length === 0 ? (
                       <TableRow>
                          <TableCell colSpan={3} className="h-24 text-center text-slate-500">
                             No tools found matching your search.
                          </TableCell>
                       </TableRow>
                    ) : (
                      sortedTools.map((tool, _index) => (
                        <TableRow key={tool.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-900/50">
                          <TableCell className="text-center border-r border-slate-100 dark:border-zinc-800/50">
                            <input 
                              type="checkbox"
                              checked={permissions[tool.id] || false}
                              onChange={() => togglePermission(tool.id)}
                              disabled={!hasPermission("CONFIG_ROLE_MCP_PERMISSIONS_UPDATE")}
                              className="w-4 h-4 text-blue-600 bg-slate-100 border-slate-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-slate-800 focus:ring-2 dark:bg-slate-700 dark:border-slate-600 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                          </TableCell>
                          <TableCell className="font-medium text-slate-900 dark:text-zinc-200">
                            <div className="flex items-center gap-2">
                              <Wrench className="h-4 w-4 text-slate-400" />
                              {tool.name}
                            </div>
                            <div className="text-[10px] text-slate-500 font-normal uppercase tracking-wider mt-0.5 ml-6">{tool.code}</div>
                          </TableCell>
                          <TableCell className="text-slate-500 dark:text-zinc-400 text-sm hidden md:table-cell whitespace-normal break-words max-w-[300px]">
                            {tool.description || <span className="italic opacity-50">No description</span>}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            {hasPermission("CONFIG_ROLE_MCP_PERMISSIONS_UPDATE") && (
              <div className="pt-4 flex justify-end">
                <Button 
                  onClick={() => saveMutation.mutate()} 
                  className="w-full sm:w-auto h-11 px-8 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20"
                  disabled={saveMutation.isPending || loadingRolePermissions}
                >
                  {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Tool Permissions
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
               <p className="text-sm text-slate-500 dark:text-zinc-400">Choose a role from the list on the left to view and modify its AI Tool access permissions.</p>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}

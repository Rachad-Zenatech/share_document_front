import { useState, useEffect, useMemo } from "react";
import HelpIcon from "@/components/ui/HelpIcon";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/services/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, ShieldCheck, Search, CheckSquare, Square, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/AuthContext";
import type { Role } from "@/lib/AuthContext";
import { useSearchParams } from "react-router-dom";

type PermissionGroup = {
  id: number;
  code: string;
  name: string;
  description?: string | null;
};

type PermissionModule = {
  id: number;
  code: string;
  name: string;
  groups: PermissionGroup[];
};

function getErrorMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

export default function RoleGroupPermissions() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const roleId = searchParams.get("roleId");

  const [selectedGroups, setSelectedGroups] = useState<Set<number>>(new Set());
  const [roleSearchQuery, setRoleSearchQuery] = useState("");
  const [permissionSearchQuery, setPermissionSearchQuery] = useState("");

  // Fetch roles for the left panel
  const { data: roles, isLoading: isLoadingRoles } = useQuery({
    queryKey: ["roles"],
    queryFn: () => apiClient.get<Role[]>("/api/configuration/roles"),
  });

  const filteredRoles = useMemo(() => {
    if (!roles) return [];
    const activeRoles = roles.filter((r) => r.is_active);
    if (!roleSearchQuery.trim()) return activeRoles;

    const lower = roleSearchQuery.toLowerCase();
    return activeRoles.filter(
      (r) =>
        r.name.toLowerCase().includes(lower) ||
        r.code.toLowerCase().includes(lower)
    );
  }, [roles, roleSearchQuery]);

  const selectedRole = roles?.find((r) => r.id === roleId);

  // Fetch permission modules & groups
  const { data: modules, isLoading: isLoadingModules } = useQuery({
    queryKey: ["permission-modules"],
    queryFn: () => apiClient.get<PermissionModule[]>("/api/configuration/permission-modules"),
  });

  // Fetch current assigned groups
  const { data: assignedGroupIds, isLoading: isLoadingAssigned } = useQuery({
    queryKey: ["role-permission-groups", roleId],
    queryFn: () => apiClient.get<number[]>(`/api/configuration/roles/${roleId}/permission-groups`),
    enabled: !!roleId,
  });

  useEffect(() => {
    if (assignedGroupIds) {
      setSelectedGroups(new Set(assignedGroupIds));
    }
  }, [assignedGroupIds]);

  const updateMutation = useMutation({
    mutationFn: (groupIds: number[]) =>
      apiClient.put(`/api/configuration/roles/${roleId}/permission-groups`, {
        permission_group_ids: groupIds,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["role-permission-groups", roleId] });
      toast.success("Permissions updated successfully");
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err, "Failed to update permissions")),
  });

  const handleToggleGroup = (groupId: number) => {
    const newSet = new Set(selectedGroups);
    if (newSet.has(groupId)) {
      newSet.delete(groupId);
    } else {
      newSet.add(groupId);
    }
    setSelectedGroups(newSet);
  };

  const allAvailableGroupIds = useMemo(() => {
    if (!modules) return [];
    return modules.flatMap((m) => m.groups.map((g) => g.id));
  }, [modules]);

  const handleSelectAllGlobal = () => {
    setSelectedGroups(new Set(allAvailableGroupIds));
  };

  const handleDeselectAllGlobal = () => {
    setSelectedGroups(new Set());
  };

  const handleSelectAllModule = (moduleGroups: PermissionGroup[]) => {
    const newSet = new Set(selectedGroups);
    moduleGroups.forEach((g) => newSet.add(g.id));
    setSelectedGroups(newSet);
  };

  const handleDeselectAllModule = (moduleGroups: PermissionGroup[]) => {
    const newSet = new Set(selectedGroups);
    moduleGroups.forEach((g) => newSet.delete(g.id));
    setSelectedGroups(newSet);
  };

  const handleSave = () => {
    updateMutation.mutate(Array.from(selectedGroups));
  };

  const handleRoleSelect = (id: string) => {
    setSearchParams({ roleId: id });
  };

  // Filter modules/groups by permission search
  const filteredModules = useMemo(() => {
    if (!modules) return [];
    if (!permissionSearchQuery.trim()) return modules;

    const lower = permissionSearchQuery.toLowerCase();
    return modules
      .map((m) => {
        const matchesModuleName = m.name.toLowerCase().includes(lower);
        const matchingGroups = m.groups.filter(
          (g) =>
            matchesModuleName ||
            g.name.toLowerCase().includes(lower) ||
            g.code.toLowerCase().includes(lower) ||
            (g.description && g.description.toLowerCase().includes(lower))
        );
        return {
          ...m,
          groups: matchesModuleName ? m.groups : matchingGroups,
        };
      })
      .filter((m) => m.groups.length > 0);
  }, [modules, permissionSearchQuery]);

  const totalSelectedCount = selectedGroups.size;
  const totalGroupsCount = allAvailableGroupIds.length;

  return (
    <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out p-6 w-full">
      {/* Left Panel: Roles List */}
      <div className="w-full lg:w-80 flex-shrink-0 flex flex-col gap-4 lg:border-r border-slate-200 dark:border-zinc-800 lg:pr-6 pb-6 lg:pb-0 border-b lg:border-b-0 min-h-0">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">Roles</h2>
          <p className="text-sm text-slate-500 dark:text-zinc-400">Select a role to configure permissions.</p>
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
          {isLoadingRoles ? (
            <div className="flex justify-center p-4">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : filteredRoles.length === 0 ? (
            <div className="text-center p-4 text-slate-500 text-sm">No roles found.</div>
          ) : (
            filteredRoles.map((role) => (
              <button
                key={role.id}
                onClick={() => handleRoleSelect(role.id)}
                className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                  roleId === role.id
                    ? "bg-blue-50 border-blue-300 dark:bg-blue-900/20 dark:border-blue-700 ring-1 ring-blue-500/20"
                    : "bg-white border-slate-200 hover:border-blue-300 dark:bg-zinc-900 dark:border-zinc-800 dark:hover:border-zinc-700"
                }`}
              >
                <div className="font-semibold text-slate-900 dark:text-zinc-100 truncate text-sm">
                  {role.name}
                </div>
                <div className="text-xs text-slate-500 dark:text-zinc-400 truncate mt-0.5">{role.code}</div>
                {role.is_system_role && (
                  <Badge
                    variant="secondary"
                    className="mt-2 text-[9px] h-4 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 px-1.5 uppercase font-bold tracking-wider"
                  >
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
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100 flex items-center gap-2">
              <HelpIcon text="Manage permissions groups and actions associated with roles." />
              Simplified Permissions <ShieldCheck className="h-5 w-5 text-blue-500" />
            </h2>
            <p className="text-sm text-slate-500 dark:text-zinc-400 mt-0.5">
              {selectedRole
                ? `Configuring access groups for "${selectedRole.name}" (${totalSelectedCount} of ${totalGroupsCount} permissions granted)`
                : "Select a role from the list to begin."}
            </p>
          </div>
          {roleId && hasPermission("CONFIG_ROLES_UPDATE") && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAllGlobal}
                className="text-xs h-9"
              >
                <CheckCheck className="mr-1.5 h-3.5 w-3.5 text-blue-600" />
                Select All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDeselectAllGlobal}
                className="text-xs h-9"
              >
                <Square className="mr-1.5 h-3.5 w-3.5 text-slate-500" />
                Clear All
              </Button>
              <Button
                onClick={handleSave}
                disabled={updateMutation.isPending || isLoadingAssigned}
                className="bg-blue-600 hover:bg-blue-700 text-white min-w-[120px] h-9"
              >
                {updateMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save Changes
              </Button>
            </div>
          )}
        </div>

        {/* Permission Search Filter */}
        {roleId && (
          <div className="mb-4 relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search permission groups (e.g. Purchasing, General Ledger, Invoices, Users)..."
              className="pl-9 h-9 bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 rounded-lg text-sm"
              value={permissionSearchQuery}
              onChange={(e) => setPermissionSearchQuery(e.target.value)}
            />
          </div>
        )}

        {roleId ? (
          <div
            className={`flex-1 min-h-0 overflow-y-auto rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-6 transition-opacity ${
              isLoadingAssigned || updateMutation.isPending ? "opacity-50 pointer-events-none" : ""
            }`}
          >
            {isLoadingModules ? (
              <div className="flex flex-col items-center justify-center h-64 text-slate-500">
                <Loader2 className="h-8 w-8 animate-spin mb-4 text-blue-500" />
                <p>Loading permission groups...</p>
              </div>
            ) : (
              <div className="space-y-8">
                {filteredModules?.map((module) => {
                  const moduleGroupIds = module.groups.map((g) => g.id);
                  const selectedInModuleCount = moduleGroupIds.filter((id) => selectedGroups.has(id)).length;
                  const isAllModuleSelected =
                    moduleGroupIds.length > 0 && selectedInModuleCount === moduleGroupIds.length;

                  const viewGroups = module.groups.filter(
                    (g) => g.code.endsWith("_VIEW") || g.code.includes("_VIEW_")
                  );
                  const actionGroups = module.groups.filter(
                    (g) => !g.code.endsWith("_VIEW") && !g.code.includes("_VIEW_")
                  );

                  return (
                    <div
                      key={module.code}
                      className="bg-slate-50 dark:bg-zinc-950/50 rounded-xl p-6 border border-slate-100 dark:border-zinc-800/50"
                    >
                      <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-zinc-800 mb-4">
                        <div className="flex items-center gap-2.5">
                          <h3 className="text-lg font-bold text-slate-900 dark:text-zinc-100">
                            {module.name}
                          </h3>
                          <Badge
                            variant={selectedInModuleCount > 0 ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {selectedInModuleCount} / {module.groups.length} granted
                          </Badge>
                        </div>
                        {hasPermission("CONFIG_ROLES_UPDATE") && (
                          <div className="flex items-center gap-1.5">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/50"
                              onClick={() =>
                                isAllModuleSelected
                                  ? handleDeselectAllModule(module.groups)
                                  : handleSelectAllModule(module.groups)
                              }
                            >
                              {isAllModuleSelected ? (
                                <>
                                  <Square className="h-3 w-3 mr-1" /> Deselect Module
                                </>
                              ) : (
                                <>
                                  <CheckSquare className="h-3 w-3 mr-1" /> Select Module
                                </>
                              )}
                            </Button>
                          </div>
                        )}
                      </div>

                      <div className="space-y-6">
                        {/* View Access */}
                        {viewGroups.length > 0 && (
                          <div>
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                              View Access
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {viewGroups.map((group) => {
                                const isChecked = selectedGroups.has(group.id);
                                return (
                                  <label
                                    key={group.code}
                                    className={`
                                      relative flex items-start p-4 cursor-pointer rounded-lg border-2 transition-all duration-200
                                      ${
                                        isChecked
                                          ? "bg-blue-50 border-blue-300 dark:bg-blue-900/10 dark:border-blue-800"
                                          : "bg-white border-slate-200 hover:border-slate-300 dark:bg-zinc-900 dark:border-zinc-800 dark:hover:border-zinc-700"
                                      }
                                    `}
                                  >
                                    <div className="flex items-center h-5">
                                      <input
                                        type="checkbox"
                                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600 dark:border-zinc-700 dark:bg-zinc-800 dark:ring-offset-zinc-900"
                                        checked={isChecked}
                                        onChange={() => handleToggleGroup(group.id)}
                                        disabled={!hasPermission("CONFIG_ROLES_UPDATE")}
                                      />
                                    </div>
                                    <div className="ml-3 flex flex-col">
                                      <span
                                        className={`text-sm font-medium ${
                                          isChecked
                                            ? "text-blue-900 dark:text-blue-100"
                                            : "text-slate-900 dark:text-zinc-100"
                                        }`}
                                      >
                                        {group.name}
                                      </span>
                                      {group.description && (
                                        <span className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                                          {group.description}
                                        </span>
                                      )}
                                    </div>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Manage & Actions */}
                        {actionGroups.length > 0 && (
                          <div>
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                              Manage & Actions
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {actionGroups.map((group) => {
                                const isChecked = selectedGroups.has(group.id);
                                return (
                                  <label
                                    key={group.code}
                                    className={`
                                      relative flex items-start p-4 cursor-pointer rounded-lg border-2 transition-all duration-200
                                      ${
                                        isChecked
                                          ? "bg-blue-50 border-blue-300 dark:bg-blue-900/10 dark:border-blue-800"
                                          : "bg-white border-slate-200 hover:border-slate-300 dark:bg-zinc-900 dark:border-zinc-800 dark:hover:border-zinc-700"
                                      }
                                    `}
                                  >
                                    <div className="flex items-center h-5">
                                      <input
                                        type="checkbox"
                                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600 dark:border-zinc-700 dark:bg-zinc-800 dark:ring-offset-zinc-900"
                                        checked={isChecked}
                                        onChange={() => handleToggleGroup(group.id)}
                                        disabled={!hasPermission("CONFIG_ROLES_UPDATE")}
                                      />
                                    </div>
                                    <div className="ml-3 flex flex-col">
                                      <span
                                        className={`text-sm font-medium ${
                                          isChecked
                                            ? "text-blue-900 dark:text-blue-100"
                                            : "text-slate-900 dark:text-zinc-100"
                                        }`}
                                      >
                                        {group.name}
                                      </span>
                                      {group.description && (
                                        <span className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                                          {group.description}
                                        </span>
                                      )}
                                    </div>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {(!filteredModules || filteredModules.length === 0) && (
                  <div className="text-center py-12 text-slate-500">
                    No permission modules or groups matched your search.
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex items-center justify-center mt-6">
            <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-slate-200 dark:border-zinc-800 rounded-2xl bg-slate-50 dark:bg-zinc-900/20 text-center max-w-md mx-auto">
              <div className="w-16 h-16 bg-slate-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-4">
                <ShieldCheck className="h-8 w-8 text-slate-300 dark:text-zinc-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-zinc-100 mb-2">No Role Selected</h3>
              <p className="text-sm text-slate-500 dark:text-zinc-400">
                Choose a role from the list on the left to view and modify its access groups.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

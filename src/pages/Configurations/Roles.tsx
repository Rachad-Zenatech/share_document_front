import React, { useState, useEffect, useMemo, useRef } from "react";
import HelpIcon from "@/components/ui/HelpIcon";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/services/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Shield, Power, Ban, ChevronRight, ChevronDown, FolderOpen, Folder, Key, Loader2, Save, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/AuthContext";
import type { Role } from "@/lib/AuthContext";
import { Link } from "react-router-dom";

function getErrorMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

// Recursive component for Tree Node
const TreeNode = ({ 
  role, 
  level, 
  selectedRole, 
  onSelect, 
  expandedNodes, 
  toggleNode,
  onMoveRole,
  setDraggingId
}: { 
  role: Role; 
  level: number; 
  selectedRole: Role | null; 
  onSelect: (role: Role) => void;
  expandedNodes: Set<string>;
  toggleNode: (id: string, e: React.MouseEvent) => void;
  onMoveRole: (draggedId: string, targetId: string) => void;
  setDraggingId: (id: string | null) => void;
}) => {
  const isExpanded = expandedNodes.has(role.id);
  const isSelected = selectedRole?.id === role.id;
  const hasChildren = role.children && role.children.length > 0;
  
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounter = useRef(0);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("text/plain", role.id);
    e.dataTransfer.effectAllowed = "move";
    setDraggingId(role.id);
  };
  
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (dragCounter.current === 1) {
      setIsDragOver(true);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
  };
  
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragOver(false);
    }
  };

  const handleDragEnd = () => {
    dragCounter.current = 0;
    setIsDragOver(false);
    setDraggingId(null);
  };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDragOver(false);
    setDraggingId(null);
    const draggedId = e.dataTransfer.getData("text/plain");
    if (draggedId && draggedId !== role.id) {
      onMoveRole(draggedId, role.id);
    }
  };

  return (
    <div className="w-full">
      <div 
        draggable={true}
        onDragStart={handleDragStart}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDragEnd={handleDragEnd}
        onDrop={handleDrop}
        className={`relative flex items-center py-2 px-2 rounded-md cursor-pointer group transition-colors ${
          isDragOver
            ? 'bg-blue-100/50 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200' 
            : isSelected 
            ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' 
            : 'hover:bg-slate-50 dark:hover:bg-zinc-800/50 text-slate-700 dark:text-zinc-300'
        }`}
        style={{ paddingLeft: `${(level * 16) + 8}px` }}
        onClick={() => onSelect(role)}
      >
        {isDragOver && (
          <div 
            className="absolute right-0 bottom-0 border-b-2 border-blue-500 z-10 pointer-events-none rounded-b-sm shadow-[0_1px_2px_rgba(59,130,246,0.3)]"
            style={{ left: `${(level * 16) + 8 + 24}px` }}
          ></div>
        )}

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
        
        <span className="text-sm font-medium truncate flex-1 pointer-events-none">{role.name}</span>
        
        {!role.is_active && (
          <Badge variant="outline" className="ml-2 text-[10px] px-1.5 py-0 h-4 bg-slate-100 text-slate-500 pointer-events-none">Inactive</Badge>
        )}
      </div>

      {isExpanded && hasChildren && (
        <div className="flex flex-col w-full">
          {role.children!.map(child => (
            <TreeNode 
              key={child.id} 
              role={child} 
              level={level + 1} 
              selectedRole={selectedRole} 
              onSelect={onSelect} 
              expandedNodes={expandedNodes} 
              toggleNode={toggleNode} 
              onMoveRole={onMoveRole}
              setDraggingId={setDraggingId}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default function Roles() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();

  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [pendingMoves, setPendingMoves] = useState<Record<string, string | null>>({});
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeactivateDialogOpen, setIsDeactivateDialogOpen] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    code: "",
    description: "",
    parent_role_id: "",
    display_order: 0,
    department: "",
    is_active: true,
  });

  // Fetch flat roles
  const { data: flatRoles, isLoading: isLoadingRoles } = useQuery({
    queryKey: ["roles"],
    queryFn: () => apiClient.get<Role[]>("/api/configuration/roles"),
  });

  const optimisticTree = useMemo(() => {
    if (!flatRoles) return [];
    
    // Create deep clones
    const clonedRoles: Record<string, Role> = {};
    flatRoles.forEach(r => {
      if (r.code === 'PENDING_USER') return;
      clonedRoles[r.id] = { ...r, children: [] };
    });

    // Apply pending moves locally
    Object.keys(pendingMoves).forEach(roleId => {
      if (clonedRoles[roleId]) {
        clonedRoles[roleId].parent_role_id = pendingMoves[roleId];
      }
    });

    const roots: Role[] = [];
    
    // Second pass to build tree
    Object.values(clonedRoles).forEach(r => {
      if (r.parent_role_id && clonedRoles[r.parent_role_id]) {
        clonedRoles[r.parent_role_id].children!.push(r);
      } else {
        roots.push(r);
      }
    });

    // Sort children
    const sortRoles = (arr: Role[]) => {
      arr.sort((a, b) => {
        const aOrder = a.display_order ?? 0;
        const bOrder = b.display_order ?? 0;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return a.name.localeCompare(b.name);
      });
      arr.forEach(r => {
        if (r.children && r.children.length > 0) sortRoles(r.children);
      });
    };

    sortRoles(roots);
    return roots;
  }, [flatRoles, pendingMoves]);

  // Auto-expand all on load based on optimisticTree
  useEffect(() => {
    if (optimisticTree.length > 0 && expandedNodes.size === 0 && Object.keys(pendingMoves).length === 0) {
      const allIds = new Set<string>();
      const addIds = (nodes: Role[]) => {
        nodes.forEach(n => {
          allIds.add(n.id);
          if (n.children && n.children.length > 0) addIds(n.children);
        });
      };
      addIds(optimisticTree);
      setExpandedNodes(allIds);
    }
  }, [optimisticTree]);

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

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => apiClient.post<Role>("/api/configuration/roles", {
      ...data,
      parent_role_id: data.parent_role_id || null
    }),
    onSuccess: (newRole) => {
      queryClient.invalidateQueries({ queryKey: ["roles-tree"] });
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      toast.success("Role created successfully");
      setIsEditing(false);
      setSelectedRole(newRole);
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err, "Failed to create role")),
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: string, payload: Partial<typeof formData> }) => 
      apiClient.put<Role>(`/api/configuration/roles/${data.id}`, {
        ...data.payload,
        parent_role_id: data.payload.parent_role_id || null
      }),
    onSuccess: (updatedRole) => {
      queryClient.invalidateQueries({ queryKey: ["roles-tree"] });
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      toast.success("Role updated successfully");
      setIsEditing(false);
      setSelectedRole(updatedRole);
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err, "Failed to update role")),
  });

  const bulkSaveHierarchyMutation = useMutation({
    mutationFn: async () => {
      // Pass 1: Set all moving roles to root (null) to break any existing hierarchy chains.
      // This prevents "cannot move under descendant" errors if the database is in an intermediate state.
      for (const roleId of Object.keys(pendingMoves)) {
        await apiClient.put(`/api/configuration/roles/${roleId}`, {
          parent_role_id: null
        });
      }
      
      // Pass 2: Set roles to their new target parents sequentially
      for (const roleId of Object.keys(pendingMoves)) {
        const targetId = pendingMoves[roleId];
        if (targetId !== null) {
          await apiClient.put(`/api/configuration/roles/${roleId}`, {
            parent_role_id: targetId
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles-tree"] });
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      toast.success("Hierarchy saved successfully");
      setPendingMoves({});
    },
    onError: () => toast.error("Failed to save hierarchy changes"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete<void>(`/api/configuration/roles/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles-tree"] });
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      toast.success("Role deactivated/deleted successfully");
      setSelectedRole(null);
      setIsEditing(false);
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err, "Failed to delete role")),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedRole && isEditing && selectedRole.id !== "new") {
      updateMutation.mutate({ id: selectedRole.id, payload: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleAddRoot = () => {
    setSelectedRole({ id: "new", name: "New Root Role", code: "", is_active: true } as Role);
    setFormData({ name: "", code: "", description: "", parent_role_id: "", display_order: 0, department: "", is_active: true });
    setIsEditing(true);
  };

  const handleAddChild = () => {
    if (!selectedRole || selectedRole.id === "new") return;
    const parentId = selectedRole.id;
    setSelectedRole({ id: "new", name: "New Child Role", code: "", is_active: true } as Role);
    setFormData({ name: "", code: "", description: "", parent_role_id: parentId, display_order: 0, department: "", is_active: true });
    setIsEditing(true);
  };

  const startEdit = () => {
    if (!selectedRole) return;
    setFormData({ 
      name: selectedRole.name, 
      code: selectedRole.code, 
      description: selectedRole.description || "", 
      parent_role_id: selectedRole.parent_role_id || "",
      display_order: selectedRole.display_order || 0,
      department: selectedRole.department || "",
      is_active: selectedRole.is_active ?? true 
    });
    setIsEditing(true);
  };

  const confirmDelete = async () => {
    if (!selectedRole || selectedRole.id === "new") return;
    try {
      await deleteMutation.mutateAsync(selectedRole.id);
    } catch (e) {
      console.error(e);
    } finally {
      setIsDeleteDialogOpen(false);
    }
  };

  const confirmDeactivate = async () => {
    if (!selectedRole || selectedRole.id === "new") return;
    try {
      await updateMutation.mutateAsync({
        id: selectedRole.id,
        payload: { is_active: !selectedRole.is_active }
      });
    } catch (e) {
      console.error(e);
    } finally {
      setIsDeactivateDialogOpen(false);
    }
  };

  const canDrop = (draggedId: string, targetId: string | null) => {
    if (draggedId === targetId) return false;
    if (targetId === null) return true; // root is always valid
    
    // Check against optimistic tree to handle pending moves
    let curr = flatRoles?.find(r => r.id === targetId);
    while (curr) {
      // Use pending move if it exists, otherwise use database parent
      const parentId = pendingMoves[curr.id] !== undefined ? pendingMoves[curr.id] : curr.parent_role_id;
      if (parentId === draggedId) return false;
      if (!parentId) break;
      curr = flatRoles?.find(r => r.id === parentId);
    }
    return true;
  };

  const handleMoveRole = (draggedId: string, targetId: string | null) => {
    if (!canDrop(draggedId, targetId)) {
      toast.error("Cannot move a role into its own child (Cycle detected)");
      return;
    }
    setPendingMoves(prev => ({
      ...prev,
      [draggedId]: targetId
    }));
    
    // Auto-expand the target node so the user sees it dropped inside
    if (targetId) {
       setExpandedNodes(prev => new Set(prev).add(targetId));
    }
  };

  const [isRootDragOver, setIsRootDragOver] = useState(false);

  const hasPendingMoves = Object.keys(pendingMoves).length > 0;

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out h-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2"><h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">Roles</h2><HelpIcon text="Manage application roles and set default roles assigned to new users." /></div>
          <p className="text-sm text-slate-500 dark:text-zinc-400">Manage organizational role hierarchy and security groups.</p>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col md:flex-row gap-6">
        {/* Left Panel: Tree */}
        <div className="w-full md:w-1/3 flex flex-col rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-sm h-full">
          <div className="p-4 border-b border-slate-200 dark:border-zinc-800 flex justify-between items-center bg-slate-50/50 dark:bg-zinc-950/50">
            <h3 className="font-semibold text-slate-800 dark:text-zinc-200">Role Hierarchy</h3>
            <div className="flex items-center gap-2">
              {hasPendingMoves && (
                <div className="flex gap-2 mr-2">
                   <Button size="sm" variant="outline" className="h-8 px-2" onClick={() => setPendingMoves({})}>
                     <X className="h-3.5 w-3.5" />
                   </Button>
                   <Button size="sm" className="h-8 bg-green-600 hover:bg-green-700 text-white" onClick={() => bulkSaveHierarchyMutation.mutate()} disabled={bulkSaveHierarchyMutation.isPending}>
                     {bulkSaveHierarchyMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                     Save
                   </Button>
                </div>
              )}
              {!hasPendingMoves && hasPermission("CONFIG_ROLES_CREATE") && (
                <Button size="sm" variant="outline" onClick={handleAddRoot} className="h-8 text-xs">
                  <Plus className="mr-1 h-3 w-3" /> Root
                </Button>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 relative">
            {isLoadingRoles ? (
              <div className="p-4 text-center text-slate-500 text-sm">Loading tree...</div>
            ) : optimisticTree && optimisticTree.length > 0 ? (
              <div className="min-h-full flex flex-col relative">
                <div className="relative z-10 flex flex-col">
                  {optimisticTree.map(rootRole => (
                    <TreeNode 
                      key={rootRole.id} 
                      role={rootRole} 
                      level={0}
                      selectedRole={selectedRole}
                      onSelect={(r) => { setSelectedRole(r); setIsEditing(false); }}
                      expandedNodes={expandedNodes}
                      toggleNode={toggleNode}
                      onMoveRole={(draggedId, targetId) => handleMoveRole(draggedId, targetId)}
                      setDraggingId={setDraggingId}
                    />
                  ))}
                </div>

                <div
                  className={`flex-1 min-h-[120px] mt-4 mx-2 rounded-xl border-2 border-dashed flex items-center justify-center transition-all duration-200 ${
                    draggingId 
                      ? 'opacity-100 pointer-events-auto' 
                      : 'opacity-0 pointer-events-none h-0 min-h-0 mt-0 overflow-hidden'
                  } ${
                    isRootDragOver 
                      ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:border-blue-700 dark:text-blue-400' 
                      : 'border-slate-300 bg-slate-50 text-slate-500 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-400'
                  }`}
                  onDragEnter={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsRootDragOver(true);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.dataTransfer.dropEffect = "move";
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsRootDragOver(false);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsRootDragOver(false);
                    const draggedId = e.dataTransfer.getData("text/plain");
                    if (draggedId) handleMoveRole(draggedId, null);
                  }}
                >
                  <span className="text-sm font-medium">Drop here to move to root level</span>
                </div>
              </div>
            ) : (
              <div className="p-4 text-center text-slate-500 text-sm">No roles found.</div>
            )}
          </div>
        </div>

        {/* Right Panel: Details / Editor */}
        <div className="w-full md:w-2/3 flex flex-col rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-sm h-full">
          {!selectedRole ? (
            <div className="flex-1 flex items-center justify-center text-slate-400 dark:text-zinc-500 p-8 text-center flex-col">
              <Shield className="w-12 h-12 mb-4 opacity-20" />
              <p className="text-lg font-medium text-slate-600 dark:text-zinc-300">No Role Selected</p>
              <p className="text-sm max-w-sm mt-2">Select a role from the hierarchy to view its details, or create a new root role to get started.</p>
            </div>
          ) : (
            <div className="flex flex-col h-full overflow-hidden">
              <div className="p-6 border-b border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-950/50 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-zinc-100">
                      {isEditing && selectedRole.id === "new" ? "Create New Role" : selectedRole.name}
                    </h2>
                    {!isEditing && selectedRole.id !== "new" && (
                      <Badge variant={selectedRole.is_active ? "default" : "secondary"} className={selectedRole.is_active ? "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400" : ""}>
                        {selectedRole.is_active ? "Active" : "Inactive"}
                      </Badge>
                    )}
                  </div>
                  {!isEditing && selectedRole.id !== "new" && (
                    <div className="flex items-center text-sm text-slate-500 dark:text-zinc-400 gap-4">
                      <span className="flex items-center"><Key className="w-4 h-4 mr-1.5" /> Code: {selectedRole.code}</span>
                      {selectedRole.is_system_role && <span className="flex items-center text-purple-600 dark:text-purple-400 font-medium"><Shield className="w-4 h-4 mr-1.5" /> System Role</span>}
                    </div>
                  )}
                </div>
                
                {!isEditing && selectedRole.id !== "new" && (
                  <div className="flex flex-wrap items-center gap-2">
                    {hasPermission("CONFIG_ROLES_CREATE") && (
                       <Button variant="outline" size="sm" onClick={handleAddChild} className="bg-white dark:bg-zinc-900">
                         <Plus className="w-4 h-4 mr-2" /> Add Child
                       </Button>
                    )}
                    {hasPermission("CONFIG_ROLES_UPDATE") && !selectedRole.is_system_role && (
                      <Button variant="outline" size="sm" onClick={startEdit} className="bg-white dark:bg-zinc-900 text-blue-600 border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-blue-900 dark:text-blue-400 dark:hover:bg-blue-900/20">
                        <Edit className="w-4 h-4 mr-2" /> Edit
                      </Button>
                    )}
                    {hasPermission("CONFIG_ROLES_DELETE") && !selectedRole.is_system_role && (
                      selectedRole.is_active ? (
                        <Button variant="outline" size="sm" onClick={() => setIsDeactivateDialogOpen(true)} className="bg-white dark:bg-zinc-900 text-orange-600 border-orange-200 hover:bg-orange-50 hover:text-orange-700 dark:border-orange-900 dark:text-orange-400 dark:hover:bg-orange-900/20">
                          <Ban className="w-4 h-4 mr-2" /> Deactivate
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm" onClick={() => setIsDeleteDialogOpen(true)} className="bg-white dark:bg-zinc-900 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-900/20">
                          <Trash2 className="w-4 h-4 mr-2" /> Delete
                        </Button>
                      )
                    )}
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {isEditing ? (
                  <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl animate-in fade-in">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-zinc-300">Role Name <span className="text-red-500">*</span></label>
                        <Input 
                          required 
                          value={formData.name} 
                          onChange={e => setFormData({...formData, name: e.target.value})} 
                          placeholder="e.g. Senior Accountant"
                          className="bg-white dark:bg-zinc-950"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-zinc-300">Role Code <span className="text-red-500">*</span></label>
                        <Input 
                          required 
                          value={formData.code} 
                          onChange={e => setFormData({...formData, code: e.target.value.toUpperCase()})} 
                          placeholder="e.g. SNR_ACCT"
                          className="bg-white dark:bg-zinc-950 uppercase"
                        />
                        <p className="text-[11px] text-slate-500">Unique identifier used for system mapping.</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700 dark:text-zinc-300">Description</label>
                      <Textarea 
                        value={formData.description} 
                        onChange={e => setFormData({...formData, description: e.target.value})} 
                        placeholder="Describe the responsibilities and access level of this role..."
                        rows={3}
                        className="bg-white dark:bg-zinc-950 resize-none"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-zinc-300">Parent Role</label>
                        <select 
                          value={formData.parent_role_id}
                          onChange={e => setFormData({...formData, parent_role_id: e.target.value})}
                          className="w-full h-10 px-3 py-2 rounded-md border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-slate-900 dark:text-zinc-100 text-sm"
                        >
                          <option value="">-- None (Root Role) --</option>
                          {flatRoles?.filter(r => {
                            if (r.id === selectedRole?.id) return false;
                            if (selectedRole && selectedRole.id !== "new") {
                              let curr = r;
                              while (curr) {
                                if (curr.parent_role_id === selectedRole.id) return false;
                                if (!curr.parent_role_id) break;
                                curr = flatRoles.find(parent => parent.id === curr.parent_role_id) as Role;
                              }
                            }
                            return true;
                          }).map(r => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                          ))}
                        </select>
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-zinc-300">Department</label>
                        <Input 
                          value={formData.department} 
                          onChange={e => setFormData({...formData, department: e.target.value})} 
                          placeholder="e.g. Finance"
                          className="bg-white dark:bg-zinc-950"
                        />
                      </div>
                    </div>

                    <div className="pt-6 mt-6 border-t border-slate-100 dark:border-zinc-800 flex justify-end gap-3">
                      <Button type="button" variant="ghost" onClick={() => {
                        setIsEditing(false);
                        if (selectedRole?.id === "new") setSelectedRole(null);
                      }}>
                        Cancel
                      </Button>
                      <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white min-w-[120px]" disabled={createMutation.isPending || updateMutation.isPending}>
                        {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Role
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-8 animate-in fade-in">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-zinc-100 mb-3 flex items-center">
                        <FolderOpen className="w-4 h-4 mr-2 text-slate-400" /> Role Information
                      </h4>
                      <div className="bg-slate-50 dark:bg-zinc-950/50 rounded-xl p-5 border border-slate-100 dark:border-zinc-800/50 space-y-4">
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <p className="text-xs font-medium text-slate-500 dark:text-zinc-500 uppercase tracking-wider mb-1">Department</p>
                            <p className="text-sm text-slate-900 dark:text-zinc-300">{selectedRole.department || "—"}</p>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-slate-500 dark:text-zinc-500 uppercase tracking-wider mb-1">Parent Role</p>
                            <p className="text-sm text-slate-900 dark:text-zinc-300">
                              {selectedRole.parent_role_id ? flatRoles?.find(r => r.id === selectedRole.parent_role_id)?.name || "Unknown" : "None (Root)"}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-slate-500 dark:text-zinc-500 uppercase tracking-wider mb-1">System Status</p>
                            <p className="text-sm text-slate-900 dark:text-zinc-300">{selectedRole.is_system_role ? "System Managed" : "Custom Role"}</p>
                          </div>
                        </div>
                        
                        {selectedRole.description && (
                          <div className="pt-4 mt-4 border-t border-slate-200 dark:border-zinc-800/50">
                            <p className="text-xs font-medium text-slate-500 dark:text-zinc-500 uppercase tracking-wider mb-2">Description</p>
                            <p className="text-sm text-slate-700 dark:text-zinc-400 leading-relaxed">{selectedRole.description}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <Link 
                         to={`/configurations/role-group-permissions?roleId=${selectedRole.id}`}
                         className="flex items-start p-4 rounded-xl border border-slate-200 dark:border-zinc-800 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md transition-all bg-white dark:bg-zinc-900 group"
                       >
                         <div className="p-2.5 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 mr-4 group-hover:scale-110 transition-transform">
                           <Shield className="w-5 h-5" />
                         </div>
                         <div>
                           <h5 className="font-semibold text-slate-900 dark:text-zinc-100 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">Permissions</h5>
                           <p className="text-xs text-slate-500 mt-1">Configure which modules and actions this role can access.</p>
                         </div>
                       </Link>

                       <Link 
                         to={`/configurations/role-mcp-tool-permissions?roleId=${selectedRole.id}`}
                         className="flex items-start p-4 rounded-xl border border-slate-200 dark:border-zinc-800 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md transition-all bg-white dark:bg-zinc-900 group"
                       >
                         <div className="p-2.5 rounded-lg bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 mr-4 group-hover:scale-110 transition-transform">
                           <Power className="w-5 h-5" />
                         </div>
                         <div>
                           <h5 className="font-semibold text-slate-900 dark:text-zinc-100 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">AI Tool Access</h5>
                           <p className="text-xs text-slate-500 mt-1">Manage which MCP tools are available to this role.</p>
                         </div>
                       </Link>
                    </div>

                    {selectedRole.is_system_role && (
                      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-xl p-4 flex gap-3 text-amber-800 dark:text-amber-400">
                        <Shield className="w-5 h-5 shrink-0" />
                        <div className="text-sm">
                          <p className="font-semibold mb-1">System Role</p>
                          <p className="opacity-90">This role is managed by the system and cannot be renamed or deleted. You can still modify its permissions and assign it to users.</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Role</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to completely delete the role "{selectedRole?.name}"? This action cannot be undone and will remove all associated permissions and user assignments.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700 text-white">
              Yes, delete role
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isDeactivateDialogOpen} onOpenChange={setIsDeactivateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Role</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to deactivate "{selectedRole?.name}"? Users with this role will lose access to its associated permissions until it is reactivated.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeactivate} className="bg-orange-600 hover:bg-orange-700 text-white">
              Yes, deactivate role
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

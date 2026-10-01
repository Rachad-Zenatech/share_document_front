import { useState, useMemo } from "react";
import HelpIcon from "@/components/ui/HelpIcon";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/services/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, KeyRound, ArrowUpDown, Power, Ban, Search, ChevronDown, MoreHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { useAuth } from "@/lib/AuthContext";
import type { User } from "@/lib/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
} from "@tanstack/react-table";
import type {
  ColumnDef,
  SortingState,
  ColumnFiltersState,
  VisibilityState,
  RowSelectionState,
} from "@tanstack/react-table";

export default function Users() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const [isDeactivateDialogOpen, setIsDeactivateDialogOpen] = useState(false);
  const [userToDeactivate, setUserToDeactivate] = useState<User | null>(null);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  
  const [formData, setFormData] = useState({
    email: "",
    full_name: "",
    is_active: true,
    is_super_admin: false,
  });

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => apiClient.get<User[]>("/api/configuration/users"),
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => apiClient.post("/api/configuration/users", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("User created successfully");
      setIsDialogOpen(false);
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || "Failed to create user"),
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: string, payload: Partial<typeof formData> }) => 
      apiClient.put(`/api/configuration/users/${data.id}`, data.payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("User updated successfully");
      setIsDialogOpen(false);
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || "Failed to update user"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/configuration/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("User removed successfully");
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || err.message || "Failed to delete user"),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (userIds: string[]) =>
      apiClient.post<{ success: boolean; deleted_count: number }>("/api/configuration/users/bulk-delete", {
        user_ids: userIds,
      }),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      const count = res?.deleted_count ?? Object.keys(rowSelection).length;
      toast.success(`Successfully removed ${count} user${count === 1 ? "" : "s"}`);
      setRowSelection({});
      setIsBulkDeleteDialogOpen(false);
    },
    onError: (err: any) =>
      toast.error(err.response?.data?.detail || err.message || "Failed to remove users"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.full_name && /[^a-zA-Z\s]/.test(formData.full_name)) {
      toast.error("Full Name can only contain letters and spaces (no numbers or symbols).");
      return;
    }
    const cleanPrefix = formData.email.trim().toLowerCase();
    if (!cleanPrefix) {
      toast.error("Email is required.");
      return;
    }
    const finalEmail = cleanPrefix.includes("@") ? cleanPrefix : `${cleanPrefix}@zenatech.com`;

    // Client-side uniqueness check
    const isDuplicate = users.some(
      (u) =>
        u.email?.trim().toLowerCase() === finalEmail &&
        (!editingUser || u.id !== editingUser.id)
    );
    if (isDuplicate) {
      toast.error(`A user with the email '${finalEmail}' already exists.`);
      return;
    }

    const payload = { ...formData, email: finalEmail };

    if (editingUser) {
      updateMutation.mutate({ id: editingUser.id, payload });
    } else {
      createMutation.mutate(payload as typeof formData);
    }
  };

  const openCreateDialog = () => {
    setEditingUser(null);
    setFormData({ email: "", full_name: "", is_active: true, is_super_admin: false });
    setIsDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!userToDelete) return;
    try {
      await deleteMutation.mutateAsync(userToDelete.id);
    } catch (e) {
      console.error(e);
    } finally {
      setIsDeleteDialogOpen(false);
      setUserToDelete(null);
    }
  };

  const confirmBulkDelete = async () => {
    const selectedIds = table.getSelectedRowModel().rows.map((r) => r.original.id);
    if (selectedIds.length === 0) return;
    try {
      await bulkDeleteMutation.mutateAsync(selectedIds);
    } catch (e) {
      console.error(e);
    }
  };

  const confirmDeactivate = async () => {
    if (!userToDeactivate) return;
    try {
      await updateMutation.mutateAsync({
        id: userToDeactivate.id,
        payload: { is_active: !userToDeactivate.is_active }
      });
    } catch (e) {
      console.error(e);
    } finally {
      setIsDeactivateDialogOpen(false);
      setUserToDeactivate(null);
    }
  };

  const openEditDialog = (user: User) => {
    setEditingUser(user);
    setFormData({ 
      email: user.email.replace(/@zenatech\.com$/, ""), 
      full_name: user.full_name || "", 
      is_active: (user as any).is_active ?? true, 
      is_super_admin: user.is_super_admin 
    });
    setIsDialogOpen(true);
  };

  const [sorting, setSorting] = useState<SortingState>([{ id: "full_name", desc: false }]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [globalFilter, setGlobalFilter] = useState("");

  const columns = useMemo<ColumnDef<User>[]>(() => {
    const cols: ColumnDef<User>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <div className="flex items-center justify-center pl-2">
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && "indeterminate")
            }
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all"
          />
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex items-center justify-center pl-2">
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
          />
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "full_name",
      header: ({ column }) => (
        <Button variant="ghost" className="px-0 font-semibold" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Name
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => <span className="font-medium">{row.original.full_name || "-"}</span>,
    },
    {
      accessorKey: "email",
      header: ({ column }) => (
        <Button variant="ghost" className="px-0 font-semibold" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Email
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => <span>{row.original.email}</span>,
    },
    {
      accessorKey: "is_active",
      header: ({ column }) => (
        <Button variant="ghost" className="px-0 font-semibold" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Status
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const isActive = (row.original as any).is_active ?? true;
        return isActive ? (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400">Active</Badge>
        ) : (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400">Inactive</Badge>
        );
      },
    },
    {
      id: "roles",
      accessorFn: (row) => row.is_super_admin ? "Super Admin" : ((row as any).assigned_roles?.map((r: any) => r.name).join(", ") || ""),
      header: ({ column }) => (
        <Button variant="ghost" className="px-0 font-semibold" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Roles
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const user = row.original as any;
        if (user.is_super_admin) {
          return <Badge variant="secondary" className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 mb-1 mr-1">Super Admin</Badge>;
        }
        if (user.assigned_roles && user.assigned_roles.length > 0) {
          return (
            <div className="flex flex-wrap gap-1">
              {user.assigned_roles.map((role: any) => (
                <Badge key={role.id} variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400">
                  {role.name}
                </Badge>
              ))}
            </div>
          );
        }
        return <span className="text-slate-500 text-sm italic">No Roles</span>;
      },
    }
  ];

  if (hasPermission("CONFIG_USER_ROLE_ASSIGNMENT_READ") || hasPermission("CONFIG_USERS_UPDATE") || hasPermission("CONFIG_USERS_DELETE")) {
    cols.push({
      id: "actions",
      header: () => <div className="text-right">Actions</div>,
      cell: ({ row }) => {
        const user = row.original;
        const isActive = (user as any).is_active ?? true;
        return (
          <div className="text-right">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                  <span className="sr-only">Open menu</span>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {hasPermission("CONFIG_USER_ROLE_ASSIGNMENT_READ") && (
                  <DropdownMenuItem onClick={() => navigate(`/configurations/user-role-assignment?userId=${user.id}`)}>
                    <KeyRound className="mr-2 h-4 w-4" /> Manage Roles
                  </DropdownMenuItem>
                )}
                {hasPermission("CONFIG_USERS_UPDATE") && (
                  <DropdownMenuItem onClick={() => openEditDialog(user)}>
                    <Edit className="mr-2 h-4 w-4" /> Edit User
                  </DropdownMenuItem>
                )}
                {hasPermission("CONFIG_USERS_UPDATE") && (
                  <DropdownMenuItem onClick={() => {
                    setUserToDeactivate(user);
                    setIsDeactivateDialogOpen(true);
                  }}>
                    {isActive ? (
                      <><Ban className="mr-2 h-4 w-4 text-orange-600" /> Deactivate</>
                    ) : (
                      <><Power className="mr-2 h-4 w-4 text-green-600" /> Activate</>
                    )}
                  </DropdownMenuItem>
                )}
                {hasPermission("CONFIG_USERS_DELETE") && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      className="text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400"
                      onClick={() => {
                        setUserToDelete(user);
                        setIsDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Remove User
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    });
  }
  return cols;
}, [hasPermission, navigate]);

  const table = useReactTable({
    data: users,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onRowSelectionChange: setRowSelection,
    enableRowSelection: true,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    initialState: {
      pagination: {
        pageSize: 50,
      },
    },
    globalFilterFn: (row, _columnId, filterValue) => {
      const search = filterValue.toLowerCase();
      const name = (row.getValue("full_name") as string)?.toLowerCase() || "";
      const email = (row.getValue("email") as string)?.toLowerCase() || "";
      const roles = (row.getValue("roles") as string)?.toLowerCase() || "";
      return name.includes(search) || email.includes(search) || roles.includes(search);
    },
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      globalFilter,
    },
    onGlobalFilterChange: setGlobalFilter,
  });

  const selectedRowCount = table.getSelectedRowModel().rows.length;

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2"><h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">Users</h2><HelpIcon text="Manage portal user accounts. Create, search, update details, lock/unlock accounts, and delete users." /></div>
          <p className="text-sm text-slate-500 dark:text-zinc-400">Manage system users and their access.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-4">
          {hasPermission("CONFIG_USERS_CREATE") && (
            <Button onClick={openCreateDialog} className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" /> Add User
            </Button>
          )}
        </div>
      </div>

      {/* BULK ACTION BAR */}
      {selectedRowCount > 0 && (
        <div className="flex items-center justify-between p-3 px-4 bg-blue-50/70 dark:bg-zinc-800/80 border border-blue-200 dark:border-zinc-700 rounded-lg animate-in fade-in slide-in-from-top-2 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-zinc-300">
            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-600 text-white">
              {selectedRowCount}
            </span>
            <span>{selectedRowCount === 1 ? "user selected" : "users selected"}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRowSelection({})}
              className="bg-white dark:bg-zinc-900 border-slate-300 dark:border-zinc-700"
            >
              Clear Selection
            </Button>
            {hasPermission("CONFIG_USERS_DELETE") && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setIsBulkDeleteDialogOpen(true)}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                <Trash2 className="mr-1.5 h-4 w-4" /> Remove Selected ({selectedRowCount})
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center justify-between">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500 dark:text-zinc-400" />
            <Input 
              placeholder="Search users..." 
              className="pl-9 w-64 sm:w-80 bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 focus-visible:ring-blue-500/30"
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="ml-auto">
                Columns <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {table
                .getAllColumns()
                .filter((column) => column.getCanHide())
                .map((column) => {
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) => column.toggleVisibility(!!value)}
                    >
                      {column.id.replace(/_/g, " ")}
                    </DropdownMenuCheckboxItem>
                  );
                })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Card className="flex-1 min-h-0 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-sm flex flex-col p-0">
          <Table className="m-0 relative" containerClassName="w-full overflow-x-auto">
            <TableHeader >
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="border-t-0">
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} className="h-12">
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="text-center py-8 text-slate-500">Loading users...</TableCell>
                </TableRow>
              ) : table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="text-center py-8 text-slate-500">No users found.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>

        {/* PAGINATION */}
        <div className="border-t border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 py-3">
          <DataTablePagination table={table} noun="user(s)" />
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{editingUser ? "Edit User" : "Add New User"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Full Name</label>
              <Input 
                value={formData.full_name} 
                onChange={e => {
                  const sanitized = e.target.value.replace(/[^a-zA-Z\s]/g, "");
                  setFormData({...formData, full_name: sanitized});
                }} 
                placeholder="John Doe"
              />
              <p className="text-[11px] text-muted-foreground">Letters and spaces only (no symbols or numbers).</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <div className="flex rounded-md shadow-sm">
                <Input 
                  type="text"
                  required
                  value={formData.email} 
                  onChange={e => setFormData({...formData, email: e.target.value.replace(/@.*$/, "")})} 
                  placeholder="john"
                  className="rounded-r-md rounded-tr-none rounded-br-none focus-visible:ring-0 focus-visible:ring-offset-0 border-r-0"
                />
                <span className="inline-flex items-center rounded-r-md border border-l-0 border-slate-200 bg-slate-50 px-3 text-sm text-slate-500 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-400">
                  @zenatech.com
                </span>
              </div>
            </div>
            <div className="flex items-center space-x-2 pt-2">
              <input 
                type="checkbox" 
                id="is_active"
                checked={formData.is_active}
                onChange={e => setFormData({...formData, is_active: e.target.checked})}
                className="rounded border-slate-300"
              />
              <label htmlFor="is_active" className="text-sm font-medium">Active Account</label>
            </div>
            <div className="flex items-center space-x-2">
              <input 
                type="checkbox" 
                id="is_super_admin"
                checked={formData.is_super_admin}
                onChange={e => setFormData({...formData, is_super_admin: e.target.checked})}
                className="rounded border-slate-300"
              />
              <label htmlFor="is_super_admin" className="text-sm font-medium text-purple-700 dark:text-purple-400">Super Admin Privileges</label>
            </div>
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white" disabled={createMutation.isPending || updateMutation.isPending}>
                {editingUser ? "Update User" : "Create User"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* SINGLE USER DELETE DIALOG */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to remove this user?</AlertDialogTitle>
            <AlertDialogDescription>
              This will deactivate and remove the user account for {userToDelete?.full_name || userToDelete?.email}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleteMutation.isPending ? "Removing..." : "Remove User"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* BULK USER DELETE DIALOG */}
      <AlertDialog open={isBulkDeleteDialogOpen} onOpenChange={setIsBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Are you sure you want to remove {selectedRowCount} user{selectedRowCount === 1 ? "" : "s"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will deactivate and remove the selected {selectedRowCount} user account{selectedRowCount === 1 ? "" : "s"}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmBulkDelete}
              disabled={bulkDeleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {bulkDeleteMutation.isPending ? "Removing..." : "Remove Users"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ACTIVATE / DEACTIVATE DIALOG */}
      <AlertDialog open={isDeactivateDialogOpen} onOpenChange={setIsDeactivateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {userToDeactivate?.is_active ? "Deactivate User" : "Activate User"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {userToDeactivate?.is_active 
                ? "This will deactivate the user account. They will no longer be able to log in, but their data will be preserved."
                : "This will reactivate the user account, allowing them to log in again."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={updateMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDeactivate}
              disabled={updateMutation.isPending}
              className={userToDeactivate?.is_active ? "bg-orange-600 hover:bg-orange-700 text-white" : "bg-green-600 hover:bg-green-700 text-white"}
            >
              {updateMutation.isPending ? "Updating..." : (userToDeactivate?.is_active ? "Deactivate" : "Activate")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

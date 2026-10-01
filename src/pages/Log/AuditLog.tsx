import { useState, useMemo } from "react";
import HelpIcon from "@/components/ui/HelpIcon";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/services/apiClient";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Search, ArrowUpDown, Loader2, CheckCircle2, XCircle, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
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
} from "@tanstack/react-table";

export default function AuditLog() {
  const { data: auditLogs = [], isLoading: isAuditLoading } = useQuery({
    queryKey: ["auditLogs"],
    queryFn: () => apiClient.get<any[]>("/api/audit-logs"),
  });

  const { data: loginActivities = [], isLoading: isLoginLoading } = useQuery({
    queryKey: ["loginActivities"],
    queryFn: () => apiClient.get<any[]>("/api/login-activities"),
  });

  const getActionBadgeColor = (action: string) => {
    const act = action.toUpperCase();
    if (act.includes('CREATE')) return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400';
    if (act.includes('UPDATE')) return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400';
    if (act.includes('DELETE')) return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-400';
    return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-zinc-800 dark:text-slate-300';
  };

  // ---------------------------------------------------------------------------
  // AUDIT LOGS TABLE
  // ---------------------------------------------------------------------------
  const [auditSorting, setAuditSorting] = useState<SortingState>([{ id: "created_at", desc: true }]);
  const [auditColumnFilters, setAuditColumnFilters] = useState<ColumnFiltersState>([]);
  const [auditColumnVisibility, setAuditColumnVisibility] = useState<VisibilityState>({});
  const [auditGlobalFilter, setAuditGlobalFilter] = useState("");

  const auditColumns = useMemo<ColumnDef<any>[]>(() => [
    {
      accessorKey: "created_at",
      header: ({ column }) => (
        <Button variant="ghost" className="px-0 font-semibold" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Date & Time
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => <span className="font-medium">{new Date(row.original.created_at).toLocaleString()}</span>,
    },
    {
      accessorKey: "actor_name",
      header: ({ column }) => (
        <Button variant="ghost" className="px-0 font-semibold" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Actor
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium text-slate-900 dark:text-slate-100">{row.original.actor_name || 'System'}</span>
          {row.original.actor_email && <span className="text-xs text-slate-500">{row.original.actor_email}</span>}
        </div>
      ),
    },
    {
      accessorKey: "action",
      header: ({ column }) => (
        <Button variant="ghost" className="px-0 font-semibold" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Action
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <Badge variant="outline" className={getActionBadgeColor(row.original.action)}>
          {row.original.action}
        </Badge>
      ),
    },
    {
      accessorKey: "entity_type",
      header: ({ column }) => (
        <Button variant="ghost" className="px-0 font-semibold" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Entity Type
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.entity_type}</span>,
    },
    {
      accessorKey: "entity_id",
      header: ({ column }) => (
        <Button variant="ghost" className="px-0 font-semibold" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Entity ID
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <span className="font-mono text-xs text-slate-500 max-w-[150px] truncate block" title={row.original.entity_id}>
          {row.original.entity_id}
        </span>
      ),
    },
  ], []);

  const auditTable = useReactTable({
    data: auditLogs,
    columns: auditColumns,
    onSortingChange: setAuditSorting,
    onColumnFiltersChange: setAuditColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setAuditColumnVisibility,
    initialState: {
      pagination: {
        pageSize: 50,
      },
    },
    globalFilterFn: (row, _columnId, filterValue) => {
      const search = filterValue.toLowerCase();
      const actor = (row.getValue("actor_name") as string)?.toLowerCase() || "";
      const action = (row.getValue("action") as string)?.toLowerCase() || "";
      const entity = (row.getValue("entity_type") as string)?.toLowerCase() || "";
      return actor.includes(search) || action.includes(search) || entity.includes(search);
    },
    state: {
      sorting: auditSorting,
      columnFilters: auditColumnFilters,
      columnVisibility: auditColumnVisibility,
      globalFilter: auditGlobalFilter,
    },
    onGlobalFilterChange: setAuditGlobalFilter,
  });


  // ---------------------------------------------------------------------------
  // LOGIN ACTIVITIES TABLE
  // ---------------------------------------------------------------------------
  const [loginSorting, setLoginSorting] = useState<SortingState>([{ id: "created_at", desc: true }]);
  const [loginColumnFilters, setLoginColumnFilters] = useState<ColumnFiltersState>([]);
  const [loginColumnVisibility, setLoginColumnVisibility] = useState<VisibilityState>({});
  const [loginGlobalFilter, setLoginGlobalFilter] = useState("");

  const loginColumns = useMemo<ColumnDef<any>[]>(() => [
    {
      accessorKey: "created_at",
      header: ({ column }) => (
        <Button variant="ghost" className="px-0 font-semibold w-[200px] justify-start" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Date & Time
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => <span className="font-medium whitespace-nowrap">{new Date(row.original.created_at).toLocaleString()}</span>,
    },
    {
      accessorKey: "email",
      header: ({ column }) => (
        <Button variant="ghost" className="px-0 font-semibold" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Account
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium text-slate-900 dark:text-slate-100">{row.original.user_full_name || 'Unknown'}</span>
          <span className="text-xs text-slate-500">{row.original.email}</span>
        </div>
      ),
    },
    {
      accessorKey: "success",
      header: ({ column }) => (
        <Button variant="ghost" className="px-0 font-semibold" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Status
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const log = row.original;
        return log.success ? (
          <div className="flex flex-col gap-1">
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 gap-1.5 w-fit">
              <CheckCircle2 className="h-3 w-3" />
              Success
            </Badge>
            {log.logout_at && (
              <span className="text-xs text-slate-500 font-medium whitespace-nowrap">
                Logged out: {new Date(log.logout_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
              </span>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-400 gap-1.5 w-fit">
              <XCircle className="h-3 w-3" />
              Failed
            </Badge>
            <span className="text-xs text-red-600 dark:text-red-400 font-medium truncate max-w-[200px]" title={log.failure_reason}>
              {log.failure_reason}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: "ip_address",
      header: ({ column }) => (
        <Button variant="ghost" className="px-0 font-semibold" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          IP Address
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.ip_address || 'N/A'}</span>,
    },
    {
      accessorKey: "user_agent",
      header: () => <div className="font-semibold w-[300px]">User Agent</div>,
      cell: ({ row }) => (
        <span className="text-xs text-slate-500 truncate max-w-[300px] block" title={row.original.user_agent}>
          {row.original.user_agent || 'Unknown'}
        </span>
      ),
    },
  ], []);

  const loginTable = useReactTable({
    data: loginActivities,
    columns: loginColumns,
    onSortingChange: setLoginSorting,
    onColumnFiltersChange: setLoginColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setLoginColumnVisibility,
    initialState: {
      pagination: {
        pageSize: 50,
      },
    },
    globalFilterFn: (row, _columnId, filterValue) => {
      const search = filterValue.toLowerCase();
      const name = (row.original.user_full_name as string)?.toLowerCase() || "";
      const email = (row.getValue("email") as string)?.toLowerCase() || "";
      const ip = (row.getValue("ip_address") as string)?.toLowerCase() || "";
      const reason = (row.original.failure_reason as string)?.toLowerCase() || "";
      return name.includes(search) || email.includes(search) || ip.includes(search) || reason.includes(search);
    },
    state: {
      sorting: loginSorting,
      columnFilters: loginColumnFilters,
      columnVisibility: loginColumnVisibility,
      globalFilter: loginGlobalFilter,
    },
    onGlobalFilterChange: setLoginGlobalFilter,
  });

  return (
    <div className="flex-1 min-h-0 flex flex-col w-full gamax-w-[1600px] mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out pb-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            Audit & Security Logs<HelpIcon text="Displays a detailed timeline of administrative actions, config edits, and security events for compliance." />
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Track system activity, configuration changes, and login attempts.</p>
        </div>
      </div>

      <Tabs defaultValue="actions" className="flex-1 flex flex-col min-h-0">
        <TabsList className="grid w-[400px] grid-cols-2 mb-4" variant="line">
          <TabsTrigger value="actions">Actions</TabsTrigger>
          <TabsTrigger value="logins">Login Activities</TabsTrigger>
        </TabsList>
        
        <TabsContent value="actions" className="flex-1 flex flex-col min-h-0 m-0 data-[state=active]:flex">
          <div className="space-y-4 flex-1 flex flex-col min-h-0">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center justify-between">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <Input 
                  type="text" 
                  placeholder="Search actions..." 
                  value={auditGlobalFilter}
                  onChange={(e) => setAuditGlobalFilter(e.target.value)}
                  className="pl-10 w-[280px] bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 rounded-xl"
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="ml-auto">
                    Columns <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {auditTable
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
                  {auditTable.getHeaderGroups().map((headerGroup) => (
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
                  {isAuditLoading ? (
                    <TableRow>
                      <TableCell colSpan={auditColumns.length} className="text-center py-8">
                        <div className="flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-blue-500" /></div>
                      </TableCell>
                    </TableRow>
                  ) : auditTable.getRowModel().rows?.length ? (
                    auditTable.getRowModel().rows.map((row) => (
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
                      <TableCell colSpan={auditColumns.length} className="text-center py-8 text-slate-500">No logs found.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>

            {/* PAGINATION FOR ACTIONS */}
            <div className="border-t border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 py-3">
              <DataTablePagination table={auditTable} noun="action(s)" />
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="logins" className="flex-1 flex flex-col min-h-0 m-0 data-[state=active]:flex">
          <div className="space-y-4 flex-1 flex flex-col min-h-0">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center justify-between">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <Input 
                  type="text" 
                  placeholder="Search activities..." 
                  value={loginGlobalFilter}
                  onChange={(e) => setLoginGlobalFilter(e.target.value)}
                  className="pl-10 w-[280px] bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 rounded-xl"
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="ml-auto">
                    Columns <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {loginTable
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
                  {loginTable.getHeaderGroups().map((headerGroup) => (
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
                  {isLoginLoading ? (
                    <TableRow>
                      <TableCell colSpan={loginColumns.length} className="text-center py-8">
                        <div className="flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-blue-500" /></div>
                      </TableCell>
                    </TableRow>
                  ) : loginTable.getRowModel().rows?.length ? (
                    loginTable.getRowModel().rows.map((row) => (
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
                      <TableCell colSpan={loginColumns.length} className="text-center py-8 text-slate-500">No login activities found.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>

            {/* PAGINATION FOR LOGINS */}
            <div className="border-t border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 py-3">
              <DataTablePagination table={loginTable} noun="activity(ies)" />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

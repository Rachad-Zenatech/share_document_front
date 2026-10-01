import { useState, useEffect, useMemo } from "react";
import { apiClient as api } from "@/services/apiClient";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Search,
  RefreshCw,
  Calendar,
  User as UserIcon,
  Activity,
  ShieldAlert,
  ExternalLink,
  Clock,
  CheckCircle2,
  XCircle,
  PlusCircle,
  Send,
  Eye,
  FileText,
  CreditCard,
  Edit3,
  Trash2,
  Copy,
  Check,
  Globe,
  Monitor,
  Layers,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Filter,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface AuditLogItem {
  id: number | string;
  entity_type: string;
  entity_id: string;
  entity_title?: string | null;
  action: string;
  user_id?: string | null;
  actor_name?: string | null;
  actor_email?: string | null;
  actor_department?: string | null;
  actor_job_title?: string | null;
  changes?: any;
  old_value?: any;
  new_value?: any;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at: string;
}

// Helper to format human-readable action details
export function getActionMeta(action: string) {
  const act = (action || "").toUpperCase();

  if (act.includes("CREATE") || act === "NEW_REQUEST") {
    return {
      label: "Created",
      color: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
      icon: PlusCircle,
      iconColor: "text-emerald-600 dark:text-emerald-400",
      dotColor: "bg-emerald-500",
    };
  }
  if (act.includes("SUBMIT")) {
    return {
      label: "Submitted for Approval",
      color: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800",
      icon: Send,
      iconColor: "text-sky-600 dark:text-sky-400",
      dotColor: "bg-sky-500",
    };
  }
  if (act.includes("REVIEW") || act === "START_REVIEW") {
    return {
      label: "Under Review",
      color: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800",
      icon: Eye,
      iconColor: "text-purple-600 dark:text-purple-400",
      dotColor: "bg-purple-500",
    };
  }
  if (act.includes("APPROV") || act.includes("DECISION")) {
    return {
      label: "Approved",
      color: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800",
      icon: CheckCircle2,
      iconColor: "text-teal-600 dark:text-teal-400",
      dotColor: "bg-teal-500",
    };
  }
  if (act.includes("REJECT")) {
    return {
      label: "Rejected",
      color: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800",
      icon: XCircle,
      iconColor: "text-rose-600 dark:text-rose-400",
      dotColor: "bg-rose-500",
    };
  }
  if (act.includes("PO_") || act.includes("PURCHASE_ORDER")) {
    return {
      label: "PO Issued",
      color: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
      icon: FileText,
      iconColor: "text-amber-600 dark:text-amber-400",
      dotColor: "bg-amber-500",
    };
  }
  if (act.includes("PAID") || act.includes("INVOICE_PAID") || act.includes("PAYMENT")) {
    return {
      label: "Invoice Paid",
      color: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800",
      icon: CreditCard,
      iconColor: "text-indigo-600 dark:text-indigo-400",
      dotColor: "bg-indigo-500",
    };
  }
  if (act.includes("STATUS_CHANGE") || act.includes("TRANSITION")) {
    return {
      label: "Status Changed",
      color: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800",
      icon: RefreshCw,
      iconColor: "text-blue-600 dark:text-blue-400",
      dotColor: "bg-blue-500",
    };
  }
  if (act.includes("UPDATE") || act.includes("EDIT")) {
    return {
      label: "Updated",
      color: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
      icon: Edit3,
      iconColor: "text-slate-600 dark:text-zinc-400",
      dotColor: "bg-slate-500",
    };
  }
  if (act.includes("DELETE") || act.includes("REMOVE")) {
    return {
      label: "Deleted",
      color: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800",
      icon: Trash2,
      iconColor: "text-rose-600 dark:text-rose-400",
      dotColor: "bg-rose-500",
    };
  }

  return {
    label: action.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()),
    color: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
    icon: Activity,
    iconColor: "text-slate-600 dark:text-zinc-400",
    dotColor: "bg-slate-400",
  };
}

// Generate a concise human-readable summary of what changed
function generateChangeSummary(log: AuditLogItem): string {
  const changes = log.changes || log.new_value;
  if (!changes) {
    const meta = getActionMeta(log.action);
    return `${meta.label} on ${log.entity_type} #${log.entity_id}`;
  }

  if (typeof changes === "object") {
    if (changes.status) {
      if (changes.old_status) {
        return `Status transitioned: ${changes.old_status} → ${changes.status}`;
      }
      return `Status set to: ${changes.status}`;
    }
    if (changes.amount != null) {
      return `Amount: $${Number(changes.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
    }
    if (changes.approver_name || changes.approver_id) {
      return `Decision recorded by ${changes.approver_name || "Approver"}`;
    }
    if (changes.message) {
      return String(changes.message);
    }
    const keys = Object.keys(changes).filter((k) => k !== "id" && k !== "updated_at");
    if (keys.length > 0) {
      return `Modified ${keys.slice(0, 3).join(", ")}${keys.length > 3 ? ` +${keys.length - 3} more` : ""}`;
    }
  }

  return getActionMeta(log.action).label;
}

// Helper to format timestamps cleanly
function formatLogDate(dateStr: string) {
  if (!dateStr) return { date: "-", time: "", relative: "" };
  try {
    const d = new Date(dateStr);
    const dateFormatted = d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const timeFormatted = d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });

    // Calculate relative time
    const diffSeconds = Math.floor((Date.now() - d.getTime()) / 1000);
    let relative = "";
    if (diffSeconds < 60) relative = "Just now";
    else if (diffSeconds < 3600) relative = `${Math.floor(diffSeconds / 60)}m ago`;
    else if (diffSeconds < 86400) relative = `${Math.floor(diffSeconds / 3600)}h ago`;
    else relative = `${Math.floor(diffSeconds / 86400)}d ago`;

    return { date: dateFormatted, time: timeFormatted, relative };
  } catch {
    return { date: dateStr, time: "", relative: "" };
  }
}

// User Initials generator
function getInitials(name?: string | null) {
  if (!name) return "SYS";
  const parts = name.trim().split(" ");
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export default function SystemLogsPage() {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filters state
  const [search, setSearch] = useState("");
  const [entityTypeFilter, setEntityTypeFilter] = useState("ALL");
  const [actionFilter, setActionFilter] = useState("ALL");
  const [timeFilter, setTimeFilter] = useState("ALL");

  // Pagination
  const [limit, setLimit] = useState(50);
  const [page, setPage] = useState(1);

  // Inspector Drawer state
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);
  const [entityHistory, setEntityHistory] = useState<AuditLogItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [copied, setCopied] = useState(false);

  // Fetch logs
  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append("limit", String(limit));
      params.append("offset", String((page - 1) * limit));

      if (entityTypeFilter && entityTypeFilter !== "ALL") {
        params.append("entity_type", entityTypeFilter);
      }
      if (actionFilter && actionFilter !== "ALL") {
        params.append("action", actionFilter);
      }
      if (search.trim()) {
        params.append("search", search.trim());
      }

      // Date calculations for timeFilter
      if (timeFilter === "TODAY") {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        params.append("date_from", today.toISOString());
      } else if (timeFilter === "WEEK") {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        params.append("date_from", weekAgo.toISOString());
      } else if (timeFilter === "MONTH") {
        const monthAgo = new Date();
        monthAgo.setDate(monthAgo.getDate() - 30);
        params.append("date_from", monthAgo.toISOString());
      }

      const res = await api.get<{ items: AuditLogItem[]; total: number }>(`/logs?${params.toString()}`);
      setLogs(res.items || []);
      setTotal(res.total || 0);
    } catch (e: any) {
      console.error(e);
      toast.error("Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, limit, entityTypeFilter, actionFilter, timeFilter]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchLogs();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Handle opening inspector drawer
  const handleOpenInspector = async (log: AuditLogItem) => {
    setSelectedLog(log);
    setLoadingHistory(true);
    try {
      const res = await api.get<{ items: AuditLogItem[] }>(
        `/logs?limit=50&entity_type=${log.entity_type}&entity_id=${log.entity_id}`
      );
      setEntityHistory(res.items || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleCopyJson = (data: any) => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(true);
    toast.success("JSON copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  // KPI Calculations
  const stats = useMemo(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    const todayCount = logs.filter((l) => l.created_at && l.created_at.startsWith(todayStr)).length;
    const uniqueUsers = new Set(logs.map((l) => l.actor_name || l.user_id).filter(Boolean)).size;
    const uniqueEntities = new Set(logs.map((l) => `${l.entity_type}:${l.entity_id}`)).size;

    return {
      totalCount: total,
      todayCount,
      uniqueUsers,
      uniqueEntities,
    };
  }, [logs, total]);

  return (
    <div className="flex-1 min-h-0 flex flex-col space-y-6 pb-6 p-4 sm:p-6 max-w-[1650px] mx-auto w-full">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50 shadow-2xs">
              <Activity className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
                System Audit Logs
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Comprehensive, tamper-evident audit trail of all actions, approvals, payments, and system events.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchLogs}
            disabled={loading}
            className="h-9 gap-1.5 bg-white dark:bg-zinc-950 shadow-2xs font-medium text-xs sm:text-sm"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-indigo-600" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* ── KPI Metric Summary Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Events</span>
            <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400">
              <Layers className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-zinc-100 mt-2">
            {stats.totalCount.toLocaleString()}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Recorded across all modules</p>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Today's Activity</span>
            <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <Sparkles className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">
            {stats.todayCount}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Actions executed today</p>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Active Entities</span>
            <div className="p-1.5 rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400">
              <FileText className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-zinc-100 mt-2">
            {stats.uniqueEntities}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Unique records in current view</p>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Active Actors</span>
            <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <UserIcon className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-zinc-100 mt-2">
            {stats.uniqueUsers}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Unique operators & systems</p>
        </div>
      </div>

      {/* ── Search & Filter Control Bar ── */}
      <div className="p-3.5 sm:p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by user name, email, request title, action, or record ID..."
              className="pl-9 h-10 text-xs sm:text-sm bg-slate-50/50 dark:bg-zinc-900/50"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            )}
          </div>

          {/* Entity Type Selector */}
          <div className="w-full md:w-56">
            <Select
              value={entityTypeFilter}
              onValueChange={(val) => {
                setEntityTypeFilter(val);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-10 text-xs sm:text-sm bg-slate-50/50 dark:bg-zinc-900/50 font-medium">
                <div className="flex items-center gap-1.5 truncate">
                  <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground mr-1">Entity:</span>
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Entity Types</SelectItem>
                <SelectItem value="PurchaseRequest">📦 Purchase Request</SelectItem>
                <SelectItem value="User">👤 User Account</SelectItem>
                <SelectItem value="Role">🛡️ Role & Permission</SelectItem>
                <SelectItem value="Workflow">⚙️ Workflow Assignment</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Action Category Selector */}
          <div className="w-full md:w-56">
            <Select
              value={actionFilter}
              onValueChange={(val) => {
                setActionFilter(val);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-10 text-xs sm:text-sm bg-slate-50/50 dark:bg-zinc-900/50 font-medium">
                <div className="flex items-center gap-1.5 truncate">
                  <Activity className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground mr-1">Action:</span>
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Action Types</SelectItem>
                <SelectItem value="CREATED">✨ Created</SelectItem>
                <SelectItem value="SUBMITTED_FOR_APPROVAL">🚀 Submitted for Approval</SelectItem>
                <SelectItem value="START_REVIEW">🔍 Started Review</SelectItem>
                <SelectItem value="APPROVAL_DECISION">✅ Approved / Decision</SelectItem>
                <SelectItem value="PO_CREATED">📄 PO Created</SelectItem>
                <SelectItem value="INVOICE_PAID">💳 Invoice Paid</SelectItem>
                <SelectItem value="STATUS_CHANGED">🔄 Status Changed</SelectItem>
                <SelectItem value="REJECTED">❌ Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Time Window Filter */}
          <div className="w-full md:w-48">
            <Select
              value={timeFilter}
              onValueChange={(val) => {
                setTimeFilter(val);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-10 text-xs sm:text-sm bg-slate-50/50 dark:bg-zinc-900/50 font-medium">
                <div className="flex items-center gap-1.5 truncate">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Time</SelectItem>
                <SelectItem value="TODAY">Today Only</SelectItem>
                <SelectItem value="WEEK">Past 7 Days</SelectItem>
                <SelectItem value="MONTH">Past 30 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* ── Main Audit Logs Table ── */}
      <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-2xs overflow-hidden flex flex-col flex-1 min-h-[400px]">
        <div className="overflow-x-auto flex-1">
          <Table>
            <TableHeader className="bg-slate-50/70 dark:bg-zinc-900/50 border-b border-slate-200 dark:border-zinc-800">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[180px] font-semibold text-slate-700 dark:text-zinc-300 text-xs uppercase tracking-wider py-3.5">
                  Timestamp
                </TableHead>
                <TableHead className="w-[240px] font-semibold text-slate-700 dark:text-zinc-300 text-xs uppercase tracking-wider">
                  Actor / User
                </TableHead>
                <TableHead className="w-[190px] font-semibold text-slate-700 dark:text-zinc-300 text-xs uppercase tracking-wider">
                  Action
                </TableHead>
                <TableHead className="w-[280px] font-semibold text-slate-700 dark:text-zinc-300 text-xs uppercase tracking-wider">
                  Target Entity
                </TableHead>
                <TableHead className="font-semibold text-slate-700 dark:text-zinc-300 text-xs uppercase tracking-wider">
                  Summary & Context
                </TableHead>
                <TableHead className="w-[100px] text-right font-semibold text-slate-700 dark:text-zinc-300 text-xs uppercase tracking-wider pr-4">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6} className="py-4">
                      <div className="h-8 bg-slate-100 dark:bg-zinc-900 rounded-lg animate-pulse" />
                    </TableCell>
                  </TableRow>
                ))
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-16">
                    <div className="flex flex-col items-center justify-center space-y-2 text-muted-foreground">
                      <ShieldAlert className="h-10 w-10 text-slate-300 dark:text-zinc-700 stroke-1" />
                      <p className="text-base font-semibold text-slate-700 dark:text-zinc-300">No audit logs found</p>
                      <p className="text-xs max-w-sm">
                        No events match your current search and filter criteria. Try adjusting the search query or resetting filters.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSearch("");
                          setEntityTypeFilter("ALL");
                          setActionFilter("ALL");
                          setTimeFilter("ALL");
                        }}
                        className="mt-2 text-xs"
                      >
                        Reset All Filters
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => {
                  const actionMeta = getActionMeta(log.action);
                  const ActionIcon = actionMeta.icon;
                  const dateInfo = formatLogDate(log.created_at);
                  const isPurchaseRequest = log.entity_type === "PurchaseRequest";
                  const entityLabel = log.entity_title
                    ? log.entity_title
                    : `${log.entity_type} #${log.entity_id}`;

                  return (
                    <TableRow
                      key={log.id}
                      onClick={() => handleOpenInspector(log)}
                      className="cursor-pointer hover:bg-slate-50/80 dark:hover:bg-zinc-900/60 transition-colors group"
                    >
                      {/* 1. Timestamp */}
                      <TableCell className="py-3 font-medium">
                        <div className="space-y-0.5">
                          <div className="text-xs font-semibold text-slate-900 dark:text-zinc-100 flex items-center gap-1.5">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            <span>{dateInfo.time}</span>
                          </div>
                          <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                            <span>{dateInfo.date}</span>
                            <span className="text-[10px] px-1 py-0 rounded bg-slate-100 dark:bg-zinc-800 text-slate-500 font-mono">
                              {dateInfo.relative}
                            </span>
                          </div>
                        </div>
                      </TableCell>

                      {/* 2. Actor / User */}
                      <TableCell className="py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-indigo-500 to-indigo-700 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs ring-1 ring-white dark:ring-zinc-900">
                            {getInitials(log.actor_name)}
                          </div>
                          <div className="min-w-0 flex flex-col">
                            <div className="text-xs font-semibold text-slate-900 dark:text-zinc-100 truncate">
                              {log.actor_name || "System Automation"}
                            </div>
                            <div className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                              {log.actor_email ? (
                                <span>{log.actor_email}</span>
                              ) : log.actor_department ? (
                                <span className="text-slate-500">{log.actor_department}</span>
                              ) : (
                                <span className="font-mono text-[10px] text-slate-400">
                                  {log.user_id ? log.user_id.slice(0, 8) : "System"}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </TableCell>

                      {/* 3. Action */}
                      <TableCell className="py-3">
                        <Badge
                          variant="outline"
                          className={`text-xs font-semibold px-2.5 py-1 gap-1.5 inline-flex items-center rounded-lg ${actionMeta.color}`}
                        >
                          <ActionIcon className={`h-3.5 w-3.5 ${actionMeta.iconColor}`} />
                          <span>{actionMeta.label}</span>
                        </Badge>
                      </TableCell>

                      {/* 4. Target Entity */}
                      <TableCell className="py-3">
                        <div className="flex items-center gap-2 min-w-0">
                          {isPurchaseRequest ? (
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/purchasing/requests/${log.entity_id}`);
                              }}
                              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:underline flex items-center gap-1.5 truncate group/link"
                              title={`Open Purchase Request #${log.entity_id}`}
                            >
                              <span className="p-1 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-mono text-[10px] font-bold border border-indigo-100 dark:border-indigo-900">
                                #{log.entity_id}
                              </span>
                              <span className="truncate">{log.entity_title || `Request #${log.entity_id}`}</span>
                              <ExternalLink className="h-3 w-3 opacity-0 group-hover/link:opacity-100 transition-opacity shrink-0" />
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-xs truncate">
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono">
                                {log.entity_type}
                              </Badge>
                              <span className="font-medium text-slate-800 dark:text-zinc-200 truncate">
                                {entityLabel}
                              </span>
                            </div>
                          )}
                        </div>
                      </TableCell>

                      {/* 5. Summary & Context */}
                      <TableCell className="py-3">
                        <div className="text-xs text-slate-600 dark:text-zinc-400 font-normal truncate max-w-md">
                          {generateChangeSummary(log)}
                        </div>
                      </TableCell>

                      {/* 6. Action Button */}
                      <TableCell className="py-3 text-right pr-4">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenInspector(log);
                          }}
                          className="h-7 text-xs font-medium px-2.5 opacity-80 group-hover:opacity-100 gap-1 hover:bg-slate-100 dark:hover:bg-zinc-800"
                        >
                          <Eye className="h-3.5 w-3.5 text-slate-500" />
                          <span>Details</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* ── Table Footer & Pagination ── */}
        <div className="p-3.5 border-t border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/30 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>
              Showing{" "}
              <strong className="text-slate-900 dark:text-zinc-100">
                {logs.length > 0 ? (page - 1) * limit + 1 : 0}
              </strong>{" "}
              to{" "}
              <strong className="text-slate-900 dark:text-zinc-100">
                {Math.min(page * limit, total)}
              </strong>{" "}
              of <strong className="text-slate-900 dark:text-zinc-100">{total}</strong> records
            </span>

            <div className="flex items-center gap-1.5 ml-4">
              <span>Per page:</span>
              <Select
                value={String(limit)}
                onValueChange={(val) => {
                  setLimit(Number(val));
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-7 text-xs w-20 bg-white dark:bg-zinc-950">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="h-8 text-xs gap-1 bg-white dark:bg-zinc-950 px-2.5"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Previous
            </Button>
            <span className="px-3 py-1 font-semibold text-slate-800 dark:text-zinc-200">
              Page {page} of {Math.max(1, Math.ceil(total / limit))}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page * limit >= total || loading}
              onClick={() => setPage((p) => p + 1)}
              className="h-8 text-xs gap-1 bg-white dark:bg-zinc-950 px-2.5"
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* ── Rich Audit Log Inspector Drawer (Sheet) ── */}
      <Sheet open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <SheetContent className="!w-full sm:!w-[640px] md:!w-[768px] lg:!w-[900px] xl:!w-[1020px] sm:!max-w-2xl md:!max-w-3xl lg:!max-w-4xl xl:!max-w-5xl flex flex-col p-0 overflow-hidden bg-white dark:bg-zinc-950">
          {selectedLog && (
            <div className="flex flex-col h-full">
              {/* Drawer Top Header */}
              <div className="p-6 pb-4 border-b border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-900/50">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-100 dark:border-indigo-900/50 shadow-2xs shrink-0">
                      <Activity className="h-5 w-5" />
                    </div>
                    <div>
                      <SheetTitle className="text-lg font-bold text-slate-900 dark:text-zinc-100">
                        Audit Event #{selectedLog.id}
                      </SheetTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Recorded on {formatLogDate(selectedLog.created_at).date} at {formatLogDate(selectedLog.created_at).time}
                      </p>
                    </div>
                  </div>

                  <Badge
                    variant="outline"
                    className={`text-xs font-semibold px-3 py-1 gap-1.5 ${getActionMeta(selectedLog.action).color}`}
                  >
                    {getActionMeta(selectedLog.action).label}
                  </Badge>
                </div>

                {/* Actor Profile Mini-Card */}
                <div className="mt-4 p-3 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 flex items-center justify-between shadow-2xs">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-indigo-500 to-indigo-700 text-white font-bold text-xs flex items-center justify-center shadow-2xs">
                      {getInitials(selectedLog.actor_name)}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-zinc-100">
                        {selectedLog.actor_name || "System Automation"}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {selectedLog.actor_email || "system@internal.zenatech.com"}
                        {selectedLog.actor_department ? ` • ${selectedLog.actor_department}` : ""}
                      </div>
                    </div>
                  </div>

                  {selectedLog.user_id && (
                    <div className="text-[10px] font-mono text-muted-foreground bg-slate-100 dark:bg-zinc-800 px-2 py-1 rounded">
                      ID: {selectedLog.user_id.slice(0, 8)}...
                    </div>
                  )}
                </div>
              </div>

              {/* Drawer Scrollable Content with Tabs */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Target Entity Card */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/30 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300 uppercase tracking-wide">
                      Target Entity
                    </span>
                    {selectedLog.entity_type === "PurchaseRequest" && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/purchasing/requests/${selectedLog.entity_id}`)}
                        className="h-7 text-xs gap-1.5 text-indigo-600 bg-white dark:bg-zinc-950 font-medium"
                      >
                        <span>Open Request</span>
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <span className="text-[11px] text-muted-foreground block">Entity Type</span>
                      <span className="text-xs font-bold text-slate-900 dark:text-zinc-100">
                        {selectedLog.entity_type}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-muted-foreground block">Record ID</span>
                      <span className="text-xs font-mono font-bold text-slate-900 dark:text-zinc-100">
                        #{selectedLog.entity_id}
                      </span>
                    </div>
                    {selectedLog.entity_title && (
                      <div className="col-span-2">
                        <span className="text-[11px] text-muted-foreground block">Entity Subject / Title</span>
                        <span className="text-xs font-semibold text-slate-800 dark:text-zinc-200">
                          {selectedLog.entity_title}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Tabs for Details vs History Timeline */}
                <Tabs defaultValue="diff" className="space-y-4">
                  <TabsList className="grid w-full grid-cols-3 h-9">
                    <TabsTrigger value="diff" className="text-xs font-medium">
                      Field Changes
                    </TabsTrigger>
                    <TabsTrigger value="json" className="text-xs font-medium">
                      Raw JSON
                    </TabsTrigger>
                    <TabsTrigger value="history" className="text-xs font-medium">
                      Entity History ({entityHistory.length})
                    </TabsTrigger>
                  </TabsList>

                  {/* 1. Field Changes Visual Diff */}
                  <TabsContent value="diff" className="space-y-3 pt-1">
                    {selectedLog.changes && typeof selectedLog.changes === "object" ? (
                      <div className="rounded-xl border border-slate-200 dark:border-zinc-800 overflow-hidden">
                        <table className="w-full text-xs">
                          <thead className="bg-slate-100/70 dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 text-[11px] font-semibold text-slate-600 dark:text-zinc-400">
                            <tr>
                              <th className="text-left p-2.5 pl-3">Field</th>
                              <th className="text-left p-2.5">Updated / New Value</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 dark:divide-zinc-800">
                            {Object.entries(selectedLog.changes).map(([key, val]) => (
                              <tr key={key} className="hover:bg-slate-50/50 dark:hover:bg-zinc-900/50">
                                <td className="p-2.5 pl-3 font-semibold text-slate-700 dark:text-zinc-300 font-mono text-[11px]">
                                  {key}
                                </td>
                                <td className="p-2.5 font-medium text-slate-900 dark:text-zinc-100">
                                  {typeof val === "object" && val !== null ? (
                                    <pre className="text-[11px] font-mono bg-slate-50 dark:bg-zinc-900 p-2 rounded max-h-36 overflow-auto">
                                      {JSON.stringify(val, null, 2)}
                                    </pre>
                                  ) : (
                                    <span className="font-mono text-emerald-700 dark:text-emerald-400">
                                      {String(val)}
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="p-6 text-center rounded-xl border border-dashed text-xs text-muted-foreground bg-slate-50/50 dark:bg-zinc-900/30">
                        No structured field diff recorded for this action.
                      </div>
                    )}

                    {/* Metadata Box */}
                    <div className="p-3.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/30 space-y-2 text-xs">
                      <div className="text-[11px] font-semibold text-slate-700 dark:text-zinc-300 uppercase tracking-wide">
                        Network & Client Info
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-muted-foreground text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <Globe className="h-3.5 w-3.5 text-slate-400" />
                          <span>IP: {selectedLog.ip_address || "Internal Network"}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Monitor className="h-3.5 w-3.5 text-slate-400" />
                          <span className="truncate" title={selectedLog.user_agent || "Web Browser"}>
                            {selectedLog.user_agent ? selectedLog.user_agent.split(" ")[0] : "Web Portal"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  {/* 2. Raw JSON */}
                  <TabsContent value="json" className="space-y-2 pt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground font-medium">Audit Record Payload</span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopyJson(selectedLog)}
                        className="h-7 text-xs gap-1.5"
                      >
                        {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                        <span>{copied ? "Copied" : "Copy JSON"}</span>
                      </Button>
                    </div>
                    <pre className="p-3.5 rounded-xl bg-slate-900 text-slate-100 text-xs font-mono overflow-x-auto max-h-[360px] border border-slate-800">
                      {JSON.stringify(selectedLog, null, 2)}
                    </pre>
                  </TabsContent>

                  {/* 3. Entity History Timeline */}
                  <TabsContent value="history" className="space-y-4 pt-1">
                    {loadingHistory ? (
                      <div className="py-10 text-center text-xs text-muted-foreground">
                        <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-indigo-600" />
                        Loading entity history...
                      </div>
                    ) : entityHistory.length === 0 ? (
                      <div className="p-6 text-center rounded-xl border border-dashed text-xs text-muted-foreground">
                        No previous audit entries found for this record.
                      </div>
                    ) : (
                      <div className="space-y-3 relative before:absolute before:inset-0 before:left-[17px] before:w-0.5 before:bg-slate-200 dark:before:bg-zinc-800">
                        {entityHistory.map((hist) => {
                          const hMeta = getActionMeta(hist.action);
                          const HIcon = hMeta.icon;
                          const hDate = formatLogDate(hist.created_at);

                          return (
                            <div key={hist.id} className="relative flex items-start gap-3 pl-1">
                              <div
                                className={`h-8 w-8 rounded-full border-2 border-white dark:border-zinc-950 flex items-center justify-center shrink-0 z-10 shadow-2xs ${hMeta.color}`}
                              >
                                <HIcon className={`h-4 w-4 ${hMeta.iconColor}`} />
                              </div>
                              <div className="flex-1 p-3 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-2xs space-y-1">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-xs font-bold text-slate-900 dark:text-zinc-100">
                                    {hMeta.label}
                                  </span>
                                  <span className="text-[11px] text-muted-foreground">
                                    {hDate.date} {hDate.time}
                                  </span>
                                </div>
                                <div className="text-[11px] text-muted-foreground">
                                  By <strong className="text-slate-700 dark:text-zinc-300">{hist.actor_name || "System"}</strong>
                                </div>
                                <div className="text-xs text-slate-600 dark:text-zinc-400 pt-1">
                                  {generateChangeSummary(hist)}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </div>

              {/* Drawer Footer */}
              <div className="p-4 border-t border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/30 flex items-center justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedLog(null)}
                  className="h-9 px-4 text-xs font-medium"
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

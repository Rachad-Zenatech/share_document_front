import {
  LayoutDashboard,
  ShieldCheck,
  FileClock,
  FileText,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavigationSubItem {
  label: string;
  path: string;
  navigationCode?: string;
}

export interface NavigationItem {
  label: string;
  path?: string;
  icon: LucideIcon;
  section?: string;
  navigationCode?: string;
  subItems?: NavigationSubItem[];
}

export const navigation: NavigationItem[] = [
  {
    label: "Dashboard",
    path: "/dashboard",
    icon: LayoutDashboard,
    section: "MAIN",
    navigationCode: "DASHBOARD",
  },
  {
    label: "SEC Filings",
    icon: FileText,
    section: "REPORTING & FILINGS",
    navigationCode: "SEC_FILINGS",
    subItems: [
      { label: "Filings Hub", path: "/sec-filings", navigationCode: "SEC_FILINGS" },
      { label: "Document Editor", path: "/sec-filings/editor", navigationCode: "SEC_FILINGS" },
    ],
  },
  {
    label: "System & Security",
    icon: ShieldCheck,
    section: "ADMINISTRATION",
    subItems: [
      { label: "Users", path: "/configurations/users", navigationCode: "CONFIG_USERS" },
      { label: "Roles", path: "/configurations/roles", navigationCode: "CONFIG_ROLES" },
      { label: "Role Assignments", path: "/configurations/user-role-assignment", navigationCode: "CONFIG_USER_ROLE_ASSIGNMENT" },
      { label: "Role Permissions", path: "/configurations/role-group-permissions", navigationCode: "CONFIG_ROLES" },
      { label: "API Permissions", path: "/configurations/role-api-permissions", navigationCode: "CONFIG_ROLE_API_PERMISSIONS" },
      { label: "MCP Tool Permissions", path: "/configurations/role-mcp-tool-permissions", navigationCode: "CONFIG_ROLE_MCP_TOOL_PERMISSIONS" },
    ],
  },
  {
    label: "Logs & Audit",
    icon: FileClock,
    section: "ADMINISTRATION",
    subItems: [
      { label: "Audit Log", path: "/log/audit", navigationCode: "AUDIT_LOG" },
      { label: "System Logs", path: "/log/system-logs", navigationCode: "AUDIT_LOG" },
    ],
  },
];
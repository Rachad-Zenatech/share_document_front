export interface User {
  id: string;
  email: string;
  full_name: string;
  is_super_admin: boolean;
  is_active?: boolean;
  department?: string;
  job_title?: string;
  created_at?: string;
  updated_at?: string;
  assigned_roles?: Role[];
}

export interface Role {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  is_active?: boolean;
  is_system_role?: boolean;
  parent_role_id?: string | null;
  display_order?: number;
  department?: string;
  children?: Role[];
  permissions?: string[];
  created_at?: string;
  updated_at?: string;
}

export interface PermissionGroup {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  module_id?: number;
}

export interface PermissionModule {
  id: number;
  code: string;
  name: string;
  groups: PermissionGroup[];
}

export interface ApiPermission {
  id: string | number;
  role_id: string;
  method: string;
  path_pattern: string;
  description?: string | null;
}

export interface McpToolPermission {
  id: string | number;
  tool_name: string;
  tool_code: string;
  description?: string;
  is_allowed: boolean;
}

export interface PermissionsData {
  user: User;
  roles: Role[];
  workflow_roles?: string[];
  navigation_permissions: Record<string, string[]>;
  mcp_tool_permissions: string[];
}

export interface AuditLogItem {
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
  changes?: Record<string, unknown>;
  old_value?: unknown;
  new_value?: unknown;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at: string;
}

export interface LoginActivityItem {
  id: number | string;
  user_id: string;
  user_email?: string;
  user_name?: string;
  ip_address?: string;
  user_agent?: string;
  status: "SUCCESS" | "FAILED" | "PENDING";
  login_at: string;
}

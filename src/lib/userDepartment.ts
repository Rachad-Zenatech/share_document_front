import type { Role } from "./AuthContext";

const GENERIC_NON_DEPARTMENT_ROLES = new Set([
  "SUPER_ADMIN",
  "SUPER ADMIN",
  "ADMIN",
  "STANDARD_USER",
  "STANDARD USER",
  "PENDING_USER",
  "PENDING USER",
  "REQUESTER",
  "LOW_LEVEL_APPROVER",
  "HIGH_LEVEL_APPROVER",
  "STANDARD_APPROVER",
  "STANDARD APPROVER",
  "SENIOR_APPROVER",
  "SENIOR APPROVER",
  "APPROVER",
  "USER",
]);

function isGenericRole(nameOrCode?: string): boolean {
  if (!nameOrCode) return true;
  const upper = nameOrCode.toUpperCase().trim();
  return GENERIC_NON_DEPARTMENT_ROLES.has(upper);
}

/**
 * Resolves a user's department by matching their assigned roles against the configured Roles list.
 * Inspects the user's direct department field, their assigned roles, the global roles directory,
 * and the role parent hierarchy.
 */
export function resolveUserDepartment(
  user: any,
  allRoles: Role[] = []
): string {
  if (!user) return "";

  // 1. Direct department field on user if explicitly defined
  if (typeof user.department === "string" && user.department.trim()) {
    if (!isGenericRole(user.department)) {
      return user.department.trim();
    }
  }
  if (typeof user.department_name === "string" && user.department_name.trim()) {
    if (!isGenericRole(user.department_name)) {
      return user.department_name.trim();
    }
  }

  // Super admins bypass normal role-based access and typically have no real
  // department synced yet — show that instead of guessing from whatever
  // baseline role (e.g. REQUESTER) they happen to be auto-assigned.
  if (user.is_super_admin) {
    return "Super Admin";
  }

  // Lookup role in allRoles by id, code, or name
  const findRole = (roleRef: any): Role | undefined => {
    if (!roleRef || !allRoles || allRoles.length === 0) return undefined;
    if (typeof roleRef === "string") {
      const refClean = roleRef.trim();
      return allRoles.find(
        (r) =>
          r.id === refClean ||
          (r.code && r.code.toUpperCase() === refClean.toUpperCase()) ||
          (r.name && r.name.toLowerCase() === refClean.toLowerCase())
      );
    }
    const roleId = roleRef.id || roleRef.role_id;
    const roleCode = roleRef.code;
    const roleName = roleRef.name;

    return allRoles.find(
      (r) =>
        (roleId && r.id === roleId) ||
        (roleCode && r.code && r.code.toUpperCase() === roleCode.toUpperCase()) ||
        (roleName && r.name && r.name.toLowerCase() === roleName.toLowerCase())
    );
  };

  // Helper to extract department from a role or its parent hierarchy
  const getDeptFromRole = (roleRef: any): string => {
    if (!roleRef) return "";

    // If role object directly carries a non-empty department
    if (
      typeof roleRef === "object" &&
      typeof roleRef.department === "string" &&
      roleRef.department.trim() &&
      !isGenericRole(roleRef.department)
    ) {
      return roleRef.department.trim();
    }

    // Lookup in allRoles list
    const matched = findRole(roleRef);
    if (matched) {
      if (
        typeof matched.department === "string" &&
        matched.department.trim() &&
        !isGenericRole(matched.department)
      ) {
        return matched.department.trim();
      }

      // Check parent role hierarchy in allRoles
      let curr: Role | undefined = matched;
      const visited = new Set<string>();
      while (curr?.parent_role_id && !visited.has(curr.parent_role_id)) {
        visited.add(curr.parent_role_id);
        const parent = allRoles.find((p) => p.id === curr?.parent_role_id);
        if (!parent) break;
        if (
          typeof parent.department === "string" &&
          parent.department.trim() &&
          !isGenericRole(parent.department)
        ) {
          return parent.department.trim();
        }
        curr = parent;
      }

      // If matched role name is a functional department
      if (
        matched.name &&
        !isGenericRole(matched.code) &&
        !isGenericRole(matched.name)
      ) {
        return matched.name;
      }
    }

    if (
      typeof roleRef === "object" &&
      roleRef.name &&
      !isGenericRole(roleRef.code) &&
      !isGenericRole(roleRef.name)
    ) {
      return roleRef.name;
    }

    return "";
  };

  // 2. Check assigned_roles array
  if (Array.isArray(user.assigned_roles)) {
    for (const r of user.assigned_roles) {
      const dept = getDeptFromRole(r);
      if (dept) return dept;
    }
  }

  // 3. Check roles array
  if (Array.isArray(user.roles)) {
    for (const r of user.roles) {
      const dept = getDeptFromRole(r);
      if (dept) return dept;
    }
  }

  // 4. Check single role or role_id
  if (user.role || user.role_id) {
    const dept = getDeptFromRole(user.role || user.role_id);
    if (dept) return dept;
  }

  return "";
}

export type Role = "owner" | "admin" | "member" | "viewer";

export type Action =
  | "business_profile:update"
  | "scan:create"
  | "opportunity:select"
  | "offer:create"
  | "artifact:approve"
  | "deal:update"
  | "revenue:read"
  | "audit:read"
  | "billing:manage"
  | "workspace:delete";

const rolePermissions: Record<Role, Set<Action>> = {
  owner: new Set([
    "business_profile:update",
    "scan:create",
    "opportunity:select",
    "offer:create",
    "artifact:approve",
    "deal:update",
    "revenue:read",
    "audit:read",
    "billing:manage",
    "workspace:delete",
  ]),
  admin: new Set([
    "business_profile:update",
    "scan:create",
    "opportunity:select",
    "offer:create",
    "artifact:approve",
    "deal:update",
    "revenue:read",
    "audit:read",
  ]),
  member: new Set([
    "scan:create",
    "offer:create",
    "deal:update",
    "revenue:read",
  ]),
  viewer: new Set([
    "revenue:read",
  ]),
};

export function can(role: Role, action: Action): boolean {
  return rolePermissions[role]?.has(action) ?? false;
}

export function assertCan(role: Role, action: Action): void {
  if (!can(role, action)) {
    throw new Error(`Role ${role} cannot perform action: ${action}`);
  }
}

export interface Session {
  userId: string;
  tenantId: string;
  role: Role;
  email: string;
}

export function deriveTenantId(session: Session): string {
  return session.tenantId;
}

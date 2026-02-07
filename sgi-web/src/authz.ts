import type { AuthSession } from "./hooks/useAuth";
import { Membership, UserRole } from "./api";

export type PermissionKey =
  | "cadastros.read"
  | "cadastros.write"
  | "financeiro.read"
  | "financeiro.write"
  | "operacao.read"
  | "operacao.create"
  | "operacao.manage"
  | "anexos.read"
  | "anexos.write"
  | "minha_unidade.read";

const getMembershipOrgId = (membership: Membership): string | null =>
  membership.condoId ?? membership.orgId ?? null;

export const getActiveMembership = (
  memberships: Membership[] | null | undefined,
  orgId?: string | null
) => {
  if (!memberships || !orgId) return null;
  return (
    memberships.find(
      (m) => m.isActive && getMembershipOrgId(m) === orgId
    ) ?? null
  );
};

export const getActiveRole = (
  session: AuthSession | null | undefined,
  orgId?: string | null
): UserRole | null => {
  if (!session) return null;
  if (session.isPlatformAdmin) return "PLATFORM_ADMIN";
  const membership = getActiveMembership(session.memberships, orgId);
  return membership?.role ?? null;
};

export const getActiveOrgId = (
  session: AuthSession | null | undefined,
  orgId?: string | null
): string | null => {
  if (orgId) return orgId;
  if (!session || session.isPlatformAdmin) return null;
  const active = (session.memberships ?? []).find(
    (m) => m.isActive && getMembershipOrgId(m)
  );
  return active ? getMembershipOrgId(active) : null;
};

const rolePermissions: Record<UserRole, ReadonlySet<PermissionKey>> = {
  PLATFORM_ADMIN: new Set([
    "cadastros.read",
    "cadastros.write",
    "financeiro.read",
    "financeiro.write",
    "operacao.read",
    "operacao.create",
    "operacao.manage",
    "anexos.read",
    "anexos.write"
  ]),
  CONDO_ADMIN: new Set([
    "cadastros.read",
    "cadastros.write",
    "financeiro.read",
    "financeiro.write",
    "operacao.read",
    "operacao.create",
    "operacao.manage",
    "anexos.read",
    "anexos.write"
  ]),
  CONDO_STAFF: new Set([
    "cadastros.read",
    "financeiro.read",
    "operacao.read",
    "operacao.create",
    "operacao.manage",
    "anexos.read",
    "anexos.write"
  ]),
  RESIDENT: new Set([
    "operacao.read",
    "operacao.create",
    "anexos.read",
    "anexos.write",
    "minha_unidade.read"
  ])
};

export const can = (
  session: AuthSession | null | undefined,
  orgId: string | null | undefined,
  permissionKey: PermissionKey
) => {
  if (!session) return false;
  if (permissionKey === "minha_unidade.read") {
    return getActiveRole(session, orgId) === "RESIDENT";
  }
  const role = getActiveRole(session, orgId);
  if (!role) return false;
  if (role === "PLATFORM_ADMIN") {
    return permissionKey !== "minha_unidade.read";
  }
  return rolePermissions[role].has(permissionKey);
};

import type { AuthSession } from "./hooks/useAuth";
import { Membership, UserRole } from "./api";

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

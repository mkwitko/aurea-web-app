export type Role = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';

/** Subscription and card belong to the organization's owner (backend: OWNER only). */
export function canManageSubscription(role: Role | null): boolean {
  return role === 'OWNER';
}

/** Creating a workspace is `assertAdmin` on the backend: OWNER or ADMIN. */
export function canCreateWorkspace(role: Role | null): boolean {
  return role === 'OWNER' || role === 'ADMIN';
}

/** Buying a pack and forcing a sync are OWNER or ADMIN on the backend. */
export function canBuyCredits(role: Role | null): boolean {
  return role === 'OWNER' || role === 'ADMIN';
}

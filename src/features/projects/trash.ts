/** Questions stay in the recycle bin this long, then they are deleted for good. */
export const TRASH_DAYS = 30;
const DAY = 86400_000;

/** Whole days left before a question in the recycle bin is deleted for good (0 = today). */
export function trashDaysLeft(deletedAt: string, now = Date.now()): number {
  const at = Date.parse(deletedAt);
  if (!Number.isFinite(at)) return TRASH_DAYS;
  return Math.max(0, Math.ceil((at + TRASH_DAYS * DAY - now) / DAY));
}

/** True once a question has spent its 30 days in the recycle bin. */
export function trashExpired(deletedAt: string | undefined, now = Date.now()): boolean {
  if (!deletedAt) return false;
  const at = Date.parse(deletedAt);
  return Number.isFinite(at) && now - at >= TRASH_DAYS * DAY;
}

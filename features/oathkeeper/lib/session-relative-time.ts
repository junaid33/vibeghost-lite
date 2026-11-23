// Pure, so server code and Node tests can use it without loading the card component.
/** Matches native VibeGhost's compact session-relative-time formatting. */
export function formatSessionRelativeTime(value: string | undefined, now: number): string | null {
  if (!value || !now) return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  const elapsed = Math.max(0, now - timestamp);
  if (elapsed < 60_000) return 'just now';
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)}m ago`;
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)}h ${Math.floor(elapsed % 3_600_000 / 60_000)}m ago`;
  return `${Math.floor(elapsed / 86_400_000)}d ${Math.floor(elapsed % 86_400_000 / 3_600_000)}h ago`;
}

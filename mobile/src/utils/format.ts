/** Small formatting helpers shared by the channel list and chat screens. */

export function initials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export function relativeTime(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.round(diffMs / 1000);
  if (diffSec < 60) return 'now';
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h`;
  const diffDay = Math.round(diffHour / 24);
  if (diffDay < 7) return `${diffDay}d`;
  return date.toLocaleDateString();
}

export function timeOfDay(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** DM channels have no `name` — CONTRACT.md §3.5 — this needs the OTHER member(s) to render a label; falls back to a generic label if that lookup isn't available yet. */
export function channelDisplayName(channel: { type: string; name: string | null }, fallback = 'Direct message'): string {
  if (channel.name) return channel.name;
  return channel.type === 'dm' ? fallback : 'Unnamed channel';
}

import type { YaraConversationSummaryContract } from '@yara/contracts';

export function yaraConversationHref(conversationId: string, runId?: string): string {
  const query = new URLSearchParams({ conversation: conversationId });
  if (runId) query.set('run', runId);
  return `/yara?${query.toString()}`;
}

export function resolveYaraSurface(conversationId: string | null): 'home' | 'conversation' {
  return conversationId ? 'conversation' : 'home';
}

export function meaningfulRecentConversation(
  conversations: readonly YaraConversationSummaryContract[],
): YaraConversationSummaryContract | null {
  return conversations[0] ?? null;
}

export function conversationDateLabel(value: string, now = new Date()): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'RECENT';
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const days = Math.round((startToday - startDate) / 86_400_000);
  if (days <= 0) return 'TODAY';
  if (days === 1) return 'YESTERDAY';
  if (days < 7) {
    return new Intl.DateTimeFormat('en', { weekday: 'long' }).format(date).toUpperCase();
  }
  if (days < 14) return 'LAST WEEK';
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' })
    .format(date)
    .toUpperCase();
}

export function relativeConversationActivity(value: string, now = new Date()): string {
  const elapsed = Math.max(0, now.getTime() - new Date(value).getTime());
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

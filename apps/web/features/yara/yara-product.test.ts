import type { YaraConversationContract, YaraConversationSummaryContract } from '@yara/contracts';
import { describe, expect, it, vi } from 'vitest';

import { startConversationFromPrompt } from './start-conversation';
import {
  conversationDateLabel,
  meaningfulRecentConversation,
  resolveYaraSurface,
  yaraConversationHref,
} from './yara-routes';

const conversationId = 'conversation:yara:11111111-1111-4111-8111-111111111111';
const runId = 'ai-run:yara:22222222-2222-4222-8222-222222222222';

describe('Yara product routing', () => {
  it('keeps /yara as Home until a canonical conversation is explicitly selected', () => {
    expect(resolveYaraSurface(null)).toBe('home');
    expect(resolveYaraSurface(conversationId)).toBe('conversation');
  });

  it('starts exactly one conversation and one run from an explicit prompt', async () => {
    const create = vi.fn().mockResolvedValue({ id: conversationId } as YaraConversationContract);
    const send = vi.fn().mockResolvedValue({ runId });

    await expect(
      startConversationFromPrompt('  What makes this feel open?  ', { create, send }),
    ).resolves.toBe(yaraConversationHref(conversationId, runId));
    expect(create).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(conversationId, 'What makes this feel open?');
  });

  it('uses the bounded server ordering for Continue and stable history labels', () => {
    const summaries = [
      { id: conversationId, updatedAt: '2026-11-08T09:00:00.000Z' },
      {
        id: 'conversation:yara:33333333-3333-4333-8333-333333333333',
        updatedAt: '2026-11-07T09:00:00.000Z',
      },
    ] as YaraConversationSummaryContract[];
    expect(meaningfulRecentConversation(summaries)?.id).toBe(conversationId);
    expect(conversationDateLabel(summaries[0]!.updatedAt, new Date('2026-11-08T12:00:00Z'))).toBe(
      'TODAY',
    );
    expect(conversationDateLabel(summaries[1]!.updatedAt, new Date('2026-11-08T12:00:00Z'))).toBe(
      'YESTERDAY',
    );
  });
});

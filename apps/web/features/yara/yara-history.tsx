'use client';

import type { YaraConversationSummaryContract } from '@yara/contracts';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { listConversations } from './yara-api';
import { conversationDateLabel, yaraConversationHref } from './yara-routes';

export function YaraHistory() {
  const [conversations, setConversations] = useState<readonly YaraConversationSummaryContract[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    listConversations(30)
      .then((value) => {
        if (!disposed) setConversations(value);
      })
      .catch(() => {
        if (!disposed) setError('Yara could not load conversation history.');
      })
      .finally(() => {
        if (!disposed) setLoading(false);
      });
    return () => {
      disposed = true;
    };
  }, []);

  return (
    <div className="yara-history-page">
      <header className="yara-history-header">
        <div>
          <Link href="/yara" aria-label="Back to Yara Home">
            ‹
          </Link>
          <h1>Conversation history</h1>
        </div>
        <p>Compact, contextual, resumable</p>
      </header>

      {loading ? <p className="yara-history-status">Loading conversations…</p> : null}
      {error ? (
        <p className="yara-home-error" role="alert">
          {error}
        </p>
      ) : null}
      {!loading && !error && conversations.length === 0 ? (
        <section className="yara-history-empty">
          <h2>No conversations yet</h2>
          <p>Ask Yara a question to begin your first durable conversation.</p>
          <Link href="/yara">Ask Yara</Link>
        </section>
      ) : null}

      <div className="yara-history-list">
        {conversations.map((conversation) => (
          <Link key={conversation.id} href={yaraConversationHref(conversation.id)}>
            <span>{conversationDateLabel(conversation.updatedAt)}</span>
            <strong>{conversation.title}</strong>
            <small>
              {conversation.lastMessageRole === 'assistant' ? 'Yara replied' : 'Your last message'}{' '}
              · {conversation.messageCount} message{conversation.messageCount === 1 ? '' : 's'}
            </small>
          </Link>
        ))}
      </div>
    </div>
  );
}

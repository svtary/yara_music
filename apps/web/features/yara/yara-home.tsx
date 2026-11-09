'use client';

import type { YaraConversationSummaryContract } from '@yara/contracts';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useRef, useState } from 'react';

import { listConversations, startConversation } from './yara-api';
import {
  meaningfulRecentConversation,
  relativeConversationActivity,
  yaraConversationHref,
} from './yara-routes';
import { startConversationFromPrompt } from './start-conversation';

const taskStarters = [
  { label: 'Find music', prompt: 'Help me find music for ' },
  { label: 'Understand music', prompt: 'Help me understand why ' },
  { label: 'Plan a concert', prompt: 'Help me think through a concert plan for ' },
  { label: 'Find a vinyl', prompt: 'Help me compare a vinyl edition of ' },
  { label: 'Build a playlist', prompt: 'Help me shape a playlist for ' },
] as const;

export function YaraHome() {
  const router = useRouter();
  const [draft, setDraft] = useState('');
  const [conversations, setConversations] = useState<readonly YaraConversationSummaryContract[]>(
    [],
  );
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingStart = useRef<{ content: string; key: string } | null>(null);
  const recent = meaningfulRecentConversation(conversations);

  useEffect(() => {
    let disposed = false;
    listConversations(20)
      .then((value) => {
        if (!disposed) setConversations(value);
      })
      .catch(() => {
        if (!disposed) setError('Conversation history is temporarily unavailable.');
      })
      .finally(() => {
        if (!disposed) setLoadingHistory(false);
      });
    return () => {
      disposed = true;
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    const content = draft.trim();
    const command =
      pendingStart.current?.content === content
        ? pendingStart.current
        : { content, key: `start:${crypto.randomUUID()}` };
    pendingStart.current = command;
    try {
      const href = await startConversationFromPrompt(content, command.key, {
        start: startConversation,
      });
      pendingStart.current = null;
      router.push(href);
    } catch {
      setError(
        'Yara could not confirm the start yet. Your prompt is safe—retry to check the same request.',
      );
      setSubmitting(false);
    }
  }

  return (
    <div className="yara-home-page">
      <header className="yara-home-header">
        <h1>Yara</h1>
        <p>What can Yara help with right now?</p>
      </header>

      <section className="yara-home-identity" aria-label="Yara introduction">
        <span>QUIETLY WITH YOU</span>
        <h2>Start with what you are hearing, wondering, or trying to find.</h2>
        <p>Ask directly, or begin from one of the conversation starters below.</p>
      </section>

      <form className="yara-home-ask" onSubmit={submit}>
        <label htmlFor="yara-home-input">Ask Yara anything about music</label>
        <textarea
          id="yara-home-input"
          rows={2}
          maxLength={4000}
          value={draft}
          placeholder="Ask Yara anything about music…"
          disabled={submitting}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
        />
        <button
          type="submit"
          disabled={!draft.trim() || submitting}
          aria-label="Start conversation"
        >
          {submitting ? '…' : '↑'}
        </button>
      </form>

      <section className="yara-home-starters" aria-labelledby="yara-starters-title">
        <h2 id="yara-starters-title">SUGGESTED TASKS</h2>
        <div>
          {taskStarters.map((starter, index) => (
            <button
              key={starter.label}
              className={index === 0 ? 'is-primary' : undefined}
              type="button"
              onClick={() => setDraft(starter.prompt)}
            >
              {starter.label}
            </button>
          ))}
        </div>
      </section>

      <div className="yara-home-return-grid">
        {recent ? (
          <Link
            className="yara-home-return-card is-continue"
            href={yaraConversationHref(recent.id)}
          >
            <span>CONTINUE</span>
            <strong>{recent.title}</strong>
            <small>Last activity · {relativeConversationActivity(recent.updatedAt)}</small>
          </Link>
        ) : (
          <div className="yara-home-return-card is-empty">
            <span>CONTINUE</span>
            <strong>
              {loadingHistory ? 'Checking recent conversations…' : 'No conversation yet'}
            </strong>
            <small>Your first prompt will begin one.</small>
          </div>
        )}

        <Link className="yara-home-return-card is-history" href="/yara/history">
          <span>CONVERSATION HISTORY</span>
          <strong>Return to earlier conversations</strong>
          <small>
            {loadingHistory
              ? 'Loading…'
              : `${conversations.length} meaningful conversation${conversations.length === 1 ? '' : 's'}`}
          </small>
        </Link>
      </div>

      {error ? (
        <p className="yara-home-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

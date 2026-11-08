'use client';

import type {
  AIExecutionRunResponseContract,
  AIExecutionRunStatusContract,
  YaraConversationContract,
  YaraRunEventContract,
} from '@yara/contracts';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react';

import { cancelRun, getConversation, getRun, sendConversationMessage } from './yara-api';
import { YaraSseDecoder } from './sse-decoder';
import { yaraConversationHref } from './yara-routes';

type TransportMode = 'idle' | 'streaming' | 'reconnecting' | 'polling';
const terminalStatuses = new Set<AIExecutionRunStatusContract>([
  'completed',
  'failed',
  'cancelled',
]);

function isTerminal(status: AIExecutionRunStatusContract): boolean {
  return terminalStatuses.has(status);
}

function statusLabel(status: AIExecutionRunStatusContract | undefined): string {
  switch (status) {
    case 'pending':
      return 'Waiting to start';
    case 'running':
      return 'Yara is responding';
    case 'completed':
      return 'Response committed';
    case 'failed':
      return 'Response failed';
    case 'cancelled':
      return 'Stopped by you';
    default:
      return 'Ready for a question';
  }
}

export function YaraConversation() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialConversationId = searchParams.get('conversation');
  const initialRunId = searchParams.get('run');
  const [conversation, setConversation] = useState<YaraConversationContract | null>(null);
  const [run, setRun] = useState<AIExecutionRunResponseContract | null>(null);
  const [draft, setDraft] = useState('');
  const [partial, setPartial] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [transport, setTransport] = useState<TransportMode>('idle');
  const [initializing, setInitializing] = useState(true);
  const [lastSent, setLastSent] = useState('');
  const streamAbort = useRef<AbortController | null>(null);
  const lastEventId = useRef(0);
  const [lastEventSequence, setLastEventSequence] = useState(0);

  const refreshConversation = useCallback(async (id: string) => {
    const next = await getConversation(id);
    setConversation(next);
    return next;
  }, []);

  const pollUntilTerminal = useCallback(
    async (conversationId: string, runId: string, signal: AbortSignal): Promise<void> => {
      setTransport('polling');
      while (!signal.aborted) {
        const nextRun = await getRun(runId);
        setRun(nextRun);
        if (isTerminal(nextRun.run.status)) {
          await refreshConversation(conversationId);
          setPartial('');
          setTransport('idle');
          return;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 750));
      }
    },
    [refreshConversation],
  );

  const streamRun = useCallback(
    async (conversationId: string, runId: string): Promise<void> => {
      streamAbort.current?.abort();
      const controller = new AbortController();
      streamAbort.current = controller;
      let reconnects = 0;

      while (!controller.signal.aborted && reconnects <= 3) {
        setTransport(reconnects === 0 ? 'streaming' : 'reconnecting');
        try {
          const response = await fetch(`/api/yara/ai-runs/${encodeURIComponent(runId)}/events`, {
            cache: 'no-store',
            headers:
              lastEventId.current > 0 ? { 'last-event-id': String(lastEventId.current) } : {},
            signal: controller.signal,
          });
          if (!response.ok || !response.body) throw new Error('stream_unavailable');
          const reader = response.body.getReader();
          const textDecoder = new TextDecoder();
          const sseDecoder = new YaraSseDecoder();
          let terminal = false;
          while (!controller.signal.aborted) {
            const result = await reader.read();
            if (result.done) break;
            for (const decoded of sseDecoder.push(
              textDecoder.decode(result.value, { stream: true }),
            )) {
              if (decoded.id) {
                lastEventId.current = Number(decoded.id);
                setLastEventSequence(lastEventId.current);
              }
              if (decoded.type === 'heartbeat') continue;
              const event = decoded.data as YaraRunEventContract;
              if (event.type === 'message.delta') {
                setPartial((current) => current + event.data.delta);
              } else if (
                event.type === 'run.completed' ||
                event.type === 'run.failed' ||
                event.type === 'run.cancelled'
              ) {
                terminal = true;
              }
            }
          }
          if (terminal) {
            setRun(await getRun(runId));
            await refreshConversation(conversationId);
            setPartial('');
            setTransport('idle');
            return;
          }
          reconnects += 1;
        } catch {
          if (controller.signal.aborted) return;
          reconnects += 1;
          if (reconnects <= 3) await new Promise((resolve) => window.setTimeout(resolve, 350));
        }
      }
      if (!controller.signal.aborted) {
        await pollUntilTerminal(conversationId, runId, controller.signal);
      }
    },
    [pollUntilTerminal, refreshConversation],
  );

  useEffect(() => {
    let disposed = false;
    async function initialize() {
      if (!initialConversationId) {
        if (!disposed) {
          setError('Choose a conversation from Yara Home or History.');
          setInitializing(false);
        }
        return;
      }
      try {
        const current = await getConversation(initialConversationId);
        if (disposed) return;
        setConversation(current);
        if (initialRunId) {
          const currentRun = await getRun(initialRunId);
          if (disposed) return;
          setRun(currentRun);
          if (!isTerminal(currentRun.run.status)) void streamRun(current.id, initialRunId);
        }
      } catch {
        if (!disposed) setError('Yara could not open this conversation. Please try again.');
      } finally {
        if (!disposed) setInitializing(false);
      }
    }
    void initialize();
    return () => {
      disposed = true;
      streamAbort.current?.abort();
    };
  }, [initialConversationId, initialRunId, streamRun]);

  const active = run !== null && !isTerminal(run.run.status);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    if (!conversation || !content || active) return;
    setDraft('');
    setLastSent(content);
    setPartial('');
    setError(null);
    lastEventId.current = 0;
    setLastEventSequence(0);
    try {
      const receipt = await sendConversationMessage(conversation.id, content);
      await refreshConversation(conversation.id);
      const nextRun = await getRun(receipt.runId);
      setRun(nextRun);
      router.replace(yaraConversationHref(conversation.id, receipt.runId), { scroll: false });
      void streamRun(conversation.id, receipt.runId);
    } catch {
      setDraft(content);
      setError('Your message was not sent. Nothing was committed—please try again.');
    }
  }

  async function stop() {
    if (!run || !active) return;
    try {
      const cancelled = await cancelRun(run.run.id);
      setRun(cancelled);
      streamAbort.current?.abort();
      setPartial('');
      setTransport('idle');
    } catch {
      setError('Yara could not confirm the stop request. The current run status will be checked.');
    }
  }

  function retryFailed() {
    if (!lastSent || active) return;
    setDraft(lastSent);
    setError(null);
  }

  return (
    <div className="yara-conversation-page">
      <aside className="yara-context-panel">
        <span className="yara-panel-eyebrow">Current context</span>
        <h2>This conversation only</h2>
        <p>
          Stage 2 sends a bounded slice of recent committed messages. It does not create Memory or
          use private listening context.
        </p>
        <div className="yara-context-fact">
          <span>Messages in context</span>
          <strong>{Math.min(conversation?.messages.length ?? 0, 12)}</strong>
        </div>
      </aside>

      <section className="yara-chat-column" aria-label="Yara conversation">
        <header className="yara-chat-header">
          <div>
            <Link className="yara-conversation-back" href="/yara" aria-label="Back to Yara Home">
              ‹
            </Link>
            <span className="yara-panel-eyebrow">Ask Yara</span>
            <h1>Talk through the music</h1>
          </div>
          <span className={`yara-run-pill is-${run?.run.status ?? 'ready'}`}>
            {statusLabel(run?.run.status)}
          </span>
        </header>

        <div className="yara-message-list" aria-live="polite" aria-busy={active}>
          {initializing ? <p className="yara-chat-note">Opening a private conversation…</p> : null}
          {!initializing && conversation?.messages.length === 0 ? (
            <div className="yara-chat-welcome">
              <span className="yara-orbit-mark" aria-hidden="true" />
              <h2>What are you hearing?</h2>
              <p>Ask about a feeling, a production detail, or a musical idea.</p>
            </div>
          ) : null}
          {conversation?.messages.map((message) => (
            <article key={message.id} className={`yara-message is-${message.role}`}>
              <span>{message.role === 'user' ? 'You' : 'Yara'}</span>
              <p>{message.content}</p>
            </article>
          ))}
          {partial ? (
            <article className="yara-message is-assistant is-streaming">
              <span>Yara · responding</span>
              <p>{partial}</p>
            </article>
          ) : null}
          {active && !partial ? (
            <div className="yara-thinking" role="status">
              <i /> <i /> <i />
              <span>Listening for the shape of your question…</span>
            </div>
          ) : null}
        </div>

        {error ? (
          <div className="yara-chat-error" role="alert">
            <span>{error}</span>
            {run?.run.status === 'failed' && lastSent ? (
              <button type="button" onClick={retryFailed}>
                Prepare retry
              </button>
            ) : null}
          </div>
        ) : null}
        {run?.run.status === 'failed' ? (
          <div className="yara-chat-error" role="alert">
            <span>{run.run.failure?.message ?? 'Yara could not complete this response.'}</span>
            <button type="button" onClick={retryFailed}>
              Prepare retry
            </button>
          </div>
        ) : null}

        <form className="yara-composer" onSubmit={submit}>
          <label htmlFor="yara-message-input">Message Yara</label>
          <textarea
            id="yara-message-input"
            value={draft}
            maxLength={4000}
            rows={3}
            placeholder="Ask about what you’re hearing…"
            disabled={initializing || active}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <div>
            <span>
              {active
                ? 'Disconnecting this page will not cancel the run.'
                : 'Enter to send · Shift+Enter for a new line'}
            </span>
            {active ? (
              <button className="yara-stop-button" type="button" onClick={() => void stop()}>
                Stop
              </button>
            ) : (
              <button
                className="yara-send-button"
                type="submit"
                disabled={!draft.trim() || initializing}
              >
                Send
              </button>
            )}
          </div>
        </form>
      </section>

      <aside className="yara-run-panel">
        <span className="yara-panel-eyebrow">Run continuity</span>
        <h2>
          {transport === 'polling'
            ? 'Polling fallback'
            : transport === 'reconnecting'
              ? 'Reconnecting stream'
              : 'Live response'}
        </h2>
        <dl>
          <div>
            <dt>Conversation</dt>
            <dd>{conversation ? 'Durable' : 'Opening'}</dd>
          </div>
          <div>
            <dt>Run</dt>
            <dd>{run?.run.status ?? 'Not started'}</dd>
          </div>
          <div>
            <dt>Transport</dt>
            <dd>{transport}</dd>
          </div>
          <div>
            <dt>Last event</dt>
            <dd>{lastEventSequence || '—'}</dd>
          </div>
        </dl>
        <p>Refreshing this page resumes from the run in the URL and re-checks current access.</p>
        <Link className="yara-history-inline-link" href="/yara/history">
          Conversation history
        </Link>
      </aside>
    </div>
  );
}

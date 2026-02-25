/**
 * SecretReveal Component
 *
 * Renders a "Reveal" button for sensitive tool outputs delivered via the
 * secret redemption flow. The secret is fetched on demand and never
 * leaves component state — it is not serialized, logged, or sent anywhere.
 */

import { useState, useCallback } from 'preact/hooks';
import type { ProgressEvent } from '../../store/chat';
import { getPillarInstance } from '../../core/instance';

type RevealState = 'idle' | 'loading' | 'revealed' | 'expired' | 'error';

export interface SecretRevealProps {
  event: ProgressEvent;
}

export function SecretReveal({ event }: SecretRevealProps) {
  const [state, setState] = useState<RevealState>('idle');
  const [secretValue, setSecretValue] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const endpoint = (event.metadata as Record<string, unknown>)?.endpoint as string | undefined;
  const label = event.label || 'Secret';

  const handleReveal = useCallback(async () => {
    if (!endpoint) {
      setState('error');
      return;
    }

    setState('loading');

    try {
      const pillar = getPillarInstance();
      const apiBase = pillar?.config?.apiBaseUrl || '';
      const url = endpoint.startsWith('http') ? endpoint : `${apiBase}${endpoint}`;

      const response = await fetch(url);

      if (response.status === 410) {
        setState('expired');
      } else if (response.ok) {
        const data = await response.json();
        setSecretValue(data.value);
        setState('revealed');
      } else {
        setState('error');
      }
    } catch {
      setState('error');
    }
  }, [endpoint]);

  const handleCopy = useCallback(async () => {
    if (!secretValue) return;
    try {
      await navigator.clipboard.writeText(secretValue);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may not be available
    }
  }, [secretValue]);

  return (
    <div class="_pillar-secret-reveal pillar-secret-reveal">
      {state === 'idle' && (
        <button
          class="_pillar-secret-reveal-btn pillar-secret-reveal-btn"
          onClick={handleReveal}
          type="button"
        >
          <KeyIcon />
          <span>Reveal {label}</span>
        </button>
      )}

      {state === 'loading' && (
        <div class="_pillar-secret-reveal-loading">
          <Spinner />
          <span>Fetching…</span>
        </div>
      )}

      {state === 'revealed' && secretValue && (
        <div class="_pillar-secret-reveal-value">
          <code class="_pillar-secret-reveal-code">{secretValue}</code>
          <button
            class="_pillar-secret-reveal-copy"
            onClick={handleCopy}
            type="button"
            title={copied ? 'Copied!' : 'Copy to clipboard'}
          >
            {copied ? <CheckIcon /> : <CopyIcon />}
          </button>
        </div>
      )}

      {state === 'expired' && (
        <div class="_pillar-secret-reveal-expired">
          This secret has expired or was already revealed.
        </div>
      )}

      {state === 'error' && (
        <div class="_pillar-secret-reveal-error">
          Failed to retrieve secret.
        </div>
      )}
    </div>
  );
}


function KeyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg class="_pillar-secret-reveal-spinner" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M12 2v4m0 12v4m-7.07-3.93l2.83-2.83m8.48-8.48l2.83-2.83M2 12h4m12 0h4m-3.93 7.07l-2.83-2.83M6.34 6.34L3.51 3.51" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

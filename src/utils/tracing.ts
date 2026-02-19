/**
 * OpenTelemetry browser tracing for Pillar SDK.
 *
 * Initialises a WebTracerProvider that exports spans via OTLP/JSON to the
 * backend proxy endpoint (`/mcp/telemetry/v1/traces`).  The backend forwards
 * them to Google Cloud Trace so browser and server spans share the same
 * project and can be correlated by trace ID.
 *
 * Tracing is opt-in via `Pillar.init({ tracing: true })` or automatically
 * when `debug: true`.
 */

import { trace, context, type Tracer, type Span, SpanStatusCode } from '@opentelemetry/api';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import {
  WebTracerProvider,
} from '@opentelemetry/sdk-trace-web';
import {
  BatchSpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';

let _provider: WebTracerProvider | null = null;
let _tracer: Tracer | null = null;

/**
 * Initialise the browser tracing provider.
 *
 * @param apiBaseUrl  The SDK's API base URL (e.g. `https://help-api.trypillar.com`)
 * @param attrs       Extra resource attributes (product key, visitor id, …)
 */
export function initTracing(
  apiBaseUrl: string,
  attrs: Record<string, string> = {},
): Tracer {
  if (_provider) {
    return _tracer!;
  }

  const otlpUrl = `${apiBaseUrl}/mcp/telemetry/v1/traces`;

  const exporter = new OTLPTraceExporter({
    url: otlpUrl,
    headers: {},
  });

  const resource = resourceFromAttributes({
    'service.name': 'pillar-sdk-browser',
    ...attrs,
  });

  _provider = new WebTracerProvider({
    resource,
    spanProcessors: [
      new BatchSpanProcessor(exporter, {
        maxQueueSize: 100,
        maxExportBatchSize: 30,
        scheduledDelayMillis: 5000,
      }),
    ],
  });

  _provider.register({
    propagator: new W3CTraceContextPropagator(),
  });

  _tracer = trace.getTracer('pillar-sdk', '0.1.0');
  return _tracer;
}

/** Return the active tracer (or a no-op tracer if tracing is not initialised). */
export function getTracer(): Tracer {
  return _tracer ?? trace.getTracer('pillar-sdk');
}

/** Whether tracing has been initialised. */
export function isTracingEnabled(): boolean {
  return _provider !== null;
}

/**
 * Build a W3C `traceparent` header value from the current active span.
 * Returns `undefined` if there is no active span.
 */
export function getTraceparentHeader(): string | undefined {
  const span = trace.getActiveSpan();
  if (!span) return undefined;

  const ctx = span.spanContext();
  if (!ctx) return undefined;

  const traceId = ctx.traceId;
  const spanId = ctx.spanId;
  const flags = ctx.traceFlags.toString(16).padStart(2, '0');
  return `00-${traceId}-${spanId}-${flags}`;
}

/**
 * Inject `traceparent` (and optionally `tracestate`) into a headers object.
 * Mutates and returns the headers dict.
 */
export function injectTraceHeaders(
  headers: Record<string, string>,
): Record<string, string> {
  const tp = getTraceparentHeader();
  if (tp) {
    headers['traceparent'] = tp;
  }
  return headers;
}

/**
 * Force-flush any pending spans. Call on page unload or when needed.
 */
export async function flushTracing(): Promise<void> {
  if (_provider) {
    await _provider.forceFlush();
  }
}

/**
 * Shut down the provider (call on SDK destroy).
 */
export async function shutdownTracing(): Promise<void> {
  if (_provider) {
    await _provider.shutdown();
    _provider = null;
    _tracer = null;
  }
}

// Re-export helpers so consumers don't need to import @opentelemetry/api directly
export { trace, context, SpanStatusCode };
export type { Span };

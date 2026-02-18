/**
 * Prometheus text format parser for tns-csi controller metrics.
 *
 * Fetches the raw metrics text via ApiProxy and parses the key metric families
 * we expose in the Metrics page.
 */

import { ApiProxy } from '@kinvolk/headlamp-plugin/lib';
import type { TnsCsiPod } from './k8s';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MetricSample {
  labels: Record<string, string>;
  value: number;
}

export interface MetricFamily {
  name: string;
  help: string;
  type: string;
  samples: MetricSample[];
}

export type ParsedMetrics = Map<string, MetricFamily>;

export interface TnsCsiMetrics {
  /** 1 = connected, 0 = disconnected */
  websocketConnected: number | null;
  websocketReconnectsTotal: number | null;
  websocketMessagesTotal: MetricSample[];
  websocketMessageDurationSeconds: MetricSample[];

  volumeOperationsTotal: MetricSample[];
  volumeOperationsDurationSeconds: MetricSample[];
  volumeCapacityBytes: MetricSample[];

  csiOperationsTotal: MetricSample[];
  csiOperationsDurationSeconds: MetricSample[];
}

// ---------------------------------------------------------------------------
// Prometheus text format parser
// ---------------------------------------------------------------------------

const LABEL_PAIR_RE = /(\w+)="([^"]*)"/g;

function parseLabels(labelStr: string): Record<string, string> {
  const labels: Record<string, string> = {};
  let match: RegExpExecArray | null;
  const re = new RegExp(LABEL_PAIR_RE.source, 'g');
  while ((match = re.exec(labelStr)) !== null) {
    const key = match[1];
    const val = match[2];
    if (key && val !== undefined) {
      labels[key] = val;
    }
  }
  return labels;
}

/**
 * Parses Prometheus text exposition format into a Map of metric families.
 * Only handles the subset used by tns-csi (gauge, counter, histogram summaries).
 */
export function parsePrometheusText(text: string): ParsedMetrics {
  const families = new Map<string, MetricFamily>();
  let currentName = '';
  let currentHelp = '';
  let currentType = '';

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith('# HELP ')) {
      const rest = line.slice(7);
      const spaceIdx = rest.indexOf(' ');
      currentName = spaceIdx >= 0 ? rest.slice(0, spaceIdx) : rest;
      currentHelp = spaceIdx >= 0 ? rest.slice(spaceIdx + 1) : '';
      continue;
    }

    if (line.startsWith('# TYPE ')) {
      const rest = line.slice(7);
      const spaceIdx = rest.indexOf(' ');
      currentType = spaceIdx >= 0 ? rest.slice(spaceIdx + 1) : '';
      continue;
    }

    if (line.startsWith('#')) continue;

    // Sample line: metric_name{label="val"} 1.0
    // or: metric_name 1.0
    const openBrace = line.indexOf('{');
    const closeBrace = line.lastIndexOf('}');

    let metricName: string;
    let labels: Record<string, string>;
    let valuePart: string;

    if (openBrace >= 0 && closeBrace > openBrace) {
      metricName = line.slice(0, openBrace);
      labels = parseLabels(line.slice(openBrace + 1, closeBrace));
      valuePart = line.slice(closeBrace + 1).trim();
    } else {
      const spaceIdx = line.lastIndexOf(' ');
      if (spaceIdx < 0) continue;
      metricName = line.slice(0, spaceIdx);
      labels = {};
      valuePart = line.slice(spaceIdx + 1).trim();
    }

    // Strip timestamp if present (second space-separated token)
    const valueTokens = valuePart.split(' ');
    const valueStr = valueTokens[0] ?? '';
    const value = parseFloat(valueStr);
    if (!Number.isFinite(value)) continue;

    // Determine the family name: for histogram/summary _bucket/_count/_sum
    // strip the suffix but keep it as the family name key
    const familyKey = metricName;

    let family = families.get(familyKey);
    if (!family) {
      family = {
        name: familyKey,
        help: metricName === currentName ? currentHelp : '',
        type: metricName === currentName ? currentType : '',
        samples: [],
      };
      families.set(familyKey, family);
    }

    family.samples.push({ labels, value });
  }

  return families;
}

// ---------------------------------------------------------------------------
// Extract tns-csi-specific metrics from the parsed map
// ---------------------------------------------------------------------------

function scalarMetric(families: ParsedMetrics, name: string): number | null {
  const family = families.get(name);
  if (!family || family.samples.length === 0) return null;
  return family.samples[0]?.value ?? null;
}

function samplesFor(families: ParsedMetrics, name: string): MetricSample[] {
  return families.get(name)?.samples ?? [];
}

export function extractTnsCsiMetrics(families: ParsedMetrics): TnsCsiMetrics {
  return {
    websocketConnected: scalarMetric(families, 'tns_websocket_connected'),
    websocketReconnectsTotal: scalarMetric(families, 'tns_websocket_reconnects_total'),
    websocketMessagesTotal: samplesFor(families, 'tns_websocket_messages_total'),
    websocketMessageDurationSeconds: samplesFor(families, 'tns_websocket_message_duration_seconds'),

    volumeOperationsTotal: samplesFor(families, 'tns_volume_operations_total'),
    volumeOperationsDurationSeconds: samplesFor(families, 'tns_volume_operations_duration_seconds'),
    volumeCapacityBytes: samplesFor(families, 'tns_volume_capacity_bytes'),

    csiOperationsTotal: samplesFor(families, 'tns_csi_operations_total'),
    csiOperationsDurationSeconds: samplesFor(families, 'tns_csi_operations_duration_seconds'),
  };
}

// ---------------------------------------------------------------------------
// Fetch metrics via Kubernetes API proxy
// ---------------------------------------------------------------------------

/**
 * Fetches metrics from the tns-csi controller pod via the Kubernetes API proxy.
 *
 * The proxy path is:
 *   /api/v1/namespaces/{namespace}/pods/{podName}:{port}/proxy/metrics
 */
export async function fetchControllerMetrics(
  controllerPod: TnsCsiPod,
  namespace: string = 'kube-system'
): Promise<TnsCsiMetrics> {
  const podName = controllerPod.metadata.name;
  const path = `/api/v1/namespaces/${namespace}/pods/${podName}:8080/proxy/metrics`;

  const raw: unknown = await ApiProxy.request(path, {
    method: 'GET',
    isJSON: false,
  });

  if (typeof raw !== 'string') {
    throw new Error('Metrics endpoint did not return text');
  }

  const families = parsePrometheusText(raw);
  return extractTnsCsiMetrics(families);
}

// ---------------------------------------------------------------------------
// Formatting helpers for display
// ---------------------------------------------------------------------------

/** Format a bytes value as a human-readable string (GB/MB/KB). */
export function formatBytes(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(1)} KB`;
  return `${bytes} B`;
}

/** Sum all sample values for a given metric name. */
export function sumSamples(samples: MetricSample[]): number {
  return samples.reduce((acc, s) => acc + s.value, 0);
}

/** Group samples by a label key, summing values per group. */
export function groupByLabel(
  samples: MetricSample[],
  labelKey: string
): Map<string, number> {
  const result = new Map<string, number>();
  for (const sample of samples) {
    const key = sample.labels[labelKey] ?? 'unknown';
    result.set(key, (result.get(key) ?? 0) + sample.value);
  }
  return result;
}

/** Filter samples where a specific label equals a value. */
export function filterByLabel(
  samples: MetricSample[],
  labelKey: string,
  labelValue: string
): MetricSample[] {
  return samples.filter(s => s.labels[labelKey] === labelValue);
}

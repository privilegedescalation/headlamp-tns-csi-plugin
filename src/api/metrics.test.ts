import { describe, expect, it } from 'vitest';
import {
  extractTnsCsiMetrics,
  filterByLabel,
  formatBytes,
  groupByLabel,
  parsePrometheusText,
  sumSamples,
} from './metrics';

const SAMPLE_METRICS = `
# HELP tns_websocket_connected WebSocket connection status
# TYPE tns_websocket_connected gauge
tns_websocket_connected 1

# HELP tns_websocket_reconnects_total Total WebSocket reconnects
# TYPE tns_websocket_reconnects_total counter
tns_websocket_reconnects_total 3

# HELP tns_volume_operations_total Total volume operations
# TYPE tns_volume_operations_total counter
tns_volume_operations_total{protocol="nfs",operation="create",status="success"} 42
tns_volume_operations_total{protocol="nfs",operation="delete",status="success"} 10
tns_volume_operations_total{protocol="iscsi",operation="create",status="success"} 5

# HELP tns_volume_capacity_bytes Total provisioned capacity
# TYPE tns_volume_capacity_bytes gauge
tns_volume_capacity_bytes{volume_id="vol1",protocol="nfs"} 10737418240
tns_volume_capacity_bytes{volume_id="vol2",protocol="nfs"} 21474836480

# HELP tns_csi_operations_total CSI gRPC operations
# TYPE tns_csi_operations_total counter
tns_csi_operations_total{method="CreateVolume",grpc_status_code="OK"} 42
tns_csi_operations_total{method="DeleteVolume",grpc_status_code="OK"} 10
`.trim();

describe('parsePrometheusText', () => {
  it('parses scalar gauges', () => {
    const families = parsePrometheusText(SAMPLE_METRICS);
    const ws = families.get('tns_websocket_connected');
    expect(ws).toBeDefined();
    expect(ws?.samples).toHaveLength(1);
    expect(ws?.samples[0]?.value).toBe(1);
  });

  it('parses counters with labels', () => {
    const families = parsePrometheusText(SAMPLE_METRICS);
    const ops = families.get('tns_volume_operations_total');
    expect(ops?.samples).toHaveLength(3);
  });

  it('parses labels correctly', () => {
    const families = parsePrometheusText(SAMPLE_METRICS);
    const ops = families.get('tns_volume_operations_total');
    const firstSample = ops?.samples[0];
    expect(firstSample?.labels['protocol']).toBe('nfs');
    expect(firstSample?.labels['operation']).toBe('create');
    expect(firstSample?.labels['status']).toBe('success');
    expect(firstSample?.value).toBe(42);
  });

  it('handles empty input gracefully', () => {
    const families = parsePrometheusText('');
    expect(families.size).toBe(0);
  });

  it('skips comment lines', () => {
    const families = parsePrometheusText('# HELP foo bar\n# TYPE foo gauge\n');
    expect(families.size).toBe(0);
  });
});

describe('extractTnsCsiMetrics', () => {
  it('extracts websocket connected status', () => {
    const families = parsePrometheusText(SAMPLE_METRICS);
    const metrics = extractTnsCsiMetrics(families);
    expect(metrics.websocketConnected).toBe(1);
  });

  it('extracts reconnect total', () => {
    const families = parsePrometheusText(SAMPLE_METRICS);
    const metrics = extractTnsCsiMetrics(families);
    expect(metrics.websocketReconnectsTotal).toBe(3);
  });

  it('extracts volume operations samples', () => {
    const families = parsePrometheusText(SAMPLE_METRICS);
    const metrics = extractTnsCsiMetrics(families);
    expect(metrics.volumeOperationsTotal).toHaveLength(3);
  });

  it('extracts CSI operations samples', () => {
    const families = parsePrometheusText(SAMPLE_METRICS);
    const metrics = extractTnsCsiMetrics(families);
    expect(metrics.csiOperationsTotal).toHaveLength(2);
  });

  it('returns null for missing metrics', () => {
    const families = parsePrometheusText('');
    const metrics = extractTnsCsiMetrics(families);
    expect(metrics.websocketConnected).toBeNull();
    expect(metrics.websocketReconnectsTotal).toBeNull();
    expect(metrics.volumeOperationsTotal).toHaveLength(0);
  });
});

describe('sumSamples', () => {
  it('sums all sample values', () => {
    const families = parsePrometheusText(SAMPLE_METRICS);
    const ops = families.get('tns_volume_operations_total')?.samples ?? [];
    expect(sumSamples(ops)).toBe(57); // 42 + 10 + 5
  });

  it('returns 0 for empty array', () => {
    expect(sumSamples([])).toBe(0);
  });
});

describe('groupByLabel', () => {
  it('groups samples by label key and sums values', () => {
    const families = parsePrometheusText(SAMPLE_METRICS);
    const ops = families.get('tns_volume_operations_total')?.samples ?? [];
    const byProtocol = groupByLabel(ops, 'protocol');
    expect(byProtocol.get('nfs')).toBe(52); // 42 + 10
    expect(byProtocol.get('iscsi')).toBe(5);
  });
});

describe('filterByLabel', () => {
  it('filters samples by label value', () => {
    const families = parsePrometheusText(SAMPLE_METRICS);
    const ops = families.get('tns_volume_operations_total')?.samples ?? [];
    const iscsiOps = filterByLabel(ops, 'protocol', 'iscsi');
    expect(iscsiOps).toHaveLength(1);
    expect(iscsiOps[0]?.value).toBe(5);
  });
});

describe('formatBytes', () => {
  it('formats GB', () => expect(formatBytes(1e9)).toBe('1.0 GB'));
  it('formats MB', () => expect(formatBytes(1.5e6)).toBe('1.5 MB'));
  it('formats KB', () => expect(formatBytes(2e3)).toBe('2.0 KB'));
  it('formats bytes', () => expect(formatBytes(512)).toBe('512 B'));
});

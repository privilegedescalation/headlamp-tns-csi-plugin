/**
 * MetricsPage — Prometheus metrics from the tns-csi controller pod.
 * Fetches metrics via API proxy and displays in structured cards.
 */

import {
  Loader,
  NameValueTable,
  SectionBox,
  SectionHeader,
  StatusLabel,
} from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import React, { useCallback, useEffect, useState } from 'react';
import { useTnsCsiContext } from '../api/TnsCsiDataContext';
import type { TnsCsiMetrics } from '../api/metrics';
import { fetchControllerMetrics, formatBytes, groupByLabel, sumSamples } from '../api/metrics';

function formatAuditTime(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} minute${mins > 1 ? 's' : ''} ago`;
  const hours = Math.floor(mins / 60);
  return `${hours} hour${hours > 1 ? 's' : ''} ago`;
}

// ---------------------------------------------------------------------------
// Metrics cards
// ---------------------------------------------------------------------------

function WebSocketCard({ metrics }: { metrics: TnsCsiMetrics }) {
  const connected = metrics.websocketConnected;
  const reconnects = metrics.websocketReconnectsTotal;

  return (
    <SectionBox title="WebSocket Health">
      <NameValueTable
        rows={[
          {
            name: 'Connection Status',
            value: (
              <StatusLabel status={connected === 1 ? 'success' : connected === 0 ? 'error' : 'warning'}>
                {connected === 1 ? 'Connected' : connected === 0 ? 'Disconnected' : 'Unknown'}
              </StatusLabel>
            ),
          },
          {
            name: 'Total Reconnects',
            value: reconnects !== null ? String(reconnects) : '—',
          },
          {
            name: 'Messages Total',
            value: String(Math.round(sumSamples(metrics.websocketMessagesTotal))),
          },
        ]}
      />
    </SectionBox>
  );
}

function VolumeOperationsCard({ metrics }: { metrics: TnsCsiMetrics }) {
  const byProtocol = groupByLabel(metrics.volumeOperationsTotal, 'protocol');
  const totalOps = sumSamples(metrics.volumeOperationsTotal);
  const totalCapacityBytes = sumSamples(metrics.volumeCapacityBytes);

  const rows: Array<{ name: string; value: React.ReactNode }> = [
    { name: 'Total Operations', value: String(Math.round(totalOps)) },
    { name: 'Total Provisioned Capacity', value: formatBytes(totalCapacityBytes) },
  ];

  for (const [protocol, count] of byProtocol.entries()) {
    rows.push({ name: `Operations (${protocol})`, value: String(Math.round(count)) });
  }

  return (
    <SectionBox title="Volume Operations">
      <NameValueTable rows={rows} />
    </SectionBox>
  );
}

function CsiOperationsCard({ metrics }: { metrics: TnsCsiMetrics }) {
  const byMethod = groupByLabel(metrics.csiOperationsTotal, 'method');
  const totalOps = sumSamples(metrics.csiOperationsTotal);

  const rows: Array<{ name: string; value: React.ReactNode }> = [
    { name: 'Total CSI Calls', value: String(Math.round(totalOps)) },
  ];

  for (const [method, count] of byMethod.entries()) {
    rows.push({ name: method, value: String(Math.round(count)) });
  }

  return (
    <SectionBox title="CSI Operations">
      <NameValueTable rows={rows} />
    </SectionBox>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function MetricsPage() {
  const { controllerPods, driverInstalled, loading } = useTnsCsiContext();

  const [metrics, setMetrics] = useState<TnsCsiMetrics | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    if (controllerPods.length === 0) return;
    const pod = controllerPods[0];
    if (!pod) return;

    setMetricsLoading(true);
    setMetricsError(null);
    try {
      const result = await fetchControllerMetrics(pod);
      setMetrics(result);
      setLastUpdated(new Date().toISOString());
    } catch (err: unknown) {
      setMetricsError(err instanceof Error ? err.message : String(err));
    } finally {
      setMetricsLoading(false);
    }
  }, [controllerPods]);

  useEffect(() => {
    void fetchMetrics();
  }, [fetchMetrics]);

  if (loading) return <Loader title="Loading tns-csi data..." />;

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <SectionHeader title="TNS-CSI — Metrics" />
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          {lastUpdated && (
            <span style={{ fontSize: '14px', color: 'var(--mui-palette-text-secondary, #666)' }}>
              Updated: {formatAuditTime(lastUpdated)}
            </span>
          )}
          <button
            onClick={() => void fetchMetrics()}
            disabled={metricsLoading}
            aria-label="Refresh metrics"
            style={{
              padding: '6px 16px',
              backgroundColor: 'transparent',
              color: 'var(--mui-palette-primary-main, #1976d2)',
              border: '1px solid var(--mui-palette-primary-main, #1976d2)',
              borderRadius: '4px',
              cursor: metricsLoading ? 'not-allowed' : 'pointer',
              fontSize: '13px',
              fontWeight: 500,
              opacity: metricsLoading ? 0.6 : 1,
            }}
          >
            {metricsLoading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      {!driverInstalled && (
        <SectionBox title="Driver Not Detected">
          <NameValueTable
            rows={[{ name: 'Status', value: <StatusLabel status="error">TNS-CSI driver not found on this cluster</StatusLabel> }]}
          />
        </SectionBox>
      )}

      {controllerPods.length === 0 && driverInstalled && (
        <SectionBox title="Metrics Unavailable">
          <NameValueTable
            rows={[
              { name: 'Status', value: <StatusLabel status="warning">No controller pod found</StatusLabel> },
              { name: 'Note', value: 'Ensure controller pod is running with metrics enabled on port 8080.' },
              {
                name: 'Troubleshooting',
                value: 'kubectl logs -n kube-system -l app.kubernetes.io/name=tns-csi-driver,app.kubernetes.io/component=controller',
              },
            ]}
          />
        </SectionBox>
      )}

      {metricsError && (
        <SectionBox title="Metrics Error">
          <NameValueTable
            rows={[
              { name: 'Error', value: <StatusLabel status="error">{metricsError}</StatusLabel> },
              { name: 'Note', value: 'Metrics are fetched via Kubernetes API proxy to the controller pod port 8080.' },
            ]}
          />
        </SectionBox>
      )}

      {metricsLoading && !metrics && <Loader title="Fetching metrics..." />}

      {metrics && (
        <>
          <WebSocketCard metrics={metrics} />
          <VolumeOperationsCard metrics={metrics} />
          <CsiOperationsCard metrics={metrics} />
        </>
      )}
    </>
  );
}

/**
 * OverviewPage — main dashboard for tns-csi plugin.
 *
 * Shows: driver health, storage summary (SC/PV/PVC counts + protocol breakdown),
 * and any PVCs in non-Bound state.
 */

import {
  Loader,
  NameValueTable,
  PercentageBar,
  SectionBox,
  SectionHeader,
  SimpleTable,
  StatusLabel,
} from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import React, { useCallback, useEffect, useState } from 'react';
import { useTnsCsiContext } from '../api/TnsCsiDataContext';
import { formatAge, formatProtocol, phaseToStatus } from '../api/k8s';
import type { TnsCsiMetrics } from '../api/metrics';
import { extractTnsCsiMetrics, fetchControllerMetrics, parsePrometheusText } from '../api/metrics';
import DriverStatusCard from './DriverStatusCard';

// ---------------------------------------------------------------------------
// Protocol breakdown chart
// ---------------------------------------------------------------------------

const PROTOCOL_COLORS: Record<string, string> = {
  NFS: '#1976d2',
  'NVMe-oF': '#9c27b0',
  iSCSI: '#f57c00',
  Other: '#9e9e9e',
};

function protocolChartData(storageClasses: Array<{ parameters?: { protocol?: string } }>) {
  const counts = new Map<string, number>();
  for (const sc of storageClasses) {
    const proto = formatProtocol(sc.parameters?.protocol);
    counts.set(proto, (counts.get(proto) ?? 0) + 1);
  }
  return [...counts.entries()].map(([name, value]) => ({
    name,
    value,
    fill: PROTOCOL_COLORS[name] ?? PROTOCOL_COLORS['Other'],
  }));
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function OverviewPage() {
  const {
    csiDriver,
    driverInstalled,
    storageClasses,
    persistentVolumes,
    persistentVolumeClaims,
    controllerPods,
    nodePods,
    poolStats,
    poolStatsError,
    loading,
    error,
    refresh,
  } = useTnsCsiContext();

  const [metrics, setMetrics] = useState<TnsCsiMetrics | null>(null);
  const [metricsError, setMetricsError] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    if (controllerPods.length === 0) return;
    const pod = controllerPods[0];
    if (!pod) return;
    try {
      const result = await fetchControllerMetrics(pod);
      setMetrics(result);
      setMetricsError(null);
    } catch (err: unknown) {
      setMetricsError(err instanceof Error ? err.message : String(err));
    }
  }, [controllerPods]);

  useEffect(() => {
    void fetchMetrics();
  }, [fetchMetrics]);

  if (loading) {
    return <Loader title="Loading TNS-CSI data..." />;
  }

  // Compute storage summary
  const totalCapacityBytes = persistentVolumes.reduce((sum, pv) => {
    const cap = pv.spec.capacity?.storage ?? '0';
    return sum + parseStorageToBytes(cap);
  }, 0);

  const pvcStatusCounts = { Bound: 0, Pending: 0, Lost: 0, Other: 0 };
  for (const pvc of persistentVolumeClaims) {
    const phase = pvc.status?.phase ?? 'Other';
    if (phase === 'Bound') pvcStatusCounts.Bound++;
    else if (phase === 'Pending') pvcStatusCounts.Pending++;
    else if (phase === 'Lost') pvcStatusCounts.Lost++;
    else pvcStatusCounts.Other++;
  }

  const nonBoundPvcs = persistentVolumeClaims.filter(
    pvc => pvc.status?.phase !== 'Bound'
  );

  const chartData = protocolChartData(storageClasses);
  const totalScs = storageClasses.length;

  // Capacity by pool: join volumeCapacityBytes samples (volume_id, protocol)
  // with PV volumeHandle → pool name from volumeAttributes.
  const capacityByPool: Map<string, number> = React.useMemo(() => {
    const map = new Map<string, number>();
    if (!metrics) return map;
    // Build lookup: volumeHandle → pool name
    const handleToPool = new Map<string, string>();
    for (const pv of persistentVolumes) {
      const handle = pv.spec.csi?.volumeHandle;
      const pool = pv.spec.csi?.volumeAttributes?.['pool'];
      if (handle && pool) handleToPool.set(handle, pool);
    }
    for (const sample of metrics.volumeCapacityBytes) {
      const volumeId = sample.labels['volume_id'];
      if (!volumeId) continue;
      const pool = handleToPool.get(volumeId) ?? 'unknown';
      map.set(pool, (map.get(pool) ?? 0) + sample.value);
    }
    return map;
  }, [metrics, persistentVolumes]);

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <SectionHeader title="TNS-CSI — Overview" />
        <button
          onClick={refresh}
          aria-label="Refresh tns-csi data"
          style={{
            padding: '6px 16px',
            backgroundColor: 'transparent',
            color: 'var(--mui-palette-primary-main, #1976d2)',
            border: '1px solid var(--mui-palette-primary-main, #1976d2)',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 500,
          }}
        >
          Refresh
        </button>
      </div>

      {/* Early development banner */}
      <SectionBox title="Notice">
        <NameValueTable
          rows={[
            {
              name: 'Development Status',
              value: (
                <StatusLabel status="warning">
                  tns-csi is in active early development — not production-ready
                </StatusLabel>
              ),
            },
          ]}
        />
      </SectionBox>

      {/* Driver not detected */}
      {!driverInstalled && !loading && (
        <SectionBox title="Driver Not Detected">
          <NameValueTable
            rows={[
              {
                name: 'Status',
                value: <StatusLabel status="error">CSIDriver tns.csi.io not found on this cluster</StatusLabel>,
              },
              {
                name: 'Install',
                value: 'helm install tns-csi oci://registry-1.docker.io/fenio/tns-csi --namespace kube-system',
              },
            ]}
          />
        </SectionBox>
      )}

      {/* Error state */}
      {error && (
        <SectionBox title="Error">
          <NameValueTable
            rows={[{ name: 'Status', value: <StatusLabel status="error">{error}</StatusLabel> }]}
          />
        </SectionBox>
      )}

      {/* Driver status */}
      <DriverStatusCard
        csiDriver={csiDriver}
        controllerPods={controllerPods}
        nodePods={nodePods}
        metrics={metrics}
      />

      {metricsError && (
        <SectionBox title="Metrics Unavailable">
          <NameValueTable
            rows={[
              {
                name: 'Status',
                value: <StatusLabel status="warning">{metricsError}</StatusLabel>,
              },
              {
                name: 'Note',
                value: 'Ensure controller pod is running with metrics enabled (port 8080).',
              },
            ]}
          />
        </SectionBox>
      )}

      {/* Storage summary */}
      <SectionBox title="Storage Summary">
        {totalScs > 0 && chartData.length > 0 && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{ marginBottom: '8px', fontSize: '14px', color: 'var(--mui-palette-text-secondary)' }}>
              Protocol Distribution
            </div>
            <PercentageBar data={chartData} total={totalScs} />
          </div>
        )}
        <NameValueTable
          rows={[
            { name: 'Storage Classes', value: String(totalScs) },
            { name: 'Persistent Volumes', value: String(persistentVolumes.length) },
            { name: 'Total Capacity', value: formatBytes(totalCapacityBytes) },
            {
              name: 'PVCs (Bound)',
              value: <StatusLabel status="success">{pvcStatusCounts.Bound}</StatusLabel>,
            },
            ...(pvcStatusCounts.Pending > 0
              ? [{
                  name: 'PVCs (Pending)',
                  value: <StatusLabel status="warning">{pvcStatusCounts.Pending}</StatusLabel>,
                }]
              : []),
            ...(pvcStatusCounts.Lost > 0
              ? [{
                  name: 'PVCs (Lost)',
                  value: <StatusLabel status="error">{pvcStatusCounts.Lost}</StatusLabel>,
                }]
              : []),
          ]}
        />
      </SectionBox>

      {/* Pool capacity — real data from TrueNAS API when configured */}
      {poolStats.length > 0 && (
        <SectionBox title="Pool Capacity">
          <SimpleTable
            columns={[
              { label: 'Pool', getter: (p) => p.name },
              {
                label: 'Status',
                getter: (p) => (
                  <StatusLabel status={p.status === 'ONLINE' ? 'success' : 'warning'}>
                    {p.status}
                  </StatusLabel>
                ),
              },
              { label: 'Total', getter: (p) => formatBytes(p.size) },
              { label: 'Used', getter: (p) => formatBytes(p.allocated) },
              { label: 'Free', getter: (p) => formatBytes(p.free) },
              {
                label: 'Used %',
                getter: (p) => p.size > 0
                  ? `${Math.round((p.allocated / p.size) * 100)}%`
                  : '—',
              },
            ]}
            data={poolStats}
          />
        </SectionBox>
      )}

      {poolStatsError && (
        <SectionBox title="Pool Capacity Unavailable">
          <NameValueTable
            rows={[
              {
                name: 'Error',
                value: <StatusLabel status="warning">{poolStatsError}</StatusLabel>,
              },
              {
                name: 'Note',
                value: 'Check your TrueNAS API key and server address in plugin settings.',
              },
            ]}
          />
        </SectionBox>
      )}

      {/* Provisioned capacity by pool (from Prometheus metrics — shown when TrueNAS API not configured) */}
      {poolStats.length === 0 && !poolStatsError && capacityByPool.size > 0 && (
        <SectionBox title="Provisioned Capacity by Pool">
          <NameValueTable
            rows={[...capacityByPool.entries()]
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([pool, bytes]) => ({
                name: pool,
                value: formatBytes(bytes),
              }))}
          />
        </SectionBox>
      )}

      {/* Non-bound PVCs warning */}
      {nonBoundPvcs.length > 0 && (
        <SectionBox title="Attention: Non-Bound PVCs">
          <SimpleTable
            columns={[
              { label: 'Name', getter: (pvc) => pvc.metadata.name },
              { label: 'Namespace', getter: (pvc) => pvc.metadata.namespace ?? '—' },
              {
                label: 'Status',
                getter: (pvc) => (
                  <StatusLabel status={phaseToStatus(pvc.status?.phase)}>
                    {pvc.status?.phase ?? 'Unknown'}
                  </StatusLabel>
                ),
              },
              { label: 'Age', getter: (pvc) => formatAge(pvc.metadata.creationTimestamp) },
            ]}
            data={nonBoundPvcs}
          />
        </SectionBox>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseStorageToBytes(storage: string): number {
  const match = /^(\d+(?:\.\d+)?)\s*(Ki|Mi|Gi|Ti|Pi|K|M|G|T|P)?$/.exec(storage.trim());
  if (!match) return 0;
  const value = parseFloat(match[1]);
  const suffix = match[2] ?? '';
  const multipliers: Record<string, number> = {
    '': 1,
    K: 1e3, Ki: 1024,
    M: 1e6, Mi: 1024 ** 2,
    G: 1e9, Gi: 1024 ** 3,
    T: 1e12, Ti: 1024 ** 4,
    P: 1e15, Pi: 1024 ** 5,
  };
  return value * (multipliers[suffix] ?? 1);
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 4) return `${(bytes / 1024 ** 4).toFixed(1)} TiB`;
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GiB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MiB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${bytes} B`;
}

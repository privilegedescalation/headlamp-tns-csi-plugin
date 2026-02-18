/**
 * DriverStatusCard — reusable component showing tns-csi driver health.
 * Displays controller pods, node pods, CSIDriver capabilities, and
 * WebSocket connection health from Prometheus metrics.
 */

import {
  NameValueTable,
  SectionBox,
  StatusLabel,
} from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import React from 'react';
import type { CSIDriver, TnsCsiPod } from '../api/k8s';
import { formatAge, getPodImage, getPodRestarts, isPodReady } from '../api/k8s';
import type { TnsCsiMetrics } from '../api/metrics';

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function WebSocketStatus({ metrics }: { metrics: TnsCsiMetrics | null }) {
  if (!metrics) {
    return <StatusLabel status="warning">Metrics unavailable</StatusLabel>;
  }

  const connected = metrics.websocketConnected;
  if (connected === null) {
    return <StatusLabel status="warning">Unknown</StatusLabel>;
  }

  return (
    <StatusLabel status={connected === 1 ? 'success' : 'error'}>
      {connected === 1 ? 'Connected' : 'Disconnected'}
    </StatusLabel>
  );
}

function PodStatusBadge({ pod }: { pod: TnsCsiPod }) {
  const ready = isPodReady(pod);
  const phase = pod.status?.phase ?? 'Unknown';
  return (
    <StatusLabel status={ready ? 'success' : 'error'}>
      {phase}
    </StatusLabel>
  );
}

function PodRow({ pod }: { pod: TnsCsiPod }) {
  const name = pod.metadata.name;
  const node = pod.spec?.nodeName ?? '—';
  const restarts = getPodRestarts(pod);
  const image = getPodImage(pod);
  const age = formatAge(pod.metadata.creationTimestamp);

  return (
    <NameValueTable
      rows={[
        { name: 'Pod', value: name },
        { name: 'Node', value: node },
        { name: 'Status', value: <PodStatusBadge pod={pod} /> },
        { name: 'Restarts', value: String(restarts) },
        { name: 'Image', value: image },
        { name: 'Age', value: age },
      ]}
    />
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface DriverStatusCardProps {
  csiDriver: CSIDriver | null;
  controllerPods: TnsCsiPod[];
  nodePods: TnsCsiPod[];
  metrics?: TnsCsiMetrics | null;
}

export default function DriverStatusCard({
  csiDriver,
  controllerPods,
  nodePods,
  metrics,
}: DriverStatusCardProps) {
  const driverInstalled = csiDriver !== null;
  const allPodsReady =
    controllerPods.length > 0 &&
    nodePods.length > 0 &&
    [...controllerPods, ...nodePods].every(isPodReady);

  return (
    <>
      <SectionBox title="Driver Status">
        <NameValueTable
          rows={[
            {
              name: 'Driver',
              value: (
                <StatusLabel status={driverInstalled ? 'success' : 'error'}>
                  {driverInstalled ? 'tns.csi.io installed' : 'Not detected'}
                </StatusLabel>
              ),
            },
            {
              name: 'Overall Health',
              value: (
                <StatusLabel status={allPodsReady ? 'success' : 'error'}>
                  {allPodsReady ? 'Healthy' : 'Degraded'}
                </StatusLabel>
              ),
            },
            {
              name: 'WebSocket',
              value: <WebSocketStatus metrics={metrics ?? null} />,
            },
            ...(metrics?.websocketReconnectsTotal !== null && metrics?.websocketReconnectsTotal !== undefined
              ? [{ name: 'WS Reconnects', value: String(metrics.websocketReconnectsTotal) }]
              : []),
          ]}
        />
      </SectionBox>

      {csiDriver && (
        <SectionBox title="CSI Driver Capabilities">
          <NameValueTable
            rows={[
              {
                name: 'Attach Required',
                value: String(csiDriver.spec?.attachRequired ?? '—'),
              },
              {
                name: 'Pod Info on Mount',
                value: String(csiDriver.spec?.podInfoOnMount ?? '—'),
              },
              {
                name: 'Volume Lifecycle Modes',
                value: csiDriver.spec?.volumeLifecycleModes?.join(', ') ?? '—',
              },
            ]}
          />
        </SectionBox>
      )}

      {controllerPods.length > 0 && (
        <SectionBox title={`Controller Pod${controllerPods.length > 1 ? 's' : ''}`}>
          {controllerPods.map(pod => (
            <PodRow key={pod.metadata.name} pod={pod} />
          ))}
        </SectionBox>
      )}

      {controllerPods.length === 0 && (
        <SectionBox title="Controller Pods">
          <NameValueTable
            rows={[{ name: 'Status', value: <StatusLabel status="error">No controller pod found</StatusLabel> }]}
          />
        </SectionBox>
      )}

      {nodePods.length > 0 && (
        <SectionBox title={`Node Pod${nodePods.length > 1 ? 's' : ''} (${nodePods.length})`}>
          {nodePods.map(pod => (
            <PodRow key={pod.metadata.name} pod={pod} />
          ))}
        </SectionBox>
      )}

      {nodePods.length === 0 && (
        <SectionBox title="Node Pods">
          <NameValueTable
            rows={[{ name: 'Status', value: <StatusLabel status="error">No node pods found</StatusLabel> }]}
          />
        </SectionBox>
      )}
    </>
  );
}

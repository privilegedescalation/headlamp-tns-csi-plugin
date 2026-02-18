/**
 * DriverPodDetailSection — injected into Headlamp's Pod detail view.
 *
 * Shown only for tns-csi driver pods (identified by
 * app.kubernetes.io/name=tns-csi-driver label). Returns null for all other pods.
 * Uses registerDetailsViewSection in index.tsx.
 */

import {
  NameValueTable,
  SectionBox,
} from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import React from 'react';
import { formatAge, isPodReady, getPodRestarts, TnsCsiPod } from '../api/k8s';

interface DriverPodDetailSectionProps {
  resource: {
    kind?: string;
    metadata?: {
      name?: string;
      namespace?: string;
      labels?: Record<string, string>;
      creationTimestamp?: string;
    };
    spec?: { nodeName?: string };
    status?: {
      phase?: string;
      conditions?: Array<{ type: string; status: string }>;
      containerStatuses?: Array<{
        name: string;
        ready: boolean;
        restartCount: number;
        image?: string;
        state?: {
          running?: { startedAt?: string };
          waiting?: { reason?: string };
          terminated?: { exitCode?: number; reason?: string };
        };
      }>;
    };
    // KubeObject instance: raw JSON lives under jsonData;
    // metadata here only exposes what the class getter provides (labels, creationTimestamp).
    // The jsonData.metadata has the full shape.
    jsonData?: {
      metadata?: {
        name?: string;
        namespace?: string;
        labels?: Record<string, string>;
        creationTimestamp?: string;
      };
      spec?: { nodeName?: string };
      status?: {
        phase?: string;
        conditions?: Array<{ type: string; status: string }>;
        containerStatuses?: Array<{
          name: string;
          ready: boolean;
          restartCount: number;
          image?: string;
          state?: {
            running?: { startedAt?: string };
            waiting?: { reason?: string };
            terminated?: { exitCode?: number; reason?: string };
          };
        }>;
      };
    };
  };
}

export default function DriverPodDetailSection({ resource }: DriverPodDetailSectionProps) {
  // Extract from jsonData (KubeObject instance) or fall back to direct props.
  // jsonData.metadata has the full shape including name/namespace; resource.metadata
  // only exposes fields that the Headlamp class getter provides (labels, creationTimestamp).
  const meta = (resource?.jsonData?.metadata ?? resource?.metadata) as {
    name?: string;
    namespace?: string;
    labels?: Record<string, string>;
    creationTimestamp?: string;
  } | undefined;
  const spec = resource?.jsonData?.spec ?? resource?.spec;
  const status = resource?.jsonData?.status ?? resource?.status;
  const labels = meta?.labels ?? {};

  // Guard: only tns-csi driver pods
  if (labels['app.kubernetes.io/name'] !== 'tns-csi-driver') {
    return null;
  }

  const component = labels['app.kubernetes.io/component'] ?? 'unknown';
  const roleLabel = component === 'controller' ? 'Controller' : component === 'node' ? 'Node' : component;

  // Build a minimal pod shape that isPodReady / getPodRestarts can consume
  const podShape: TnsCsiPod = {
    metadata: {
      name: meta?.name ?? '',
      namespace: meta?.namespace,
      creationTimestamp: meta?.creationTimestamp,
      labels,
    },
    spec: { nodeName: spec?.nodeName },
    status: status as TnsCsiPod['status'],
  };

  const ready = isPodReady(podShape);
  const restarts = getPodRestarts(podShape);
  const phase = status?.phase ?? '—';
  const nodeName = spec?.nodeName ?? '—';
  const age = formatAge(meta?.creationTimestamp);

  // Container statuses
  const containerStatuses = status?.containerStatuses ?? [];
  const containerRows = containerStatuses.map(cs => {
    let stateText = 'Unknown';
    if (cs.state?.running) {
      stateText = `Running since ${cs.state.running.startedAt ? formatAge(cs.state.running.startedAt) : '?'} ago`;
    } else if (cs.state?.waiting) {
      stateText = `Waiting: ${cs.state.waiting.reason ?? 'unknown'}`;
    } else if (cs.state?.terminated) {
      stateText = `Terminated (exit ${cs.state.terminated.exitCode ?? '?'}): ${cs.state.terminated.reason ?? ''}`;
    }
    return {
      name: cs.name,
      value: `${cs.ready ? '✓ Ready' : '✗ Not Ready'} — ${stateText} — ${cs.restartCount} restart(s)`,
    };
  });

  return (
    <SectionBox title="TNS-CSI Driver Info">
      <NameValueTable
        rows={[
          { name: 'Role', value: roleLabel },
          { name: 'Phase', value: phase },
          { name: 'Ready', value: ready ? 'Yes' : 'No' },
          { name: 'Restarts', value: String(restarts) },
          { name: 'Node', value: nodeName },
          { name: 'Age', value: age },
          ...containerRows,
        ]}
      />
    </SectionBox>
  );
}

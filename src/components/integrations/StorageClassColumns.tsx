/**
 * StorageClassColumns — registerResourceTableColumnsProcessor for StorageClass and PV tables.
 *
 * Adds Protocol/Pool/Server columns to the native /storage-classes table and
 * Protocol/Dataset columns to the native /persistent-volumes table.
 *
 * Items in column processors are KubeObject class instances from Headlamp.
 * Raw Kubernetes JSON fields (parameters, spec, status) must be accessed
 * via .jsonData — only fields with explicit getters (provisioner, reclaimPolicy, etc.)
 * are accessible as direct properties.
 */

import React from 'react';
import { formatProtocol, TNS_CSI_PROVISIONER } from '../../api/k8s';

// ---------------------------------------------------------------------------
// Helper: extract a field from either a KubeObject instance or a plain object
// ---------------------------------------------------------------------------

function getField(item: unknown, ...path: string[]): unknown {
  if (!item || typeof item !== 'object') return undefined;
  const obj = item as Record<string, unknown>;

  // KubeObject instance — raw K8s JSON is under .jsonData
  const raw: Record<string, unknown> =
    'jsonData' in obj && obj['jsonData'] && typeof obj['jsonData'] === 'object'
      ? (obj['jsonData'] as Record<string, unknown>)
      : obj;

  let cur: unknown = raw;
  for (const key of path) {
    if (!cur || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

// ---------------------------------------------------------------------------
// StorageClass column definitions
// ---------------------------------------------------------------------------

/**
 * Returns extra columns for the native StorageClass table.
 * For non-tns-csi rows, cells show "—" (never undefined/null visible).
 */
export function buildStorageClassColumns() {
  return [
    {
      label: 'Protocol',
      getValue: (sc: unknown): string | null => {
        const provisioner =
          getField(sc, 'provisioner') ??
          (sc as Record<string, unknown>)?.['provisioner'];
        if (provisioner !== TNS_CSI_PROVISIONER) return null;
        const p = getField(sc, 'parameters', 'protocol');
        return typeof p === 'string' ? formatProtocol(p) : null;
      },
      render: (sc: unknown) => {
        const provisioner =
          getField(sc, 'provisioner') ??
          (sc as Record<string, unknown>)?.['provisioner'];
        if (provisioner !== TNS_CSI_PROVISIONER) return <span>—</span>;
        const protocol = getField(sc, 'parameters', 'protocol') as string | undefined;
        return <span>{formatProtocol(protocol)}</span>;
      },
    },
    {
      label: 'Pool',
      getValue: (sc: unknown): string | null => {
        const provisioner =
          getField(sc, 'provisioner') ??
          (sc as Record<string, unknown>)?.['provisioner'];
        if (provisioner !== TNS_CSI_PROVISIONER) return null;
        const p = getField(sc, 'parameters', 'pool');
        return typeof p === 'string' ? p : null;
      },
      render: (sc: unknown) => {
        const provisioner =
          getField(sc, 'provisioner') ??
          (sc as Record<string, unknown>)?.['provisioner'];
        if (provisioner !== TNS_CSI_PROVISIONER) return <span>—</span>;
        const pool = getField(sc, 'parameters', 'pool') as string | undefined;
        return <span>{pool ?? '—'}</span>;
      },
    },
    {
      label: 'Server',
      getValue: (sc: unknown): string | null => {
        const provisioner =
          getField(sc, 'provisioner') ??
          (sc as Record<string, unknown>)?.['provisioner'];
        if (provisioner !== TNS_CSI_PROVISIONER) return null;
        const p = getField(sc, 'parameters', 'server');
        return typeof p === 'string' ? p : null;
      },
      render: (sc: unknown) => {
        const provisioner =
          getField(sc, 'provisioner') ??
          (sc as Record<string, unknown>)?.['provisioner'];
        if (provisioner !== TNS_CSI_PROVISIONER) return <span>—</span>;
        const server = getField(sc, 'parameters', 'server') as string | undefined;
        return <span>{server ?? '—'}</span>;
      },
    },
  ];
}

// ---------------------------------------------------------------------------
// PersistentVolume column definitions
// ---------------------------------------------------------------------------

/**
 * Returns extra columns for the native PersistentVolume table.
 * For non-tns-csi PVs, cells show "—".
 */
export function buildPVColumns() {
  return [
    {
      label: 'Protocol',
      getValue: (pv: unknown): string | null => {
        const driver = getField(pv, 'spec', 'csi', 'driver') as string | undefined;
        if (driver !== TNS_CSI_PROVISIONER) return null;
        const p = getField(pv, 'spec', 'csi', 'volumeAttributes', 'protocol');
        return typeof p === 'string' ? formatProtocol(p) : null;
      },
      render: (pv: unknown) => {
        const driver = getField(pv, 'spec', 'csi', 'driver') as string | undefined;
        if (driver !== TNS_CSI_PROVISIONER) return <span>—</span>;
        const protocol = getField(pv, 'spec', 'csi', 'volumeAttributes', 'protocol') as string | undefined;
        return <span>{formatProtocol(protocol)}</span>;
      },
    },
    {
      label: 'Dataset',
      getValue: (pv: unknown): string | null => {
        const driver = getField(pv, 'spec', 'csi', 'driver') as string | undefined;
        if (driver !== TNS_CSI_PROVISIONER) return null;
        const d = getField(pv, 'spec', 'csi', 'volumeAttributes', 'datasetName');
        return typeof d === 'string' ? d : null;
      },
      render: (pv: unknown) => {
        const driver = getField(pv, 'spec', 'csi', 'driver') as string | undefined;
        if (driver !== TNS_CSI_PROVISIONER) return <span>—</span>;
        const dataset = getField(pv, 'spec', 'csi', 'volumeAttributes', 'datasetName') as string | undefined;
        return <span style={{ fontFamily: 'monospace', fontSize: '0.85em' }}>{dataset ?? '—'}</span>;
      },
    },
  ];
}

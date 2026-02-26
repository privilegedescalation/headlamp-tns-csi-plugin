/**
 * Shared test helpers: mock factories, fixtures, and context setup
 * for component tests.
 */

import { vi } from 'vitest';
import type { TnsCsiContextValue } from './api/TnsCsiDataContext';
import type {
  CSIDriver,
  TnsCsiPersistentVolume,
  TnsCsiPersistentVolumeClaim,
  TnsCsiPod,
  TnsCsiStorageClass,
  VolumeSnapshot,
  VolumeSnapshotClass,
} from './api/k8s';
import type { TnsCsiMetrics } from './api/metrics';

// ---------------------------------------------------------------------------
// Default context value (everything empty / zeroed)
// ---------------------------------------------------------------------------

export function defaultContext(overrides?: Partial<TnsCsiContextValue>): TnsCsiContextValue {
  return {
    csiDriver: null,
    driverInstalled: false,
    storageClasses: [],
    persistentVolumes: [],
    persistentVolumeClaims: [],
    controllerPods: [],
    nodePods: [],
    volumeSnapshots: [],
    volumeSnapshotClasses: [],
    snapshotCrdAvailable: false,
    poolStats: [],
    poolStatsError: null,
    loading: false,
    error: null,
    refresh: vi.fn(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Sample fixtures
// ---------------------------------------------------------------------------

export const sampleCSIDriver: CSIDriver = {
  metadata: { name: 'tns.csi.io' },
  spec: {
    attachRequired: false,
    podInfoOnMount: true,
    volumeLifecycleModes: ['Persistent'],
  },
};

export function makeSampleStorageClass(overrides?: Partial<TnsCsiStorageClass>): TnsCsiStorageClass {
  return {
    metadata: { name: 'tns-nfs', creationTimestamp: '2025-01-01T00:00:00Z' },
    provisioner: 'tns.csi.io',
    reclaimPolicy: 'Delete',
    volumeBindingMode: 'Immediate',
    allowVolumeExpansion: true,
    parameters: {
      protocol: 'nfs',
      pool: 'tank',
      server: '10.0.0.1',
    },
    ...overrides,
  };
}

export const sampleStorageClass = makeSampleStorageClass();

export function makeSamplePV(overrides?: Partial<TnsCsiPersistentVolume>): TnsCsiPersistentVolume {
  return {
    metadata: {
      name: 'pv-test-001',
      creationTimestamp: '2025-01-01T00:00:00Z',
    },
    spec: {
      csi: {
        driver: 'tns.csi.io',
        volumeHandle: 'tank/vol-001',
        volumeAttributes: {
          protocol: 'nfs',
          server: '10.0.0.1',
          pool: 'tank',
        },
      },
      capacity: { storage: '100Gi' },
      accessModes: ['ReadWriteOnce'],
      persistentVolumeReclaimPolicy: 'Delete',
      storageClassName: 'tns-nfs',
      claimRef: { name: 'my-pvc', namespace: 'default' },
    },
    status: { phase: 'Bound' },
    ...overrides,
  };
}

export const samplePV = makeSamplePV();

export function makeSamplePVC(overrides?: Partial<TnsCsiPersistentVolumeClaim>): TnsCsiPersistentVolumeClaim {
  return {
    metadata: {
      name: 'my-pvc',
      namespace: 'default',
      creationTimestamp: '2025-01-01T00:00:00Z',
    },
    spec: {
      storageClassName: 'tns-nfs',
      accessModes: ['ReadWriteOnce'],
      resources: { requests: { storage: '100Gi' } },
      volumeName: 'pv-test-001',
    },
    status: {
      phase: 'Bound',
      capacity: { storage: '100Gi' },
    },
    ...overrides,
  };
}

export const samplePVC = makeSamplePVC();

export function makeSamplePod(overrides?: Partial<TnsCsiPod> & { name?: string }): TnsCsiPod {
  const name = overrides?.name ?? overrides?.metadata?.name ?? 'tns-csi-controller-abc';
  return {
    metadata: {
      name,
      creationTimestamp: '2025-01-01T00:00:00Z',
      ...overrides?.metadata,
    },
    spec: {
      nodeName: 'node-1',
      ...overrides?.spec,
    },
    status: {
      phase: 'Running',
      conditions: [{ type: 'Ready', status: 'True' }],
      containerStatuses: [
        {
          name: 'tns-csi',
          ready: true,
          restartCount: 0,
          image: 'fenio/tns-csi:v0.5.0',
        },
      ],
      ...overrides?.status,
    },
  };
}

export const samplePod = makeSamplePod();

export function makeSampleSnapshot(overrides?: Partial<VolumeSnapshot>): VolumeSnapshot {
  return {
    metadata: {
      name: 'snap-001',
      namespace: 'default',
      creationTimestamp: '2025-01-01T00:00:00Z',
    },
    spec: {
      source: { persistentVolumeClaimName: 'my-pvc' },
      volumeSnapshotClassName: 'tns-snap-class',
    },
    status: {
      readyToUse: true,
      restoreSize: '100Gi',
    },
    ...overrides,
  };
}

export function makeSampleSnapshotClass(overrides?: Partial<VolumeSnapshotClass>): VolumeSnapshotClass {
  return {
    metadata: {
      name: 'tns-snap-class',
      creationTimestamp: '2025-01-01T00:00:00Z',
    },
    driver: 'tns.csi.io',
    deletionPolicy: 'Delete',
    ...overrides,
  };
}

export function makeSampleMetrics(overrides?: Partial<TnsCsiMetrics>): TnsCsiMetrics {
  return {
    websocketConnected: 1,
    websocketReconnectsTotal: 3,
    websocketMessagesTotal: [{ labels: {}, value: 100 }],
    websocketMessageDurationSeconds: [],
    volumeOperationsTotal: [
      { labels: { protocol: 'nfs' }, value: 10 },
      { labels: { protocol: 'iscsi' }, value: 5 },
    ],
    volumeOperationsDurationSeconds: [],
    volumeCapacityBytes: [
      { labels: { volume_id: 'tank/vol-001' }, value: 107374182400 },
    ],
    csiOperationsTotal: [
      { labels: { method: 'CreateVolume' }, value: 10 },
      { labels: { method: 'DeleteVolume' }, value: 2 },
    ],
    csiOperationsDurationSeconds: [],
    ...overrides,
  };
}


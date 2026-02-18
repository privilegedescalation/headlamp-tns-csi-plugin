/**
 * Kubernetes type definitions and helper functions for tns-csi resources.
 *
 * All K8s resource types are typed at the fields we actually use.
 * External data from the API is validated at the boundary before use.
 */

// ---------------------------------------------------------------------------
// Provisioner constant
// ---------------------------------------------------------------------------

export const TNS_CSI_PROVISIONER = 'tns.csi.io' as const;

// ---------------------------------------------------------------------------
// Label selectors
// ---------------------------------------------------------------------------

export const TNS_CSI_CONTROLLER_SELECTOR =
  'app.kubernetes.io/name=tns-csi-driver,app.kubernetes.io/component=controller';
export const TNS_CSI_NODE_SELECTOR =
  'app.kubernetes.io/name=tns-csi-driver,app.kubernetes.io/component=node';

// ---------------------------------------------------------------------------
// Generic Kubernetes object base shapes
// ---------------------------------------------------------------------------

export interface KubeObjectMeta {
  name: string;
  namespace?: string;
  creationTimestamp?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  uid?: string;
}

export interface KubeObject {
  apiVersion?: string;
  kind?: string;
  metadata: KubeObjectMeta;
}

// ---------------------------------------------------------------------------
// StorageClass
// ---------------------------------------------------------------------------

export interface TnsCsiStorageClassParameters {
  protocol?: 'nfs' | 'nvmeof' | 'iscsi' | string;
  pool?: string;
  server?: string;
  deleteStrategy?: 'delete' | 'retain' | string;
  encryption?: string; // "true" / "false" string from K8s params
}

export interface TnsCsiStorageClass extends KubeObject {
  provisioner: string;
  reclaimPolicy?: string;
  volumeBindingMode?: string;
  allowVolumeExpansion?: boolean;
  parameters?: TnsCsiStorageClassParameters;
}

export function isTnsCsiStorageClass(sc: unknown): sc is TnsCsiStorageClass {
  if (!sc || typeof sc !== 'object') return false;
  const obj = sc as Record<string, unknown>;
  return obj['provisioner'] === TNS_CSI_PROVISIONER;
}

export function filterTnsCsiStorageClasses(items: unknown[]): TnsCsiStorageClass[] {
  return items.filter(isTnsCsiStorageClass);
}

// ---------------------------------------------------------------------------
// PersistentVolume
// ---------------------------------------------------------------------------

export interface TnsCsiVolumeAttributes {
  protocol?: string;
  server?: string;
  pool?: string;
  [key: string]: string | undefined;
}

export interface CsiSpec {
  driver: string;
  volumeHandle?: string;
  volumeAttributes?: TnsCsiVolumeAttributes;
}

export interface ClaimRef {
  name: string;
  namespace: string;
}

export interface PersistentVolumeSpec {
  csi?: CsiSpec;
  capacity?: { storage?: string };
  accessModes?: string[];
  persistentVolumeReclaimPolicy?: string;
  storageClassName?: string;
  claimRef?: ClaimRef;
}

export interface TnsCsiPersistentVolume extends KubeObject {
  spec: PersistentVolumeSpec;
  status?: { phase?: string };
}

export function isTnsCsiPersistentVolume(pv: unknown): pv is TnsCsiPersistentVolume {
  if (!pv || typeof pv !== 'object') return false;
  const obj = pv as Record<string, unknown>;
  const spec = obj['spec'] as Record<string, unknown> | undefined;
  if (!spec) return false;
  const csi = spec['csi'] as Record<string, unknown> | undefined;
  return csi?.['driver'] === TNS_CSI_PROVISIONER;
}

export function filterTnsCsiPersistentVolumes(items: unknown[]): TnsCsiPersistentVolume[] {
  return items.filter(isTnsCsiPersistentVolume);
}

// ---------------------------------------------------------------------------
// PersistentVolumeClaim
// ---------------------------------------------------------------------------

export interface PVCSpec {
  storageClassName?: string;
  accessModes?: string[];
  resources?: { requests?: { storage?: string } };
  volumeName?: string;
}

export interface TnsCsiPersistentVolumeClaim extends KubeObject {
  spec: PVCSpec;
  status?: {
    phase?: string;
    capacity?: { storage?: string };
    accessModes?: string[];
  };
}

/**
 * Returns PVCs that are bound to a tns-csi PV (cross-reference by claimRef).
 */
export function filterTnsCsiPVCs(
  pvcs: TnsCsiPersistentVolumeClaim[],
  tnsPvs: TnsCsiPersistentVolume[]
): TnsCsiPersistentVolumeClaim[] {
  const boundSet = new Set<string>();
  for (const pv of tnsPvs) {
    const ref = pv.spec.claimRef;
    if (ref) {
      boundSet.add(`${ref.namespace}/${ref.name}`);
    }
  }
  return pvcs.filter(pvc => {
    const ns = pvc.metadata.namespace ?? '';
    return boundSet.has(`${ns}/${pvc.metadata.name}`);
  });
}

/** Find the tns-csi PV bound to a given PVC. */
export function findBoundPv(
  pvc: TnsCsiPersistentVolumeClaim,
  tnsPvs: TnsCsiPersistentVolume[]
): TnsCsiPersistentVolume | undefined {
  const ns = pvc.metadata.namespace ?? '';
  const name = pvc.metadata.name;
  return tnsPvs.find(
    pv => pv.spec.claimRef?.namespace === ns && pv.spec.claimRef?.name === name
  );
}

// ---------------------------------------------------------------------------
// CSIDriver
// ---------------------------------------------------------------------------

export interface CSIDriverSpec {
  attachRequired?: boolean;
  podInfoOnMount?: boolean;
  volumeLifecycleModes?: string[];
}

export interface CSIDriver extends KubeObject {
  spec?: CSIDriverSpec;
}

// ---------------------------------------------------------------------------
// Pod
// ---------------------------------------------------------------------------

export interface ContainerStatus {
  name: string;
  ready: boolean;
  restartCount: number;
  image?: string;
  state?: {
    running?: { startedAt?: string };
    waiting?: { reason?: string; message?: string };
    terminated?: { exitCode?: number; reason?: string };
  };
}

export interface PodStatus {
  phase?: string;
  conditions?: Array<{ type: string; status: string }>;
  containerStatuses?: ContainerStatus[];
}

export interface PodSpec {
  nodeName?: string;
}

export interface TnsCsiPod extends KubeObject {
  spec?: PodSpec;
  status?: PodStatus;
}

export function isPodReady(pod: TnsCsiPod): boolean {
  return (
    pod.status?.conditions?.some(c => c.type === 'Ready' && c.status === 'True') ?? false
  );
}

export function getPodRestarts(pod: TnsCsiPod): number {
  return (
    pod.status?.containerStatuses?.reduce((sum, c) => sum + c.restartCount, 0) ?? 0
  );
}

export function getPodImage(pod: TnsCsiPod): string {
  return pod.status?.containerStatuses?.[0]?.image ?? 'unknown';
}

// ---------------------------------------------------------------------------
// VolumeSnapshot (CRD: snapshot.storage.k8s.io/v1)
// ---------------------------------------------------------------------------

export interface VolumeSnapshotSpec {
  source?: { persistentVolumeClaimName?: string; volumeSnapshotContentName?: string };
  volumeSnapshotClassName?: string;
}

export interface VolumeSnapshotStatus {
  readyToUse?: boolean;
  restoreSize?: string;
  error?: { message?: string };
}

export interface VolumeSnapshot extends KubeObject {
  spec?: VolumeSnapshotSpec;
  status?: VolumeSnapshotStatus;
}

export interface VolumeSnapshotClass extends KubeObject {
  driver?: string;
  deletionPolicy?: string;
}

export function isTnsCsiVolumeSnapshotClass(vsc: unknown): vsc is VolumeSnapshotClass {
  if (!vsc || typeof vsc !== 'object') return false;
  const obj = vsc as Record<string, unknown>;
  return obj['driver'] === TNS_CSI_PROVISIONER;
}

export function filterTnsCsiVolumeSnapshots(
  snapshots: VolumeSnapshot[],
  tnsCsiSnapshotClassNames: Set<string>
): VolumeSnapshot[] {
  return snapshots.filter(
    s => s.spec?.volumeSnapshotClassName && tnsCsiSnapshotClassNames.has(s.spec.volumeSnapshotClassName)
  );
}

// ---------------------------------------------------------------------------
// K8s API list response envelope
// ---------------------------------------------------------------------------

export interface KubeList<T> {
  items: T[];
  metadata?: { resourceVersion?: string };
}

/**
 * Type guard for a KubeList response from ApiProxy.request.
 * Validates the minimal structure (items array) before consuming.
 */
export function isKubeList(value: unknown): value is KubeList<unknown> {
  if (!value || typeof value !== 'object') return false;
  return Array.isArray((value as Record<string, unknown>)['items']);
}

// ---------------------------------------------------------------------------
// Utility: human-readable age
// ---------------------------------------------------------------------------

export function formatAge(timestamp: string | undefined): string {
  if (!timestamp) return 'unknown';
  const diffMs = Date.now() - new Date(timestamp).getTime();
  const secs = Math.floor(diffMs / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

// ---------------------------------------------------------------------------
// Utility: access modes display
// ---------------------------------------------------------------------------

const ACCESS_MODE_ABBREV: Record<string, string> = {
  ReadWriteOnce: 'RWO',
  ReadWriteMany: 'RWX',
  ReadOnlyMany: 'ROX',
  ReadWriteOncePod: 'RWOP',
};

export function formatAccessModes(modes: string[] | undefined): string {
  if (!modes || modes.length === 0) return '—';
  return modes.map(m => ACCESS_MODE_ABBREV[m] ?? m).join(', ');
}

// ---------------------------------------------------------------------------
// Utility: protocol display
// ---------------------------------------------------------------------------

export function formatProtocol(protocol: string | undefined): string {
  if (!protocol) return '—';
  const map: Record<string, string> = {
    nfs: 'NFS',
    nvmeof: 'NVMe-oF',
    iscsi: 'iSCSI',
  };
  return map[protocol.toLowerCase()] ?? protocol;
}

// ---------------------------------------------------------------------------
// Phase → StatusLabel status mapping
// ---------------------------------------------------------------------------

export function phaseToStatus(phase: string | undefined): 'success' | 'warning' | 'error' {
  switch (phase) {
    case 'Bound':
    case 'Available':
    case 'Running':
    case 'Succeeded':
      return 'success';
    case 'Pending':
    case 'Released':
      return 'warning';
    default:
      return 'error';
  }
}

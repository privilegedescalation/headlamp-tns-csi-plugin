/**
 * TnsCsiDataContext — shared data provider for tns-csi Kubernetes resources.
 *
 * Wraps the K8s hook calls and provides filtered tns-csi resources to all
 * child pages through React context, avoiding prop drilling and duplicate
 * API calls.
 */

import { ApiProxy, K8s } from '@kinvolk/headlamp-plugin/lib';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  CSIDriver,
  filterTnsCsiPersistentVolumes,
  filterTnsCsiPVCs,
  filterTnsCsiStorageClasses,
  isKubeList,
  TnsCsiPersistentVolume,
  TnsCsiPersistentVolumeClaim,
  TnsCsiPod,
  TnsCsiStorageClass,
  TNS_CSI_PROVISIONER,
  VolumeSnapshot,
  VolumeSnapshotClass,
} from './k8s';

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------

export interface TnsCsiContextValue {
  // Driver presence
  csiDriver: CSIDriver | null;
  driverInstalled: boolean;

  // Core resources (filtered to tns-csi only)
  storageClasses: TnsCsiStorageClass[];
  persistentVolumes: TnsCsiPersistentVolume[];
  persistentVolumeClaims: TnsCsiPersistentVolumeClaim[];

  // Driver pods
  controllerPods: TnsCsiPod[];
  nodePods: TnsCsiPod[];

  // Snapshots (CRD — may be unavailable)
  volumeSnapshots: VolumeSnapshot[];
  volumeSnapshotClasses: VolumeSnapshotClass[];
  snapshotCrdAvailable: boolean;

  // Loading / error state
  loading: boolean;
  error: string | null;

  // Manual refresh trigger
  refresh: () => void;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const TnsCsiContext = createContext<TnsCsiContextValue | null>(null);

export function useTnsCsiContext(): TnsCsiContextValue {
  const ctx = useContext(TnsCsiContext);
  if (!ctx) {
    throw new Error('useTnsCsiContext must be used within a TnsCsiDataProvider');
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function TnsCsiDataProvider({ children }: { children: React.ReactNode }) {
  // K8s resource hooks — headlamp re-fetches on cluster changes automatically
  const [allStorageClasses, scError] = K8s.ResourceClasses.StorageClass.useList();
  const [allPvs, pvError] = K8s.ResourceClasses.PersistentVolume.useList();
  const [allPvcs, pvcError] = K8s.ResourceClasses.PersistentVolumeClaim.useList({ namespace: '' });

  // Pods fetched via label selector through ApiProxy (useList doesn't support selectors easily)
  const [controllerPods, setControllerPods] = useState<TnsCsiPod[]>([]);
  const [nodePods, setNodePods] = useState<TnsCsiPod[]>([]);
  const [csiDriver, setCsiDriver] = useState<CSIDriver | null>(null);
  const [volumeSnapshots, setVolumeSnapshots] = useState<VolumeSnapshot[]>([]);
  const [volumeSnapshotClasses, setVolumeSnapshotClasses] = useState<VolumeSnapshotClass[]>([]);
  const [snapshotCrdAvailable, setSnapshotCrdAvailable] = useState(false);
  const [asyncLoading, setAsyncLoading] = useState(true);
  const [asyncError, setAsyncError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchAsync() {
      setAsyncLoading(true);
      setAsyncError(null);
      try {
        // CSIDriver
        try {
          const driver = await ApiProxy.request(
            `/apis/storage.k8s.io/v1/csidrivers/${TNS_CSI_PROVISIONER}`
          ) as CSIDriver;
          if (!cancelled) setCsiDriver(driver);
        } catch {
          if (!cancelled) setCsiDriver(null);
        }

        // Controller pods
        try {
          const ctrlList = await ApiProxy.request(
            `/api/v1/namespaces/kube-system/pods?labelSelector=${encodeURIComponent(
              'app.kubernetes.io/name=tns-csi-driver,app.kubernetes.io/component=controller'
            )}`
          );
          if (!cancelled && isKubeList(ctrlList)) {
            setControllerPods(ctrlList.items as TnsCsiPod[]);
          }
        } catch {
          if (!cancelled) setControllerPods([]);
        }

        // Node pods
        try {
          const nodeList = await ApiProxy.request(
            `/api/v1/namespaces/kube-system/pods?labelSelector=${encodeURIComponent(
              'app.kubernetes.io/name=tns-csi-driver,app.kubernetes.io/component=node'
            )}`
          );
          if (!cancelled && isKubeList(nodeList)) {
            setNodePods(nodeList.items as TnsCsiPod[]);
          }
        } catch {
          if (!cancelled) setNodePods([]);
        }

        // VolumeSnapshots (CRD — graceful degradation)
        try {
          const vscList = await ApiProxy.request(
            '/apis/snapshot.storage.k8s.io/v1/volumesnapshotclasses'
          );
          if (!cancelled && isKubeList(vscList)) {
            setVolumeSnapshotClasses(vscList.items as VolumeSnapshotClass[]);
            setSnapshotCrdAvailable(true);

            const vsList = await ApiProxy.request(
              '/apis/snapshot.storage.k8s.io/v1/volumesnapshots'
            );
            if (!cancelled && isKubeList(vsList)) {
              setVolumeSnapshots(vsList.items as VolumeSnapshot[]);
            }
          }
        } catch {
          if (!cancelled) {
            setSnapshotCrdAvailable(false);
            setVolumeSnapshotClasses([]);
            setVolumeSnapshots([]);
          }
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setAsyncError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) setAsyncLoading(false);
      }
    }

    void fetchAsync();
    return () => { cancelled = true; };
  }, [refreshKey]);

  // ---------------------------------------------------------------------------
  // Derived / filtered values — memoized to avoid recomputation on every render
  // ---------------------------------------------------------------------------

  const storageClasses = useMemo(() => {
    if (!allStorageClasses) return [];
    return filterTnsCsiStorageClasses(allStorageClasses as unknown[]);
  }, [allStorageClasses]);

  const persistentVolumes = useMemo(() => {
    if (!allPvs) return [];
    return filterTnsCsiPersistentVolumes(allPvs as unknown[]);
  }, [allPvs]);

  const persistentVolumeClaims = useMemo(() => {
    if (!allPvcs || persistentVolumes.length === 0) return [];
    return filterTnsCsiPVCs(allPvcs as TnsCsiPersistentVolumeClaim[], persistentVolumes);
  }, [allPvcs, persistentVolumes]);

  // ---------------------------------------------------------------------------
  // Combined loading / error state
  // ---------------------------------------------------------------------------

  const loading = asyncLoading || !allStorageClasses || !allPvs || !allPvcs;

  const errors: string[] = [];
  if (scError) errors.push(String(scError));
  if (pvError) errors.push(String(pvError));
  if (pvcError) errors.push(String(pvcError));
  if (asyncError) errors.push(asyncError);
  const error = errors.length > 0 ? errors.join('; ') : null;

  const driverInstalled = csiDriver !== null;

  // ---------------------------------------------------------------------------
  // Memoized context value to prevent unnecessary re-renders
  // ---------------------------------------------------------------------------

  const value = useMemo<TnsCsiContextValue>(
    () => ({
      csiDriver,
      driverInstalled,
      storageClasses,
      persistentVolumes,
      persistentVolumeClaims,
      controllerPods,
      nodePods,
      volumeSnapshots,
      volumeSnapshotClasses,
      snapshotCrdAvailable,
      loading,
      error,
      refresh,
    }),
    [
      csiDriver,
      driverInstalled,
      storageClasses,
      persistentVolumes,
      persistentVolumeClaims,
      controllerPods,
      nodePods,
      volumeSnapshots,
      volumeSnapshotClasses,
      snapshotCrdAvailable,
      loading,
      error,
      refresh,
    ]
  );

  return <TnsCsiContext.Provider value={value}>{children}</TnsCsiContext.Provider>;
}

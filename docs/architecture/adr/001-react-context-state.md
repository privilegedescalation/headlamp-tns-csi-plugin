# ADR 001: React Context for Shared CSI Driver State

**Status**: Accepted

**Date**: 2026-03-05

**Deciders**: Development Team

---

## Context

The TNS CSI plugin needs to share data across multiple views: Overview, StorageClasses, Volumes, Snapshots, Metrics, and Benchmark pages, plus detail view sections for PVC, PV, and Pod. Data comes from three tracks:

1. **Headlamp `useList()` hooks** — StorageClass, PersistentVolume, PersistentVolumeClaim
2. **`ApiProxy.request()`** — CSIDriver resource, controller/node pods, VolumeSnapshotClasses, and VolumeSnapshots
3. **TrueNAS WebSocket API** — Pool capacity stats (optional, when API key is configured in settings)

The context exposes: `csiDriver`, `driverInstalled`, `storageClasses`, `persistentVolumes`, `persistentVolumeClaims`, `controllerPods`, `nodePods`, `volumeSnapshots`, `volumeSnapshotClasses`, `snapshotCrdAvailable`, `poolStats`, `poolStatsError`, `loading`, `error`, `refresh`.

---

## Decision

Use a single `TnsCsiDataProvider` React Context wrapping all routes. Three-track data fetching:

1. `useList()` for standard Kubernetes resources (StorageClass, PV, PVC)
2. `ApiProxy.request()` in `useEffect` for CSI-specific resources and snapshots
3. TrueNAS WebSocket client for pool capacity stats (only when API key is configured in settings)

---

## Consequences

- ✅ Single fetch point eliminates duplicate API calls
- ✅ All views share consistent data — no stale data across pages
- ✅ Three-track strategy handles different API requirements cleanly
- ✅ TrueNAS integration is opt-in — plugin works without it
- ⚠️ Large context with many fields increases cognitive overhead
- ⚠️ TrueNAS WebSocket adds complexity to the data layer
- ⚠️ All consumers re-render on any data change — mitigated by infrequent updates (polling interval)

---

## Alternatives Considered

1. **Separate contexts per data domain** — Rejected. Data is cross-referenced (PVCs filter by StorageClass provisioner), so splitting contexts would require cross-context coordination.

2. **Custom hooks without context** — Rejected. Would duplicate fetches across 6 pages, leading to redundant API calls and inconsistent data.

3. **Redux/Zustand** — Rejected. Not available in the Headlamp plugin environment.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-03-05 | Initial decision |

# ADR 003: Graceful Degradation for Optional CRDs

**Status**: Accepted

**Date**: 2026-03-05

**Deciders**: Development Team

---

## Context

The plugin uses VolumeSnapshot and VolumeSnapshotClass CRDs from `snapshot.storage.k8s.io/v1`. These CRDs are part of the Kubernetes Volume Snapshot feature, which is optional — not all clusters have the snapshot controller installed.

The plugin should work on clusters without snapshot support, showing storage classes, volumes, metrics, and benchmarks without the snapshots page. The CRD fetch is wrapped in `try/catch`; if it fails, the `snapshotCrdAvailable` flag is set to `false`.

---

## Decision

Implement graceful degradation for optional CRDs. The snapshot API calls are wrapped in `try/catch` within the data context. When the snapshot CRDs are not installed:

- `snapshotCrdAvailable` is set to `false`
- Snapshot-related data arrays are empty
- The Snapshots page shows an informational message rather than an error
- All other plugin features remain fully functional

---

## Consequences

- ✅ Plugin works on clusters without snapshot CRDs installed
- ✅ No error state for missing optional features — clean informational messaging
- ✅ Clear user feedback about what features are available
- ✅ Core features (volumes, storage classes, metrics, benchmarks) always work
- ⚠️ Two code paths (with/without snapshots) to maintain and test
- ⚠️ Snapshot data might silently fail for reasons other than missing CRDs (e.g., RBAC issues)

---

## Alternatives Considered

1. **Require snapshot CRDs (hard dependency)** — Rejected. Too restrictive; many clusters do not have the snapshot controller installed.

2. **Feature detection via API discovery before fetching** — Considered, but `try/catch` on the actual fetch is simpler and catches all failure modes including RBAC restrictions.

3. **Disable snapshots page entirely when CRDs missing** — Rejected. Showing an informational message explaining how to enable snapshots is better UX than silently hiding the page.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-03-05 | Initial decision |

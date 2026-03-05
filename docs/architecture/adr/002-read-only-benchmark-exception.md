# ADR 002: Read-Only Plugin with Benchmark Exception

**Status**: Accepted

**Date**: 2026-03-05

**Deciders**: Development Team

---

## Context

The plugin is primarily a read-only observability tool for TNS CSI storage. However, it includes a Benchmark feature that runs kbench (FIO-based storage benchmarks) against storage classes. Running benchmarks requires creating temporary Kubernetes resources: a PVC for the test volume and a Job running the kbench container.

These resources are tagged with `app.kubernetes.io/managed-by=headlamp-tns-csi-plugin` for lifecycle tracking. The benchmark workflow includes:

1. `buildPvcManifest()` — Create PVC spec for test volume
2. `createPvc()` — Create the PVC in the cluster
3. `buildJobManifest()` — Create Job spec for kbench container
4. `createJob()` — Create the Job in the cluster
5. Poll for Job completion
6. `fetchKbenchLogs()` — Retrieve benchmark output from pod logs
7. `parseKbenchLog()` — Parse FIO results from kbench output
8. `deleteJob()` — Clean up the benchmark Job
9. `deletePvc()` — Clean up the test PVC

---

## Decision

The plugin is read-only for all storage observability features. The sole exception is the Benchmark feature, which creates and deletes temporary PVC + Job resources. All created resources are labeled for identification and cleaned up after benchmark completion. The benchmark is triggered explicitly by user action (button on StorageClass detail page via `registerDetailsViewHeaderAction`).

---

## Consequences

- ✅ Minimal RBAC requirements for normal operation (read-only)
- ✅ Benchmark is opt-in and requires explicit user action
- ✅ Resources are auto-cleaned after benchmark completion
- ✅ `managed-by` label enables easy identification of plugin-created resources
- ⚠️ Requires additional RBAC permissions (create/delete Jobs and PVCs) for benchmark feature
- ⚠️ Failed cleanup leaves orphaned resources — mitigated by `listKbenchJobs()` which finds orphaned resources by label for manual cleanup

---

## Alternatives Considered

1. **No benchmark feature (fully read-only)** — Rejected. Storage performance testing is a key use case for storage administrators evaluating CSI drivers.

2. **External benchmark tool with results import** — Rejected. Poor user experience requiring context-switching between tools.

3. **Benchmark as a separate plugin** — Rejected. Benchmark results are tied to storage class context and benefit from shared data in the plugin.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-03-05 | Initial decision |

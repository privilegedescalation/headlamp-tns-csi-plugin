# Architecture Overview

## System Architecture

The TNS-CSI plugin is a single-page React application bundled as a Headlamp plugin. It runs entirely in the browser and communicates with Kubernetes exclusively through Headlamp's proxied API.

```
┌─────────────────────────────────────────────────────┐
│                    Browser                          │
│                                                     │
│  ┌──────────────────────────────────────────────┐   │
│  │            React Plugin Bundle               │   │
│  │                                              │   │
│  │  index.tsx  ──  registerRoute/Sidebar/etc.   │   │
│  │                                              │   │
│  │  TnsCsiDataProvider (React Context)          │   │
│  │  ├── K8s.ResourceClasses hooks (live watch)  │   │
│  │  └── ApiProxy.request (async fetch)          │   │
│  │                                              │   │
│  │  Pages:                                      │   │
│  │  OverviewPage  StorageClassesPage            │   │
│  │  VolumesPage   SnapshotsPage                 │   │
│  │  MetricsPage   BenchmarkPage                 │   │
│  │                                              │   │
│  │  PVCDetailSection (injected into PVC views)  │   │
│  └──────────────────────────────────────────────┘   │
└───────────────────────┬─────────────────────────────┘
                        │ HTTPS
                        ▼
┌─────────────────────────────────────────────────────┐
│              Headlamp Pod (kube-system)              │
│                                                     │
│  Headlamp UI server + API proxy                     │
│  (forwards requests using service account token     │
│   or user-supplied OIDC token)                      │
└───────────────────────┬─────────────────────────────┘
                        │ in-cluster
                        ▼
┌─────────────────────────────────────────────────────┐
│           Kubernetes API Server                     │
│                                                     │
│  ├── /apis/storage.k8s.io/v1/storageclasses         │
│  ├── /api/v1/persistentvolumes                      │
│  ├── /api/v1/persistentvolumeclaims                 │
│  ├── /api/v1/namespaces/kube-system/pods            │
│  ├── /apis/storage.k8s.io/v1/csidrivers            │
│  ├── /apis/snapshot.storage.k8s.io/v1/...          │
│  ├── /api/v1/namespaces/kube-system/pods/<pod>/proxy/metrics
│  └── (Benchmark) /apis/batch/v1/jobs               │
└─────────────────────────────────────────────────────┘
```

## Component Hierarchy

```
index.tsx
└── TnsCsiDataProvider
    ├── OverviewPage
    │   └── DriverStatusCard
    ├── StorageClassesPage
    │   └── StorageClassDetailPanel (slide-in)
    ├── VolumesPage
    │   └── VolumeDetailPanel (slide-in)
    ├── SnapshotsPage
    │   └── SnapshotDetailPanel (slide-in)
    ├── MetricsPage
    └── BenchmarkPage

registerDetailsViewSection
└── TnsCsiDataProvider
    └── PVCDetailSection (injected)
```

## Data Sources

| Data | Source | Mechanism |
| ---- | ------ | --------- |
| StorageClasses | `storage.k8s.io/v1` | `K8s.ResourceClasses.StorageClass.useList()` — live watch |
| PersistentVolumes | `core/v1` | `K8s.ResourceClasses.PersistentVolume.useList()` — live watch |
| PersistentVolumeClaims | `core/v1` | `K8s.ResourceClasses.PersistentVolumeClaim.useList()` — live watch |
| CSIDriver | `storage.k8s.io/v1` | `ApiProxy.request` — one-shot fetch |
| Controller pods | `core/v1` | `ApiProxy.request` with label selector — one-shot fetch |
| Node pods | `core/v1` | `ApiProxy.request` with label selector — one-shot fetch |
| VolumeSnapshots | `snapshot.storage.k8s.io/v1` | `ApiProxy.request` — graceful degradation if CRD absent |
| Prometheus metrics | Controller pod port 8080 | `ApiProxy.request` pod proxy |
| kbench FIO logs | Benchmark Job pod | `ApiProxy.request` pod log |

## Key Design Decisions

### KubeObject jsonData Extraction

Headlamp's `useList()` hooks return KubeObject class instances, not plain JSON objects. The class only exposes getter-defined fields (`provisioner`, `reclaimPolicy`, `volumeBindingMode`, `allowVolumeExpansion` for StorageClass). All other fields — including `parameters`, `spec`, and `status` — must be accessed via `.jsonData`.

`TnsCsiDataContext.tsx` extracts `jsonData` from every item before passing to filter/type helpers:

```typescript
const extractJsonData = (items: unknown[]): unknown[] =>
  items.map(item =>
    item && typeof item === 'object' && 'jsonData' in item
      ? (item as { jsonData: unknown }).jsonData
      : item
  );
```

This is the single most important architectural invariant to preserve when working with headlamp hook data.

### Context Provider Pattern

`TnsCsiDataProvider` wraps every route component. This ensures:
- All data fetching happens once per page navigation (not once per component)
- All pages share the same filtered StorageClasses, PVs, PVCs, and pod lists
- The `refresh()` callback triggers a `refreshKey` increment which re-runs async fetches

### Read-Only Constraint

The only write operation in the entire plugin is `BenchmarkPage.tsx`, which creates and deletes a Kubernetes Job and PVC. All other pages are strictly read-only. This is intentional and should be preserved.

### Detail Panel Pattern

Slide-in detail panels use URL hash state (`location.hash`) so:
- Panel state survives browser refresh
- Back button closes the panel
- Deep-linking to a specific resource is possible

Pattern: `history.push(\`\${location.pathname}#\${name}\`)` to open, `history.push(location.pathname)` to close.

### Graceful Degradation

The snapshot CRD (`snapshot.storage.k8s.io/v1`) may not be installed. The context provider catches the 404/405 error and sets `snapshotCrdAvailable: false`. The Snapshots page shows an informational message instead of an error. Prometheus metrics similarly fall back to placeholder cards.

## Module Responsibilities

| File | Responsibility |
| ---- | -------------- |
| `src/index.tsx` | All registrations — sidebar entries, routes, detail section, plugin settings |
| `src/api/k8s.ts` | Type definitions, type guards, filter helpers, format utilities |
| `src/api/metrics.ts` | Prometheus text format parser, `fetchControllerMetrics` |
| `src/api/kbench.ts` | kbench manifest builders, FIO log parser, `BenchmarkState` discriminated union |
| `src/api/TnsCsiDataContext.tsx` | Shared data fetching and filtering; the `extractJsonData` pattern |
| `src/components/*.tsx` | Page and panel UI components |

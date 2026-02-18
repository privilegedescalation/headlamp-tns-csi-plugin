# Headlamp TNS-CSI Plugin — Implementation Prompt

## Overview

You are an expert Kubernetes storage engineer, staff TypeScript engineer, and React engineer with deep experience in headlamp plugin development. Your task is to implement a headlamp plugin for the **tns-csi** CSI driver (https://github.com/fenio/tns-csi) that surfaces storage visibility into the Headlamp Kubernetes UI.

The plugin is **read-only** with a single interactive exception: triggering a **kbench** storage benchmark job and displaying its results.

---

## Role Context

You are a composite of three specialist personas working in concert.

### Kubernetes Specialist

You are a senior Kubernetes specialist with deep expertise in designing, deploying, and managing production Kubernetes clusters. For this plugin, your K8s mastery covers:

- **Storage orchestration**: StorageClasses, PersistentVolumes, dynamic provisioning, volume snapshots, CSI drivers, backup strategies, performance tuning
- **Custom resources**: CSIDriver, VolumeSnapshot/VolumeSnapshotClass CRDs (graceful degradation when absent), proper CRD API version detection
- **Observability**: Prometheus metrics collection, Kubernetes events, pod log retrieval via API proxy
- **Workload orchestration**: Job management (creation, status polling, log retrieval, cleanup), PVC lifecycle
- **Production patterns**: Design for failure, health checks, readiness probes, graceful degradation
- **Troubleshooting expertise**: Understand tns-csi label selectors, pod states, CSI driver registration, metrics endpoint configuration

Apply this mindset: before surfacing any Kubernetes data, verify the resource/CRD exists and handle absence gracefully with actionable user messaging.

### TypeScript Professional

You are a senior TypeScript developer with mastery of TypeScript 5.0+ specializing in advanced type safety and correctness. For this plugin:

- **Strict mode**: All compiler flags enabled, zero `any` usage (use `unknown` + type guards where truly opaque)
- **Type-first development**: Define all interfaces before implementing — `KbenchResult`, `TnsCsiStorageClass`, `PrometheusMetrics`, etc.
- **Branded types**: Use branded types for identifiers where appropriate (e.g., `type JobName = string & { __brand: 'JobName' }`)
- **Discriminated unions**: Model states as discriminated unions — e.g., `BenchmarkState = { status: 'idle' } | { status: 'running'; jobName: string } | { status: 'complete'; result: KbenchResult } | { status: 'failed'; error: string }`
- **Type guards**: Write explicit type guard functions for API responses (K8s objects, Prometheus text parsing output)
- **No runtime surprises**: Validate all external data (K8s API responses, pod log text) at the boundary before passing into typed domain objects
- **Type-only imports**: Use `import type` for type-only imports to minimize bundle impact

TypeScript quality bar: 100% type coverage on all public APIs, zero `@ts-ignore` or `@ts-expect-error` without comment justification.

### React Specialist

You are a senior React specialist with expertise in React 18+ and the modern React ecosystem. For this plugin:

- **Functional components only**: No class components, no legacy lifecycle methods
- **Hooks mastery**: `useState`, `useEffect`, `useMemo`, `useCallback`, `useRef`, `useContext` — used correctly with proper dependency arrays (no stale closures)
- **Context optimization**: Avoid unnecessary re-renders by splitting context when needed; memoize context values
- **Performance**: `useMemo` for expensive computations (filtering PV lists, parsing metrics), `useCallback` for stable event handlers passed to children
- **Component composition**: Small, focused components; compound component pattern for complex UI like the benchmark result cards
- **Accessibility**: Proper ARIA labels on all interactive elements (benchmark runner buttons, drawer close buttons, dropdown selects); keyboard navigation (Escape to close panels, as established in polaris plugin)
- **Error boundaries**: Loading/error/empty guards at every data boundary — match the exact pattern from `headlamp-polaris-plugin`
- **URL state**: Use `useHistory`/`useLocation` from `react-router-dom` for detail panel state (hash-based), matching polaris pattern

React quality bar: No prop drilling beyond 2 levels (use context), no inline function definitions in JSX that cause unnecessary re-renders on hot paths.

---

## Target Project: tns-csi

**tns-csi** (https://github.com/fenio/tns-csi) is a Kubernetes CSI driver for **TrueNAS Scale 25.10+** that provisions NFS, NVMe-oF, and iSCSI persistent volumes. It is in active early development (not production-ready).

### Key Architecture Details

- **Driver name / provisioner**: `tns.csi.io`
- **Namespace**: `kube-system` (default Helm install)
- **Label selectors**:
  - Controller pod: `app.kubernetes.io/name=tns-csi-driver,app.kubernetes.io/component=controller`
  - Node pod: `app.kubernetes.io/name=tns-csi-driver,app.kubernetes.io/component=node`
- **Protocols supported**: NFS (RWX/RWO/RWOP), NVMe-oF (RWO/RWOP), iSCSI (RWO/RWOP)
- **StorageClass `provisioner`**: `tns.csi.io`
- **Prometheus metrics endpoint**: `http://<controller-pod>:8080/metrics`

### ZFS Volume Metadata (on TrueNAS)

Volumes are tagged with ZFS user properties (`tns-csi:*`). While these aren't directly queryable from Kubernetes, the plugin should surface equivalent Kubernetes-native data:
- `tns-csi:protocol` → visible in PV `.spec.csi.volumeAttributes.protocol`
- `tns-csi:managed_by` = `"tns-csi"` (ownership marker)
- `tns-csi:schema_version` = `"1"`

### Kubernetes Resources to Surface

The plugin should query and display the following:

**StorageClasses** (filtered where `provisioner == "tns.csi.io"`):
- Name, protocol (from `parameters.protocol`), pool, server
- `allowVolumeExpansion`, `reclaimPolicy`, `volumeBindingMode`

**PersistentVolumes** (filtered where `spec.csi.driver == "tns.csi.io"`):
- Name, capacity, status, reclaim policy, access modes
- CSI attributes: `protocol`, `server`
- Bound PVC reference

**PersistentVolumeClaims** (cross-referenced with tns-csi PVs):
- Name, namespace, status, requested/allocated storage
- Access modes, StorageClass name
- Bound PV

**VolumeSnapshots** (`snapshot.storage.k8s.io/v1`):
- Filtered by `spec.volumeSnapshotClassName` matching tns-csi snapshot classes
- Name, namespace, source PVC, size, readyToUse, creation time

**CSI Driver** resource (`storage.k8s.io/v1` CSIDriver where `name == "tns.csi.io"`):
- Capabilities: volumeLifecycleModes, podInfoOnMount, attachRequired

**Controller and Node Pods** (via label selector):
- Status, restarts, age, image version
- Ready/not-ready state

### Prometheus Metrics (Available from Controller)

The controller exposes `/metrics` on port `8080`. Key metrics to display:
```
# Volume operations
tns_volume_operations_total{protocol, operation, status}
tns_volume_operations_duration_seconds{protocol, operation, status}
tns_volume_capacity_bytes{volume_id, protocol}

# WebSocket connection health
tns_websocket_connected          # gauge: 1=connected, 0=disconnected
tns_websocket_reconnects_total   # counter
tns_websocket_message_duration_seconds{method}

# CSI operations
tns_csi_operations_total{method, grpc_status_code}
tns_csi_operations_duration_seconds{method, grpc_status_code}
```

These should be fetched via the Kubernetes API proxy (not direct pod access), using `ApiProxy.request` from `@kinvolk/headlamp-plugin/lib`.

---

## kbench Integration

**kbench** (https://github.com/longhorn/kbench) is a Kubernetes-native FIO storage benchmark tool.

### How kbench Works

kbench runs as a Kubernetes **Job** backed by a **PersistentVolumeClaim**. When the Job completes (~6 minutes), results are captured from pod logs.

### Kubernetes YAML to Deploy

```yaml
# PVC
kind: PersistentVolumeClaim
apiVersion: v1
metadata:
  name: kbench-pvc-<uuid>
  namespace: default
  labels:
    app.kubernetes.io/managed-by: headlamp-tns-csi-plugin
spec:
  storageClassName: <user-selected-storage-class>
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 33Gi  # kbench needs ~33Gi minimum for 30G test
---
apiVersion: batch/v1
kind: Job
metadata:
  name: kbench-<uuid>
  namespace: default
  labels:
    app.kubernetes.io/managed-by: headlamp-tns-csi-plugin
    kbench: fio
spec:
  template:
    metadata:
      labels:
        kbench: fio
    spec:
      containers:
      - name: kbench
        image: yasker/kbench:latest
        env:
        - name: MODE
          value: "full"
        - name: FILE_NAME
          value: "/volume/test"
        - name: SIZE
          value: "30G"
        - name: CPU_IDLE_PROF
          value: "disabled"
        volumeMounts:
        - name: vol
          mountPath: /volume/
      restartPolicy: Never
      volumes:
      - name: vol
        persistentVolumeClaim:
          claimName: kbench-pvc-<uuid>
  backoffLimit: 0
```

### Result Format

kbench outputs a structured summary to stdout:
```
=====================
FIO Benchmark Summary
For: test_device
SIZE: 30G
QUICK MODE: DISABLED
=====================
IOPS (Read/Write)
        Random:          98368 / 89200
    Sequential:         108513 / 107636
  CPU Idleness:                     68%

Bandwidth in KiB/sec (Read/Write)
        Random:         542447 / 514487
    Sequential:         552052 / 521330
  CPU Idleness:                     99%

Latency in ns (Read/Write)
        Random:           97222 / 44548
    Sequential:           40483 / 44690
  CPU Idleness:                     72%
```

The plugin must:
1. Parse this text output from pod logs
2. Display it in a structured, readable table/card format
3. Distinguish IOPS, Bandwidth, and Latency sections
4. Show Read/Write separately
5. Indicate "higher is better" for IOPS/Bandwidth/CPU Idleness and "lower is better" for Latency

### kbench UX Flow

1. User navigates to the "Benchmark" section of the plugin
2. User selects a tns-csi StorageClass from a dropdown
3. User optionally configures: size (default 30G), namespace (default: `default`), mode (default: `full`)
4. User clicks "Run Benchmark" — shows confirmation dialog explaining duration (~6 min) and resource requirements
5. Plugin creates PVC + Job via `ApiProxy.request` (POST to Kubernetes API)
6. Plugin polls Job status every 10 seconds, showing progress (Pending → Running → Complete/Failed)
7. When Job completes, plugin fetches logs and parses the FIO summary
8. Results displayed in a structured card with sections for IOPS, Bandwidth, Latency
9. User can dismiss results or run another benchmark
10. Past benchmark results are listed (fetched from existing kbench Jobs with label `app.kubernetes.io/managed-by: headlamp-tns-csi-plugin`)
11. Cleanup: offer a button to delete the Job + PVC when done

---

## Headlamp Plugin Development Guide

### Project Bootstrap

```bash
npx @kinvolk/headlamp-plugin create headlamp-tns-csi-plugin
cd headlamp-tns-csi-plugin
npm install
npm start  # dev server with hot reload
```

### package.json

```json
{
  "name": "headlamp-tns-csi-plugin",
  "version": "0.1.0",
  "description": "Headlamp plugin for TNS-CSI driver visibility and benchmarking",
  "license": "Apache-2.0",
  "scripts": {
    "start": "headlamp-plugin start",
    "build": "headlamp-plugin build",
    "package": "headlamp-plugin package",
    "tsc": "tsc --noEmit",
    "lint": "eslint --ext .ts,.tsx src/",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "@kinvolk/headlamp-plugin": "^0.13.0"
  }
}
```

### Key Registration APIs

All imports from `@kinvolk/headlamp-plugin/lib`:

```typescript
import {
  registerRoute,
  registerSidebarEntry,
  registerDetailsViewSection,
  registerAppBarAction,
  registerPluginSettings,
} from '@kinvolk/headlamp-plugin/lib';
```

**Sidebar Entry:**
```typescript
registerSidebarEntry({
  parent: null,
  name: 'tns-csi',
  label: 'TNS CSI',
  url: '/tns-csi',
  icon: 'mdi:database',  // MDI icon name
});

registerSidebarEntry({
  parent: 'tns-csi',
  name: 'tns-csi-overview',
  label: 'Overview',
  url: '/tns-csi',
  icon: 'mdi:view-dashboard',
});
```

**Route:**
```typescript
registerRoute({
  path: '/tns-csi',
  sidebar: 'tns-csi-overview',
  name: 'tns-csi-overview',
  exact: true,
  component: () => <OverviewPage />,
});
```

**Details View Section** (to inject tns-csi info on PVC/PV detail pages):
```typescript
registerDetailsViewSection(({ resource }) => {
  if (resource?.kind !== 'PersistentVolumeClaim') return null;
  // Only for tns-csi PVCs (check storageClassName or bound PV driver)
  return <TnsCsiPVCDetail resource={resource} />;
});
```

### K8s Resource Hooks

```typescript
import { K8s } from '@kinvolk/headlamp-plugin/lib';

// List StorageClasses
const [storageClasses, error] = K8s.ResourceClasses.StorageClass.useList();

// List PVCs
const [pvcs, error] = K8s.ResourceClasses.PersistentVolumeClaim.useList({ namespace: '' });

// List PVs (cluster-scoped)
const [pvs, error] = K8s.ResourceClasses.PersistentVolume.useList();

// List Jobs
const [jobs, error] = K8s.ResourceClasses.Job.useList({ namespace: 'default' });

// Custom Resources (VolumeSnapshots)
// Use K8s.makeCustomResourceClass or ApiProxy.request for CRDs
```

### ApiProxy for Custom Requests

```typescript
import { ApiProxy } from '@kinvolk/headlamp-plugin/lib';

// Fetch pod logs
const logs = await ApiProxy.request(
  `/api/v1/namespaces/${namespace}/pods/${podName}/log?container=kbench&timestamps=false`
);

// Create a Job
await ApiProxy.request('/apis/batch/v1/namespaces/default/jobs', {
  method: 'POST',
  body: JSON.stringify(jobManifest),
  headers: { 'Content-Type': 'application/json' },
});

// Fetch metrics (via proxy to controller pod)
const metricsText = await ApiProxy.request(
  `/api/v1/namespaces/kube-system/pods/${controllerPodName}:8080/proxy/metrics`
);
```

### Common UI Components

All from `@kinvolk/headlamp-plugin/lib/CommonComponents`:

```typescript
import {
  SectionBox,
  SectionHeader,
  SimpleTable,
  NameValueTable,
  StatusLabel,
  Loader,
  PercentageBar,
  PercentageCircle,
  Link,
} from '@kinvolk/headlamp-plugin/lib/CommonComponents';
```

Usage patterns (from existing headlamp-polaris-plugin):
- `<SectionBox title="...">` — card-style container with title
- `<SectionHeader title="..." />` — page header
- `<SimpleTable columns={[{label, getter}]} data={rows} />` — sortable data table
- `<NameValueTable rows={[{name, value}]} />` — two-column key-value display
- `<StatusLabel status="success|warning|error">text</StatusLabel>` — colored badge
- `<Loader title="..." />` — loading spinner
- `<PercentageCircle data={[]} total={n} label="..." />` — donut chart
- `<PercentageBar data={[]} total={n} />` — horizontal bar breakdown

### Data Pattern: Context + Hook

Follow the pattern from headlamp-polaris-plugin:

```typescript
// src/api/TnsCsiDataContext.tsx
import React, { createContext, useContext, useState } from 'react';

interface TnsCsiContextType {
  storageClasses: StorageClass[] | null;
  pvs: PV[] | null;
  pvcs: PVC[] | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

const TnsCsiContext = createContext<TnsCsiContextType | null>(null);

export function TnsCsiDataProvider({ children }: { children: React.ReactNode }) {
  // ... fetch and provide data
}

export function useTnsCsiContext() {
  const ctx = useContext(TnsCsiContext);
  if (!ctx) throw new Error('useTnsCsiContext must be used within TnsCsiDataProvider');
  return ctx;
}
```

### Testing

Use **vitest** + **@testing-library/react** (as in headlamp-polaris-plugin):

```typescript
// vitest.config.ts (auto-configured by headlamp-plugin)
// src/components/Overview.test.tsx

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@kinvolk/headlamp-plugin/lib', () => ({
  ApiProxy: { request: vi.fn() },
  K8s: { ResourceClasses: { StorageClass: { useList: vi.fn(() => [[], null]) } } },
}));
```

---

## Plugin Architecture

### File Structure

```
headlamp-tns-csi-plugin/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.tsx                    # Plugin entry: register routes, sidebar, detail sections
│   ├── api/
│   │   ├── k8s.ts                   # Helper functions: filter tns-csi resources, parse CSI attrs
│   │   ├── metrics.ts               # Prometheus metrics parsing (text format)
│   │   ├── kbench.ts                # kbench Job/PVC creation, log parsing, result types
│   │   └── TnsCsiDataContext.tsx    # React context + provider for shared data
│   └── components/
│       ├── OverviewPage.tsx         # Main dashboard: driver health, stats summary
│       ├── StorageClassesPage.tsx   # List of tns-csi StorageClasses
│       ├── VolumesPage.tsx          # List of tns-csi PVs with PVC cross-reference
│       ├── SnapshotsPage.tsx        # VolumeSnapshot list (tns-csi)
│       ├── MetricsPage.tsx          # Prometheus metrics visualization
│       ├── BenchmarkPage.tsx        # kbench trigger + results
│       ├── DriverStatusCard.tsx     # Reusable: controller/node pod health
│       └── PVCDetailSection.tsx     # Injected into PVC detail view
```

### Sidebar Navigation

```
TNS CSI (top-level, icon: mdi:database-cog)
├── Overview          (/tns-csi)
├── Storage Classes   (/tns-csi/storage-classes)
├── Volumes           (/tns-csi/volumes)
├── Snapshots         (/tns-csi/snapshots)
├── Metrics           (/tns-csi/metrics)
└── Benchmark         (/tns-csi/benchmark)
```

---

## Page Specifications

### 1. Overview Page (`/tns-csi`)

**Sections:**

**Driver Status Card:**
- CSIDriver resource: name, attached, capabilities
- Controller pod(s): status, restarts, image version
- Node pod(s): status per node, restarts
- WebSocket connection health (from Prometheus `tns_websocket_connected`)

**Storage Summary:**
- Total StorageClasses managed by tns-csi
- Breakdown by protocol (NFS / NVMe-oF / iSCSI) — using `PercentageBar`
- Total PVs, total capacity (sum of `spec.capacity.storage`)
- PVC status breakdown: Bound / Pending / Lost

**Recent Activity:**
- Last N volume operations (inferred from recent PV creation timestamps)
- Any PVCs in non-Bound state (highlighted as warnings)

### 2. Storage Classes Page (`/tns-csi/storage-classes`)

**Filter**: `storageClass.provisioner === 'tns.csi.io'`

**Table columns:**
| Column | Source |
|--------|--------|
| Name | `.metadata.name` |
| Protocol | `.parameters.protocol` (nfs/nvmeof/iscsi) |
| Pool | `.parameters.pool` |
| Server | `.parameters.server` |
| Reclaim Policy | `.reclaimPolicy` |
| Volume Binding | `.volumeBindingMode` |
| Allow Expansion | `.allowVolumeExpansion` |
| Delete Strategy | `.parameters.deleteStrategy` (retain/delete) |
| Encryption | `.parameters.encryption` (bool) |
| PV Count | (cross-ref from PV list) |

Click row → detail panel showing all parameters

### 3. Volumes Page (`/tns-csi/volumes`)

**Filter**: `pv.spec.csi.driver === 'tns.csi.io'`

**Table columns:**
| Column | Source |
|--------|--------|
| PVC Name | `.spec.claimRef.name` |
| Namespace | `.spec.claimRef.namespace` |
| Protocol | `.spec.csi.volumeAttributes.protocol` |
| Server | `.spec.csi.volumeAttributes.server` |
| Capacity | `.spec.capacity.storage` |
| Access Modes | `.spec.accessModes` |
| Reclaim Policy | `.spec.persistentVolumeReclaimPolicy` |
| Status | `.status.phase` (color-coded) |
| StorageClass | `.spec.storageClassName` |
| Age | `.metadata.creationTimestamp` |

Click row → detail panel showing full CSI attributes and linked snapshot list

### 4. Snapshots Page (`/tns-csi/snapshots`)

**Resource**: `snapshot.storage.k8s.io/v1` VolumeSnapshot

**Filter**: VolumeSnapshotClass's `driver === 'tns.csi.io'`
(fetch VolumeSnapshotClasses first, then filter VolumeSnapshots by snapshotClassName)

Use `ApiProxy.request('/apis/snapshot.storage.k8s.io/v1/volumesnapshots')` since VolumeSnapshot is a CRD.

**Table columns:**
| Column | Source |
|--------|--------|
| Name | `.metadata.name` |
| Namespace | `.metadata.namespace` |
| Source PVC | `.spec.source.persistentVolumeClaimName` |
| Snapshot Class | `.spec.volumeSnapshotClassName` |
| Ready | `.status.readyToUse` (boolean badge) |
| Size | `.status.restoreSize` |
| Age | `.metadata.creationTimestamp` |

### 5. Metrics Page (`/tns-csi/metrics`)

Fetch Prometheus metrics text via ApiProxy from the controller pod metrics endpoint.

Display in cards:

**WebSocket Health:**
- Connection status (green/red indicator from `tns_websocket_connected`)
- Total reconnects (`tns_websocket_reconnects_total`)
- Messages sent/received (`tns_websocket_messages_total`)

**Volume Operations:**
- Operations by protocol (`tns_volume_operations_total`)
- Error rate per protocol/operation
- Total provisioned capacity (from `tns_volume_capacity_bytes`)

**CSI Operations:**
- Operation counts by method (`tns_csi_operations_total`)
- Error rates

Include a "Refresh" button and last-updated timestamp.

Note: If the controller pod cannot be found or metrics are unavailable, display a helpful message explaining how metrics are configured.

### 6. Benchmark Page (`/tns-csi/benchmark`)

#### Run New Benchmark Section

**Form:**
- **Storage Class** (required): dropdown of tns-csi StorageClasses
- **Namespace**: text input, default `default`
- **Test Size**: text input, default `30G` (with note: must be ~10% smaller than PVC)
- **Mode**: select — `full` (default), `quick`, or specific modes (random-read-iops, etc.)

**Run Button** → opens confirmation dialog:
> "This will create a ~33Gi PVC and run FIO benchmark (~6 minutes). The Job and PVC will remain until manually deleted. Continue?"

After confirmation:
1. Generate unique suffix (short UUID)
2. Create PVC via POST to `/apis/v1/namespaces/{ns}/persistentvolumeclaims`
3. Create Job via POST to `/apis/batch/v1/namespaces/{ns}/jobs`
4. Show status: "Creating PVC... → Waiting for PVC to bind... → Job running... → Parsing results..."

**Progress Polling** (every 10 seconds):
- Fetch Job status
- Show phase: `Pending` / `Active` / `Succeeded` / `Failed`
- Show pod status if available

#### Results Display

When Job succeeds, fetch logs and parse the FIO summary text:

```typescript
interface KbenchResult {
  iops: {
    randomRead: number;
    randomWrite: number;
    sequentialRead: number;
    sequentialWrite: number;
    cpuIdleness: number;
  };
  bandwidth: {
    randomRead: number;
    randomWrite: number;
    sequentialRead: number;
    sequentialWrite: number;
    cpuIdleness: number;
  };
  latency: {
    randomRead: number;
    randomWrite: number;
    sequentialRead: number;
    sequentialWrite: number;
    cpuIdleness: number;
  };
  metadata: {
    storageClass: string;
    size: string;
    startedAt: string;
    completedAt: string;
    jobName: string;
    namespace: string;
  };
}
```

Display results in three cards (IOPS, Bandwidth, Latency), each with a table:
| Metric | Read | Write | Note |
|--------|------|-------|------|
| Random | ... | ... | Higher is better |
| Sequential | ... | ... | Higher is better |
| CPU Idleness | ... | - | Higher is better |

For Latency: "Lower is better" note instead.

Format values:
- IOPS: thousands separator (e.g., `98,368`)
- Bandwidth: human-readable (e.g., `529 MB/s`)
- Latency: microseconds or milliseconds (e.g., `97 µs`)

#### Past Benchmarks List

List existing Jobs with label `app.kubernetes.io/managed-by: headlamp-tns-csi-plugin` and `kbench: fio`:
| Column | Value |
|--------|-------|
| Job Name | link to Job detail |
| Namespace | namespace |
| Storage Class | (from Job annotations or labels) |
| Status | Active/Complete/Failed |
| Started | creation timestamp |
| Actions | "View Results" / "Delete" |

**Delete** action removes both the Job and the PVC.

---

## PVC Detail Section Injection

Register a `registerDetailsViewSection` that injects a "TNS-CSI Storage Details" section on PVC detail pages when the bound PV uses `tns.csi.io` as the CSI driver.

Display:
- Protocol (NFS/NVMe-oF/iSCSI) — with icon
- Server (TrueNAS IP)
- ZFS pool
- StorageClass parameters relevant to this volume
- Link to Volumes page filtered to this PVC

---

## Implementation Requirements

### Filtering

**StorageClass filter**: `sc.spec.provisioner === 'tns.csi.io'`

**PV filter**: `pv.spec.csi?.driver === 'tns.csi.io'`

**PVC cross-reference**: For each tns-csi PV, find the PVC via `pv.spec.claimRef.{name,namespace}`

**VolumeSnapshot filter**:
1. Get all VolumeSnapshotClasses: `GET /apis/snapshot.storage.k8s.io/v1/volumesnapshotclasses`
2. Filter where `.driver === 'tns.csi.io'`
3. Get all VolumeSnapshots: `GET /apis/snapshot.storage.k8s.io/v1/volumesnapshots`
4. Filter where `.spec.volumeSnapshotClassName` is in the tns-csi snapshot class names

### Error Handling

- **Driver not installed**: If no CSIDriver `tns.csi.io` exists, show a clear banner: "TNS-CSI driver not detected on this cluster. Install via Helm..."
- **No snapshots CRD**: If VolumeSnapshot CRDs are not present, show: "Volume snapshot CRDs not installed. See tns-csi documentation."
- **Metrics unavailable**: If controller pod not found or metrics request fails, show: "Metrics unavailable. Ensure controller pod is running with metrics enabled (port 8080)."
- **kbench Job fails**: Show job logs, offer to re-run or cleanup

### Important Developer Notes from tns-csi

Based on the upstream documentation:

1. **Early development warning**: The driver is NOT production-ready. The plugin UI should prominently note this on the Overview page.

2. **NVMe-oF requires static IP**: Display a note on the NVMe-oF StorageClass detail that DHCP is not supported.

3. **Protocol-specific prerequisites**: Display prerequisite notes per protocol:
   - NFS: `nfs-common` / `nfs-utils` on nodes
   - NVMe-oF: `nvme-cli`, kernel modules `nvme-tcp`/`nvme-fabrics`
   - iSCSI: `open-iscsi` on nodes

4. **WebSocket API dependency**: The driver uses TrueNAS WebSocket API (`wss://`). Connection health is critical — the Metrics page `tns_websocket_connected` gauge is the primary health indicator.

5. **Volume adoption**: Volumes tagged with `tns-csi:adoptable=true` can be adopted cross-cluster. This is surfaced as metadata on the PV detail section.

6. **Provisioner ID**: Always use `tns.csi.io` (not `tns-csi` or variations).

7. **Controller logs command** (show in troubleshooting section):
   ```
   kubectl logs -n kube-system -l app.kubernetes.io/name=tns-csi-driver,app.kubernetes.io/component=controller
   ```

### kbench Important Notes

From the kbench documentation:
- **Test SIZE must be at least 10% smaller than PVC size** (default: 30G test in 33Gi PVC)
- For accurate results, **SIZE should be at least 25× the read/write bandwidth** to avoid cache effects
- A full benchmark takes **~6 minutes**; do not cancel mid-run
- Always test local storage baseline first for comparison
- **CPU Idleness for Latency benchmark should be ≥40%** — if lower, the result may be CPU-starved
- Lower read latency than local storage is a red flag (likely caching)
- Better write performance than local storage is almost impossible for distributed storage without cache

Display these notes as info tooltips or a "Benchmark Guide" info panel.

---

## Code Quality Requirements

### TypeScript Checklist

- [ ] `strict: true` in `tsconfig.json` with all compiler flags (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, etc.)
- [ ] Zero `any` — use `unknown` + type guards for external data (API responses, log parsing)
- [ ] All public APIs have 100% type coverage
- [ ] `import type` used for type-only imports
- [ ] All K8s resource shapes typed — use `KubeObject` base type from headlamp where available
- [ ] Discriminated unions for all state machines (benchmark flow, snapshot CRD availability)
- [ ] Type guards at every external data boundary (API response parsing, Prometheus text parsing, pod log parsing)
- [ ] No `@ts-ignore` without inline explanation comment

### React Checklist

- [ ] Functional components with hooks only — no class components
- [ ] All `useEffect` dependency arrays correct — no stale closures, no missing deps
- [ ] `useMemo` on expensive filtering (tns-csi PV/PVC cross-reference computation)
- [ ] `useCallback` for stable event handlers passed as props (open/close panel, refresh)
- [ ] Context values memoized to prevent unnecessary re-renders
- [ ] ARIA labels on all interactive elements (buttons, selects, drawer controls)
- [ ] Keyboard navigation: Escape closes detail panels
- [ ] URL hash state for detail panel (matching polaris plugin pattern)
- [ ] Use headlamp's built-in component library exclusively — **do NOT add MUI, Ant Design, or other UI libraries**

### Error Boundary Pattern

Wrap each page with the exact loading/error pattern from `headlamp-polaris-plugin`:

```typescript
if (loading) return <Loader title="Loading TNS-CSI data..." />;
if (error) return (
  <SectionBox title="Error">
    <NameValueTable rows={[{ name: 'Status', value: <StatusLabel status="error">{error}</StatusLabel> }]} />
  </SectionBox>
);
if (!data) return (
  <SectionBox title="No Data">
    <NameValueTable rows={[{ name: 'Status', value: 'TNS-CSI driver not detected on this cluster.' }]} />
  </SectionBox>
);
```

### Kubernetes Checklist

- [ ] Check CSIDriver `tns.csi.io` existence before rendering any pages — show install banner if absent
- [ ] VolumeSnapshot CRD availability checked before Snapshots page renders — show degraded state if absent
- [ ] Metrics endpoint access via API proxy (`/api/v1/namespaces/kube-system/pods/<pod>:8080/proxy/metrics`) — handle 404/timeout
- [ ] kbench Job/PVC labeled with `app.kubernetes.io/managed-by: headlamp-tns-csi-plugin` for tracking
- [ ] kbench PVC cleanup offered after benchmark completion — never auto-delete without user confirmation
- [ ] Use correct label selectors for tns-csi pods:
  - Controller: `app.kubernetes.io/name=tns-csi-driver,app.kubernetes.io/component=controller`
  - Node: `app.kubernetes.io/name=tns-csi-driver,app.kubernetes.io/component=node`

### Plugin Settings

Register plugin settings for configurable options:
- Default namespace for kbench jobs
- Metrics refresh interval (default: 60s)
- Automatically cleanup completed kbench jobs (bool, default: false)

```typescript
registerPluginSettings('headlamp-tns-csi-plugin', SettingsComponent, true);
```

---

## Reference: Existing Plugin Patterns

Study the `headlamp-polaris-plugin` at `../headlamp-polaris-plugin/` for patterns:

**index.tsx**: `registerSidebarEntry`, `registerRoute`, `registerDetailsViewSection`, `registerAppBarAction`, `registerPluginSettings`

**Data context pattern**: `PolarisDataProvider` → `usePolarisDataContext()` — replicate this for tns-csi data

**Component patterns**:
- `DashboardView.tsx`: `SectionHeader` + multiple `SectionBox` + `PercentageCircle` + `PercentageBar` + `SimpleTable`
- `NamespacesListView.tsx`: `SimpleTable` with click handlers, slide-in detail panel, keyboard navigation (Escape to close), URL hash state

**API pattern**: `ApiProxy.request(url)` for all Kubernetes API calls, including CRDs

**Testing pattern**: `vitest` + `vi.mock('@kinvolk/headlamp-plugin/lib', ...)` for mocking K8s APIs

---

## Deliverables

Implement the complete plugin with:

1. **`src/index.tsx`** — entry point with all registrations
2. **`src/api/k8s.ts`** — K8s helper functions and type definitions
3. **`src/api/metrics.ts`** — Prometheus text format parser
4. **`src/api/kbench.ts`** — kbench Job management and log parser
5. **`src/api/TnsCsiDataContext.tsx`** — React context provider
6. **`src/components/OverviewPage.tsx`**
7. **`src/components/StorageClassesPage.tsx`**
8. **`src/components/VolumesPage.tsx`**
9. **`src/components/SnapshotsPage.tsx`**
10. **`src/components/MetricsPage.tsx`**
11. **`src/components/BenchmarkPage.tsx`**
12. **`src/components/DriverStatusCard.tsx`**
13. **`src/components/PVCDetailSection.tsx`**
14. **Unit tests** for all API modules and key components
15. **`package.json`** with correct headlamp-plugin dependency

The plugin must be buildable with `npm run build` and loadable by headlamp without errors.

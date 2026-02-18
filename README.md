# Headlamp TNS-CSI Plugin

[![Artifact Hub](https://img.shields.io/endpoint?url=https://artifacthub.io/badge/package/headlamp/headlamp-tns-csi-plugin/headlamp-tns-csi-plugin)](https://artifacthub.io/packages/headlamp/headlamp-tns-csi-plugin/headlamp-tns-csi-plugin)
[![CI](https://github.com/privilegedescalation/headlamp-tns-csi-plugin/actions/workflows/ci.yaml/badge.svg)](https://github.com/privilegedescalation/headlamp-tns-csi-plugin/actions/workflows/ci.yaml)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

A [Headlamp](https://headlamp.dev/) plugin that surfaces [tns-csi](https://github.com/fenio/tns-csi) CSI driver visibility and kbench storage benchmarking directly in the Headlamp UI.

**[Documentation](#documentation) | [Installation](#installing) | [Security](#rbac--security-setup) | [Development](#development)**

## What It Does

Adds a **TrueNAS (tns-csi)** top-level sidebar section to Headlamp with full CSI driver observability and interactive storage benchmarking:

### Main Views

- **Overview Dashboard** — driver health card, storage summary (StorageClass / PV / PVC counts), protocol distribution, PercentageBar for Bound vs non-Bound PVCs, non-Bound PVC alert table, and live Prometheus metric snapshot
- **Storage Classes** — table of tns-csi StorageClasses with Protocol, Pool, Server, Reclaim Policy, Expansion, and PV count columns; click a row for a slide-in detail panel including protocol-specific prerequisite notes
- **Volumes** — table of tns-csi PersistentVolumes with capacity, access modes, reclaim policy, status badge, and bound claim; slide-in detail panel with full CSI volume attributes
- **Snapshots** — table of VolumeSnapshots scoped to tns-csi VolumeSnapshotClasses; shows ready status, size, source PVC, and class; graceful degradation when snapshot CRD is absent
- **Metrics** — Prometheus WebSocket health indicator, per-volume I/O (read/write IOPS and bandwidth from the controller pod), and CSI operation latency cards
- **Benchmark** — interactive kbench runner: select a tns-csi StorageClass, configure capacity and access mode, then run/stop a kbench Job+PVC lifecycle; live FIO log streaming with IOPS, bandwidth, and latency result cards

### Integrated Features

- **PVC Detail Injection** — TNS-CSI section automatically injected into Headlamp's PVC detail views showing protocol, server, pool, volume handle, and link to the bound PV
- **Dark Mode Support** — full theme adaptation using MUI CSS variables across all panels and drawers
- **Graceful Degradation** — Snapshot CRD absence is detected silently; missing Prometheus data shows placeholder cards rather than errors
- **kbench Lifecycle Management** — automatically creates and cleans up the benchmark Job and PVC; `app.kubernetes.io/managed-by=headlamp-tns-csi-plugin` label guards all managed resources

### Data & Refresh

StorageClasses, PersistentVolumes, and PVCs are fetched via Headlamp's `K8s.ResourceClasses` hooks (live watch). Driver pods, the CSIDriver object, VolumeSnapshots, and Prometheus metrics are fetched via `ApiProxy.request`. Metrics are polled from the tns-csi controller pod at port `8080` using the Prometheus text format parser.

The plugin is **read-only** except for the Benchmark page, which creates and deletes a Job and PVC in the namespace you select.

## Prerequisites

| Requirement           | Minimum version |
| --------------------- | --------------- |
| Headlamp              | v0.20+          |
| tns-csi driver        | Any release     |
| Kubernetes            | v1.24+          |
| snapshot CRD (optional) | v1            |

The tns-csi driver must be deployed in `kube-system` with the standard `app.kubernetes.io/name=tns-csi-driver` labels. The controller pod must expose Prometheus metrics on port `8080`.

## Installing

### Option 1: Headlamp Plugin Manager (Recommended)

The plugin is published on [Artifact Hub](https://artifacthub.io/packages/headlamp/headlamp-tns-csi-plugin/headlamp-tns-csi-plugin). Configure Headlamp via Helm:

```yaml
config:
  pluginsDir: /headlamp/plugins

pluginsManager:
  sources:
    - name: headlamp-tns-csi-plugin
      url: https://github.com/privilegedescalation/headlamp-tns-csi-plugin/releases/download/v0.1.0/headlamp-tns-csi-plugin-0.1.0.tar.gz
```

Or install via the Headlamp UI:

1. Go to **Settings → Plugins**
2. Click **Catalog** tab
3. Search for "TNS CSI" or "TrueNAS"
4. Click **Install**

### Option 2: Manual Tarball Install

Download the `.tar.gz` from the [GitHub releases page](https://github.com/privilegedescalation/headlamp-tns-csi-plugin/releases), then extract into Headlamp's plugin directory:

```bash
wget https://github.com/privilegedescalation/headlamp-tns-csi-plugin/releases/download/v0.1.0/headlamp-tns-csi-plugin-0.1.0.tar.gz
tar xzf headlamp-tns-csi-plugin-0.1.0.tar.gz -C /headlamp/plugins/
```

### Option 3: Build from Source

```bash
git clone https://github.com/privilegedescalation/headlamp-tns-csi-plugin.git
cd headlamp-tns-csi-plugin
npm install
npm run build
npx @kinvolk/headlamp-plugin extract . /headlamp/plugins
```

## RBAC / Security Setup

The plugin reads from the Kubernetes API and the tns-csi controller pod's Prometheus endpoint. The Benchmark page additionally creates and deletes Jobs and PVCs.

### Minimal read-only permissions

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: headlamp-tns-csi-reader
rules:
  - apiGroups: [""]
    resources: ["persistentvolumes", "persistentvolumeclaims", "pods"]
    verbs: ["get", "list", "watch"]
  - apiGroups: ["storage.k8s.io"]
    resources: ["storageclasses", "csidrivers"]
    verbs: ["get", "list", "watch"]
  - apiGroups: ["snapshot.storage.k8s.io"]
    resources: ["volumesnapshots", "volumesnapshotclasses"]
    verbs: ["get", "list", "watch"]
  - apiGroups: [""]
    resources: ["pods/log"]
    verbs: ["get"]
```

### Additional permissions for Benchmark page

```yaml
  - apiGroups: ["batch"]
    resources: ["jobs"]
    verbs: ["get", "list", "watch", "create", "delete"]
  - apiGroups: [""]
    resources: ["persistentvolumeclaims"]
    verbs: ["create", "delete"]
```

### Metrics access

The plugin fetches Prometheus metrics from the tns-csi controller pod via the Kubernetes pod proxy sub-resource. Grant `get` on `pods/proxy` in `kube-system`:

```yaml
  - apiGroups: [""]
    resources: ["pods/proxy"]
    verbs: ["get"]
    # Optionally scope to the controller pod namespace
```

Apply the role and bind it to your Headlamp service account with a ClusterRoleBinding.

## Documentation

**[Complete Documentation](docs/README.md)** — Documentation hub with all guides

### Quick Links

- **[Architecture](docs/architecture/overview.md)** — System architecture, data flow, component hierarchy
- **[Deployment](docs/deployment/helm.md)** — Production deployment with Helm, FluxCD
- **[Troubleshooting](docs/troubleshooting/README.md)** — Common issues and diagnosis
- **[Contributing](CONTRIBUTING.md)** — Development workflow, branching strategy, PR process
- **[Security](SECURITY.md)** — Security model, RBAC, vulnerability reporting
- **[Changelog](CHANGELOG.md)** — Complete release history

## Troubleshooting

**For comprehensive troubleshooting, see [docs/troubleshooting/README.md](docs/troubleshooting/README.md).**

Quick reference:

| Symptom | Likely Cause | Quick Fix |
| ------- | ------------ | --------- |
| **Plugin not in sidebar** | Plugin not installed or needs browser refresh | Hard refresh (Cmd+Shift+R / Ctrl+Shift+F5) |
| **No StorageClasses listed** | Driver not installed or wrong provisioner | Verify `kubectl get sc` shows `tns.csi.io` provisioner |
| **Driver status "Not installed"** | CSIDriver object missing | Check `kubectl get csidriver tns.csi.io` |
| **Protocol/Pool/Server showing "—"** | StorageClass has no parameters | Inspect `kubectl get sc <name> -o yaml` |
| **Metrics page empty** | Controller pod unreachable or no metrics port | Check controller pod logs and port 8080 |
| **Snapshots tab empty** | Snapshot CRD not installed | Install `snapshot.storage.k8s.io` CRDs |
| **Benchmark fails to start** | Missing RBAC for Jobs/PVCs | Add batch/jobs create+delete permissions |

## Development

**For detailed development guide, see [CONTRIBUTING.md](CONTRIBUTING.md).**

### Quick Start

```bash
# Clone repository
git clone https://github.com/privilegedescalation/headlamp-tns-csi-plugin.git
cd headlamp-tns-csi-plugin

# Install dependencies
npm install

# Run with hot reload
npm start  # Opens Headlamp at http://localhost:4466

# Build for production
npm run build        # outputs dist/main.js
npm run package      # creates headlamp-tns-csi-plugin-<version>.tar.gz

# Run tests
npm test             # 67 unit tests
npm run test:watch   # watch mode

# Code quality
npm run lint         # eslint
npm run tsc          # type-check
```

## Project Structure

```
src/
  index.tsx                       -- Entry point. Registers sidebar entries, routes,
                                     detail section injection, and plugin settings.
  api/
    k8s.ts                        -- TypeScript types and filtering helpers for tns-csi
                                     resources (StorageClass, PV, PVC, Pod, Snapshot).
    metrics.ts                    -- Prometheus text format parser; fetchControllerMetrics
                                     via ApiProxy from controller pod port 8080.
    kbench.ts                     -- kbench Job+PVC manifest builders, FIO log parser,
                                     BenchmarkState discriminated union, format helpers.
    TnsCsiDataContext.tsx          -- React context provider; shared data fetch across
                                     all pages (StorageClasses, PVs, PVCs, pods, driver).
  components/
    OverviewPage.tsx               -- Dashboard: driver health, storage summary,
                                     protocol distribution, non-Bound PVC alerts.
    StorageClassesPage.tsx         -- StorageClass list + slide-in detail panel.
    VolumesPage.tsx                -- PV list + slide-in detail panel.
    SnapshotsPage.tsx              -- VolumeSnapshot list + slide-in detail panel.
    MetricsPage.tsx                -- Prometheus metrics display cards.
    BenchmarkPage.tsx              -- Interactive kbench runner (ONLY write operation).
    DriverStatusCard.tsx           -- Driver health/status card component.
    PVCDetailSection.tsx           -- TNS-CSI section injected into PVC detail views.
vitest.config.mts                  -- Vitest configuration (jsdom environment).
vitest.setup.ts                    -- localStorage shim for Node 22+.
```

## Key Technical Details

### Provisioner

All resources are filtered to provisioner `tns.csi.io`. StorageClasses with any other provisioner are invisible to the plugin.

### Driver Component Labels

| Component | Label Selector |
| --------- | -------------- |
| Controller | `app.kubernetes.io/name=tns-csi-driver,app.kubernetes.io/component=controller` |
| Node | `app.kubernetes.io/name=tns-csi-driver,app.kubernetes.io/component=node` |

### Metrics Endpoint

The plugin fetches Prometheus text format metrics from:

```
GET /api/v1/namespaces/kube-system/pods/<controller-pod>/proxy/metrics
```

Extracted metrics include `kubelet_volume_stats_*`, `csi_operations_seconds_*`, and any custom tns-csi metrics exposed on port `8080`.

### kbench Benchmarks

The Benchmark page creates resources labeled `app.kubernetes.io/managed-by=headlamp-tns-csi-plugin`. It uses the `yasker/kbench:latest` image and runs a configurable FIO test. Results are parsed from the Job's pod log into IOPS, bandwidth (MB/s), and latency (µs) cards.

## Releasing

Releases are automated via **GitHub Actions**. To cut a release:

```bash
# 1. Update CHANGELOG.md with new version
# 2. Trigger the release workflow from GitHub Actions UI:
#    Actions → Release → Run workflow → enter version X.Y.Z
```

This triggers the **GitHub Actions** release workflow (`.github/workflows/release.yaml`):

1. Build the plugin in a `node:20` container
2. Update `package.json` and `artifacthub-pkg.yml` with the new version
3. Package a `.tar.gz` tarball
4. Compute SHA256 checksum and update `artifacthub-pkg.yml`
5. Commit, tag, and create a GitHub release with the tarball attached

ArtifactHub syncs within 30 minutes. The new version will appear in the Headlamp plugin catalog automatically.

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for:

- Development workflow
- Branching strategy (feature branches required for code changes)
- Commit message conventions (Conventional Commits)
- PR process and review checklist
- Code style guidelines
- Testing requirements

## Links

- **[GitHub Repository](https://github.com/privilegedescalation/headlamp-tns-csi-plugin)** — Source code, issues, releases
- **[Artifact Hub](https://artifacthub.io/packages/headlamp/headlamp-tns-csi-plugin/headlamp-tns-csi-plugin)** — Plugin catalog listing
- **[Headlamp](https://headlamp.dev/)** — Kubernetes web UI
- **[tns-csi driver](https://github.com/fenio/tns-csi)** — TrueNAS CSI driver
- **[kbench](https://github.com/longhorn/kbench)** — Storage benchmark tool

## License

[Apache-2.0 License](LICENSE) — see LICENSE file for details.

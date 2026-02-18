# TNS-CSI Plugin Documentation

Welcome to the Headlamp TNS-CSI Plugin documentation.

## Quick Links

- **[Quick Start](getting-started/quick-start.md)** — Get up and running in 5 minutes
- **[Installation Guide](getting-started/installation.md)** — All installation methods
- **[Troubleshooting](troubleshooting/README.md)** — Common issues and fixes

## Documentation Index

### Getting Started

| Guide | Description |
| ----- | ----------- |
| [Quick Start](getting-started/quick-start.md) | Fastest path to a working installation |
| [Installation](getting-started/installation.md) | Plugin Manager, manual tarball, build from source |
| [Prerequisites](getting-started/prerequisites.md) | Headlamp version, tns-csi driver, RBAC |

### User Guide

| Guide | Description |
| ----- | ----------- |
| [Overview Dashboard](user-guide/overview.md) | Driver health, storage summary, protocol distribution |
| [Storage Classes](user-guide/storage-classes.md) | StorageClass list and detail panel |
| [Volumes](user-guide/volumes.md) | PersistentVolume list and detail panel |
| [Snapshots](user-guide/snapshots.md) | VolumeSnapshot list and CRD requirements |
| [Metrics](user-guide/metrics.md) | Prometheus metrics display |
| [Benchmark](user-guide/benchmark.md) | kbench interactive storage benchmarking |
| [PVC Detail Injection](user-guide/pvc-detail.md) | TNS-CSI section in PVC detail views |
| [RBAC Permissions](user-guide/rbac.md) | Required permissions per feature |

### Architecture

| Guide | Description |
| ----- | ----------- |
| [Overview](architecture/overview.md) | System architecture, data flow, component hierarchy |
| [Data Flow](architecture/data-flow.md) | How data moves from K8s API to the UI |
| [Design Decisions](architecture/design-decisions.md) | Key architectural choices and rationale |

### Deployment

| Guide | Description |
| ----- | ----------- |
| [Helm](deployment/helm.md) | Deploy with Helm (recommended) |
| [Production Checklist](deployment/production.md) | Security and reliability checklist |

### Troubleshooting

| Guide | Description |
| ----- | ----------- |
| [Common Issues](troubleshooting/README.md) | Quick diagnosis table |
| [RBAC Issues](troubleshooting/rbac.md) | 403 errors, missing permissions |
| [Driver Detection](troubleshooting/driver.md) | Driver not installed, wrong provisioner |
| [Metrics Issues](troubleshooting/metrics.md) | Empty metrics page, unreachable controller |
| [Benchmark Issues](troubleshooting/benchmark.md) | Benchmark fails to start or complete |

### Development

| Guide | Description |
| ----- | ----------- |
| [Development Setup](development/setup.md) | Clone, install, run dev server |
| [Testing](development/testing.md) | Unit tests, mocking headlamp APIs |
| [Release Process](development/release.md) | How releases are cut and published |

## External Links

- **[GitHub Repository](https://github.com/privilegedescalation/headlamp-tns-csi-plugin)**
- **[Artifact Hub](https://artifacthub.io/packages/headlamp/headlamp-tns-csi-plugin/headlamp-tns-csi-plugin)**
- **[tns-csi Driver](https://github.com/fenio/tns-csi)**
- **[kbench](https://github.com/longhorn/kbench)**
- **[Headlamp](https://headlamp.dev/)**

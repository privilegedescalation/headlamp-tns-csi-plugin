# Changelog

All notable changes to the Headlamp TNS-CSI Plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.1] - 2026-02-19

### Fixed

- **OverviewPage crash** — brace mismatch in `TnsCsiDataContext` placed TrueNAS pool stats fetch outside the outer try block, breaking the entire context provider
- **PV Pool column** — tns-csi driver writes `datasetName` (e.g. `pool0/pvc-abc`), not `pool`, into `volumeAttributes`; Pool is now correctly derived from the first path segment
- **App bar badge removed** — removed the colored tns-csi status bubble from the top nav bar

## [0.2.0] - 2026-02-18

### Added

- **Native Headlamp integration** — Protocol/Pool/Server columns injected into the native StorageClass table; Protocol/Volume Handle columns into the native PV table
- **PV Detail Injection** — TNS-CSI section injected into Headlamp PV detail views with full CSI volume attributes
- **Pod Detail Injection** — Driver role/status section injected into tns-csi Pod detail pages (controller vs node role, ready status, restart count)
- **StorageClass Benchmark button** — "Benchmark" shortcut button added to tns-csi StorageClass detail page headers
- **App Bar Badge** — driver health badge in top nav bar showing `tns-csi: N/Nc M/Mn` (controller/node pod ready counts), color-coded green/orange/red
- **Sidebar trim** — reduced from 6 to 4 entries (Overview, Snapshots, Metrics, Benchmark); Storage Classes and Volumes accessible via direct URL
- **TrueNAS API integration** — WebSocket JSON-RPC client (`pool.query`) for real pool capacity (size/allocated/free/health status)
- **Plugin settings page** — API key and server address configuration with connection test button
- **Three-tier pool capacity display** — real TrueNAS API data → error hint → metrics-based provisioned-capacity fallback
- **CI workflow** — lint + type-check + test on every push and PR
- **Release workflow** — manual workflow_dispatch for versioned releases with automatic version bump, checksum, tag, and GitHub release creation
- **Documentation** — README, CHANGELOG, CONTRIBUTING, SECURITY, and full `docs/` suite (architecture, deployment, user guide, troubleshooting)

## [0.1.0] - 2026-02-18

### Added

- **Overview Dashboard** — driver health card, storage summary (StorageClass / PV / PVC counts), protocol distribution with PercentageBar, non-Bound PVC alert table, and live Prometheus metric snapshot
- **Storage Classes page** — table with Protocol, Pool, Server, Reclaim Policy, Expansion, and PV count columns; slide-in detail panel with protocol-specific prerequisite notes (NFS, NVMe-oF, iSCSI)
- **Volumes page** — PersistentVolume table with capacity, access modes, reclaim policy, phase status badge, and bound claim; slide-in detail panel with full CSI volume attributes
- **Snapshots page** — VolumeSnapshot table scoped to tns-csi VolumeSnapshotClasses; graceful degradation when snapshot CRD is not installed
- **Metrics page** — Prometheus WebSocket health indicator, per-volume I/O (read/write IOPS and bandwidth), CSI operation latency cards from controller pod port 8080
- **Benchmark page** — interactive kbench runner with StorageClass selection, capacity/access-mode configuration, Job+PVC lifecycle management, live FIO log streaming, and IOPS/bandwidth/latency result cards
- **PVC Detail Injection** — TNS-CSI section automatically injected into Headlamp's PVC detail views showing protocol, server, pool, volume handle, and link to the bound PV
- **TnsCsiDataContext** — shared React context provider for all plugin pages; extracts `jsonData` from Headlamp KubeObject instances so StorageClass `parameters` (protocol, pool, server) are accessible
- **Prometheus text format parser** — zero-dependency parser for the Prometheus exposition format used by the tns-csi controller
- **kbench FIO log parser** — parses `yasker/kbench` FIO output into structured IOPS, bandwidth (MB/s), and latency (µs) results
- **ArtifactHub publishing** — `artifacthub-pkg.yml` and `artifacthub-repo.yml` registered at Artifact Hub; plugin available in Headlamp catalog

### Infrastructure

- GitHub repository setup with initial CI and release workflows
- 67 unit tests with Vitest + @testing-library/react
- TypeScript strict mode with zero `any` types
- ESLint + Prettier code quality tooling

[Unreleased]: https://github.com/privilegedescalation/headlamp-tns-csi-plugin/compare/v0.2.1...HEAD
[0.2.1]: https://github.com/privilegedescalation/headlamp-tns-csi-plugin/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/privilegedescalation/headlamp-tns-csi-plugin/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/privilegedescalation/headlamp-tns-csi-plugin/releases/tag/v0.1.0

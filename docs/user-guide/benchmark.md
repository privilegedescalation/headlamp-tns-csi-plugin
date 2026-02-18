# Benchmark Page

The Benchmark page provides an interactive storage benchmark runner using [kbench](https://github.com/longhorn/kbench) (the Longhorn storage benchmark tool based on FIO).

## What It Does

1. You select a tns-csi StorageClass, a namespace, a PVC capacity, and an access mode
2. The plugin creates a PVC and a Kubernetes Job that runs `yasker/kbench:latest`
3. FIO log output streams in real-time from the kbench pod
4. When complete, results are parsed and displayed as IOPS, bandwidth (MB/s), and latency (µs) cards

## Prerequisites

- RBAC permissions for Jobs and PVCs — see [RBAC Permissions](rbac.md)
- The target namespace must exist
- The selected StorageClass must support the chosen access mode

## Running a Benchmark

1. Navigate to **TrueNAS (tns-csi) → Benchmark**
2. Select a StorageClass from the dropdown (only tns-csi classes are listed)
3. Enter the target namespace (defaults to `default`)
4. Set PVC capacity (e.g., `10Gi`)
5. Choose access mode (`ReadWriteOnce`, `ReadWriteMany`, etc.)
6. Click **Run Benchmark**

The benchmark progress shows:
- Benchmark state (Starting, Running, Parsing Results, Complete, Failed)
- Live FIO log output as it streams from the pod
- Result cards once FIO completes

## Result Cards

When the benchmark completes, the plugin displays:

| Card | Metric |
| ---- | ------ |
| Read IOPS | Random 4K read I/O operations per second |
| Write IOPS | Random 4K write I/O operations per second |
| Read Bandwidth | Sequential read throughput (MB/s) |
| Write Bandwidth | Sequential write throughput (MB/s) |
| Read Latency | Average read latency (µs) |
| Write Latency | Average write latency (µs) |

## Stopping a Benchmark

Click **Stop** to cancel the running benchmark. The plugin will delete the Job and PVC.

If the page is closed or navigated away from during a benchmark, the Job and PVC will remain in the cluster with the label:

```
app.kubernetes.io/managed-by=headlamp-tns-csi-plugin
```

Clean them up manually:

```bash
kubectl delete jobs,pvc -n <namespace> \
  -l app.kubernetes.io/managed-by=headlamp-tns-csi-plugin
```

## Resource Cleanup

The plugin automatically deletes the benchmark Job and PVC when:
- The benchmark completes successfully
- You click Stop
- The page component unmounts

## Protocol Notes

Different protocols have different performance characteristics:

| Protocol | Typical Use Case | Access Modes |
| -------- | ---------------- | ------------ |
| NFS | Shared storage, RWX workloads | RWO, RWX, RWOP |
| NVMe-oF | High-performance block storage | RWO, RWOP |
| iSCSI | Block storage | RWO, RWOP |

For NVMe-oF benchmarks, ensure nodes have the `nvme-tcp` kernel module loaded and the controller has a static IP.

# RBAC Permissions

## Overview

The plugin requires different permissions depending on which features you use. Start with the read-only set and add the benchmark write permissions only if needed.

## Read-Only Permissions (All Pages Except Benchmark)

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: headlamp-tns-csi-reader
rules:
  # StorageClasses and CSIDriver
  - apiGroups: ["storage.k8s.io"]
    resources: ["storageclasses", "csidrivers"]
    verbs: ["get", "list", "watch"]

  # PersistentVolumes (cluster-scoped)
  - apiGroups: [""]
    resources: ["persistentvolumes"]
    verbs: ["get", "list", "watch"]

  # PersistentVolumeClaims (all namespaces)
  - apiGroups: [""]
    resources: ["persistentvolumeclaims"]
    verbs: ["get", "list", "watch"]

  # tns-csi driver pods and their logs/proxy (for metrics)
  - apiGroups: [""]
    resources: ["pods"]
    verbs: ["get", "list", "watch"]
  - apiGroups: [""]
    resources: ["pods/log", "pods/proxy"]
    verbs: ["get"]

  # VolumeSnapshots (optional — gracefully degraded if absent)
  - apiGroups: ["snapshot.storage.k8s.io"]
    resources: ["volumesnapshots", "volumesnapshotclasses"]
    verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: headlamp-tns-csi
subjects:
  - kind: ServiceAccount
    name: headlamp          # adjust to your Headlamp service account name
    namespace: kube-system  # adjust to your Headlamp namespace
roleRef:
  kind: ClusterRole
  name: headlamp-tns-csi-reader
  apiGroup: rbac.authorization.k8s.io
```

## Additional Permissions for Benchmark Page

The Benchmark page creates and deletes a Job and PVC. These rules can be added to the ClusterRole above, or bound as a separate namespaced Role scoped to a dedicated benchmark namespace.

```yaml
  # Benchmark: create/delete kbench Job
  - apiGroups: ["batch"]
    resources: ["jobs"]
    verbs: ["get", "list", "watch", "create", "delete"]

  # Benchmark: create/delete kbench PVC
  - apiGroups: [""]
    resources: ["persistentvolumeclaims"]
    verbs: ["get", "list", "watch", "create", "delete"]
```

## Scoping Benchmark Permissions to a Namespace

For tighter security, restrict benchmark write permissions to a dedicated namespace using a Role + RoleBinding instead of ClusterRole:

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: headlamp-tns-csi-benchmark
  namespace: storage-benchmarks   # dedicated benchmark namespace
rules:
  - apiGroups: ["batch"]
    resources: ["jobs"]
    verbs: ["get", "list", "watch", "create", "delete"]
  - apiGroups: [""]
    resources: ["persistentvolumeclaims"]
    verbs: ["get", "list", "watch", "create", "delete"]
  - apiGroups: [""]
    resources: ["pods", "pods/log"]
    verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: headlamp-tns-csi-benchmark
  namespace: storage-benchmarks
subjects:
  - kind: ServiceAccount
    name: headlamp
    namespace: kube-system
roleRef:
  kind: Role
  name: headlamp-tns-csi-benchmark
  apiGroup: rbac.authorization.k8s.io
```

With this configuration, benchmark jobs can only be created in the `storage-benchmarks` namespace.

## Permission Summary by Feature

| Feature | Permissions Required |
| ------- | -------------------- |
| Overview | `storageclasses list`, `persistentvolumes list`, `persistentvolumeclaims list`, `pods list` (kube-system), `csidrivers get` |
| Storage Classes | `storageclasses list` |
| Volumes | `persistentvolumes list` |
| Snapshots | `volumesnapshots list`, `volumesnapshotclasses list` |
| Metrics | `pods/proxy get` (kube-system controller pod) |
| Benchmark | `jobs create/delete`, `persistentvolumeclaims create/delete` |
| PVC Detail Injection | `persistentvolumeclaims get`, `persistentvolumes get` |

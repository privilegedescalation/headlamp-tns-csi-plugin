# Benchmark Issues

## Benchmark Fails to Start

### Check RBAC

The Benchmark page requires permissions to create and delete Jobs and PVCs:

```bash
kubectl auth can-i create jobs -n <benchmark-namespace> \
  --as=system:serviceaccount:kube-system:headlamp

kubectl auth can-i create persistentvolumeclaims -n <benchmark-namespace> \
  --as=system:serviceaccount:kube-system:headlamp
```

Apply the additional permissions if missing — see [RBAC Issues](rbac.md) or [SECURITY.md](../../SECURITY.md).

### Check the Target Namespace Exists

The namespace you select in the Benchmark form must exist. Create it if needed:

```bash
kubectl create namespace <benchmark-namespace>
```

## Benchmark Stuck in "Running"

### Check the kbench Pod

```bash
kubectl get pods -n <benchmark-namespace> \
  -l app.kubernetes.io/managed-by=headlamp-tns-csi-plugin
```

Common states:

| Pod State | Cause | Action |
| --------- | ----- | ------ |
| `Pending` | PVC not provisioned or scheduler issue | Check PVC status and StorageClass |
| `Init:Error` | kbench image pull failure | Check image pull policy and network |
| `Running` | Benchmark in progress | Wait for completion |
| `Completed` | Finished — results should appear | Check FIO log section |
| `Error` / `OOMKilled` | kbench ran out of memory | Reduce test size or capacity |

### Check the PVC

```bash
kubectl get pvc -n <benchmark-namespace> \
  -l app.kubernetes.io/managed-by=headlamp-tns-csi-plugin
```

If the PVC is stuck in `Pending`, the StorageClass provisioner may not be able to create the volume:

```bash
kubectl describe pvc -n <benchmark-namespace> <pvc-name>
```

Look for events at the bottom of the describe output.

### View kbench Logs Directly

```bash
kubectl logs -n <benchmark-namespace> \
  -l app.kubernetes.io/managed-by=headlamp-tns-csi-plugin \
  --tail=100
```

## Leftover Resources After Failed Benchmark

If the benchmark was stopped or the plugin page was closed during a run, the Job and PVC may not have been cleaned up:

```bash
# List leftover resources
kubectl get jobs,pvc -n <benchmark-namespace> \
  -l app.kubernetes.io/managed-by=headlamp-tns-csi-plugin

# Clean up manually
kubectl delete jobs,pvc -n <benchmark-namespace> \
  -l app.kubernetes.io/managed-by=headlamp-tns-csi-plugin
```

The plugin adds the `app.kubernetes.io/managed-by=headlamp-tns-csi-plugin` label to all benchmark resources precisely to enable safe cleanup with this label selector.

## No Results Shown After Benchmark Completes

The plugin parses the FIO log output from the kbench pod. If results don't appear:

1. Check the pod completed successfully (status `Completed`, exit code 0)
2. View the raw log: `kubectl logs -n <ns> <kbench-pod>`
3. Look for the FIO result section — it should contain lines like `READ: bw=...` or `WRITE: bw=...`

If the kbench version produces output in a different format, the FIO log parser may not recognize it. Open a [GitHub Issue](https://github.com/privilegedescalation/headlamp-tns-csi-plugin/issues) with a sample of the log output.

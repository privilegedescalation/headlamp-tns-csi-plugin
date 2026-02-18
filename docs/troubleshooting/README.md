# Troubleshooting

## Quick Diagnosis

| Symptom | Likely Cause | Fix |
| ------- | ------------ | --- |
| **Plugin not in sidebar** | Not installed or browser cache | Hard refresh (Cmd+Shift+R / Ctrl+Shift+F5) |
| **"TrueNAS (tns-csi)" missing from sidebar** | Plugin not loaded | Check Headlamp plugin manager or restart Headlamp pod |
| **No StorageClasses listed** | Wrong provisioner or driver not installed | See [Driver Detection](#driver-detection) |
| **Driver status "Not installed"** | CSIDriver object missing | `kubectl get csidriver tns.csi.io` |
| **Protocol/Pool/Server showing "—"** | StorageClass missing parameters | `kubectl get sc <name> -o yaml` to inspect |
| **403 on any page** | Missing RBAC | See [RBAC Issues](rbac.md) |
| **Metrics page empty** | Controller pod unreachable or no metrics | See [Metrics Issues](metrics.md) |
| **Snapshots tab: "CRD not available"** | Snapshot CRD not installed | Install `snapshot.storage.k8s.io` CRDs |
| **Snapshots tab empty (no message)** | No snapshots or wrong snapshot class | Check VolumeSnapshotClass driver field |
| **Benchmark fails immediately** | Missing RBAC for Jobs/PVCs | See [Benchmark Issues](benchmark.md) |
| **Benchmark stuck in "Running"** | kbench pod not starting | `kubectl get pods -n <ns> -l app.kubernetes.io/managed-by=headlamp-tns-csi-plugin` |
| **Page loads but data is stale** | Watch connection dropped | Click the Refresh button or reload the page |

## Driver Detection

The plugin detects the tns-csi driver by querying:

```
GET /apis/storage.k8s.io/v1/csidrivers/tns.csi.io
```

If this returns 404, the driver shows as "Not installed".

**Check:**

```bash
kubectl get csidriver tns.csi.io
```

If missing, verify the tns-csi driver is deployed. The driver registers its CSIDriver object on startup.

## StorageClass Parameters Showing "—"

StorageClass Protocol, Pool, and Server come from the StorageClass `parameters` field.

**Check:**

```bash
kubectl get sc -o yaml | grep -A5 "provisioner: tns.csi.io"
```

Expected output includes:

```yaml
parameters:
  protocol: nfs
  pool: tank/k8s
  server: 192.168.1.1
```

If `parameters` is absent, the StorageClass was created without them — the CSI driver documentation specifies the required parameters for each protocol.

## Controller Pods Not Showing

The Overview page shows controller and node pod counts using label selectors:

- Controller: `app.kubernetes.io/name=tns-csi-driver,app.kubernetes.io/component=controller`
- Node: `app.kubernetes.io/name=tns-csi-driver,app.kubernetes.io/component=node`

**Check:**

```bash
kubectl get pods -n kube-system -l app.kubernetes.io/name=tns-csi-driver
```

If pods exist but aren't showing, verify the `app.kubernetes.io/component` label is set correctly.

## Infinite Loading Spinner

If a page shows a loading spinner indefinitely:

1. **Check browser console** for errors (F12 → Console)
2. **Check network tab** for failed API requests (look for 403, 404, 500)
3. **Check Headlamp pod logs**: `kubectl logs -n kube-system -l app.kubernetes.io/name=headlamp`
4. **Try refreshing** — the watch connection may have been interrupted

## Common API Errors

| HTTP Status | Meaning | Action |
| ----------- | ------- | ------ |
| `401 Unauthorized` | Token expired or invalid | Re-authenticate in Headlamp |
| `403 Forbidden` | Missing RBAC permission | See [RBAC Issues](rbac.md) |
| `404 Not Found` | Resource doesn't exist | Expected for optional resources (CSIDriver, snapshot CRD) |
| `503 Service Unavailable` | API server overloaded | Wait and retry |

## Getting More Information

**Browser console:**

```
F12 → Console tab
```

Look for errors related to `tns-csi`, `headlamp-plugin`, or Kubernetes API paths.

**Headlamp pod logs:**

```bash
kubectl logs -n kube-system -l app.kubernetes.io/name=headlamp --tail=100
```

**tns-csi controller logs:**

```bash
kubectl logs -n kube-system -l app.kubernetes.io/name=tns-csi-driver,app.kubernetes.io/component=controller --tail=100
```

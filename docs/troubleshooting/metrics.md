# Metrics Issues

## Metrics Page Shows No Data

### 1. Check the Controller Pod Is Running

```bash
kubectl get pods -n kube-system \
  -l app.kubernetes.io/name=tns-csi-driver,app.kubernetes.io/component=controller
```

The controller pod must be in `Running` state with all containers ready.

### 2. Verify Port 8080 Is Exposed

```bash
# Check the pod spec for port 8080
kubectl get pod -n kube-system <controller-pod-name> -o yaml | grep -A5 "ports:"
```

If port 8080 is not declared, the tns-csi driver version you're running may not expose Prometheus metrics. Check the driver documentation.

### 3. Test the Metrics Endpoint Directly

```bash
# Port-forward the controller pod
kubectl port-forward -n kube-system \
  $(kubectl get pods -n kube-system -l app.kubernetes.io/name=tns-csi-driver,app.kubernetes.io/component=controller -o name | head -1) \
  8080:8080

# In another terminal
curl http://localhost:8080/metrics | head -20
```

If this returns Prometheus text format output, the endpoint is working. If it returns 404 or connection refused, the controller isn't exposing metrics.

### 4. Check RBAC for Pod Proxy

The plugin accesses metrics via the Kubernetes pod proxy sub-resource:

```
GET /api/v1/namespaces/kube-system/pods/<pod>/proxy/metrics
```

This requires `get` on `pods/proxy` in `kube-system`:

```bash
kubectl auth can-i get pods/proxy \
  -n kube-system \
  --as=system:serviceaccount:kube-system:headlamp
```

### 5. Network Policies

If `kube-system` has NetworkPolicies, ensure the Kubernetes API server can reach the controller pod on port 8080. The pod proxy hop is performed by the API server, not by Headlamp directly.

## Metrics Show Stale Values

The Metrics page fetches data on-demand when the page loads. Click **Refresh** to re-fetch the latest metrics from the controller pod.

## Some Metric Cards Show "—"

Not all tns-csi driver versions expose all metrics. The plugin shows placeholder "—" values for metrics that are absent from the Prometheus output. This is expected behavior.

The plugin specifically looks for:
- `kubelet_volume_stats_*` metrics (volume I/O)
- `csi_operations_seconds_*` metrics (CSI operation latency)
- Any tns-csi specific metrics on port 8080

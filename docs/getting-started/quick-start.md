# Quick Start

Get the TNS-CSI plugin running in Headlamp in about 5 minutes.

## Prerequisites

- Headlamp v0.20+ running in your cluster
- tns-csi driver installed in `kube-system`
- `kubectl` access to your cluster

## Step 1: Install the Plugin

### Via Headlamp UI (Easiest)

1. Open Headlamp and navigate to **Settings → Plugins → Catalog**
2. Search for **"TNS CSI"** or **"TrueNAS"**
3. Click **Install**
4. Refresh the browser

### Via Helm

Add the plugin source to your Headlamp Helm values:

```yaml
config:
  pluginsDir: /headlamp/plugins

pluginsManager:
  sources:
    - name: tns-csi
      url: https://github.com/privilegedescalation/headlamp-tns-csi-plugin/releases/download/v0.2.4/tns-csi-0.2.4.tar.gz
```

Then upgrade your Headlamp release:

```bash
helm upgrade headlamp headlamp/headlamp -f values.yaml -n kube-system
```

## Step 2: Configure RBAC

The plugin needs read access to storage resources and the tns-csi controller pod's metrics endpoint.

Apply the minimal RBAC:

```bash
kubectl apply -f - <<'EOF'
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
    resources: ["pods/log", "pods/proxy"]
    verbs: ["get"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: headlamp-tns-csi
subjects:
  - kind: ServiceAccount
    name: headlamp
    namespace: kube-system
roleRef:
  kind: ClusterRole
  name: headlamp-tns-csi-reader
  apiGroup: rbac.authorization.k8s.io
EOF
```

Adjust `name: headlamp` and `namespace: kube-system` to match your Headlamp service account.

## Step 3: Verify

1. Open Headlamp — you should see **TrueNAS (tns-csi)** in the left sidebar
2. Click **Overview** — you should see the driver health card and storage summary
3. Click **Storage Classes** — your tns-csi StorageClasses should appear with Protocol, Pool, and Server filled in

## Troubleshooting

| Problem | Fix |
| ------- | --- |
| No sidebar entry | Hard-refresh browser (Cmd+Shift+R) |
| Driver shows "Not installed" | Run `kubectl get csidriver tns.csi.io` |
| StorageClasses empty | Check `kubectl get sc` for `tns.csi.io` provisioner |
| Protocol/Pool/Server show "—" | Check `kubectl get sc <name> -o yaml` for `.parameters` |
| Metrics page empty | Verify controller pod exposes port 8080 |

For more detail see [Troubleshooting](../troubleshooting/README.md).

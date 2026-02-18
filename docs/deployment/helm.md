# Deployment with Helm

## Basic Helm Installation

Add the Headlamp Helm repository and deploy with the plugin configured:

```bash
helm repo add headlamp https://headlamp-k8s.github.io/headlamp/
helm repo update

helm install headlamp headlamp/headlamp \
  --namespace kube-system \
  --create-namespace \
  --set config.pluginsDir=/headlamp/plugins \
  --set pluginsManager.sources[0].name=headlamp-tns-csi-plugin \
  --set pluginsManager.sources[0].url=https://github.com/privilegedescalation/headlamp-tns-csi-plugin/releases/download/v0.1.0/headlamp-tns-csi-plugin-0.1.0.tar.gz
```

## Complete values.yaml Example

```yaml
# headlamp-values.yaml

config:
  pluginsDir: /headlamp/plugins

pluginsManager:
  sources:
    - name: headlamp-tns-csi-plugin
      url: https://github.com/privilegedescalation/headlamp-tns-csi-plugin/releases/download/v0.1.0/headlamp-tns-csi-plugin-0.1.0.tar.gz

serviceAccount:
  name: headlamp

# Optional: OIDC authentication
# oidcConfig:
#   clientID: headlamp
#   clientSecret: <your-secret>
#   issuerURL: https://your-oidc-provider.example.com/
#   scopes: "openid profile email groups"
```

Apply:

```bash
helm install headlamp headlamp/headlamp \
  --namespace kube-system \
  -f headlamp-values.yaml
```

## FluxCD HelmRelease

```yaml
apiVersion: source.toolkit.fluxcd.io/v1
kind: HelmRepository
metadata:
  name: headlamp
  namespace: kube-system
spec:
  interval: 12h
  url: https://headlamp-k8s.github.io/headlamp/
---
apiVersion: helm.toolkit.fluxcd.io/v2
kind: HelmRelease
metadata:
  name: headlamp
  namespace: kube-system
spec:
  interval: 1h
  chart:
    spec:
      chart: headlamp
      version: ">=0.26.0"
      sourceRef:
        kind: HelmRepository
        name: headlamp
        namespace: kube-system
  values:
    config:
      pluginsDir: /headlamp/plugins
    pluginsManager:
      sources:
        - name: headlamp-tns-csi-plugin
          url: https://github.com/privilegedescalation/headlamp-tns-csi-plugin/releases/download/v0.1.0/headlamp-tns-csi-plugin-0.1.0.tar.gz
```

## RBAC Manifest (Apply Separately)

After deploying Headlamp, apply the plugin's RBAC:

```bash
kubectl apply -f - <<'EOF'
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: headlamp-tns-csi-reader
rules:
  - apiGroups: ["storage.k8s.io"]
    resources: ["storageclasses", "csidrivers"]
    verbs: ["get", "list", "watch"]
  - apiGroups: [""]
    resources: ["persistentvolumes", "persistentvolumeclaims", "pods"]
    verbs: ["get", "list", "watch"]
  - apiGroups: [""]
    resources: ["pods/log", "pods/proxy"]
    verbs: ["get"]
  - apiGroups: ["snapshot.storage.k8s.io"]
    resources: ["volumesnapshots", "volumesnapshotclasses"]
    verbs: ["get", "list", "watch"]
  # Uncomment for Benchmark page:
  # - apiGroups: ["batch"]
  #   resources: ["jobs"]
  #   verbs: ["get", "list", "watch", "create", "delete"]
  # - apiGroups: [""]
  #   resources: ["persistentvolumeclaims"]
  #   verbs: ["create", "delete"]
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

## Upgrading the Plugin

To upgrade to a new plugin version, update the `url` in your values and apply:

```bash
helm upgrade headlamp headlamp/headlamp \
  --namespace kube-system \
  -f headlamp-values.yaml
```

Or update the FluxCD HelmRelease and let Flux reconcile.

## Production Checklist

- [ ] Headlamp v0.20+ deployed
- [ ] Plugin installed and sidebar entry visible
- [ ] RBAC ClusterRole and ClusterRoleBinding applied
- [ ] tns-csi driver installed in `kube-system` with standard labels
- [ ] Controller pod exposes port 8080 for Prometheus metrics
- [ ] Headlamp accessible via HTTPS
- [ ] (Optional) Snapshot CRD installed for Snapshots tab
- [ ] (Optional) Benchmark namespace created and write RBAC applied

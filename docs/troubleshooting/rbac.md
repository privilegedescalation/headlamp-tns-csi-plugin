# RBAC Issues

## 403 Forbidden Errors

A 403 error means the identity making the API request (Headlamp's service account or the logged-in user's token) lacks the required permission.

### Diagnosing Which Permission Is Missing

Use `kubectl auth can-i` to check specific permissions:

```bash
# Check if the Headlamp service account can list StorageClasses
kubectl auth can-i list storageclasses \
  --as=system:serviceaccount:kube-system:headlamp

# Check pod proxy access (for metrics)
kubectl auth can-i get pods/proxy \
  -n kube-system \
  --as=system:serviceaccount:kube-system:headlamp

# Check snapshot access
kubectl auth can-i list volumesnapshots \
  --as=system:serviceaccount:kube-system:headlamp
```

### Applying the Required RBAC

See [RBAC Permissions](../user-guide/rbac.md) for the complete ClusterRole manifest.

Quick apply:

```bash
kubectl apply -f https://raw.githubusercontent.com/privilegedescalation/headlamp-tns-csi-plugin/main/docs/user-guide/rbac-manifest.yaml
```

Or manually apply the ClusterRole and ClusterRoleBinding from [SECURITY.md](../../SECURITY.md).

### OIDC Token Mode

If Headlamp is configured for OIDC authentication, each user's own token is used for API requests. The RBAC must be bound to the user's identity (email, group) rather than the service account:

```yaml
subjects:
  - kind: Group
    name: "engineering"
    apiGroup: rbac.authorization.k8s.io
```

Users not in the group will see 403 errors in the plugin.

### Benchmark 403

The Benchmark page requires additional write permissions:

```yaml
- apiGroups: ["batch"]
  resources: ["jobs"]
  verbs: ["get", "list", "watch", "create", "delete"]
- apiGroups: [""]
  resources: ["persistentvolumeclaims"]
  verbs: ["create", "delete"]
```

If only the Benchmark page shows 403, add these rules to your ClusterRole (or a separate Role scoped to the benchmark namespace).

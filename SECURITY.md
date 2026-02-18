# Security Policy

## Overview

The Headlamp TNS-CSI Plugin is a visibility and benchmarking tool for the tns-csi Kubernetes CSI driver. Security considerations center on Kubernetes RBAC, network policies, and the limited write operations performed by the Benchmark page.

## Security Model

### Primarily Read-Only

The plugin is **read-only** for all pages except Benchmark:

- **No secrets access**: The plugin does not read or store Kubernetes Secrets
- **No CRD installation**: No custom resource definitions or cluster-level modifications
- **No PII**: CSI resource metadata (names, namespaces, parameters) does not contain personally identifiable information
- **No external egress**: All API calls go through the Kubernetes API server proxy; no external network calls

### The Benchmark Exception

The Benchmark page creates and deletes a Kubernetes Job and PVC to run storage benchmarks. These resources are:

- Labeled `app.kubernetes.io/managed-by=headlamp-tns-csi-plugin` for identification
- Created only in the namespace the user explicitly selects
- Automatically deleted when the benchmark completes or is stopped
- Using the `yasker/kbench:latest` image (a public, well-known benchmark tool)

Grant benchmark write permissions only to users who should be able to initiate storage tests.

### Data Flow

```
User Browser
    ↓ (HTTPS)
Headlamp Pod
    ↓ (in-cluster service account or user token)
Kubernetes API Server
    ↓ (list/watch StorageClasses, PVs, PVCs, pods, snapshots)
    ↓ (pod proxy: controller pod port 8080 → Prometheus metrics)
    ↓ (pod proxy: kbench pod → FIO log for benchmark results)
Plugin Frontend (React)
```

All communication uses Kubernetes authentication and authorization mechanisms. The plugin never stores credentials or bypasses RBAC.

## RBAC Requirements

### Minimal Read-Only Permissions

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: headlamp-tns-csi-reader
rules:
  - apiGroups: [""]
    resources: ["persistentvolumes", "pods"]
    verbs: ["get", "list", "watch"]
  - apiGroups: [""]
    resources: ["persistentvolumeclaims"]
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
    # pods/proxy is used to fetch Prometheus metrics from the controller pod
```

### Additional Permissions for Benchmark Page

```yaml
  - apiGroups: ["batch"]
    resources: ["jobs"]
    verbs: ["get", "list", "watch", "create", "delete"]
  - apiGroups: [""]
    resources: ["persistentvolumeclaims"]
    verbs: ["create", "delete"]
```

### Binding Example

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: headlamp-tns-csi
subjects:
  - kind: ServiceAccount
    name: headlamp
    namespace: kube-system   # adjust to your Headlamp namespace
roleRef:
  kind: ClusterRole
  name: headlamp-tns-csi-reader
  apiGroup: rbac.authorization.k8s.io
```

### ⚠️ Security Best Practices

1. **Principle of Least Privilege**: Grant benchmark write permissions (`jobs create/delete`, `persistentvolumeclaims create/delete`) only to users who need them
2. **Namespace Scoping for Benchmarks**: If possible, restrict benchmark Job/PVC permissions to a dedicated benchmark namespace using a namespaced Role rather than ClusterRole
3. **Pod Proxy Scoping**: Scope `pods/proxy` access to `kube-system` only, or to pods matching the tns-csi controller label
4. **Audit Logging**: Enable Kubernetes audit logging to track all API requests made through the plugin
5. **Image Pinning**: Consider pinning `yasker/kbench:latest` to a specific digest in your environment for supply chain security

## Network Security

### Network Policies

If your cluster uses NetworkPolicies, ensure the Kubernetes API server can proxy requests to the tns-csi controller pod on port `8080`:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-api-server-to-tns-csi-controller
  namespace: kube-system
spec:
  podSelector:
    matchLabels:
      app.kubernetes.io/name: tns-csi-driver
      app.kubernetes.io/component: controller
  policyTypes:
    - Ingress
  ingress:
    - ports:
        - protocol: TCP
          port: 8080
```

The Kubernetes API server performs the pod proxy hop, so policies should permit the API server (not Headlamp directly) to reach the controller pod.

### TLS/HTTPS

- **External Access**: Always access Headlamp over HTTPS
- **Internal Communication**: Headlamp to API server uses the service account token over the cluster's internal network
- **Pod Proxy**: API server → tns-csi controller happens over HTTP within the cluster (port 8080)

## Authentication Methods

### Service Account (Default)

Headlamp runs with a dedicated service account (`headlamp` in `kube-system`). All users share the same RBAC permissions.

**Security Considerations:**
- All users have identical access to plugin functionality including Benchmark
- Suitable for trusted internal environments
- Simpler RBAC management

### OIDC Token Authentication

Headlamp can use per-user OIDC tokens. RBAC is enforced per-user, enabling fine-grained access control:

- Read-only users: bind only the reader ClusterRole
- Benchmark users: bind the additional write permissions
- Users without permissions see appropriate 403 errors

## Vulnerability Reporting

### Supported Versions

Security updates are applied to the latest release only.

| Version | Supported          |
| ------- | ------------------ |
| latest  | ✅                 |
| < latest | ❌                |

### Reporting a Vulnerability

Report security vulnerabilities via:

1. **GitHub Security Advisories**: [Report a vulnerability](https://github.com/privilegedescalation/headlamp-tns-csi-plugin/security/advisories/new)
2. **GitHub Issues**: Open an issue and mark it "security" if advisories are unavailable

**Please do not** open public GitHub issues for security vulnerabilities before a fix is available.

**Response Timeline:**
- **Acknowledgment**: Within 48 hours
- **Initial Assessment**: Within 1 week
- **Fix Timeline**: Critical: 1–2 weeks; High: 2–4 weeks; Medium/Low: next release cycle

## Dependency Security

The project uses:
- **npm audit**: Runs automatically during `npm install`
- **GitHub Dependabot**: Monitors dependencies and creates PRs for updates

Headlamp itself (`@kinvolk/headlamp-plugin`) is a peer dependency. Security updates to Headlamp should be applied by upgrading your Headlamp installation.

**Minimum supported Headlamp version**: v0.20.0

## Deployment Security Checklist

Before deploying to production:

- [ ] **RBAC configured**: ClusterRole and ClusterRoleBinding exist for Headlamp service account
- [ ] **Benchmark permissions scoped**: Write permissions granted only to appropriate users/groups
- [ ] **Network policies**: Allow API server → tns-csi controller traffic on port 8080
- [ ] **TLS enabled**: Headlamp accessible only via HTTPS
- [ ] **Audit logging enabled**: Kubernetes API audit logs capture requests
- [ ] **Plugin version**: Running latest release
- [ ] **Dependencies audited**: `npm audit` shows no critical vulnerabilities

## Compliance

### Data Residency

All data remains within your Kubernetes cluster. The plugin does not:
- Send data to external services
- Store data in browser localStorage (except any future settings)
- Use third-party analytics or tracking

### Audit Trail

All API requests are logged in Kubernetes API audit logs (if enabled). Pod proxy requests to the controller pod's metrics endpoint appear as:

```json
{
  "verb": "get",
  "requestURI": "/api/v1/namespaces/kube-system/pods/<controller-pod>/proxy/metrics",
  "user": {
    "username": "system:serviceaccount:kube-system:headlamp"
  }
}
```

### Privacy

The plugin processes only technical metadata (resource names, namespaces, CSI parameters, metrics values). No personal data is collected, stored, or transmitted.

## Contact

- **Security Issues**: [GitHub Security Advisories](https://github.com/privilegedescalation/headlamp-tns-csi-plugin/security/advisories)
- **General Questions**: [GitHub Discussions](https://github.com/privilegedescalation/headlamp-tns-csi-plugin/discussions)
- **Bug Reports**: [GitHub Issues](https://github.com/privilegedescalation/headlamp-tns-csi-plugin/issues)

## License

This plugin is provided under the Apache-2.0 License. See [LICENSE](LICENSE) for details.

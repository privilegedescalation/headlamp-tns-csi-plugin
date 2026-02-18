# Installation Guide

## Installation Methods

### Method 1: Headlamp Plugin Manager (Recommended)

The plugin is published on [Artifact Hub](https://artifacthub.io/packages/headlamp/headlamp-tns-csi-plugin/headlamp-tns-csi-plugin).

**Via Headlamp UI:**

1. Navigate to **Settings → Plugins → Catalog**
2. Search for "TNS CSI" or "TrueNAS"
3. Click **Install**
4. Refresh the page

**Via Helm values:**

```yaml
config:
  pluginsDir: /headlamp/plugins

pluginsManager:
  sources:
    - name: headlamp-tns-csi-plugin
      url: https://github.com/privilegedescalation/headlamp-tns-csi-plugin/releases/download/v0.1.0/headlamp-tns-csi-plugin-0.1.0.tar.gz
```

**Via FluxCD HelmRelease:**

```yaml
apiVersion: helm.toolkit.fluxcd.io/v2
kind: HelmRelease
metadata:
  name: headlamp
  namespace: kube-system
spec:
  chart:
    spec:
      chart: headlamp
      sourceRef:
        kind: HelmRepository
        name: headlamp
  values:
    config:
      pluginsDir: /headlamp/plugins
    pluginsManager:
      sources:
        - name: headlamp-tns-csi-plugin
          url: https://github.com/privilegedescalation/headlamp-tns-csi-plugin/releases/download/v0.1.0/headlamp-tns-csi-plugin-0.1.0.tar.gz
```

### Method 2: Manual Tarball Install

Download and extract the plugin directly:

```bash
# Download the release tarball
wget https://github.com/privilegedescalation/headlamp-tns-csi-plugin/releases/download/v0.1.0/headlamp-tns-csi-plugin-0.1.0.tar.gz

# Verify the checksum
echo "14a3e8c13d0b894a41aa1cfccbcb1f6af09dcbb8fd95c7040a540987ea2096a7  headlamp-tns-csi-plugin-0.1.0.tar.gz" | sha256sum --check

# Extract into your Headlamp plugins directory
tar xzf headlamp-tns-csi-plugin-0.1.0.tar.gz -C /headlamp/plugins/
```

The plugin directory should appear as `/headlamp/plugins/headlamp-tns-csi-plugin/`.

Restart Headlamp (or the pod) after extracting.

### Method 3: Sidecar Container

For Headlamp deployments where you prefer managing plugins as container init sidecars:

```yaml
initContainers:
  - name: install-tns-csi-plugin
    image: alpine:3
    command:
      - sh
      - -c
      - |
        wget -O /tmp/plugin.tar.gz \
          https://github.com/privilegedescalation/headlamp-tns-csi-plugin/releases/download/v0.1.0/headlamp-tns-csi-plugin-0.1.0.tar.gz
        tar xzf /tmp/plugin.tar.gz -C /headlamp/plugins/
    volumeMounts:
      - name: plugins
        mountPath: /headlamp/plugins
```

### Method 4: Build from Source

For development or to test unreleased changes:

```bash
git clone https://github.com/privilegedescalation/headlamp-tns-csi-plugin.git
cd headlamp-tns-csi-plugin
npm install
npm run build
npm run package
# Produces headlamp-tns-csi-plugin-0.1.0.tar.gz

# Extract to your Headlamp plugins directory
tar xzf headlamp-tns-csi-plugin-0.1.0.tar.gz -C /headlamp/plugins/
```

Or use `headlamp-plugin extract` for automatic placement:

```bash
npx @kinvolk/headlamp-plugin extract . /headlamp/plugins
```

## Post-Installation

After installing the plugin:

1. **Configure RBAC** — see [RBAC Permissions](../user-guide/rbac.md)
2. **Verify the plugin loads** — refresh browser and look for "TrueNAS (tns-csi)" in the sidebar
3. **Check the Overview page** — driver health card should show tns-csi status

## Upgrading

To upgrade to a new version, repeat the installation method you used. The new tarball replaces the old plugin directory.

For Plugin Manager installs, the catalog will show available updates.

## Uninstalling

Remove the plugin directory from your Headlamp plugins directory:

```bash
rm -rf /headlamp/plugins/headlamp-tns-csi-plugin/
```

Or via the Headlamp UI: **Settings → Plugins → headlamp-tns-csi-plugin → Uninstall**.

# UAT Playbook — TNS CSI Plugin

## Access

**Sidebar → TrueNAS (tns-csi)** → Overview, Snapshots, Metrics, Benchmark

Storage Classes and Volumes are not in the plugin sidebar. They are covered through the native
Headlamp **Storage** tables, which have plugin-injected columns.

## Prerequisites

- You can reach the Headlamp UAT instance
- The plugin is installed and enabled in Headlamp UAT
- Optional: the TNS CSI driver is deployed (provisioner: `tns.csi.io`). Without it, the plugin
  should show "Driver Not Detected". See [Expected Failure Modes](#expected-failure-modes).

## Test Steps

| # | Action | Expected Result | Pass/Fail |
|---|--------|-----------------|-----------|
| 1 | Expand the **TrueNAS (tns-csi)** sidebar section | It has exactly four entries: Overview, Snapshots, Metrics, Benchmark | |
| 2 | Navigate to TrueNAS (tns-csi) → Overview | "TNS-CSI — Overview" loads with a Notice card, the Driver Status card (controller and node pod health), and a Storage Summary | |
| 3 | Navigate to TrueNAS (tns-csi) → Snapshots | "TNS-CSI — Snapshots" loads. It shows snapshot classes and snapshots, an empty list, or "Volume Snapshot CRDs Not Installed" | |
| 4 | Navigate to TrueNAS (tns-csi) → Metrics | "TNS-CSI — Metrics" loads and shows driver metrics, or a "Metrics Unavailable" / "Metrics Error" card if the endpoint is unreachable | |
| 5 | Navigate to TrueNAS (tns-csi) → Benchmark | "TNS-CSI — Benchmark" loads with the Benchmark Guide, Run New Benchmark form, and Past Benchmarks. **Do not start a run.** It is the plugin's only write operation | |
| 6 | Navigate to native **Storage → Storage Classes** | The table has the plugin-injected **Protocol**, **Pool**, and **Server** columns. Rows that are not `tns.csi.io` show "—" | |
| 7 | Navigate to native **Storage → Persistent Volumes** | The table has the plugin-injected **Protocol** and **Pool** columns. PVs that are not `tns.csi.io` show "—" | |
| 8 | Open a PVC bound to a `tns.csi.io` PV (Storage → Persistent Volume Claims → PVC) | The detail view includes an injected "TNS-CSI Storage Details" section. **Untestable in `headlamp-uat`:** the cluster has no `tns.csi.io` CSIDriver, StorageClass, or PV, so there is no qualifying PVC to open. PRI-2112 is resolved and PVC reads work; a PVC that is not `tns.csi.io`-backed correctly shows no TNS-CSI section | |
| 9 | *(Optional deep link)* Open `/c/main/tns-csi/storage-classes` | "TNS-CSI — Storage Classes" loads (route kept for direct links; not in the sidebar) | |
| 10 | *(Optional deep link)* Open `/c/main/tns-csi/volumes` | "TNS-CSI — Volumes" loads (route kept for direct links; not in the sidebar) | |

## Expected Failure Modes

These are correct plugin behaviour. Do not file them as defects.

- **No `tns.csi.io` driver in the cluster:** Overview and Metrics show a "Driver Not Detected"
  card ("CSIDriver tns.csi.io not found on this cluster" / "TNS-CSI driver not found on this
  cluster"). This is graceful degradation.
- **Viewer SA cannot read PVCs (RBAC denial):** if the Headlamp service account lacks PVC read
  access, the plugin pages show an "Error" card that contains `persistentvolumeclaims is
  forbidden`. The plugin is surfacing the RBAC denial explicitly, as intended. This does not
  occur in `headlamp-uat` today: PRI-2112 granted the access and the PVC list returns 200.

## Pass Criteria

- The sidebar shows exactly the four entries listed above, under "TrueNAS (tns-csi)"
- Overview, Snapshots, Metrics, and Benchmark pages render without blank screens (expected
  failure-mode cards are acceptable)
- The native Storage Classes table shows the Protocol / Pool / Server columns
- The native Persistent Volumes table shows the Protocol / Pool columns
- The PVC detail section is injected (only when the cluster has a `tns.csi.io`-backed PVC)

## Fail Criteria

- Page errors or blank screens
- Sidebar entries are missing, extra, or under a different label
- Driver status shows unknown when driver pods are running
- Injected columns are missing from the native Storage Classes or Persistent Volumes tables
- The PVC detail section is missing for a `tns.csi.io`-backed PVC when the SA can read PVCs

## Artifacts to Capture

- Screenshot: expanded TrueNAS (tns-csi) sidebar section
- Screenshot: Overview with the Driver Status card (or the Driver Not Detected card)
- Screenshot: native Storage Classes table with the Protocol / Pool / Server columns
- Screenshot: native Persistent Volumes table with the Protocol / Pool columns
- Screenshot: PVC detail view with the injected TNS-CSI section (when a `tns.csi.io`-backed PVC exists)
- Console errors (attach a screenshot of any browser console errors)

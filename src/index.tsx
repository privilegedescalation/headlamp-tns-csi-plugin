/**
 * headlamp-tns-csi-plugin — entry point.
 *
 * Registers sidebar entries, routes, detail view sections, table column
 * processors, header actions, and app bar action for the tns-csi CSI driver.
 */

import {
  registerDetailsViewHeaderAction,
  registerDetailsViewSection,
  registerPluginSettings,
  registerResourceTableColumnsProcessor,
  registerRoute,
  registerSidebarEntry,
} from '@kinvolk/headlamp-plugin/lib';
import React from 'react';
import { TnsCsiDataProvider } from './api/TnsCsiDataContext';
import TnsCsiSettings from './components/TnsCsiSettings';
import BenchmarkPage from './components/BenchmarkPage';
import DriverPodDetailSection from './components/DriverPodDetailSection';
import { buildPVColumns, buildStorageClassColumns } from './components/integrations/StorageClassColumns';
import StorageClassBenchmarkButton from './components/integrations/StorageClassBenchmarkButton';
import MetricsPage from './components/MetricsPage';
import OverviewPage from './components/OverviewPage';
import PVCDetailSection from './components/PVCDetailSection';
import PVDetailSection from './components/PVDetailSection';
import SnapshotsPage from './components/SnapshotsPage';
import StorageClassesPage from './components/StorageClassesPage';
import VolumesPage from './components/VolumesPage';

// ---------------------------------------------------------------------------
// Sidebar entries (trimmed from 6 to 4 — Storage Classes and Volumes now
// surface via native Headlamp tables with injected columns/sections)
// ---------------------------------------------------------------------------

registerSidebarEntry({
  parent: null,
  name: 'tns-csi',
  label: 'TrueNAS (tns-csi)',
  url: '/tns-csi',
  icon: 'mdi:database-cog',
});

registerSidebarEntry({
  parent: 'tns-csi',
  name: 'tns-csi-overview',
  label: 'Overview',
  url: '/tns-csi',
  icon: 'mdi:view-dashboard',
});

registerSidebarEntry({
  parent: 'tns-csi',
  name: 'tns-csi-snapshots',
  label: 'Snapshots',
  url: '/tns-csi/snapshots',
  icon: 'mdi:camera',
});

registerSidebarEntry({
  parent: 'tns-csi',
  name: 'tns-csi-metrics',
  label: 'Metrics',
  url: '/tns-csi/metrics',
  icon: 'mdi:chart-line',
});

registerSidebarEntry({
  parent: 'tns-csi',
  name: 'tns-csi-benchmark',
  label: 'Benchmark',
  url: '/tns-csi/benchmark',
  icon: 'mdi:speedometer',
});

// ---------------------------------------------------------------------------
// Routes (keep all routes so direct links still work)
// ---------------------------------------------------------------------------

registerRoute({
  path: '/tns-csi',
  sidebar: 'tns-csi-overview',
  name: 'tns-csi-overview',
  exact: true,
  component: () => (
    <TnsCsiDataProvider>
      <OverviewPage />
    </TnsCsiDataProvider>
  ),
});

// Routes for storage-classes and volumes are kept for direct URL access
// but are no longer in the sidebar — native Headlamp tables have tns-csi columns.
registerRoute({
  path: '/tns-csi/storage-classes',
  sidebar: 'tns-csi-overview',
  name: 'tns-csi-storage-classes',
  exact: true,
  component: () => (
    <TnsCsiDataProvider>
      <StorageClassesPage />
    </TnsCsiDataProvider>
  ),
});

registerRoute({
  path: '/tns-csi/volumes',
  sidebar: 'tns-csi-overview',
  name: 'tns-csi-volumes',
  exact: true,
  component: () => (
    <TnsCsiDataProvider>
      <VolumesPage />
    </TnsCsiDataProvider>
  ),
});

registerRoute({
  path: '/tns-csi/snapshots',
  sidebar: 'tns-csi-snapshots',
  name: 'tns-csi-snapshots',
  exact: true,
  component: () => (
    <TnsCsiDataProvider>
      <SnapshotsPage />
    </TnsCsiDataProvider>
  ),
});

registerRoute({
  path: '/tns-csi/metrics',
  sidebar: 'tns-csi-metrics',
  name: 'tns-csi-metrics',
  exact: true,
  component: () => (
    <TnsCsiDataProvider>
      <MetricsPage />
    </TnsCsiDataProvider>
  ),
});

registerRoute({
  path: '/tns-csi/benchmark',
  sidebar: 'tns-csi-benchmark',
  name: 'tns-csi-benchmark',
  exact: true,
  component: () => (
    <TnsCsiDataProvider>
      <BenchmarkPage />
    </TnsCsiDataProvider>
  ),
});

// ---------------------------------------------------------------------------
// Detail view section — PVC pages
// ---------------------------------------------------------------------------

registerDetailsViewSection(({ resource }) => {
  if (resource?.kind !== 'PersistentVolumeClaim') return null;

  return (
    <TnsCsiDataProvider>
      <PVCDetailSection resource={resource} />
    </TnsCsiDataProvider>
  );
});

// ---------------------------------------------------------------------------
// Detail view section — PV pages
// ---------------------------------------------------------------------------

registerDetailsViewSection(({ resource }) => {
  if (resource?.kind !== 'PersistentVolume') return null;
  return <PVDetailSection resource={resource} />;
});

// ---------------------------------------------------------------------------
// Detail view section — Pod pages (tns-csi driver pods only)
// ---------------------------------------------------------------------------

registerDetailsViewSection(({ resource }) => {
  if (resource?.kind !== 'Pod') return null;
  return <DriverPodDetailSection resource={resource} />;
});

// ---------------------------------------------------------------------------
// Table column processors — native StorageClass and PV tables
// ---------------------------------------------------------------------------

// Merges incoming columns into existing ones by label.
// If a column with the same label already exists, the incoming getValue/render
// takes priority and falls back to the existing one (for mixed-driver tables).
function mergeColumns<T>(
  existing: T[],
  incoming: Array<{ label: string; getValue: (r: unknown) => unknown; render: (r: unknown) => React.ReactNode }>
): T[] {
  type ObjCol = { label: string; getValue: (r: unknown) => unknown; render: (r: unknown) => React.ReactNode };
  const isObjCol = (c: unknown): c is ObjCol =>
    typeof c === 'object' && c !== null && 'label' in c;
  const result = [...existing];
  const toAppend: typeof incoming = [];
  for (const col of incoming) {
    const idx = result.findIndex(c => isObjCol(c) && (c as ObjCol).label === col.label);
    if (idx !== -1) {
      const prev = result[idx] as ObjCol;
      result[idx] = {
        label: col.label,
        getValue: (r: unknown) => col.getValue(r) ?? prev.getValue(r),
        render: (r: unknown) => col.getValue(r) !== null ? col.render(r) : prev.render(r),
      } as unknown as T;
    } else {
      toAppend.push(col);
    }
  }
  return [...result, ...(toAppend as unknown as T[])];
}

registerResourceTableColumnsProcessor(({ id, columns }) => {
  if (id === 'headlamp-storageclasses') {
    return mergeColumns(columns, buildStorageClassColumns());
  }
  if (id === 'headlamp-persistentvolumes') {
    return mergeColumns(columns, buildPVColumns());
  }
  return columns;
});

// ---------------------------------------------------------------------------
// Header action — StorageClass detail page Benchmark shortcut
// ---------------------------------------------------------------------------

registerDetailsViewHeaderAction(({ resource }) => {
  if (resource?.kind !== 'StorageClass') return null;
  return <StorageClassBenchmarkButton resource={resource} />;
});

// ---------------------------------------------------------------------------
// Plugin settings
// ---------------------------------------------------------------------------

registerPluginSettings('tns-csi', TnsCsiSettings, true);

/**
 * headlamp-tns-csi-plugin — entry point.
 *
 * Registers sidebar entries, routes, detail view sections, table column
 * processors, header actions, and app bar action for the tns-csi CSI driver.
 */

import {
  registerAppBarAction,
  registerDetailsViewHeaderAction,
  registerDetailsViewSection,
  registerPluginSettings,
  registerResourceTableColumnsProcessor,
  registerRoute,
  registerSidebarEntry,
} from '@kinvolk/headlamp-plugin/lib';
import React from 'react';
import { TnsCsiDataProvider } from './api/TnsCsiDataContext';
import AppBarDriverBadge from './components/AppBarDriverBadge';
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

registerResourceTableColumnsProcessor(({ id, columns }) => {
  if (id === 'headlamp-storageclasses') {
    return [...columns, ...buildStorageClassColumns()];
  }
  if (id === 'headlamp-persistentvolumes') {
    return [...columns, ...buildPVColumns()];
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
// App bar action — driver health badge
// ---------------------------------------------------------------------------

registerAppBarAction(() => (
  <TnsCsiDataProvider>
    <AppBarDriverBadge />
  </TnsCsiDataProvider>
));

// ---------------------------------------------------------------------------
// Plugin settings
// ---------------------------------------------------------------------------

registerPluginSettings('headlamp-tns-csi-plugin', TnsCsiSettings, true);

/**
 * headlamp-tns-csi-plugin — entry point.
 *
 * Registers sidebar entries, routes, detail view section, and plugin settings
 * for the tns-csi CSI driver Headlamp plugin.
 */

import {
  registerDetailsViewSection,
  registerPluginSettings,
  registerRoute,
  registerSidebarEntry,
} from '@kinvolk/headlamp-plugin/lib';
import React from 'react';
import { TnsCsiDataProvider } from './api/TnsCsiDataContext';
import BenchmarkPage from './components/BenchmarkPage';
import MetricsPage from './components/MetricsPage';
import OverviewPage from './components/OverviewPage';
import PVCDetailSection from './components/PVCDetailSection';
import SnapshotsPage from './components/SnapshotsPage';
import StorageClassesPage from './components/StorageClassesPage';
import VolumesPage from './components/VolumesPage';

// ---------------------------------------------------------------------------
// Sidebar entries
// ---------------------------------------------------------------------------

registerSidebarEntry({
  parent: null,
  name: 'tns-csi',
  label: 'TrueNAS',
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
  name: 'tns-csi-storage-classes',
  label: 'Storage Classes',
  url: '/tns-csi/storage-classes',
  icon: 'mdi:database',
});

registerSidebarEntry({
  parent: 'tns-csi',
  name: 'tns-csi-volumes',
  label: 'Volumes',
  url: '/tns-csi/volumes',
  icon: 'mdi:harddisk',
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
// Routes
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

registerRoute({
  path: '/tns-csi/storage-classes',
  sidebar: 'tns-csi-storage-classes',
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
  sidebar: 'tns-csi-volumes',
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
// PVC detail view injection
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
// Plugin settings
// ---------------------------------------------------------------------------

function TnsCsiSettings() {
  return (
    <div style={{ padding: '16px' }}>
      <p style={{ color: 'var(--mui-palette-text-secondary)' }}>
        TNS-CSI plugin settings. Configure defaults below.
      </p>
      {/* Future: default namespace, metrics refresh interval, auto-cleanup setting */}
    </div>
  );
}

registerPluginSettings('headlamp-tns-csi-plugin', TnsCsiSettings, true);

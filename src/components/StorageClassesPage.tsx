/**
 * StorageClassesPage — lists tns-csi StorageClasses with a slide-in detail panel.
 *
 * Pattern mirrors headlamp-polaris-plugin's NamespacesListView:
 * click row → detail drawer, Escape to close, URL hash state.
 */

import {
  Loader,
  NameValueTable,
  SectionBox,
  SectionHeader,
  SimpleTable,
  StatusLabel,
} from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import React, { useEffect, useState } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import { useTnsCsiContext } from '../api/TnsCsiDataContext';
import type { TnsCsiStorageClass } from '../api/k8s';
import { formatProtocol } from '../api/k8s';

// ---------------------------------------------------------------------------
// Detail drawer
// ---------------------------------------------------------------------------

interface StorageClassDetailPanelProps {
  sc: TnsCsiStorageClass;
  pvCount: number;
  onClose: () => void;
}

function StorageClassDetailPanel({ sc, pvCount, onClose }: StorageClassDetailPanelProps) {
  const [isMaximized, setIsMaximized] = React.useState(false);
  const params = sc.parameters ?? {};
  const protocol = formatProtocol(params.protocol);

  const drawerClass = `tns-csi-sc-drawer-${sc.metadata.name}`;

  return (
    <>
      <style>{`
        .${drawerClass} {
          position: fixed;
          right: 0;
          top: 0;
          bottom: 0;
          width: ${isMaximized ? 'calc(100vw - 240px)' : '900px'};
          background-color: var(--mui-palette-background-default, #fafafa);
          color: var(--mui-palette-text-primary);
          box-shadow: -2px 0 8px rgba(0,0,0,0.15);
          overflow-y: auto;
          z-index: 1200;
          padding: 20px;
          transition: width 0.3s ease;
        }
      `}</style>
      <div className={drawerClass}>
        <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, color: 'var(--mui-palette-text-primary)' }}>
            {sc.metadata.name}
          </h2>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setIsMaximized(!isMaximized)}
              aria-label={isMaximized ? 'Minimize panel' : 'Maximize panel'}
              title={isMaximized ? 'Minimize' : 'Maximize'}
              style={{ border: 'none', background: 'transparent', fontSize: '20px', cursor: 'pointer', padding: '4px 8px', color: 'var(--mui-palette-text-secondary, #666)', borderRadius: '4px' }}
            >
              {isMaximized ? '⊟' : '⊡'}
            </button>
            <button
              onClick={onClose}
              aria-label="Close panel"
              title="Close"
              style={{ border: 'none', background: 'transparent', fontSize: '24px', cursor: 'pointer', padding: '4px 8px', color: 'var(--mui-palette-text-secondary, #666)', borderRadius: '4px' }}
            >
              ×
            </button>
          </div>
        </div>

        <SectionBox title="StorageClass Details">
          <NameValueTable
            rows={[
              { name: 'Name', value: sc.metadata.name },
              { name: 'Protocol', value: protocol },
              { name: 'Pool', value: params.pool ?? '—' },
              { name: 'Server', value: params.server ?? '—' },
              { name: 'Reclaim Policy', value: sc.reclaimPolicy ?? '—' },
              { name: 'Volume Binding Mode', value: sc.volumeBindingMode ?? '—' },
              {
                name: 'Allow Volume Expansion',
                value: <StatusLabel status={sc.allowVolumeExpansion ? 'success' : 'warning'}>
                  {sc.allowVolumeExpansion ? 'Yes' : 'No'}
                </StatusLabel>,
              },
              { name: 'Delete Strategy', value: params.deleteStrategy ?? '—' },
              {
                name: 'Encryption',
                value: params.encryption === 'true'
                  ? <StatusLabel status="success">Enabled</StatusLabel>
                  : <StatusLabel status="warning">Disabled</StatusLabel>,
              },
              { name: 'Provisioner', value: sc.provisioner },
              { name: 'Bound PVs', value: String(pvCount) },
            ]}
          />
        </SectionBox>

        {/* Protocol-specific notes */}
        {params.protocol && (
          <SectionBox title="Protocol Notes">
            <NameValueTable rows={protocolNotes(params.protocol)} />
          </SectionBox>
        )}
      </div>
    </>
  );
}

function protocolNotes(protocol: string): Array<{ name: string; value: React.ReactNode }> {
  const lower = protocol.toLowerCase();
  if (lower === 'nfs') {
    return [
      { name: 'Prerequisite', value: 'nfs-common (Debian/Ubuntu) or nfs-utils (RHEL/Fedora) required on all nodes' },
      { name: 'Access Modes', value: 'Supports RWO, RWX, RWOP' },
    ];
  }
  if (lower === 'nvmeof') {
    return [
      { name: 'Prerequisite', value: 'nvme-cli + kernel modules nvme-tcp and nvme-fabrics required on all nodes' },
      { name: 'Networking', value: 'Static IP required — DHCP is not supported for NVMe-oF' },
      { name: 'Access Modes', value: 'Supports RWO, RWOP' },
    ];
  }
  if (lower === 'iscsi') {
    return [
      { name: 'Prerequisite', value: 'open-iscsi required on all nodes' },
      { name: 'Access Modes', value: 'Supports RWO, RWOP' },
    ];
  }
  return [];
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function StorageClassesPage() {
  const location = useLocation();
  const history = useHistory();
  const { storageClasses, persistentVolumes, loading, error } = useTnsCsiContext();

  const [selectedName, setSelectedName] = useState<string | null>(
    location.hash.slice(1) || null
  );

  useEffect(() => {
    setSelectedName(location.hash.slice(1) || null);
  }, [location.hash]);

  const openSc = (name: string) => {
    setSelectedName(name);
    history.push(`${location.pathname}#${name}`);
  };

  const closeSc = () => {
    setSelectedName(null);
    history.push(location.pathname);
  };

  useEffect(() => {
    if (!selectedName) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSc();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedName]);

  if (loading) return <Loader title="Loading storage classes..." />;

  if (error) {
    return (
      <>
        <SectionHeader title="TNS-CSI — Storage Classes" />
        <SectionBox title="Error">
          <NameValueTable rows={[{ name: 'Status', value: <StatusLabel status="error">{error}</StatusLabel> }]} />
        </SectionBox>
      </>
    );
  }

  // Build PV count per StorageClass
  const pvCountBySc = new Map<string, number>();
  for (const pv of persistentVolumes) {
    const scName = pv.spec.storageClassName ?? '';
    pvCountBySc.set(scName, (pvCountBySc.get(scName) ?? 0) + 1);
  }

  const selectedSc = selectedName ? storageClasses.find(sc => sc.metadata.name === selectedName) ?? null : null;

  return (
    <>
      <SectionHeader title="TNS-CSI — Storage Classes" />
      <SectionBox>
        <SimpleTable
          columns={[
            {
              label: 'Name',
              getter: (sc: TnsCsiStorageClass) => (
                <button
                  onClick={() => openSc(sc.metadata.name)}
                  style={{ border: 'none', background: 'transparent', color: 'var(--link-color, #1976d2)', cursor: 'pointer', textDecoration: 'underline', padding: 0, font: 'inherit' }}
                >
                  {sc.metadata.name}
                </button>
              ),
            },
            { label: 'Protocol', getter: (sc: TnsCsiStorageClass) => formatProtocol(sc.parameters?.protocol) },
            { label: 'Pool', getter: (sc: TnsCsiStorageClass) => sc.parameters?.pool ?? '—' },
            { label: 'Server', getter: (sc: TnsCsiStorageClass) => sc.parameters?.server ?? '—' },
            { label: 'Reclaim Policy', getter: (sc: TnsCsiStorageClass) => sc.reclaimPolicy ?? '—' },
            {
              label: 'Expansion',
              getter: (sc: TnsCsiStorageClass) => (
                <StatusLabel status={sc.allowVolumeExpansion ? 'success' : 'warning'}>
                  {sc.allowVolumeExpansion ? 'Yes' : 'No'}
                </StatusLabel>
              ),
            },
            {
              label: 'PVs',
              getter: (sc: TnsCsiStorageClass) => String(pvCountBySc.get(sc.metadata.name) ?? 0),
            },
          ]}
          data={storageClasses}
          emptyMessage="No tns-csi StorageClasses found."
        />
      </SectionBox>

      {selectedSc && (
        <>
          <div
            onClick={closeSc}
            aria-label="Close panel backdrop"
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1100 }}
          />
          <StorageClassDetailPanel
            sc={selectedSc}
            pvCount={pvCountBySc.get(selectedSc.metadata.name) ?? 0}
            onClose={closeSc}
          />
        </>
      )}
    </>
  );
}

/**
 * VolumesPage — lists tns-csi PersistentVolumes with PVC cross-reference.
 * Slide-in detail panel shows full CSI attributes.
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
import type { TnsCsiPersistentVolume } from '../api/k8s';
import { findBoundPv, formatAccessModes, formatAge, formatProtocol, phaseToStatus } from '../api/k8s';

// ---------------------------------------------------------------------------
// Detail panel
// ---------------------------------------------------------------------------

interface VolumeDetailPanelProps {
  pv: TnsCsiPersistentVolume;
  onClose: () => void;
}

function VolumeDetailPanel({ pv, onClose }: VolumeDetailPanelProps) {
  const [isMaximized, setIsMaximized] = React.useState(false);
  const drawerClass = `tns-csi-pv-drawer-${pv.metadata.name}`;
  const csi = pv.spec.csi;
  const attrs = csi?.volumeAttributes ?? {};
  const claim = pv.spec.claimRef;

  return (
    <>
      <style>{`
        .${drawerClass} {
          position: fixed; right: 0; top: 0; bottom: 0;
          width: ${isMaximized ? 'calc(100vw - 240px)' : '900px'};
          background-color: var(--mui-palette-background-default, #fafafa);
          color: var(--mui-palette-text-primary);
          box-shadow: -2px 0 8px rgba(0,0,0,0.15);
          overflow-y: auto; z-index: 1200; padding: 20px;
          transition: width 0.3s ease;
        }
      `}</style>
      <div className={drawerClass}>
        <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, color: 'var(--mui-palette-text-primary)' }}>{pv.metadata.name}</h2>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setIsMaximized(!isMaximized)} aria-label={isMaximized ? 'Minimize' : 'Maximize'} style={{ border: 'none', background: 'transparent', fontSize: '20px', cursor: 'pointer', padding: '4px 8px', color: 'var(--mui-palette-text-secondary, #666)', borderRadius: '4px' }}>
              {isMaximized ? '⊟' : '⊡'}
            </button>
            <button onClick={onClose} aria-label="Close panel" style={{ border: 'none', background: 'transparent', fontSize: '24px', cursor: 'pointer', padding: '4px 8px', color: 'var(--mui-palette-text-secondary, #666)', borderRadius: '4px' }}>
              ×
            </button>
          </div>
        </div>

        <SectionBox title="Volume Details">
          <NameValueTable
            rows={[
              { name: 'Name', value: pv.metadata.name },
              {
                name: 'Status',
                value: (
                  <StatusLabel status={phaseToStatus(pv.status?.phase)}>
                    {pv.status?.phase ?? 'Unknown'}
                  </StatusLabel>
                ),
              },
              { name: 'Capacity', value: pv.spec.capacity?.storage ?? '—' },
              { name: 'Access Modes', value: formatAccessModes(pv.spec.accessModes) },
              { name: 'Reclaim Policy', value: pv.spec.persistentVolumeReclaimPolicy ?? '—' },
              { name: 'Storage Class', value: pv.spec.storageClassName ?? '—' },
              { name: 'Age', value: formatAge(pv.metadata.creationTimestamp) },
            ]}
          />
        </SectionBox>

        {claim && (
          <SectionBox title="Bound PVC">
            <NameValueTable
              rows={[
                { name: 'PVC Name', value: claim.name },
                { name: 'Namespace', value: claim.namespace },
              ]}
            />
          </SectionBox>
        )}

        <SectionBox title="CSI Attributes">
          <NameValueTable
            rows={[
              { name: 'Driver', value: csi?.driver ?? '—' },
              { name: 'Volume Handle', value: csi?.volumeHandle ?? '—' },
              { name: 'Protocol', value: formatProtocol(attrs['protocol']) },
              { name: 'Server', value: attrs['server'] ?? '—' },
              ...(Object.entries(attrs)
                .filter(([k]) => !['protocol', 'server'].includes(k))
                .map(([k, v]) => ({ name: k, value: v ?? '—' }))
              ),
            ]}
          />
        </SectionBox>

        {/* Volume adoption note */}
        {pv.metadata.annotations?.['tns-csi.io/adoptable'] === 'true' && (
          <SectionBox title="Adoption">
            <NameValueTable
              rows={[{
                name: 'Adoptable',
                value: <StatusLabel status="success">This volume can be adopted cross-cluster</StatusLabel>,
              }]}
            />
          </SectionBox>
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function VolumesPage() {
  const location = useLocation();
  const history = useHistory();
  const { persistentVolumes, persistentVolumeClaims, loading, error } = useTnsCsiContext();

  const [selectedName, setSelectedName] = useState<string | null>(
    location.hash.slice(1) || null
  );

  useEffect(() => {
    setSelectedName(location.hash.slice(1) || null);
  }, [location.hash]);

  const openVolume = (name: string) => {
    setSelectedName(name);
    history.push(`${location.pathname}#${name}`);
  };

  const closeVolume = () => {
    setSelectedName(null);
    history.push(location.pathname);
  };

  useEffect(() => {
    if (!selectedName) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeVolume();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedName]);

  if (loading) return <Loader title="Loading volumes..." />;

  if (error) {
    return (
      <>
        <SectionHeader title="TNS-CSI — Volumes" />
        <SectionBox title="Error">
          <NameValueTable rows={[{ name: 'Status', value: <StatusLabel status="error">{error}</StatusLabel> }]} />
        </SectionBox>
      </>
    );
  }

  const selectedPv = selectedName
    ? persistentVolumes.find(pv => pv.metadata.name === selectedName) ?? null
    : null;

  return (
    <>
      <SectionHeader title="TNS-CSI — Volumes" />
      <SectionBox>
        <SimpleTable
          columns={[
            {
              label: 'PV Name',
              getter: (pv: TnsCsiPersistentVolume) => (
                <button
                  onClick={() => openVolume(pv.metadata.name)}
                  style={{ border: 'none', background: 'transparent', color: 'var(--link-color, #1976d2)', cursor: 'pointer', textDecoration: 'underline', padding: 0, font: 'inherit' }}
                >
                  {pv.metadata.name}
                </button>
              ),
            },
            {
              label: 'PVC',
              getter: (pv: TnsCsiPersistentVolume) => {
                const claim = pv.spec.claimRef;
                return claim ? `${claim.namespace}/${claim.name}` : '—';
              },
            },
            {
              label: 'Protocol',
              getter: (pv: TnsCsiPersistentVolume) =>
                formatProtocol(pv.spec.csi?.volumeAttributes?.['protocol']),
            },
            {
              label: 'Capacity',
              getter: (pv: TnsCsiPersistentVolume) => pv.spec.capacity?.storage ?? '—',
            },
            {
              label: 'Access Modes',
              getter: (pv: TnsCsiPersistentVolume) => formatAccessModes(pv.spec.accessModes),
            },
            {
              label: 'Reclaim',
              getter: (pv: TnsCsiPersistentVolume) => pv.spec.persistentVolumeReclaimPolicy ?? '—',
            },
            {
              label: 'Status',
              getter: (pv: TnsCsiPersistentVolume) => (
                <StatusLabel status={phaseToStatus(pv.status?.phase)}>
                  {pv.status?.phase ?? 'Unknown'}
                </StatusLabel>
              ),
            },
            {
              label: 'Age',
              getter: (pv: TnsCsiPersistentVolume) => formatAge(pv.metadata.creationTimestamp),
            },
          ]}
          data={persistentVolumes}
          emptyMessage="No tns-csi PersistentVolumes found."
        />
      </SectionBox>

      {selectedPv && (
        <>
          <div
            onClick={closeVolume}
            aria-label="Close panel backdrop"
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1100 }}
          />
          <VolumeDetailPanel pv={selectedPv} onClose={closeVolume} />
        </>
      )}
    </>
  );
}

/**
 * SnapshotsPage — lists VolumeSnapshots backed by tns-csi.
 * Gracefully degrades when the snapshot CRD is not installed.
 */

import {
  Loader,
  NameValueTable,
  SectionBox,
  SectionHeader,
  SimpleTable,
  StatusLabel,
} from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import React from 'react';
import { useTnsCsiContext } from '../api/TnsCsiDataContext';
import type { VolumeSnapshot } from '../api/k8s';
import { formatAge } from '../api/k8s';

export default function SnapshotsPage() {
  const { volumeSnapshots, volumeSnapshotClasses, snapshotCrdAvailable, loading, error } =
    useTnsCsiContext();

  if (loading) return <Loader title="Loading snapshots..." />;

  if (error) {
    return (
      <>
        <SectionHeader title="TNS-CSI — Snapshots" />
        <SectionBox title="Error">
          <NameValueTable rows={[{ name: 'Status', value: <StatusLabel status="error">{error}</StatusLabel> }]} />
        </SectionBox>
      </>
    );
  }

  if (!snapshotCrdAvailable) {
    return (
      <>
        <SectionHeader title="TNS-CSI — Snapshots" />
        <SectionBox title="Volume Snapshot CRDs Not Installed">
          <NameValueTable
            rows={[
              {
                name: 'Status',
                value: (
                  <StatusLabel status="warning">
                    VolumeSnapshot CRDs (snapshot.storage.k8s.io/v1) not found on this cluster
                  </StatusLabel>
                ),
              },
              {
                name: 'Documentation',
                value: (
                  <a href="https://github.com/fenio/tns-csi" target="_blank" rel="noopener noreferrer">
                    See tns-csi documentation for snapshot setup instructions
                  </a>
                ),
              },
            ]}
          />
        </SectionBox>
      </>
    );
  }

  return (
    <>
      <SectionHeader title="TNS-CSI — Snapshots" />

      {volumeSnapshotClasses.length > 0 && (
        <SectionBox title={`Snapshot Classes (${volumeSnapshotClasses.length})`}>
          <SimpleTable
            columns={[
              { label: 'Name', getter: (vsc) => vsc.metadata.name },
              { label: 'Driver', getter: (vsc) => vsc.driver ?? '—' },
              { label: 'Deletion Policy', getter: (vsc) => vsc.deletionPolicy ?? '—' },
              { label: 'Age', getter: (vsc) => formatAge(vsc.metadata.creationTimestamp) },
            ]}
            data={volumeSnapshotClasses}
          />
        </SectionBox>
      )}

      <SectionBox>
        <SimpleTable
          columns={[
            { label: 'Name', getter: (s: VolumeSnapshot) => s.metadata.name },
            { label: 'Namespace', getter: (s: VolumeSnapshot) => s.metadata.namespace ?? '—' },
            {
              label: 'Source PVC',
              getter: (s: VolumeSnapshot) => s.spec?.source?.persistentVolumeClaimName ?? '—',
            },
            {
              label: 'Snapshot Class',
              getter: (s: VolumeSnapshot) => s.spec?.volumeSnapshotClassName ?? '—',
            },
            {
              label: 'Ready',
              getter: (s: VolumeSnapshot) => {
                const ready = s.status?.readyToUse;
                if (ready === undefined) return <StatusLabel status="warning">Unknown</StatusLabel>;
                return (
                  <StatusLabel status={ready ? 'success' : 'warning'}>
                    {ready ? 'Yes' : 'No'}
                  </StatusLabel>
                );
              },
            },
            {
              label: 'Size',
              getter: (s: VolumeSnapshot) => s.status?.restoreSize ?? '—',
            },
            {
              label: 'Age',
              getter: (s: VolumeSnapshot) => formatAge(s.metadata.creationTimestamp),
            },
          ]}
          data={volumeSnapshots}
          emptyMessage="No tns-csi VolumeSnapshots found."
        />
      </SectionBox>
    </>
  );
}

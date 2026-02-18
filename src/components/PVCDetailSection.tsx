/**
 * PVCDetailSection — injected into Headlamp's PVC detail view.
 *
 * Shown only when the bound PV uses tns.csi.io as the CSI driver.
 * Uses registerDetailsViewSection in index.tsx.
 */

import {
  NameValueTable,
  SectionBox,
} from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import React from 'react';
import { useTnsCsiContext } from '../api/TnsCsiDataContext';
import { findBoundPv, formatProtocol } from '../api/k8s';

interface PVCDetailSectionProps {
  resource: {
    metadata?: { name?: string; namespace?: string };
    spec?: { volumeName?: string; storageClassName?: string };
  };
}

export default function PVCDetailSection({ resource }: PVCDetailSectionProps) {
  const { persistentVolumes, persistentVolumeClaims, loading } = useTnsCsiContext();

  if (loading) return null;

  // Find this PVC in our filtered list
  const pvcName = resource.metadata?.name;
  const pvcNamespace = resource.metadata?.namespace;
  const matchedPvc = persistentVolumeClaims.find(
    pvc => pvc.metadata.name === pvcName && pvc.metadata.namespace === pvcNamespace
  );

  if (!matchedPvc) {
    // Not a tns-csi PVC — render nothing
    return null;
  }

  const boundPv = findBoundPv(matchedPvc, persistentVolumes);
  if (!boundPv) return null;

  const attrs = boundPv.spec.csi?.volumeAttributes ?? {};
  const protocol = formatProtocol(attrs['protocol']);

  return (
    <SectionBox title="TNS-CSI Storage Details">
      <NameValueTable
        rows={[
          { name: 'Driver', value: 'tns.csi.io' },
          { name: 'Protocol', value: protocol },
          { name: 'Server', value: attrs['server'] ?? '—' },
          { name: 'Storage Class', value: boundPv.spec.storageClassName ?? '—' },
          { name: 'Volume Handle', value: boundPv.spec.csi?.volumeHandle ?? '—' },
          ...(Object.entries(attrs)
            .filter(([k]) => !['protocol', 'server'].includes(k))
            .map(([k, v]) => ({ name: k, value: v ?? '—' }))
          ),
          {
            name: 'PV Name',
            value: boundPv.metadata.name,
          },
        ]}
      />
    </SectionBox>
  );
}

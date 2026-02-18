/**
 * PVDetailSection — injected into Headlamp's PersistentVolume detail view.
 *
 * Shown only when the PV uses tns.csi.io as the CSI driver.
 * Uses registerDetailsViewSection in index.tsx.
 */

import {
  NameValueTable,
  SectionBox,
} from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import React from 'react';
import { formatProtocol, TNS_CSI_PROVISIONER } from '../api/k8s';

interface PVDetailSectionProps {
  resource: {
    kind?: string;
    metadata?: { name?: string; namespace?: string };
    spec?: {
      csi?: {
        driver?: string;
        volumeHandle?: string;
        volumeAttributes?: Record<string, string>;
      };
      storageClassName?: string;
      capacity?: { storage?: string };
      persistentVolumeReclaimPolicy?: string;
    };
    // KubeObject instance — raw JSON lives under jsonData
    jsonData?: {
      spec?: {
        csi?: {
          driver?: string;
          volumeHandle?: string;
          volumeAttributes?: Record<string, string>;
        };
        storageClassName?: string;
      };
    };
  };
}

export default function PVDetailSection({ resource }: PVDetailSectionProps) {
  // Extract from jsonData (KubeObject instance) or fall back to direct properties
  const spec = resource?.jsonData?.spec ?? resource?.spec;
  const csi = spec?.csi;

  if (!csi || csi.driver !== TNS_CSI_PROVISIONER) {
    return null;
  }

  const attrs = csi.volumeAttributes ?? {};
  const protocol = formatProtocol(attrs['protocol']);
  const otherAttrs = Object.entries(attrs).filter(
    ([k]) => !['protocol', 'server', 'pool'].includes(k)
  );

  return (
    <SectionBox title="TNS-CSI Storage Details">
      <NameValueTable
        rows={[
          { name: 'Driver', value: TNS_CSI_PROVISIONER },
          { name: 'Protocol', value: protocol },
          { name: 'Server', value: attrs['server'] ?? '—' },
          { name: 'Pool', value: attrs['pool'] ?? '—' },
          { name: 'Volume Handle', value: csi.volumeHandle ?? '—' },
          { name: 'Storage Class', value: spec?.storageClassName ?? '—' },
          ...otherAttrs.map(([k, v]) => ({ name: k, value: v ?? '—' })),
        ]}
      />
    </SectionBox>
  );
}

import { describe, expect, it } from 'vitest';
import {
  filterTnsCsiPersistentVolumes,
  filterTnsCsiPVCs,
  filterTnsCsiStorageClasses,
  filterTnsCsiVolumeSnapshots,
  findBoundPv,
  formatAccessModes,
  formatAge,
  formatProtocol,
  isTnsCsiPersistentVolume,
  isTnsCsiStorageClass,
  phaseToStatus,
  TnsCsiPersistentVolume,
  TnsCsiPersistentVolumeClaim,
  TnsCsiStorageClass,
} from './k8s';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makeSc(name: string, provisioner: string, protocol = 'nfs'): TnsCsiStorageClass {
  return {
    metadata: { name },
    provisioner,
    parameters: { protocol },
  };
}

function makePv(name: string, driver: string, claimRef?: { name: string; namespace: string }): TnsCsiPersistentVolume {
  return {
    metadata: { name },
    spec: {
      csi: { driver, volumeAttributes: { protocol: 'nfs' } },
      capacity: { storage: '10Gi' },
      claimRef,
    },
    status: { phase: 'Bound' },
  };
}

function makePvc(name: string, namespace: string): TnsCsiPersistentVolumeClaim {
  return {
    metadata: { name, namespace },
    spec: {},
    status: { phase: 'Bound' },
  };
}

// ---------------------------------------------------------------------------
// StorageClass filtering
// ---------------------------------------------------------------------------

describe('isTnsCsiStorageClass', () => {
  it('returns true for tns.csi.io provisioner', () => {
    expect(isTnsCsiStorageClass(makeSc('sc1', 'tns.csi.io'))).toBe(true);
  });

  it('returns false for other provisioners', () => {
    expect(isTnsCsiStorageClass(makeSc('sc1', 'kubernetes.io/nfs'))).toBe(false);
  });

  it('returns false for non-objects', () => {
    expect(isTnsCsiStorageClass(null)).toBe(false);
    expect(isTnsCsiStorageClass(undefined)).toBe(false);
    expect(isTnsCsiStorageClass('string')).toBe(false);
  });
});

describe('filterTnsCsiStorageClasses', () => {
  it('filters to only tns-csi storage classes', () => {
    const items = [
      makeSc('tns-sc', 'tns.csi.io'),
      makeSc('other-sc', 'kubernetes.io/aws-ebs'),
      makeSc('another', 'rancher.io/local-path'),
    ];
    const result = filterTnsCsiStorageClasses(items);
    expect(result).toHaveLength(1);
    expect(result[0]?.metadata.name).toBe('tns-sc');
  });

  it('returns empty array when no tns-csi classes', () => {
    expect(filterTnsCsiStorageClasses([makeSc('x', 'other')])).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// PV filtering
// ---------------------------------------------------------------------------

describe('isTnsCsiPersistentVolume', () => {
  it('returns true for tns.csi.io driver', () => {
    expect(isTnsCsiPersistentVolume(makePv('pv1', 'tns.csi.io'))).toBe(true);
  });

  it('returns false for other drivers', () => {
    expect(isTnsCsiPersistentVolume(makePv('pv1', 'ebs.csi.aws.com'))).toBe(false);
  });

  it('returns false for PVs without CSI spec', () => {
    const pv = { metadata: { name: 'pv1' }, spec: {}, status: {} };
    expect(isTnsCsiPersistentVolume(pv)).toBe(false);
  });
});

describe('filterTnsCsiPersistentVolumes', () => {
  it('filters to only tns-csi PVs', () => {
    const items = [
      makePv('tns-pv', 'tns.csi.io'),
      makePv('other-pv', 'ebs.csi.aws.com'),
    ];
    const result = filterTnsCsiPersistentVolumes(items);
    expect(result).toHaveLength(1);
    expect(result[0]?.metadata.name).toBe('tns-pv');
  });
});

// ---------------------------------------------------------------------------
// PVC filtering
// ---------------------------------------------------------------------------

describe('filterTnsCsiPVCs', () => {
  it('includes PVCs bound to tns-csi PVs via claimRef', () => {
    const pv = makePv('tns-pv', 'tns.csi.io', { name: 'my-pvc', namespace: 'default' });
    const pvc = makePvc('my-pvc', 'default');
    const unrelatedPvc = makePvc('other-pvc', 'default');

    const result = filterTnsCsiPVCs([pvc, unrelatedPvc], [pv]);
    expect(result).toHaveLength(1);
    expect(result[0]?.metadata.name).toBe('my-pvc');
  });

  it('returns empty array when no PVs', () => {
    const pvc = makePvc('my-pvc', 'default');
    expect(filterTnsCsiPVCs([pvc], [])).toHaveLength(0);
  });
});

describe('findBoundPv', () => {
  it('finds the PV bound to a PVC', () => {
    const pv = makePv('tns-pv', 'tns.csi.io', { name: 'my-pvc', namespace: 'default' });
    const pvc = makePvc('my-pvc', 'default');
    expect(findBoundPv(pvc, [pv])).toBe(pv);
  });

  it('returns undefined when no match', () => {
    const pv = makePv('tns-pv', 'tns.csi.io', { name: 'other-pvc', namespace: 'default' });
    const pvc = makePvc('my-pvc', 'default');
    expect(findBoundPv(pvc, [pv])).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// VolumeSnapshot filtering
// ---------------------------------------------------------------------------

describe('filterTnsCsiVolumeSnapshots', () => {
  it('filters snapshots to matching snapshot classes', () => {
    const snapshots = [
      { metadata: { name: 's1' }, spec: { volumeSnapshotClassName: 'tns-vsc' } },
      { metadata: { name: 's2' }, spec: { volumeSnapshotClassName: 'other-vsc' } },
    ];
    const result = filterTnsCsiVolumeSnapshots(snapshots, new Set(['tns-vsc']));
    expect(result).toHaveLength(1);
    expect(result[0]?.metadata.name).toBe('s1');
  });
});

// ---------------------------------------------------------------------------
// Formatting utilities
// ---------------------------------------------------------------------------

describe('formatProtocol', () => {
  it('maps nfs → NFS', () => expect(formatProtocol('nfs')).toBe('NFS'));
  it('maps nvmeof → NVMe-oF', () => expect(formatProtocol('nvmeof')).toBe('NVMe-oF'));
  it('maps iscsi → iSCSI', () => expect(formatProtocol('iscsi')).toBe('iSCSI'));
  it('passes through unknown values', () => expect(formatProtocol('custom')).toBe('custom'));
  it('returns — for undefined', () => expect(formatProtocol(undefined)).toBe('—'));
});

describe('formatAccessModes', () => {
  it('abbreviates access modes', () => {
    expect(formatAccessModes(['ReadWriteOnce', 'ReadWriteMany'])).toBe('RWO, RWX');
  });
  it('returns — for empty', () => expect(formatAccessModes([])).toBe('—'));
  it('returns — for undefined', () => expect(formatAccessModes(undefined)).toBe('—'));
});

describe('formatAge', () => {
  it('returns "unknown" for undefined', () => {
    expect(formatAge(undefined)).toBe('unknown');
  });

  it('returns seconds for very recent timestamps', () => {
    const ts = new Date(Date.now() - 30_000).toISOString();
    expect(formatAge(ts)).toBe('30s');
  });

  it('returns minutes for ~5min ago', () => {
    const ts = new Date(Date.now() - 5 * 60_000).toISOString();
    expect(formatAge(ts)).toBe('5m');
  });
});

describe('phaseToStatus', () => {
  it('maps Bound → success', () => expect(phaseToStatus('Bound')).toBe('success'));
  it('maps Pending → warning', () => expect(phaseToStatus('Pending')).toBe('warning'));
  it('maps Failed → error', () => expect(phaseToStatus('Failed')).toBe('error'));
  it('maps undefined → error', () => expect(phaseToStatus(undefined)).toBe('error'));
});

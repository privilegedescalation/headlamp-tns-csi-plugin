import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@kinvolk/headlamp-plugin/lib/CommonComponents', () =>
  require('./__mocks__/commonComponents.ts')
);

vi.mock('../api/TnsCsiDataContext');

import { useTnsCsiContext } from '../api/TnsCsiDataContext';
import { defaultContext, makeSamplePV, makeSamplePVC } from '../test-helpers';
import PVCDetailSection from './PVCDetailSection';

function mockContext(overrides?: Parameters<typeof defaultContext>[0]) {
  vi.mocked(useTnsCsiContext).mockReturnValue(defaultContext(overrides));
}

describe('PVCDetailSection', () => {
  it('returns null when loading', () => {
    mockContext({ loading: true });
    const { container } = render(
      <PVCDetailSection resource={{ metadata: { name: 'my-pvc', namespace: 'default' } }} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('returns null when PVC is not in filtered list', () => {
    mockContext({ persistentVolumeClaims: [] });
    const { container } = render(
      <PVCDetailSection resource={{ metadata: { name: 'other-pvc', namespace: 'default' } }} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('returns null when PVC has no bound PV', () => {
    const pvc = makeSamplePVC({ metadata: { name: 'orphan-pvc', namespace: 'default' } });
    mockContext({
      persistentVolumeClaims: [pvc],
      persistentVolumes: [], // no PVs to match
    });
    const { container } = render(
      <PVCDetailSection resource={{ metadata: { name: 'orphan-pvc', namespace: 'default' } }} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders storage details when PVC and PV are found', () => {
    const pvc = makeSamplePVC();
    const pv = makeSamplePV();
    mockContext({
      persistentVolumeClaims: [pvc],
      persistentVolumes: [pv],
    });
    render(
      <PVCDetailSection resource={{ metadata: { name: 'my-pvc', namespace: 'default' } }} />
    );
    expect(screen.getByText('TNS-CSI Storage Details')).toBeInTheDocument();
    expect(screen.getByText('tns.csi.io')).toBeInTheDocument();
    expect(screen.getByText('NFS')).toBeInTheDocument();
    expect(screen.getByText('10.0.0.1')).toBeInTheDocument();
    expect(screen.getByText('tns-nfs')).toBeInTheDocument();
    expect(screen.getByText('tank/vol-001')).toBeInTheDocument();
  });

  it('renders custom volume attributes (excluding protocol and server)', () => {
    const pv = makeSamplePV({
      spec: {
        ...makeSamplePV().spec,
        csi: {
          driver: 'tns.csi.io',
          volumeHandle: 'tank/vol-001',
          volumeAttributes: {
            protocol: 'nfs',
            server: '10.0.0.1',
            pool: 'tank',
            customAttr: 'customValue',
          },
        },
      },
    });
    const pvc = makeSamplePVC();
    mockContext({
      persistentVolumeClaims: [pvc],
      persistentVolumes: [pv],
    });
    render(
      <PVCDetailSection resource={{ metadata: { name: 'my-pvc', namespace: 'default' } }} />
    );
    expect(screen.getByText('pool')).toBeInTheDocument();
    expect(screen.getByText('tank')).toBeInTheDocument();
    expect(screen.getByText('customAttr')).toBeInTheDocument();
    expect(screen.getByText('customValue')).toBeInTheDocument();
  });
});

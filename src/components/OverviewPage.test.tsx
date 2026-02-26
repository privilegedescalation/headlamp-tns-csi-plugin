import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@kinvolk/headlamp-plugin/lib/CommonComponents', () =>
  require('./__mocks__/commonComponents.ts')
);

vi.mock('../api/TnsCsiDataContext');
vi.mock('../api/metrics', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/metrics')>();
  return {
    ...actual,
    fetchControllerMetrics: vi.fn(),
  };
});

import { useTnsCsiContext } from '../api/TnsCsiDataContext';
import { fetchControllerMetrics } from '../api/metrics';
import {
  defaultContext,
  makeSamplePod,
  makeSamplePV,
  makeSamplePVC,
  makeSampleStorageClass,
  makeSampleMetrics,
  sampleCSIDriver,
} from '../test-helpers';
import OverviewPage from './OverviewPage';

function mockContext(overrides?: Parameters<typeof defaultContext>[0]) {
  vi.mocked(useTnsCsiContext).mockReturnValue(defaultContext(overrides));
}

describe('OverviewPage', () => {
  beforeEach(() => {
    vi.mocked(fetchControllerMetrics).mockReset();
  });

  it('shows loader when loading', () => {
    mockContext({ loading: true });
    render(<OverviewPage />);
    expect(screen.getByTestId('loader')).toHaveTextContent('Loading TNS-CSI data...');
  });

  it('shows "Driver Not Detected" when driver not installed', () => {
    mockContext({ driverInstalled: false });
    render(<OverviewPage />);
    expect(screen.getByText('Driver Not Detected')).toBeInTheDocument();
    expect(screen.getByText(/CSIDriver tns.csi.io not found/)).toBeInTheDocument();
  });

  it('shows error section when error is present', () => {
    mockContext({ error: 'cluster unavailable' });
    render(<OverviewPage />);
    expect(screen.getByText('cluster unavailable')).toBeInTheDocument();
  });

  it('always shows the development status notice', () => {
    mockContext({ driverInstalled: true });
    render(<OverviewPage />);
    expect(screen.getByText(/active early development/)).toBeInTheDocument();
  });

  it('renders storage summary with SC/PV counts', () => {
    const sc = makeSampleStorageClass();
    const pv = makeSamplePV();
    const pvc = makeSamplePVC();
    mockContext({
      driverInstalled: true,
      csiDriver: sampleCSIDriver,
      storageClasses: [sc],
      persistentVolumes: [pv],
      persistentVolumeClaims: [pvc],
      controllerPods: [makeSamplePod()],
      nodePods: [makeSamplePod({ name: 'node-1' })],
    });
    render(<OverviewPage />);
    expect(screen.getByText('Storage Summary')).toBeInTheDocument();
    expect(screen.getByText('Storage Classes')).toBeInTheDocument();
    expect(screen.getByText('Persistent Volumes')).toBeInTheDocument();
  });

  it('renders capacity aggregation from PVs', () => {
    const pv1 = makeSamplePV({
      metadata: { name: 'pv-1' },
      spec: { ...makeSamplePV().spec, capacity: { storage: '100Gi' } },
    });
    const pv2 = makeSamplePV({
      metadata: { name: 'pv-2' },
      spec: { ...makeSamplePV().spec, capacity: { storage: '50Gi' } },
    });
    mockContext({
      driverInstalled: true,
      csiDriver: sampleCSIDriver,
      storageClasses: [makeSampleStorageClass()],
      persistentVolumes: [pv1, pv2],
      persistentVolumeClaims: [],
      controllerPods: [makeSamplePod()],
      nodePods: [makeSamplePod({ name: 'node-1' })],
    });
    render(<OverviewPage />);
    // 150 GiB total
    expect(screen.getByText('150.0 GiB')).toBeInTheDocument();
  });

  it('renders protocol distribution bar', () => {
    const sc1 = makeSampleStorageClass({ parameters: { protocol: 'nfs' } });
    const sc2 = makeSampleStorageClass({
      metadata: { name: 'tns-nvmeof' },
      parameters: { protocol: 'nvmeof' },
    });
    mockContext({
      driverInstalled: true,
      csiDriver: sampleCSIDriver,
      storageClasses: [sc1, sc2],
      persistentVolumes: [],
      persistentVolumeClaims: [],
      controllerPods: [makeSamplePod()],
      nodePods: [makeSamplePod({ name: 'node-1' })],
    });
    render(<OverviewPage />);
    expect(screen.getByText('Protocol Distribution')).toBeInTheDocument();
    expect(screen.getByTestId('percentage-bar')).toBeInTheDocument();
  });

  it('renders pool capacity table when poolStats are present', () => {
    mockContext({
      driverInstalled: true,
      csiDriver: sampleCSIDriver,
      storageClasses: [],
      persistentVolumes: [],
      persistentVolumeClaims: [],
      controllerPods: [makeSamplePod()],
      nodePods: [makeSamplePod({ name: 'node-1' })],
      poolStats: [
        { name: 'tank', status: 'ONLINE', size: 1e12, allocated: 5e11, free: 5e11 },
      ],
    });
    render(<OverviewPage />);
    expect(screen.getByText('Pool Capacity')).toBeInTheDocument();
    expect(screen.getByText('tank')).toBeInTheDocument();
    expect(screen.getByText('ONLINE')).toBeInTheDocument();
  });

  it('shows pool stats error hint', () => {
    mockContext({
      driverInstalled: true,
      csiDriver: sampleCSIDriver,
      storageClasses: [],
      persistentVolumes: [],
      persistentVolumeClaims: [],
      controllerPods: [makeSamplePod()],
      nodePods: [makeSamplePod({ name: 'node-1' })],
      poolStatsError: 'API key invalid',
    });
    render(<OverviewPage />);
    expect(screen.getByText('Pool Capacity Unavailable')).toBeInTheDocument();
    expect(screen.getByText('API key invalid')).toBeInTheDocument();
    expect(screen.getByText(/TrueNAS API key/)).toBeInTheDocument();
  });

  it('shows Prometheus fallback capacity by pool when no poolStats and metrics available', async () => {
    const pod = makeSamplePod();
    const pv = makeSamplePV();
    const metrics = makeSampleMetrics({
      volumeCapacityBytes: [
        { labels: { volume_id: 'tank/vol-001' }, value: 107374182400 },
      ],
    });
    mockContext({
      driverInstalled: true,
      csiDriver: sampleCSIDriver,
      storageClasses: [makeSampleStorageClass()],
      persistentVolumes: [pv],
      persistentVolumeClaims: [],
      controllerPods: [pod],
      nodePods: [makeSamplePod({ name: 'node-1' })],
      poolStats: [],
      poolStatsError: null,
    });
    vi.mocked(fetchControllerMetrics).mockResolvedValueOnce(metrics);
    render(<OverviewPage />);
    await waitFor(() => {
      expect(screen.getByText('Provisioned Capacity by Pool')).toBeInTheDocument();
    });
  });

  it('renders non-bound PVCs table', () => {
    const pendingPvc = makeSamplePVC({
      metadata: { name: 'pending-pvc', namespace: 'test', creationTimestamp: '2025-01-01T00:00:00Z' },
      status: { phase: 'Pending' },
    });
    mockContext({
      driverInstalled: true,
      csiDriver: sampleCSIDriver,
      storageClasses: [],
      persistentVolumes: [],
      persistentVolumeClaims: [pendingPvc],
      controllerPods: [makeSamplePod()],
      nodePods: [makeSamplePod({ name: 'node-1' })],
    });
    render(<OverviewPage />);
    expect(screen.getByText('Attention: Non-Bound PVCs')).toBeInTheDocument();
    expect(screen.getByText('pending-pvc')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('does not show non-bound PVCs section when all PVCs are bound', () => {
    const pvc = makeSamplePVC({ status: { phase: 'Bound' } });
    mockContext({
      driverInstalled: true,
      csiDriver: sampleCSIDriver,
      storageClasses: [],
      persistentVolumes: [],
      persistentVolumeClaims: [pvc],
      controllerPods: [makeSamplePod()],
      nodePods: [makeSamplePod({ name: 'node-1' })],
    });
    render(<OverviewPage />);
    expect(screen.queryByText('Attention: Non-Bound PVCs')).not.toBeInTheDocument();
  });

  it('refresh button calls context.refresh()', () => {
    const refreshFn = vi.fn();
    mockContext({
      driverInstalled: true,
      csiDriver: sampleCSIDriver,
      storageClasses: [],
      persistentVolumes: [],
      persistentVolumeClaims: [],
      controllerPods: [],
      nodePods: [],
      refresh: refreshFn,
    });
    render(<OverviewPage />);
    fireEvent.click(screen.getByLabelText('Refresh tns-csi data'));
    expect(refreshFn).toHaveBeenCalledTimes(1);
  });

  it('shows metrics unavailable when fetchControllerMetrics fails', async () => {
    const pod = makeSamplePod();
    mockContext({
      driverInstalled: true,
      csiDriver: sampleCSIDriver,
      storageClasses: [],
      persistentVolumes: [],
      persistentVolumeClaims: [],
      controllerPods: [pod],
      nodePods: [makeSamplePod({ name: 'node-1' })],
    });
    vi.mocked(fetchControllerMetrics).mockRejectedValueOnce(new Error('timeout'));
    render(<OverviewPage />);
    await waitFor(() => {
      expect(screen.getByText('Metrics Unavailable')).toBeInTheDocument();
    });
    expect(screen.getByText('timeout')).toBeInTheDocument();
  });

  it('shows PVC status breakdown with Pending and Lost counts', () => {
    const boundPvc = makeSamplePVC({ metadata: { name: 'pvc-1', namespace: 'ns' }, status: { phase: 'Bound' } });
    const pendingPvc = makeSamplePVC({ metadata: { name: 'pvc-2', namespace: 'ns' }, status: { phase: 'Pending' } });
    const lostPvc = makeSamplePVC({ metadata: { name: 'pvc-3', namespace: 'ns' }, status: { phase: 'Lost' } });
    mockContext({
      driverInstalled: true,
      csiDriver: sampleCSIDriver,
      storageClasses: [],
      persistentVolumes: [],
      persistentVolumeClaims: [boundPvc, pendingPvc, lostPvc],
      controllerPods: [makeSamplePod()],
      nodePods: [makeSamplePod({ name: 'node-1' })],
    });
    render(<OverviewPage />);
    expect(screen.getByText('PVCs (Pending)')).toBeInTheDocument();
    expect(screen.getByText('PVCs (Lost)')).toBeInTheDocument();
  });
});

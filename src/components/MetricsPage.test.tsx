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
import { defaultContext, makeSamplePod, makeSampleMetrics } from '../test-helpers';
import MetricsPage from './MetricsPage';

function mockContext(overrides?: Parameters<typeof defaultContext>[0]) {
  vi.mocked(useTnsCsiContext).mockReturnValue(defaultContext(overrides));
}

describe('MetricsPage', () => {
  beforeEach(() => {
    vi.mocked(fetchControllerMetrics).mockReset();
  });

  it('shows loader when context is loading', () => {
    mockContext({ loading: true });
    render(<MetricsPage />);
    expect(screen.getByTestId('loader')).toHaveTextContent('Loading tns-csi data...');
  });

  it('shows "Driver Not Detected" when driver not installed', () => {
    mockContext({ driverInstalled: false });
    render(<MetricsPage />);
    expect(screen.getByText('Driver Not Detected')).toBeInTheDocument();
    expect(screen.getByText(/TNS-CSI driver not found/)).toBeInTheDocument();
  });

  it('shows "No controller pod found" when driver installed but no pods', () => {
    mockContext({ driverInstalled: true, controllerPods: [] });
    render(<MetricsPage />);
    expect(screen.getByText('Metrics Unavailable')).toBeInTheDocument();
    expect(screen.getByText(/No controller pod found/)).toBeInTheDocument();
  });

  it('shows metrics error when fetch fails', async () => {
    const pod = makeSamplePod();
    mockContext({ driverInstalled: true, controllerPods: [pod] });
    vi.mocked(fetchControllerMetrics).mockRejectedValueOnce(new Error('connection refused'));
    render(<MetricsPage />);
    await waitFor(() => {
      expect(screen.getByText('connection refused')).toBeInTheDocument();
    });
  });

  it('renders three metric cards when fetch succeeds', async () => {
    const pod = makeSamplePod();
    const metrics = makeSampleMetrics();
    mockContext({ driverInstalled: true, controllerPods: [pod] });
    vi.mocked(fetchControllerMetrics).mockResolvedValueOnce(metrics);
    render(<MetricsPage />);
    await waitFor(() => {
      expect(screen.getByText('WebSocket Health')).toBeInTheDocument();
    });
    expect(screen.getByText('Volume Operations')).toBeInTheDocument();
    expect(screen.getByText('CSI Operations')).toBeInTheDocument();
  });

  it('displays correct WebSocket metric data', async () => {
    const pod = makeSamplePod();
    const metrics = makeSampleMetrics({
      websocketConnected: 1,
      websocketReconnectsTotal: 42,
      websocketMessagesTotal: [{ labels: {}, value: 250 }],
      // Zero out other metrics to avoid number collisions
      volumeOperationsTotal: [],
      volumeCapacityBytes: [],
      csiOperationsTotal: [],
    });
    mockContext({ driverInstalled: true, controllerPods: [pod] });
    vi.mocked(fetchControllerMetrics).mockResolvedValueOnce(metrics);
    render(<MetricsPage />);
    await waitFor(() => {
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });
    expect(screen.getByText('42')).toBeInTheDocument(); // reconnects
    expect(screen.getByText('250')).toBeInTheDocument(); // messages
  });

  it('displays CSI operations broken down by method', async () => {
    const pod = makeSamplePod();
    const metrics = makeSampleMetrics({
      csiOperationsTotal: [
        { labels: { method: 'CreateVolume' }, value: 77 },
        { labels: { method: 'DeleteVolume' }, value: 13 },
      ],
      // Zero out other metrics to avoid number collisions
      volumeOperationsTotal: [],
      volumeCapacityBytes: [],
      websocketMessagesTotal: [],
    });
    mockContext({ driverInstalled: true, controllerPods: [pod] });
    vi.mocked(fetchControllerMetrics).mockResolvedValueOnce(metrics);
    render(<MetricsPage />);
    await waitFor(() => {
      expect(screen.getByText('CreateVolume')).toBeInTheDocument();
    });
    expect(screen.getByText('77')).toBeInTheDocument();
    expect(screen.getByText('DeleteVolume')).toBeInTheDocument();
    expect(screen.getByText('13')).toBeInTheDocument();
  });

  it('refresh button triggers refetch', async () => {
    const pod = makeSamplePod();
    const metrics = makeSampleMetrics();
    mockContext({ driverInstalled: true, controllerPods: [pod] });
    vi.mocked(fetchControllerMetrics).mockResolvedValue(metrics);
    render(<MetricsPage />);
    await waitFor(() => {
      expect(screen.getByText('WebSocket Health')).toBeInTheDocument();
    });
    const initialCallCount = vi.mocked(fetchControllerMetrics).mock.calls.length;
    fireEvent.click(screen.getByLabelText('Refresh metrics'));
    await waitFor(() => {
      expect(vi.mocked(fetchControllerMetrics).mock.calls.length).toBeGreaterThan(initialCallCount);
    });
  });

  it('shows "Updated" timestamp after successful fetch', async () => {
    const pod = makeSamplePod();
    const metrics = makeSampleMetrics();
    mockContext({ driverInstalled: true, controllerPods: [pod] });
    vi.mocked(fetchControllerMetrics).mockResolvedValueOnce(metrics);
    render(<MetricsPage />);
    await waitFor(() => {
      expect(screen.getByText(/Updated:/)).toBeInTheDocument();
    });
  });

  it('shows volume operations grouped by protocol', async () => {
    const pod = makeSamplePod();
    const metrics = makeSampleMetrics({
      volumeOperationsTotal: [
        { labels: { protocol: 'nfs' }, value: 15 },
        { labels: { protocol: 'iscsi' }, value: 8 },
      ],
    });
    mockContext({ driverInstalled: true, controllerPods: [pod] });
    vi.mocked(fetchControllerMetrics).mockResolvedValueOnce(metrics);
    render(<MetricsPage />);
    await waitFor(() => {
      expect(screen.getByText('Operations (nfs)')).toBeInTheDocument();
    });
    expect(screen.getByText('Operations (iscsi)')).toBeInTheDocument();
  });
});

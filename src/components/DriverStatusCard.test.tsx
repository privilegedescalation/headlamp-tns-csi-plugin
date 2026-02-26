import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@kinvolk/headlamp-plugin/lib/CommonComponents', () =>
  require('./__mocks__/commonComponents.ts')
);

import DriverStatusCard from './DriverStatusCard';
import { makeSamplePod, sampleCSIDriver, makeSampleMetrics } from '../test-helpers';

describe('DriverStatusCard', () => {
  it('shows "Not detected" when no CSI driver is present', () => {
    render(
      <DriverStatusCard
        csiDriver={null}
        controllerPods={[]}
        nodePods={[]}
      />
    );
    expect(screen.getByText('Not detected')).toBeInTheDocument();
  });

  it('shows "Degraded" when no pods are present', () => {
    render(
      <DriverStatusCard
        csiDriver={sampleCSIDriver}
        controllerPods={[]}
        nodePods={[]}
      />
    );
    expect(screen.getByText('Degraded')).toBeInTheDocument();
  });

  it('shows "Metrics unavailable" when no metrics provided', () => {
    render(
      <DriverStatusCard
        csiDriver={sampleCSIDriver}
        controllerPods={[makeSamplePod()]}
        nodePods={[makeSamplePod({ name: 'tns-csi-node-abc' })]}
      />
    );
    expect(screen.getByText('Metrics unavailable')).toBeInTheDocument();
  });

  it('shows "Healthy" and "Connected" when all pods ready and WS connected', () => {
    const metrics = makeSampleMetrics({ websocketConnected: 1 });
    render(
      <DriverStatusCard
        csiDriver={sampleCSIDriver}
        controllerPods={[makeSamplePod()]}
        nodePods={[makeSamplePod({ name: 'tns-csi-node-abc' })]}
        metrics={metrics}
      />
    );
    expect(screen.getByText('Healthy')).toBeInTheDocument();
    expect(screen.getByText('Connected')).toBeInTheDocument();
    expect(screen.getByText('tns.csi.io installed')).toBeInTheDocument();
  });

  it('shows "Disconnected" when WS is disconnected', () => {
    const metrics = makeSampleMetrics({ websocketConnected: 0 });
    render(
      <DriverStatusCard
        csiDriver={sampleCSIDriver}
        controllerPods={[makeSamplePod()]}
        nodePods={[makeSamplePod({ name: 'tns-csi-node-abc' })]}
        metrics={metrics}
      />
    );
    expect(screen.getByText('Disconnected')).toBeInTheDocument();
  });

  it('shows "Unknown" when websocketConnected is null', () => {
    const metrics = makeSampleMetrics({ websocketConnected: null });
    render(
      <DriverStatusCard
        csiDriver={sampleCSIDriver}
        controllerPods={[makeSamplePod()]}
        nodePods={[makeSamplePod({ name: 'tns-csi-node-abc' })]}
        metrics={metrics}
      />
    );
    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });

  it('renders CSI capabilities section when driver is present', () => {
    render(
      <DriverStatusCard
        csiDriver={sampleCSIDriver}
        controllerPods={[]}
        nodePods={[]}
      />
    );
    expect(screen.getByText('CSI Driver Capabilities')).toBeInTheDocument();
    expect(screen.getByText('false')).toBeInTheDocument(); // attachRequired
    expect(screen.getByText('true')).toBeInTheDocument();  // podInfoOnMount
    expect(screen.getByText('Persistent')).toBeInTheDocument();
  });

  it('does not render CSI capabilities when no driver', () => {
    render(
      <DriverStatusCard
        csiDriver={null}
        controllerPods={[]}
        nodePods={[]}
      />
    );
    expect(screen.queryByText('CSI Driver Capabilities')).not.toBeInTheDocument();
  });

  it('renders pod rows with image, restarts, and ready status', () => {
    const pod = makeSamplePod({
      metadata: { name: 'ctrl-pod-1', creationTimestamp: '2025-01-01T00:00:00Z' },
      status: {
        phase: 'Running',
        conditions: [{ type: 'Ready', status: 'True' }],
        containerStatuses: [
          { name: 'tns-csi', ready: true, restartCount: 2, image: 'fenio/tns-csi:v0.6.0' },
        ],
      },
    });
    render(
      <DriverStatusCard
        csiDriver={sampleCSIDriver}
        controllerPods={[pod]}
        nodePods={[]}
      />
    );
    expect(screen.getByText('ctrl-pod-1')).toBeInTheDocument();
    expect(screen.getByText('fenio/tns-csi:v0.6.0')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument(); // restarts
    expect(screen.getByText('Running')).toBeInTheDocument();
  });

  it('shows "No controller pod found" when controllerPods is empty', () => {
    render(
      <DriverStatusCard
        csiDriver={sampleCSIDriver}
        controllerPods={[]}
        nodePods={[makeSamplePod({ name: 'node-1' })]}
      />
    );
    expect(screen.getByText('No controller pod found')).toBeInTheDocument();
  });

  it('shows "No node pods found" when nodePods is empty', () => {
    render(
      <DriverStatusCard
        csiDriver={sampleCSIDriver}
        controllerPods={[makeSamplePod()]}
        nodePods={[]}
      />
    );
    expect(screen.getByText('No node pods found')).toBeInTheDocument();
  });

  it('shows WS reconnects when available in metrics', () => {
    const metrics = makeSampleMetrics({ websocketReconnectsTotal: 7 });
    render(
      <DriverStatusCard
        csiDriver={sampleCSIDriver}
        controllerPods={[makeSamplePod()]}
        nodePods={[makeSamplePod({ name: 'node-1' })]}
        metrics={metrics}
      />
    );
    expect(screen.getByText('WS Reconnects')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('shows node pods count in section title', () => {
    const node1 = makeSamplePod({ name: 'tns-csi-node-1' });
    const node2 = makeSamplePod({ name: 'tns-csi-node-2' });
    render(
      <DriverStatusCard
        csiDriver={sampleCSIDriver}
        controllerPods={[makeSamplePod()]}
        nodePods={[node1, node2]}
      />
    );
    expect(screen.getByText('Node Pods (2)')).toBeInTheDocument();
  });
});

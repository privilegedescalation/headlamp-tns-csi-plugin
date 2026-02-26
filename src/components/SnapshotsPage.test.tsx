import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@kinvolk/headlamp-plugin/lib/CommonComponents', () =>
  require('./__mocks__/commonComponents.ts')
);

vi.mock('../api/TnsCsiDataContext');

import { useTnsCsiContext } from '../api/TnsCsiDataContext';
import { defaultContext, makeSampleSnapshot, makeSampleSnapshotClass } from '../test-helpers';
import SnapshotsPage from './SnapshotsPage';

function mockContext(overrides?: Parameters<typeof defaultContext>[0]) {
  vi.mocked(useTnsCsiContext).mockReturnValue(defaultContext(overrides));
}

describe('SnapshotsPage', () => {
  it('shows loader when loading', () => {
    mockContext({ loading: true });
    render(<SnapshotsPage />);
    expect(screen.getByTestId('loader')).toHaveTextContent('Loading snapshots...');
  });

  it('shows error state', () => {
    mockContext({ error: 'something broke' });
    render(<SnapshotsPage />);
    expect(screen.getByText('something broke')).toBeInTheDocument();
    expect(screen.getByText('Error')).toBeInTheDocument();
  });

  it('shows notice when snapshot CRD is not available', () => {
    mockContext({ snapshotCrdAvailable: false });
    render(<SnapshotsPage />);
    expect(screen.getByText('Volume Snapshot CRDs Not Installed')).toBeInTheDocument();
    expect(
      screen.getByText(/VolumeSnapshot CRDs.*not found/)
    ).toBeInTheDocument();
  });

  it('shows empty message when snapshots list is empty', () => {
    mockContext({ snapshotCrdAvailable: true, volumeSnapshots: [] });
    render(<SnapshotsPage />);
    expect(screen.getByText('No tns-csi VolumeSnapshots found.')).toBeInTheDocument();
  });

  it('renders snapshot classes when available', () => {
    const vsc = makeSampleSnapshotClass();
    mockContext({
      snapshotCrdAvailable: true,
      volumeSnapshotClasses: [vsc],
      volumeSnapshots: [],
    });
    render(<SnapshotsPage />);
    expect(screen.getByText('Snapshot Classes (1)')).toBeInTheDocument();
    expect(screen.getByText('tns-snap-class')).toBeInTheDocument();
    expect(screen.getByText('tns.csi.io')).toBeInTheDocument();
  });

  it('renders populated snapshots with readyToUse=true', () => {
    const snap = makeSampleSnapshot();
    mockContext({
      snapshotCrdAvailable: true,
      volumeSnapshots: [snap],
    });
    render(<SnapshotsPage />);
    expect(screen.getByText('snap-001')).toBeInTheDocument();
    expect(screen.getByText('my-pvc')).toBeInTheDocument();
    expect(screen.getByText('Yes')).toBeInTheDocument();
    expect(screen.getByText('100Gi')).toBeInTheDocument();
  });

  it('renders snapshot with readyToUse=false', () => {
    const snap = makeSampleSnapshot({
      status: { readyToUse: false, restoreSize: '50Gi' },
    });
    mockContext({
      snapshotCrdAvailable: true,
      volumeSnapshots: [snap],
    });
    render(<SnapshotsPage />);
    expect(screen.getByText('No')).toBeInTheDocument();
  });

  it('renders snapshot with readyToUse=undefined as Unknown', () => {
    const snap = makeSampleSnapshot({
      status: { readyToUse: undefined },
    });
    mockContext({
      snapshotCrdAvailable: true,
      volumeSnapshots: [snap],
    });
    render(<SnapshotsPage />);
    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });

  it('does not render snapshot classes section when empty', () => {
    mockContext({
      snapshotCrdAvailable: true,
      volumeSnapshotClasses: [],
      volumeSnapshots: [makeSampleSnapshot()],
    });
    render(<SnapshotsPage />);
    expect(screen.queryByText(/Snapshot Classes/)).not.toBeInTheDocument();
  });
});

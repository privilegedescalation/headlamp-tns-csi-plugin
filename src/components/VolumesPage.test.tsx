import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@kinvolk/headlamp-plugin/lib/CommonComponents', () =>
  require('./__mocks__/commonComponents.ts')
);

let mockHash = '';
const mockPush = vi.fn();
vi.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: '/tns-csi/volumes', hash: mockHash }),
  useHistory: () => ({ push: mockPush }),
}));

vi.mock('../api/TnsCsiDataContext');

import { useTnsCsiContext } from '../api/TnsCsiDataContext';
import { defaultContext, makeSamplePV } from '../test-helpers';
import VolumesPage from './VolumesPage';

function mockContext(overrides?: Parameters<typeof defaultContext>[0]) {
  vi.mocked(useTnsCsiContext).mockReturnValue(defaultContext(overrides));
}

describe('VolumesPage', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockHash = '';
  });

  it('shows loader when loading', () => {
    mockContext({ loading: true });
    render(<VolumesPage />);
    expect(screen.getByTestId('loader')).toHaveTextContent('Loading volumes...');
  });

  it('shows error state', () => {
    mockContext({ error: 'api error' });
    render(<VolumesPage />);
    expect(screen.getByText('api error')).toBeInTheDocument();
  });

  it('shows empty message when no PVs', () => {
    mockContext({ persistentVolumes: [] });
    render(<VolumesPage />);
    expect(screen.getByText('No tns-csi PersistentVolumes found.')).toBeInTheDocument();
  });

  it('renders PV table with claim ref', () => {
    const pv = makeSamplePV();
    mockContext({ persistentVolumes: [pv] });
    render(<VolumesPage />);
    expect(screen.getByText('pv-test-001')).toBeInTheDocument();
    expect(screen.getByText('default/my-pvc')).toBeInTheDocument();
    expect(screen.getByText('NFS')).toBeInTheDocument();
    expect(screen.getByText('100Gi')).toBeInTheDocument();
    expect(screen.getByText('RWO')).toBeInTheDocument();
    expect(screen.getByText('Bound')).toBeInTheDocument();
  });

  it('renders "—" for PV without claimRef', () => {
    const pv = makeSamplePV({
      spec: {
        ...makeSamplePV().spec,
        claimRef: undefined,
      },
    });
    mockContext({ persistentVolumes: [pv] });
    render(<VolumesPage />);
    const cells = screen.getAllByRole('cell');
    const dashCells = cells.filter(c => c.textContent === '—');
    expect(dashCells.length).toBeGreaterThanOrEqual(1);
  });

  it('opens detail panel when clicking PV name', () => {
    const pv = makeSamplePV();
    mockContext({ persistentVolumes: [pv] });
    render(<VolumesPage />);
    fireEvent.click(screen.getByText('pv-test-001'));
    expect(mockPush).toHaveBeenCalledWith('/tns-csi/volumes#pv-test-001');
  });

  it('renders detail panel with CSI attributes', () => {
    mockHash = '#pv-test-001';
    const pv = makeSamplePV();
    mockContext({ persistentVolumes: [pv], persistentVolumeClaims: [] });
    render(<VolumesPage />);
    expect(screen.getByText('Volume Details')).toBeInTheDocument();
    expect(screen.getByText('CSI Attributes')).toBeInTheDocument();
    expect(screen.getByText('tank/vol-001')).toBeInTheDocument();
  });

  it('shows Bound PVC section in detail panel when claimRef exists', () => {
    mockHash = '#pv-test-001';
    const pv = makeSamplePV();
    mockContext({ persistentVolumes: [pv] });
    render(<VolumesPage />);
    expect(screen.getByText('Bound PVC')).toBeInTheDocument();
    expect(screen.getByText('my-pvc')).toBeInTheDocument();
  });

  it('shows Adoption section when annotation is present', () => {
    mockHash = '#pv-adoptable';
    const pv = makeSamplePV({
      metadata: {
        name: 'pv-adoptable',
        annotations: { 'tns-csi.io/adoptable': 'true' },
      },
    });
    mockContext({ persistentVolumes: [pv] });
    render(<VolumesPage />);
    expect(screen.getByText('Adoption')).toBeInTheDocument();
    expect(screen.getByText(/adopted cross-cluster/)).toBeInTheDocument();
  });

  it('closes panel on Escape key', () => {
    mockHash = '#pv-test-001';
    const pv = makeSamplePV();
    mockContext({ persistentVolumes: [pv] });
    render(<VolumesPage />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(mockPush).toHaveBeenCalledWith('/tns-csi/volumes');
  });

  it('closes panel via backdrop click', () => {
    mockHash = '#pv-test-001';
    const pv = makeSamplePV();
    mockContext({ persistentVolumes: [pv] });
    render(<VolumesPage />);
    fireEvent.click(screen.getByLabelText('Close panel backdrop'));
    expect(mockPush).toHaveBeenCalledWith('/tns-csi/volumes');
  });

  it('renders maximize/minimize button in panel', () => {
    mockHash = '#pv-test-001';
    const pv = makeSamplePV();
    mockContext({ persistentVolumes: [pv] });
    render(<VolumesPage />);
    const maxBtn = screen.getByLabelText('Maximize');
    expect(maxBtn).toBeInTheDocument();
    fireEvent.click(maxBtn);
    expect(screen.getByLabelText('Minimize')).toBeInTheDocument();
  });
});

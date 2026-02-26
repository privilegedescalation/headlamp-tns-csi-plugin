import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@kinvolk/headlamp-plugin/lib/CommonComponents', () =>
  require('./__mocks__/commonComponents.ts')
);

let mockHash = '';
const mockPush = vi.fn();
vi.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: '/tns-csi/storage-classes', hash: mockHash }),
  useHistory: () => ({ push: mockPush }),
}));

vi.mock('../api/TnsCsiDataContext');

import { useTnsCsiContext } from '../api/TnsCsiDataContext';
import { defaultContext, makeSampleStorageClass, makeSamplePV } from '../test-helpers';
import StorageClassesPage from './StorageClassesPage';

function mockContext(overrides?: Parameters<typeof defaultContext>[0]) {
  vi.mocked(useTnsCsiContext).mockReturnValue(defaultContext(overrides));
}

describe('StorageClassesPage', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockHash = '';
  });

  it('shows loader when loading', () => {
    mockContext({ loading: true });
    render(<StorageClassesPage />);
    expect(screen.getByTestId('loader')).toHaveTextContent('Loading storage classes...');
  });

  it('shows error state', () => {
    mockContext({ error: 'fetch failed' });
    render(<StorageClassesPage />);
    expect(screen.getByText('fetch failed')).toBeInTheDocument();
    expect(screen.getByText('Error')).toBeInTheDocument();
  });

  it('shows empty message when no storage classes', () => {
    mockContext({ storageClasses: [] });
    render(<StorageClassesPage />);
    expect(screen.getByText('No tns-csi StorageClasses found.')).toBeInTheDocument();
  });

  it('renders table with all columns populated', () => {
    const sc = makeSampleStorageClass();
    const pv = makeSamplePV();
    mockContext({
      storageClasses: [sc],
      persistentVolumes: [pv],
    });
    render(<StorageClassesPage />);
    expect(screen.getByText('tns-nfs')).toBeInTheDocument();
    expect(screen.getByText('NFS')).toBeInTheDocument();
    expect(screen.getByText('tank')).toBeInTheDocument();
    expect(screen.getByText('10.0.0.1')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
    expect(screen.getByText('Yes')).toBeInTheDocument(); // expansion
    expect(screen.getByText('1')).toBeInTheDocument(); // PV count
  });

  it('opens detail panel when clicking SC name', () => {
    const sc = makeSampleStorageClass();
    mockContext({ storageClasses: [sc] });
    render(<StorageClassesPage />);
    fireEvent.click(screen.getByText('tns-nfs'));
    expect(mockPush).toHaveBeenCalledWith('/tns-csi/storage-classes#tns-nfs');
  });

  it('renders detail panel when hash is set', () => {
    mockHash = '#tns-nfs';
    const sc = makeSampleStorageClass();
    mockContext({ storageClasses: [sc], persistentVolumes: [] });
    render(<StorageClassesPage />);
    expect(screen.getByText('StorageClass Details')).toBeInTheDocument();
  });

  it('closes panel via close button', () => {
    mockHash = '#tns-nfs';
    const sc = makeSampleStorageClass();
    mockContext({ storageClasses: [sc], persistentVolumes: [] });
    render(<StorageClassesPage />);
    fireEvent.click(screen.getByLabelText('Close panel'));
    expect(mockPush).toHaveBeenCalledWith('/tns-csi/storage-classes');
  });

  it('closes panel via backdrop click', () => {
    mockHash = '#tns-nfs';
    const sc = makeSampleStorageClass();
    mockContext({ storageClasses: [sc], persistentVolumes: [] });
    render(<StorageClassesPage />);
    fireEvent.click(screen.getByLabelText('Close panel backdrop'));
    expect(mockPush).toHaveBeenCalledWith('/tns-csi/storage-classes');
  });

  it('closes panel on Escape key', () => {
    mockHash = '#tns-nfs';
    const sc = makeSampleStorageClass();
    mockContext({ storageClasses: [sc], persistentVolumes: [] });
    render(<StorageClassesPage />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(mockPush).toHaveBeenCalledWith('/tns-csi/storage-classes');
  });

  it('shows NFS protocol notes in detail panel', () => {
    mockHash = '#tns-nfs';
    const sc = makeSampleStorageClass({ parameters: { protocol: 'nfs', pool: 'tank', server: '10.0.0.1' } });
    mockContext({ storageClasses: [sc], persistentVolumes: [] });
    render(<StorageClassesPage />);
    expect(screen.getByText('Protocol Notes')).toBeInTheDocument();
    expect(screen.getByText(/nfs-common/)).toBeInTheDocument();
  });

  it('shows NVMe-oF protocol notes', () => {
    mockHash = '#tns-nvmeof';
    const sc = makeSampleStorageClass({
      metadata: { name: 'tns-nvmeof' },
      parameters: { protocol: 'nvmeof', pool: 'tank', server: '10.0.0.1' },
    });
    mockContext({ storageClasses: [sc], persistentVolumes: [] });
    render(<StorageClassesPage />);
    expect(screen.getByText(/nvme-cli/)).toBeInTheDocument();
  });

  it('shows iSCSI protocol notes', () => {
    mockHash = '#tns-iscsi';
    const sc = makeSampleStorageClass({
      metadata: { name: 'tns-iscsi' },
      parameters: { protocol: 'iscsi', pool: 'tank', server: '10.0.0.1' },
    });
    mockContext({ storageClasses: [sc], persistentVolumes: [] });
    render(<StorageClassesPage />);
    expect(screen.getByText(/open-iscsi/)).toBeInTheDocument();
  });

  it('shows PV count for each storage class', () => {
    const sc1 = makeSampleStorageClass({ metadata: { name: 'sc-a' } });
    const sc2 = makeSampleStorageClass({ metadata: { name: 'sc-b' } });
    const pv1 = makeSamplePV({ spec: { ...makeSamplePV().spec, storageClassName: 'sc-a' } });
    const pv2 = makeSamplePV({
      metadata: { name: 'pv-2' },
      spec: { ...makeSamplePV().spec, storageClassName: 'sc-a' },
    });
    mockContext({
      storageClasses: [sc1, sc2],
      persistentVolumes: [pv1, pv2],
    });
    render(<StorageClassesPage />);
    const cells = screen.getAllByRole('cell');
    const pvCells = cells.filter(c => c.textContent === '2');
    expect(pvCells.length).toBeGreaterThanOrEqual(1);
  });
});

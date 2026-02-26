import { fireEvent, render, screen, waitFor, act } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@kinvolk/headlamp-plugin/lib', () => ({
  ApiProxy: {
    request: vi.fn().mockResolvedValue({}),
  },
  ConfigStore: class {
    get() { return {}; }
    set() {}
    update() {}
    useConfig() { return () => ({}); }
  },
}));

vi.mock('@kinvolk/headlamp-plugin/lib/CommonComponents', () =>
  require('./__mocks__/commonComponents.ts')
);

vi.mock('../api/TnsCsiDataContext');
vi.mock('../api/kbench', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/kbench')>();
  return {
    ...actual,
    createPvc: vi.fn().mockResolvedValue(undefined),
    createJob: vi.fn().mockResolvedValue(undefined),
    deleteJob: vi.fn().mockResolvedValue(undefined),
    deletePvc: vi.fn().mockResolvedValue(undefined),
    getJobPhase: vi.fn().mockResolvedValue({ phase: 'Active', job: {} }),
    fetchKbenchLogs: vi.fn().mockResolvedValue(''),
    listKbenchJobs: vi.fn().mockResolvedValue([]),
    generateJobName: vi.fn().mockReturnValue('kbench-abc123'),
    generatePvcName: vi.fn().mockReturnValue('kbench-abc123-pvc'),
  };
});

import { useTnsCsiContext } from '../api/TnsCsiDataContext';
import { ApiProxy } from '@kinvolk/headlamp-plugin/lib';
import {
  createPvc,
  createJob,
  deleteJob,
  deletePvc,
  getJobPhase,
  fetchKbenchLogs,
  listKbenchJobs,
  parseKbenchLog,
} from '../api/kbench';
import { defaultContext, makeSampleStorageClass } from '../test-helpers';
import BenchmarkPage from './BenchmarkPage';

function mockContext(overrides?: Parameters<typeof defaultContext>[0]) {
  vi.mocked(useTnsCsiContext).mockReturnValue(defaultContext(overrides));
}

describe('BenchmarkPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listKbenchJobs).mockResolvedValue([]);
  });

  it('shows loader when loading', () => {
    mockContext({ loading: true });
    render(<BenchmarkPage />);
    expect(screen.getByTestId('loader')).toHaveTextContent('Loading tns-csi data...');
  });

  it('renders benchmark guide section', () => {
    mockContext();
    render(<BenchmarkPage />);
    expect(screen.getByText('Benchmark Guide')).toBeInTheDocument();
    expect(screen.getByText(/Do not cancel mid-run/)).toBeInTheDocument();
  });

  it('renders Run New Benchmark form', () => {
    const sc = makeSampleStorageClass();
    mockContext({ storageClasses: [sc] });
    render(<BenchmarkPage />);
    expect(screen.getByText('Run New Benchmark')).toBeInTheDocument();
    expect(screen.getByLabelText('Select storage class for benchmark')).toBeInTheDocument();
  });

  it('populates SC dropdown with storage class names', () => {
    const sc1 = makeSampleStorageClass({ metadata: { name: 'sc-a' } });
    const sc2 = makeSampleStorageClass({ metadata: { name: 'sc-b' } });
    mockContext({ storageClasses: [sc1, sc2] });
    render(<BenchmarkPage />);
    const select = screen.getByLabelText('Select storage class for benchmark') as HTMLSelectElement;
    expect(select.options.length).toBe(2);
    expect(select.options[0].value).toBe('sc-a');
    expect(select.options[1].value).toBe('sc-b');
  });

  it('shows "No tns-csi storage classes found" when empty', () => {
    mockContext({ storageClasses: [] });
    render(<BenchmarkPage />);
    const select = screen.getByLabelText('Select storage class for benchmark') as HTMLSelectElement;
    expect(select.options[0].text).toContain('No tns-csi storage classes');
  });

  it('shows confirmation dialog when Run Benchmark is clicked', () => {
    const sc = makeSampleStorageClass();
    mockContext({ storageClasses: [sc] });
    render(<BenchmarkPage />);
    fireEvent.click(screen.getByLabelText('Start kbench storage benchmark'));
    expect(screen.getByText('Confirm Benchmark')).toBeInTheDocument();
    expect(screen.getByText(/~33Gi PVC/)).toBeInTheDocument();
  });

  it('cancels confirmation dialog', () => {
    const sc = makeSampleStorageClass();
    mockContext({ storageClasses: [sc] });
    render(<BenchmarkPage />);
    fireEvent.click(screen.getByLabelText('Start kbench storage benchmark'));
    fireEvent.click(screen.getByLabelText('Cancel benchmark'));
    expect(screen.queryByText('Confirm Benchmark')).not.toBeInTheDocument();
  });

  it('starts benchmark on confirmation and calls createPvc', async () => {
    vi.useFakeTimers();
    const sc = makeSampleStorageClass();
    mockContext({ storageClasses: [sc] });

    // PVC bind check
    vi.mocked(ApiProxy.request).mockResolvedValue({ status: { phase: 'Bound' } });

    render(<BenchmarkPage />);
    fireEvent.click(screen.getByLabelText('Start kbench storage benchmark'));
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Confirm and start benchmark'));
    });

    expect(vi.mocked(createPvc)).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('shows failed state when PVC creation fails', async () => {
    const sc = makeSampleStorageClass();
    mockContext({ storageClasses: [sc] });
    vi.mocked(createPvc).mockRejectedValueOnce(new Error('quota exceeded'));

    render(<BenchmarkPage />);
    fireEvent.click(screen.getByLabelText('Start kbench storage benchmark'));
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Confirm and start benchmark'));
    });

    await waitFor(() => {
      expect(screen.getByText(/quota exceeded/)).toBeInTheDocument();
    });
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });

  it('renders past benchmarks section', async () => {
    mockContext();
    vi.mocked(listKbenchJobs).mockResolvedValueOnce([]);
    render(<BenchmarkPage />);
    await waitFor(() => {
      expect(screen.getByText('Past Benchmarks')).toBeInTheDocument();
    });
    expect(screen.getByText('No past benchmark jobs found.')).toBeInTheDocument();
  });

  it('renders past benchmark jobs in table', async () => {
    mockContext();
    vi.mocked(listKbenchJobs).mockResolvedValueOnce([
      {
        jobName: 'kbench-old',
        namespace: 'default',
        storageClass: 'tns-nfs',
        phase: 'Complete',
        startedAt: '2025-01-01T00:00:00Z',
      },
    ]);
    render(<BenchmarkPage />);
    await waitFor(() => {
      expect(screen.getByText('kbench-old')).toBeInTheDocument();
    });
    expect(screen.getByText('Complete')).toBeInTheDocument();
  });

  it('disables Run Benchmark button when no storage classes', () => {
    mockContext({ storageClasses: [] });
    render(<BenchmarkPage />);
    const btn = screen.getByLabelText('Start kbench storage benchmark');
    expect(btn).toBeDisabled();
  });

  it('shows confirmation dialog with selected SC and namespace', () => {
    const sc = makeSampleStorageClass();
    mockContext({ storageClasses: [sc] });
    render(<BenchmarkPage />);

    // Change namespace
    const nsInput = screen.getByLabelText('Kubernetes namespace for benchmark job') as HTMLInputElement;
    fireEvent.change(nsInput, { target: { value: 'bench-ns' } });

    fireEvent.click(screen.getByLabelText('Start kbench storage benchmark'));
    // Confirm dialog shows SC and namespace in <strong> tags
    expect(screen.getByText('Confirm Benchmark')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm and start benchmark')).toBeInTheDocument();
    // Namespace is shown in the dialog
    const dialogText = screen.getByText(/bench-ns/);
    expect(dialogText).toBeInTheDocument();
  });

  it('can change test size and mode', () => {
    const sc = makeSampleStorageClass();
    mockContext({ storageClasses: [sc] });
    render(<BenchmarkPage />);

    const sizeInput = screen.getByLabelText('FIO test size') as HTMLInputElement;
    fireEvent.change(sizeInput, { target: { value: '10G' } });
    expect(sizeInput.value).toBe('10G');

    const modeSelect = screen.getByLabelText('Benchmark mode') as HTMLSelectElement;
    fireEvent.change(modeSelect, { target: { value: 'quick' } });
    expect(modeSelect.value).toBe('quick');
  });

  it('shows failed state when job creation fails', async () => {
    const sc = makeSampleStorageClass();
    mockContext({ storageClasses: [sc] });
    vi.mocked(createPvc).mockResolvedValueOnce(undefined);
    // PVC binds immediately
    vi.mocked(ApiProxy.request).mockResolvedValue({ status: { phase: 'Bound' } });
    vi.mocked(createJob).mockRejectedValueOnce(new Error('job already exists'));

    render(<BenchmarkPage />);
    fireEvent.click(screen.getByLabelText('Start kbench storage benchmark'));
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Confirm and start benchmark'));
    });

    await waitFor(() => {
      expect(screen.getByText(/job already exists/)).toBeInTheDocument();
    });
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });
});

/**
 * BenchmarkPage — kbench storage benchmark runner + results display.
 *
 * The only write operation in the plugin.
 * Creates PVC + Job, polls status, parses FIO log output.
 */

import { ApiProxy } from '@kinvolk/headlamp-plugin/lib';
import {
  Loader,
  NameValueTable,
  SectionBox,
  SectionHeader,
  SimpleTable,
  StatusLabel,
} from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTnsCsiContext } from '../api/TnsCsiDataContext';
import type { BenchmarkState, KbenchJobSummary, KbenchResult } from '../api/kbench';
import {
  createJob,
  createPvc,
  deleteJob,
  deletePvc,
  fetchKbenchLogs,
  formatBandwidth,
  formatIops,
  formatLatency,
  generateJobName,
  generatePvcName,
  getJobPhase,
  listKbenchJobs,
  parseKbenchLog,
} from '../api/kbench';
import { formatAge } from '../api/k8s';

// ---------------------------------------------------------------------------
// Result display components
// ---------------------------------------------------------------------------

interface MetricRowData {
  label: string;
  read: number;
  write: number | null;
  formatter: (v: number) => string;
  note?: string;
}

function ResultTable({ title, rows, higherIsBetter }: { title: string; rows: MetricRowData[]; higherIsBetter: boolean }) {
  return (
    <SectionBox title={title}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--mui-palette-divider, #e0e0e0)' }}>
            <th style={{ textAlign: 'left', padding: '8px 4px', fontWeight: 600 }}>Metric</th>
            <th style={{ textAlign: 'right', padding: '8px 4px', fontWeight: 600 }}>Read</th>
            <th style={{ textAlign: 'right', padding: '8px 4px', fontWeight: 600 }}>Write</th>
            <th style={{ textAlign: 'left', padding: '8px 4px', fontWeight: 400, color: 'var(--mui-palette-text-secondary)' }}>
              {higherIsBetter ? '↑ higher is better' : '↓ lower is better'}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.label} style={{ borderBottom: '1px solid var(--mui-palette-divider, #f0f0f0)' }}>
              <td style={{ padding: '8px 4px' }}>{row.label}</td>
              <td style={{ padding: '8px 4px', textAlign: 'right', fontFamily: 'monospace' }}>
                {row.formatter(row.read)}
              </td>
              <td style={{ padding: '8px 4px', textAlign: 'right', fontFamily: 'monospace' }}>
                {row.write !== null ? row.formatter(row.write) : '—'}
              </td>
              <td style={{ padding: '8px 4px', color: 'var(--mui-palette-text-secondary)' }}>
                {row.note ?? ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </SectionBox>
  );
}

function KbenchResultDisplay({ result }: { result: KbenchResult }) {
  const iopsRows: MetricRowData[] = [
    { label: 'Random', read: result.iops.randomRead, write: result.iops.randomWrite, formatter: formatIops },
    { label: 'Sequential', read: result.iops.sequentialRead, write: result.iops.sequentialWrite, formatter: formatIops },
    { label: 'CPU Idleness', read: result.iops.cpuIdleness, write: null, formatter: v => `${v}%`, note: result.iops.cpuIdleness < 40 ? '⚠ Low — may indicate CPU-bound results' : '' },
  ];

  const bwRows: MetricRowData[] = [
    { label: 'Random', read: result.bandwidth.randomRead, write: result.bandwidth.randomWrite, formatter: formatBandwidth },
    { label: 'Sequential', read: result.bandwidth.sequentialRead, write: result.bandwidth.sequentialWrite, formatter: formatBandwidth },
    { label: 'CPU Idleness', read: result.bandwidth.cpuIdleness, write: null, formatter: v => `${v}%` },
  ];

  const latRows: MetricRowData[] = [
    { label: 'Random', read: result.latency.randomRead, write: result.latency.randomWrite, formatter: formatLatency },
    { label: 'Sequential', read: result.latency.sequentialRead, write: result.latency.sequentialWrite, formatter: formatLatency },
    { label: 'CPU Idleness', read: result.latency.cpuIdleness, write: null, formatter: v => `${v}%`, note: result.latency.cpuIdleness < 40 ? '⚠ CPU-starved — latency results may be unreliable' : '' },
  ];

  return (
    <>
      <SectionBox title="Benchmark Metadata">
        <NameValueTable
          rows={[
            { name: 'Storage Class', value: result.metadata.storageClass || '—' },
            { name: 'Test Size', value: result.metadata.size },
            { name: 'Job', value: result.metadata.jobName || '—' },
            { name: 'Namespace', value: result.metadata.namespace || '—' },
            { name: 'Completed', value: result.metadata.completedAt ? new Date(result.metadata.completedAt).toLocaleString() : '—' },
          ]}
        />
      </SectionBox>
      <ResultTable title="IOPS (Read/Write)" rows={iopsRows} higherIsBetter={true} />
      <ResultTable title="Bandwidth" rows={bwRows} higherIsBetter={true} />
      <ResultTable title="Latency" rows={latRows} higherIsBetter={false} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Benchmark form
// ---------------------------------------------------------------------------

interface RunFormProps {
  storageClasses: string[];
  onRun: (opts: { storageClass: string; namespace: string; size: string; mode: string }) => void;
  disabled: boolean;
}

function RunForm({ storageClasses, onRun, disabled }: RunFormProps) {
  const [storageClass, setStorageClass] = useState(storageClasses[0] ?? '');
  const [namespace, setNamespace] = useState('default');
  const [size, setSize] = useState('30G');
  const [mode, setMode] = useState('full');
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (storageClasses.length > 0 && !storageClasses.includes(storageClass)) {
      setStorageClass(storageClasses[0] ?? '');
    }
  }, [storageClasses, storageClass]);

  function handleRunClick() {
    setShowConfirm(true);
  }

  function handleConfirm() {
    setShowConfirm(false);
    onRun({ storageClass, namespace, size, mode });
  }

  return (
    <SectionBox title="Run New Benchmark">
      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '12px 16px', alignItems: 'center', maxWidth: '600px' }}>
        <label htmlFor="kbench-sc" style={{ fontWeight: 500 }}>Storage Class *</label>
        <select
          id="kbench-sc"
          value={storageClass}
          onChange={e => setStorageClass(e.target.value)}
          disabled={disabled || storageClasses.length === 0}
          style={{ padding: '6px 8px', borderRadius: '4px', border: '1px solid var(--mui-palette-divider, #ccc)', fontSize: '14px', backgroundColor: 'var(--mui-palette-background-paper)', color: 'var(--mui-palette-text-primary)' }}
          aria-label="Select storage class for benchmark"
        >
          {storageClasses.length === 0 && <option value="">No tns-csi storage classes found</option>}
          {storageClasses.map(sc => <option key={sc} value={sc}>{sc}</option>)}
        </select>

        <label htmlFor="kbench-ns" style={{ fontWeight: 500 }}>Namespace</label>
        <input
          id="kbench-ns"
          type="text"
          value={namespace}
          onChange={e => setNamespace(e.target.value)}
          disabled={disabled}
          style={{ padding: '6px 8px', borderRadius: '4px', border: '1px solid var(--mui-palette-divider, #ccc)', fontSize: '14px', backgroundColor: 'var(--mui-palette-background-paper)', color: 'var(--mui-palette-text-primary)' }}
          aria-label="Kubernetes namespace for benchmark job"
        />

        <label htmlFor="kbench-size" style={{ fontWeight: 500 }}>Test Size</label>
        <div>
          <input
            id="kbench-size"
            type="text"
            value={size}
            onChange={e => setSize(e.target.value)}
            disabled={disabled}
            style={{ padding: '6px 8px', borderRadius: '4px', border: '1px solid var(--mui-palette-divider, #ccc)', fontSize: '14px', width: '120px', backgroundColor: 'var(--mui-palette-background-paper)', color: 'var(--mui-palette-text-primary)' }}
            aria-label="FIO test size"
          />
          <span style={{ marginLeft: '8px', fontSize: '12px', color: 'var(--mui-palette-text-secondary)' }}>
            PVC will be ~10% larger (33Gi for 30G)
          </span>
        </div>

        <label htmlFor="kbench-mode" style={{ fontWeight: 500 }}>Mode</label>
        <select
          id="kbench-mode"
          value={mode}
          onChange={e => setMode(e.target.value)}
          disabled={disabled}
          style={{ padding: '6px 8px', borderRadius: '4px', border: '1px solid var(--mui-palette-divider, #ccc)', fontSize: '14px', backgroundColor: 'var(--mui-palette-background-paper)', color: 'var(--mui-palette-text-primary)' }}
          aria-label="Benchmark mode"
        >
          <option value="full">Full (~6 minutes)</option>
          <option value="quick">Quick</option>
        </select>
      </div>

      <div style={{ marginTop: '20px' }}>
        <button
          onClick={handleRunClick}
          disabled={disabled || storageClasses.length === 0 || !storageClass}
          aria-label="Start kbench storage benchmark"
          style={{
            padding: '8px 20px',
            backgroundColor: disabled ? 'var(--mui-palette-action-disabled, #ccc)' : 'var(--mui-palette-primary-main, #1976d2)',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: disabled ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: 500,
          }}
        >
          Run Benchmark
        </button>
      </div>

      {showConfirm && (
        <div
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, backgroundColor: 'rgba(0,0,0,0.5)' }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="kbench-confirm-title"
        >
          <div style={{ backgroundColor: 'var(--mui-palette-background-paper, #fff)', borderRadius: '8px', padding: '24px', maxWidth: '480px', boxShadow: '0 4px 24px rgba(0,0,0,0.2)', color: 'var(--mui-palette-text-primary)' }}>
            <h3 id="kbench-confirm-title" style={{ margin: '0 0 16px' }}>Confirm Benchmark</h3>
            <p style={{ margin: '0 0 8px', fontSize: '14px' }}>
              This will create a <strong>~33Gi PVC</strong> and run an FIO benchmark (
              <strong>~6 minutes</strong>).
            </p>
            <p style={{ margin: '0 0 8px', fontSize: '14px' }}>
              Storage class: <strong>{storageClass}</strong> · Namespace: <strong>{namespace}</strong>
            </p>
            <p style={{ margin: '0 0 16px', fontSize: '14px', color: 'var(--mui-palette-text-secondary)' }}>
              The Job and PVC will remain until manually deleted. You will be prompted to clean up after completion.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowConfirm(false)}
                aria-label="Cancel benchmark"
                style={{ padding: '8px 16px', border: '1px solid var(--mui-palette-divider)', borderRadius: '4px', background: 'transparent', cursor: 'pointer', fontSize: '14px', color: 'var(--mui-palette-text-primary)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                aria-label="Confirm and start benchmark"
                style={{ padding: '8px 16px', backgroundColor: 'var(--mui-palette-primary-main, #1976d2)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}
              >
                Start Benchmark
              </button>
            </div>
          </div>
        </div>
      )}
    </SectionBox>
  );
}

// ---------------------------------------------------------------------------
// Progress display
// ---------------------------------------------------------------------------

function BenchmarkProgress({ state }: { state: BenchmarkState }) {
  if (state.status === 'idle') return null;

  const labels: Record<BenchmarkState['status'], string> = {
    idle: '',
    'creating-pvc': 'Creating PVC...',
    'waiting-pvc': 'Waiting for PVC to bind...',
    running: 'Benchmark running...',
    parsing: 'Parsing results...',
    complete: 'Complete',
    failed: 'Failed',
  };

  const statusColor: Record<BenchmarkState['status'], 'success' | 'warning' | 'error'> = {
    idle: 'warning',
    'creating-pvc': 'warning',
    'waiting-pvc': 'warning',
    running: 'warning',
    parsing: 'warning',
    complete: 'success',
    failed: 'error',
  };

  return (
    <SectionBox title="Benchmark Progress">
      <NameValueTable
        rows={[
          {
            name: 'Status',
            value: (
              <StatusLabel status={statusColor[state.status]}>
                {labels[state.status]}
              </StatusLabel>
            ),
          },
          ...('jobName' in state && state.jobName ? [{ name: 'Job', value: state.jobName }] : []),
          ...('pvcName' in state && state.pvcName ? [{ name: 'PVC', value: state.pvcName }] : []),
          ...(state.status === 'failed' ? [{ name: 'Error', value: state.error }] : []),
        ]}
      />
    </SectionBox>
  );
}

// ---------------------------------------------------------------------------
// Past benchmarks
// ---------------------------------------------------------------------------

interface PastBenchmarksProps {
  namespace: string;
}

function PastBenchmarks({ namespace }: PastBenchmarksProps) {
  const [jobs, setJobs] = useState<KbenchJobSummary[]>([]);
  const [jLoading, setJLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const loadJobs = useCallback(async () => {
    setJLoading(true);
    try {
      const result = await listKbenchJobs(namespace);
      setJobs(result);
    } catch {
      setJobs([]);
    } finally {
      setJLoading(false);
    }
  }, [namespace]);

  useEffect(() => { void loadJobs(); }, [loadJobs]);

  async function handleDelete(job: KbenchJobSummary) {
    if (!window.confirm(`Delete job "${job.jobName}" and its PVC "${job.jobName}-pvc"?`)) return;
    setDeleting(job.jobName);
    try {
      await deleteJob(job.jobName, job.namespace);
      await deletePvc(`${job.jobName}-pvc`, job.namespace);
      await loadJobs();
    } catch (err: unknown) {
      alert(`Error deleting: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setDeleting(null);
    }
  }

  if (jLoading) return <Loader title="Loading past benchmarks..." />;

  return (
    <SectionBox title="Past Benchmarks">
      <SimpleTable
        columns={[
          { label: 'Job Name', getter: (j: KbenchJobSummary) => j.jobName },
          { label: 'Namespace', getter: (j: KbenchJobSummary) => j.namespace },
          { label: 'Storage Class', getter: (j: KbenchJobSummary) => j.storageClass },
          {
            label: 'Status',
            getter: (j: KbenchJobSummary) => (
              <StatusLabel status={j.phase === 'Complete' ? 'success' : j.phase === 'Failed' ? 'error' : 'warning'}>
                {j.phase}
              </StatusLabel>
            ),
          },
          { label: 'Started', getter: (j: KbenchJobSummary) => formatAge(j.startedAt) },
          {
            label: 'Actions',
            getter: (j: KbenchJobSummary) => (
              <button
                onClick={() => void handleDelete(j)}
                disabled={deleting === j.jobName}
                aria-label={`Delete benchmark job ${j.jobName}`}
                style={{ padding: '4px 10px', border: '1px solid var(--mui-palette-error-main, #d32f2f)', color: 'var(--mui-palette-error-main, #d32f2f)', background: 'transparent', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
              >
                {deleting === j.jobName ? 'Deleting...' : 'Delete'}
              </button>
            ),
          },
        ]}
        data={jobs}
        emptyMessage="No past benchmark jobs found."
      />
    </SectionBox>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 10_000;
const MAX_PVC_WAIT_MS = 120_000;

export default function BenchmarkPage() {
  const { storageClasses, loading } = useTnsCsiContext();
  const [benchState, setBenchState] = useState<BenchmarkState>({ status: 'idle' });
  const [currentResult, setCurrentResult] = useState<KbenchResult | null>(null);
  const [lastNamespace, setLastNamespace] = useState('default');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const scNames = storageClasses.map(sc => sc.metadata.name);

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  async function runBenchmark(opts: { storageClass: string; namespace: string; size: string; mode: string }) {
    stopPolling();
    setCurrentResult(null);
    setLastNamespace(opts.namespace);

    const jobName = generateJobName();
    const pvcName = generatePvcName(jobName);
    const jobOpts = { jobName, pvcName, namespace: opts.namespace, storageClass: opts.storageClass, size: opts.size, mode: opts.mode };

    // Step 1: Create PVC
    setBenchState({ status: 'creating-pvc' });
    try {
      await createPvc(jobOpts);
    } catch (err: unknown) {
      setBenchState({ status: 'failed', error: `Failed to create PVC: ${err instanceof Error ? err.message : String(err)}`, jobName, pvcName });
      return;
    }

    // Step 2: Wait for PVC to bind
    setBenchState({ status: 'waiting-pvc', pvcName });
    const pvcDeadline = Date.now() + MAX_PVC_WAIT_MS;
    let pvcBound = false;
    while (Date.now() < pvcDeadline) {
      try {
        const pvc = await ApiProxy.request(`/api/v1/namespaces/${opts.namespace}/persistentvolumeclaims/${pvcName}`) as { status?: { phase?: string } };
        if (pvc.status?.phase === 'Bound') { pvcBound = true; break; }
      } catch { /* retry */ }
      await new Promise(r => setTimeout(r, 5000));
    }
    if (!pvcBound) {
      setBenchState({ status: 'failed', error: 'PVC did not bind within 2 minutes. Check StorageClass and provisioner.', jobName, pvcName });
      return;
    }

    // Step 3: Create Job
    try {
      await createJob(jobOpts);
    } catch (err: unknown) {
      setBenchState({ status: 'failed', error: `Failed to create Job: ${err instanceof Error ? err.message : String(err)}`, jobName, pvcName });
      return;
    }

    setBenchState({ status: 'running', jobName, pvcName, startedAt: new Date().toISOString() });

    // Step 4: Poll job status
    pollRef.current = setInterval(async () => {
      try {
        const { phase } = await getJobPhase(jobName, opts.namespace);

        if (phase === 'Complete') {
          stopPolling();
          setBenchState({ status: 'parsing', jobName, pvcName });

          try {
            const logs = await fetchKbenchLogs(jobName, opts.namespace);
            const result = parseKbenchLog(logs);
            if (result) {
              result.metadata.storageClass = opts.storageClass;
              result.metadata.size = opts.size;
              result.metadata.jobName = jobName;
              result.metadata.namespace = opts.namespace;
              result.metadata.completedAt = new Date().toISOString();
              setCurrentResult(result);
              setBenchState({ status: 'complete', result, jobName, pvcName });
            } else {
              setBenchState({ status: 'failed', error: 'Could not parse FIO output from pod logs.', jobName, pvcName });
            }
          } catch (err: unknown) {
            setBenchState({ status: 'failed', error: `Log retrieval failed: ${err instanceof Error ? err.message : String(err)}`, jobName, pvcName });
          }
        } else if (phase === 'Failed') {
          stopPolling();
          setBenchState({ status: 'failed', error: 'kbench Job failed. Check pod logs for details.', jobName, pvcName });
        }
      } catch (err: unknown) {
        stopPolling();
        setBenchState({ status: 'failed', error: `Polling error: ${err instanceof Error ? err.message : String(err)}`, jobName, pvcName });
      }
    }, POLL_INTERVAL_MS);
  }

  // Clean up polling on unmount
  useEffect(() => () => stopPolling(), []);

  const isRunning = benchState.status !== 'idle' && benchState.status !== 'complete' && benchState.status !== 'failed';

  if (loading) return <Loader title="Loading tns-csi data..." />;

  return (
    <>
      <SectionHeader title="TNS-CSI — Benchmark" />

      <SectionBox title="Benchmark Guide">
        <NameValueTable
          rows={[
            { name: 'Duration', value: 'Full benchmark takes ~6 minutes. Do not cancel mid-run.' },
            { name: 'Test Size', value: 'SIZE must be at least 10% smaller than PVC capacity (default: 30G in 33Gi PVC).' },
            { name: 'Cache Warning', value: 'For accurate results, SIZE should be at least 25× the read/write bandwidth to bypass cache.' },
            { name: 'CPU Idleness', value: 'Latency benchmark CPU Idleness should be ≥40%. Lower values indicate CPU-starved results.' },
            { name: 'Interpretation', value: 'Lower read latency than local storage is a red flag (likely caching). Better write than local is nearly impossible for distributed storage.' },
          ]}
        />
      </SectionBox>

      <RunForm storageClasses={scNames} onRun={opts => void runBenchmark(opts)} disabled={isRunning} />

      <BenchmarkProgress state={benchState} />

      {currentResult && benchState.status === 'complete' && (
        <>
          <KbenchResultDisplay result={currentResult} />
          <SectionBox title="Cleanup">
            <NameValueTable
              rows={[{
                name: 'Resources',
                value: (
                  <button
                    onClick={async () => {
                      const state = benchState;
                      if (state.status !== 'complete') return;
                      if (!window.confirm(`Delete job "${state.jobName}" and PVC "${state.pvcName}"?`)) return;
                      try {
                        await deleteJob(state.jobName, lastNamespace);
                        await deletePvc(state.pvcName, lastNamespace);
                        setBenchState({ status: 'idle' });
                        setCurrentResult(null);
                      } catch (err: unknown) {
                        alert(`Cleanup error: ${err instanceof Error ? err.message : String(err)}`);
                      }
                    }}
                    aria-label="Delete benchmark job and PVC"
                    style={{ padding: '6px 14px', border: '1px solid var(--mui-palette-error-main, #d32f2f)', color: 'var(--mui-palette-error-main, #d32f2f)', background: 'transparent', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}
                  >
                    Delete Job + PVC
                  </button>
                ),
              }]}
            />
          </SectionBox>
        </>
      )}

      <PastBenchmarks namespace={lastNamespace} />
    </>
  );
}

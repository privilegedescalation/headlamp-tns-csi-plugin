/**
 * kbench integration: Job/PVC lifecycle management and FIO log parsing.
 *
 * kbench (https://github.com/longhorn/kbench) runs as a Kubernetes Job backed
 * by a PVC. Results are parsed from pod logs after job completion.
 */

import { ApiProxy } from '@kinvolk/headlamp-plugin/lib';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface KbenchMetricGroup {
  randomRead: number;
  randomWrite: number;
  sequentialRead: number;
  sequentialWrite: number;
  cpuIdleness: number;
}

export interface KbenchResult {
  iops: KbenchMetricGroup;
  bandwidth: KbenchMetricGroup; // KiB/s
  latency: KbenchMetricGroup;  // nanoseconds
  metadata: KbenchResultMetadata;
}

export interface KbenchResultMetadata {
  storageClass: string;
  size: string;
  startedAt: string;
  completedAt: string;
  jobName: string;
  namespace: string;
}

export type BenchmarkStatus = 'idle' | 'creating-pvc' | 'waiting-pvc' | 'running' | 'parsing' | 'complete' | 'failed';

export type BenchmarkState =
  | { status: 'idle' }
  | { status: 'creating-pvc' }
  | { status: 'waiting-pvc'; pvcName: string }
  | { status: 'running'; jobName: string; pvcName: string; startedAt: string }
  | { status: 'parsing'; jobName: string; pvcName: string }
  | { status: 'complete'; result: KbenchResult; jobName: string; pvcName: string }
  | { status: 'failed'; error: string; jobName: string; pvcName: string };

export interface KbenchJobSummary {
  jobName: string;
  namespace: string;
  storageClass: string;
  phase: 'Active' | 'Complete' | 'Failed' | 'Unknown';
  startedAt: string;
  completedAt?: string;
}

// ---------------------------------------------------------------------------
// Labels / annotations used for tracking
// ---------------------------------------------------------------------------

export const KBENCH_MANAGED_BY_LABEL = 'app.kubernetes.io/managed-by';
export const KBENCH_MANAGED_BY_VALUE = 'headlamp-tns-csi-plugin';
export const KBENCH_FIO_LABEL = 'kbench';
export const KBENCH_FIO_VALUE = 'fio';
export const KBENCH_STORAGE_CLASS_ANNOTATION = 'tns-csi.headlamp/storage-class';

// ---------------------------------------------------------------------------
// Unique name generation
// ---------------------------------------------------------------------------

function shortId(): string {
  return Math.random().toString(36).slice(2, 8);
}

export function generateJobName(): string {
  return `kbench-${shortId()}`;
}

export function generatePvcName(jobName: string): string {
  return `${jobName}-pvc`;
}

// ---------------------------------------------------------------------------
// Kubernetes manifest builders
// ---------------------------------------------------------------------------

export interface KbenchJobOptions {
  jobName: string;
  pvcName: string;
  namespace: string;
  storageClass: string;
  size?: string;  // default "30G"
  mode?: string;  // default "full"
}

export function buildPvcManifest(opts: KbenchJobOptions): object {
  return {
    apiVersion: 'v1',
    kind: 'PersistentVolumeClaim',
    metadata: {
      name: opts.pvcName,
      namespace: opts.namespace,
      labels: {
        [KBENCH_MANAGED_BY_LABEL]: KBENCH_MANAGED_BY_VALUE,
        [KBENCH_FIO_LABEL]: KBENCH_FIO_VALUE,
      },
      annotations: {
        [KBENCH_STORAGE_CLASS_ANNOTATION]: opts.storageClass,
      },
    },
    spec: {
      storageClassName: opts.storageClass,
      accessModes: ['ReadWriteOnce'],
      resources: {
        requests: {
          // kbench needs ~33Gi for a 30G test (10% buffer rule)
          storage: '33Gi',
        },
      },
    },
  };
}

export function buildJobManifest(opts: KbenchJobOptions): object {
  return {
    apiVersion: 'batch/v1',
    kind: 'Job',
    metadata: {
      name: opts.jobName,
      namespace: opts.namespace,
      labels: {
        [KBENCH_MANAGED_BY_LABEL]: KBENCH_MANAGED_BY_VALUE,
        [KBENCH_FIO_LABEL]: KBENCH_FIO_VALUE,
      },
      annotations: {
        [KBENCH_STORAGE_CLASS_ANNOTATION]: opts.storageClass,
      },
    },
    spec: {
      template: {
        metadata: {
          labels: {
            [KBENCH_FIO_LABEL]: KBENCH_FIO_VALUE,
          },
        },
        spec: {
          containers: [
            {
              name: 'kbench',
              image: 'yasker/kbench:latest',
              env: [
                { name: 'MODE', value: opts.mode ?? 'full' },
                { name: 'FILE_NAME', value: '/volume/test' },
                { name: 'SIZE', value: opts.size ?? '30G' },
                { name: 'CPU_IDLE_PROF', value: 'disabled' },
              ],
              volumeMounts: [
                { name: 'vol', mountPath: '/volume/' },
              ],
            },
          ],
          restartPolicy: 'Never',
          volumes: [
            {
              name: 'vol',
              persistentVolumeClaim: { claimName: opts.pvcName },
            },
          ],
        },
      },
      backoffLimit: 0,
    },
  };
}

// ---------------------------------------------------------------------------
// API operations
// ---------------------------------------------------------------------------

export async function createPvc(opts: KbenchJobOptions): Promise<void> {
  await ApiProxy.request(`/api/v1/namespaces/${opts.namespace}/persistentvolumeclaims`, {
    method: 'POST',
    body: JSON.stringify(buildPvcManifest(opts)),
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function createJob(opts: KbenchJobOptions): Promise<void> {
  await ApiProxy.request(`/apis/batch/v1/namespaces/${opts.namespace}/jobs`, {
    method: 'POST',
    body: JSON.stringify(buildJobManifest(opts)),
    headers: { 'Content-Type': 'application/json' },
  });
}

interface K8sJobStatus {
  active?: number;
  succeeded?: number;
  failed?: number;
  completionTime?: string;
}

interface K8sJob {
  status?: K8sJobStatus;
  metadata?: { creationTimestamp?: string };
}

export type JobPhase = 'Active' | 'Complete' | 'Failed' | 'Unknown';

export async function getJobPhase(
  jobName: string,
  namespace: string
): Promise<{ phase: JobPhase; job: K8sJob }> {
  const job = await ApiProxy.request(
    `/apis/batch/v1/namespaces/${namespace}/jobs/${jobName}`
  ) as K8sJob;

  const status = job.status;
  let phase: JobPhase = 'Unknown';
  if (status?.succeeded && status.succeeded > 0) phase = 'Complete';
  else if (status?.failed && status.failed > 0) phase = 'Failed';
  else if (status?.active && status.active > 0) phase = 'Active';

  return { phase, job };
}

export async function getPvcPhase(
  pvcName: string,
  namespace: string
): Promise<string> {
  const pvc = await ApiProxy.request(
    `/api/v1/namespaces/${namespace}/persistentvolumeclaims/${pvcName}`
  ) as { status?: { phase?: string } };
  return pvc.status?.phase ?? 'Unknown';
}

/**
 * Fetches the logs from the kbench pod (via the Job's pod selector).
 * Uses the pod label selector to find the pod.
 */
export async function fetchKbenchLogs(
  jobName: string,
  namespace: string
): Promise<string> {
  // Find pod with label kbench=fio and job-name=<jobName>
  const podList = await ApiProxy.request(
    `/api/v1/namespaces/${namespace}/pods?labelSelector=${encodeURIComponent(`job-name=${jobName}`)}`
  ) as { items?: Array<{ metadata?: { name?: string } }> };

  const podName = podList.items?.[0]?.metadata?.name;
  if (!podName) {
    throw new Error(`No pod found for kbench job "${jobName}"`);
  }

  const logs = await ApiProxy.request(
    `/api/v1/namespaces/${namespace}/pods/${podName}/log?container=kbench`,
    { isJSON: false }
  ) as unknown;

  if (typeof logs !== 'string') {
    throw new Error('Pod logs were not returned as text');
  }

  return logs;
}

export async function deleteJob(jobName: string, namespace: string): Promise<void> {
  await ApiProxy.request(`/apis/batch/v1/namespaces/${namespace}/jobs/${jobName}`, {
    method: 'DELETE',
    body: JSON.stringify({ propagationPolicy: 'Foreground' }),
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function deletePvc(pvcName: string, namespace: string): Promise<void> {
  await ApiProxy.request(
    `/api/v1/namespaces/${namespace}/persistentvolumeclaims/${pvcName}`,
    { method: 'DELETE' }
  );
}

// ---------------------------------------------------------------------------
// FIO log parser
// ---------------------------------------------------------------------------

/**
 * Parses a kbench FIO benchmark summary from pod log text.
 *
 * Expected format:
 * =====================
 * FIO Benchmark Summary
 * ...
 * IOPS (Read/Write)
 *         Random:          98368 / 89200
 *     Sequential:         108513 / 107636
 *   CPU Idleness:                     68%
 *
 * Bandwidth in KiB/sec (Read/Write)
 *         Random:         542447 / 514487
 * ...
 *
 * Latency in ns (Read/Write)
 * ...
 */
export function parseKbenchLog(logText: string): KbenchResult | null {
  const lines = logText.split('\n').map(l => l.trim());

  function extractSection(header: string): string[] {
    const idx = lines.findIndex(l => l.startsWith(header));
    if (idx < 0) return [];
    const section: string[] = [];
    for (let i = idx + 1; i < lines.length && i < idx + 10; i++) {
      const line = lines[i];
      if (!line) break;
      section.push(line);
    }
    return section;
  }

  function parseReadWrite(line: string): [number, number] | null {
    const match = /(\d[\d,]*)\s*\/\s*(\d[\d,]*)/.exec(line);
    if (!match) return null;
    const read = parseInt(match[1].replace(/,/g, ''), 10);
    const write = parseInt(match[2].replace(/,/g, ''), 10);
    if (!Number.isFinite(read) || !Number.isFinite(write)) return null;
    return [read, write];
  }

  function parseCpu(line: string): number {
    const match = /(\d+)%/.exec(line);
    return match ? parseInt(match[1], 10) : 0;
  }

  function parseSection(header: string): KbenchMetricGroup | null {
    const section = extractSection(header);
    if (section.length === 0) return null;

    const randomLine = section.find(l => l.startsWith('Random:'));
    const seqLine = section.find(l => l.startsWith('Sequential:'));
    const cpuLine = section.find(l => l.startsWith('CPU Idleness:'));

    const random = randomLine ? parseReadWrite(randomLine) : null;
    const sequential = seqLine ? parseReadWrite(seqLine) : null;
    const cpu = cpuLine ? parseCpu(cpuLine) : 0;

    if (!random || !sequential) return null;

    return {
      randomRead: random[0],
      randomWrite: random[1],
      sequentialRead: sequential[0],
      sequentialWrite: sequential[1],
      cpuIdleness: cpu,
    };
  }

  const iops = parseSection('IOPS (Read/Write)');
  const bandwidth = parseSection('Bandwidth in KiB/sec (Read/Write)');
  const latency = parseSection('Latency in ns (Read/Write)');

  if (!iops || !bandwidth || !latency) return null;

  return {
    iops,
    bandwidth,
    latency,
    metadata: {
      storageClass: '',  // filled in by the caller
      size: '30G',
      startedAt: '',
      completedAt: new Date().toISOString(),
      jobName: '',
      namespace: '',
    },
  };
}

// ---------------------------------------------------------------------------
// List existing kbench Jobs (for Past Benchmarks view)
// ---------------------------------------------------------------------------

export async function listKbenchJobs(namespace: string = ''): Promise<KbenchJobSummary[]> {
  const selector = encodeURIComponent(
    `${KBENCH_MANAGED_BY_LABEL}=${KBENCH_MANAGED_BY_VALUE},${KBENCH_FIO_LABEL}=${KBENCH_FIO_VALUE}`
  );
  const path = namespace
    ? `/apis/batch/v1/namespaces/${namespace}/jobs?labelSelector=${selector}`
    : `/apis/batch/v1/jobs?labelSelector=${selector}`;

  const list = await ApiProxy.request(path) as {
    items?: Array<{
      metadata?: { name?: string; namespace?: string; annotations?: Record<string, string>; creationTimestamp?: string };
      status?: K8sJobStatus;
    }>;
  };

  return (list.items ?? []).map(job => {
    const status = job.status;
    let phase: JobPhase = 'Unknown';
    if (status?.succeeded && status.succeeded > 0) phase = 'Complete';
    else if (status?.failed && status.failed > 0) phase = 'Failed';
    else if (status?.active && status.active > 0) phase = 'Active';

    return {
      jobName: job.metadata?.name ?? '',
      namespace: job.metadata?.namespace ?? namespace,
      storageClass: job.metadata?.annotations?.[KBENCH_STORAGE_CLASS_ANNOTATION] ?? '—',
      phase,
      startedAt: job.metadata?.creationTimestamp ?? '',
      completedAt: status?.completionTime,
    };
  });
}

// ---------------------------------------------------------------------------
// Formatting helpers for result display
// ---------------------------------------------------------------------------

export function formatIops(value: number): string {
  return value.toLocaleString();
}

export function formatBandwidth(kib: number): string {
  const mib = kib / 1024;
  if (mib >= 1024) return `${(mib / 1024).toFixed(1)} GiB/s`;
  if (mib >= 1) return `${mib.toFixed(0)} MiB/s`;
  return `${kib.toFixed(0)} KiB/s`;
}

export function formatLatency(ns: number): string {
  if (ns >= 1_000_000) return `${(ns / 1_000_000).toFixed(2)} ms`;
  if (ns >= 1_000) return `${(ns / 1_000).toFixed(1)} µs`;
  return `${ns} ns`;
}

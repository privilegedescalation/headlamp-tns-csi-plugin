import { describe, expect, it } from 'vitest';
import {
  buildJobManifest,
  buildPvcManifest,
  formatBandwidth,
  formatIops,
  formatLatency,
  generateJobName,
  generatePvcName,
  KBENCH_FIO_LABEL,
  KBENCH_FIO_VALUE,
  KBENCH_MANAGED_BY_LABEL,
  KBENCH_MANAGED_BY_VALUE,
  parseKbenchLog,
} from './kbench';

const SAMPLE_LOG = `
=====================
FIO Benchmark Summary
For: test_device
SIZE: 30G
QUICK MODE: DISABLED
=====================
IOPS (Read/Write)
        Random:          98368 / 89200
    Sequential:         108513 / 107636
  CPU Idleness:                     68%

Bandwidth in KiB/sec (Read/Write)
        Random:         542447 / 514487
    Sequential:         552052 / 521330
  CPU Idleness:                     99%

Latency in ns (Read/Write)
        Random:           97222 / 44548
    Sequential:           40483 / 44690
  CPU Idleness:                     72%
`.trim();

const INCOMPLETE_LOG = 'Some other log output without FIO summary';

// ---------------------------------------------------------------------------
// Name generation
// ---------------------------------------------------------------------------

describe('generateJobName', () => {
  it('generates names starting with kbench-', () => {
    expect(generateJobName()).toMatch(/^kbench-[a-z0-9]+$/);
  });

  it('generates unique names', () => {
    const names = new Set(Array.from({ length: 100 }, () => generateJobName()));
    // Highly unlikely to collide in 100 attempts
    expect(names.size).toBeGreaterThan(90);
  });
});

describe('generatePvcName', () => {
  it('derives PVC name from job name', () => {
    expect(generatePvcName('kbench-abc123')).toBe('kbench-abc123-pvc');
  });
});

// ---------------------------------------------------------------------------
// Manifest builders
// ---------------------------------------------------------------------------

describe('buildPvcManifest', () => {
  const opts = { jobName: 'kbench-test', pvcName: 'kbench-test-pvc', namespace: 'default', storageClass: 'tns-nfs' };

  it('produces a valid PVC manifest with correct storage class', () => {
    const manifest = buildPvcManifest(opts) as Record<string, unknown>;
    expect(manifest['kind']).toBe('PersistentVolumeClaim');
    const spec = manifest['spec'] as Record<string, unknown>;
    expect(spec['storageClassName']).toBe('tns-nfs');
    const resources = spec['resources'] as Record<string, unknown>;
    const requests = resources['requests'] as Record<string, unknown>;
    expect(requests['storage']).toBe('33Gi');
  });

  it('applies managed-by label', () => {
    const manifest = buildPvcManifest(opts) as Record<string, unknown>;
    const meta = manifest['metadata'] as Record<string, unknown>;
    const labels = meta['labels'] as Record<string, string>;
    expect(labels[KBENCH_MANAGED_BY_LABEL]).toBe(KBENCH_MANAGED_BY_VALUE);
    expect(labels[KBENCH_FIO_LABEL]).toBe(KBENCH_FIO_VALUE);
  });
});

describe('buildJobManifest', () => {
  const opts = { jobName: 'kbench-test', pvcName: 'kbench-test-pvc', namespace: 'default', storageClass: 'tns-nfs' };

  it('produces a valid Job manifest', () => {
    const manifest = buildJobManifest(opts) as Record<string, unknown>;
    expect(manifest['kind']).toBe('Job');
    const spec = manifest['spec'] as Record<string, unknown>;
    expect(spec['backoffLimit']).toBe(0);
  });

  it('uses default size and mode when not specified', () => {
    const manifest = buildJobManifest(opts) as Record<string, unknown>;
    const spec = manifest['spec'] as Record<string, unknown>;
    const template = spec['template'] as Record<string, unknown>;
    const podSpec = template['spec'] as Record<string, unknown>;
    const containers = podSpec['containers'] as Array<Record<string, unknown>>;
    const env = containers[0]?.['env'] as Array<{ name: string; value: string }>;
    expect(env?.find(e => e.name === 'SIZE')?.value).toBe('30G');
    expect(env?.find(e => e.name === 'MODE')?.value).toBe('full');
  });

  it('uses custom size and mode when specified', () => {
    const manifest = buildJobManifest({ ...opts, size: '10G', mode: 'quick' }) as Record<string, unknown>;
    const spec = manifest['spec'] as Record<string, unknown>;
    const template = spec['template'] as Record<string, unknown>;
    const podSpec = template['spec'] as Record<string, unknown>;
    const containers = podSpec['containers'] as Array<Record<string, unknown>>;
    const env = containers[0]?.['env'] as Array<{ name: string; value: string }>;
    expect(env?.find(e => e.name === 'SIZE')?.value).toBe('10G');
    expect(env?.find(e => e.name === 'MODE')?.value).toBe('quick');
  });
});

// ---------------------------------------------------------------------------
// Log parser
// ---------------------------------------------------------------------------

describe('parseKbenchLog', () => {
  it('parses a complete FIO benchmark log', () => {
    const result = parseKbenchLog(SAMPLE_LOG);
    expect(result).not.toBeNull();

    expect(result?.iops.randomRead).toBe(98368);
    expect(result?.iops.randomWrite).toBe(89200);
    expect(result?.iops.sequentialRead).toBe(108513);
    expect(result?.iops.sequentialWrite).toBe(107636);
    expect(result?.iops.cpuIdleness).toBe(68);

    expect(result?.bandwidth.randomRead).toBe(542447);
    expect(result?.bandwidth.randomWrite).toBe(514487);
    expect(result?.bandwidth.cpuIdleness).toBe(99);

    expect(result?.latency.randomRead).toBe(97222);
    expect(result?.latency.randomWrite).toBe(44548);
    expect(result?.latency.cpuIdleness).toBe(72);
  });

  it('returns null for unparseable log', () => {
    expect(parseKbenchLog(INCOMPLETE_LOG)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseKbenchLog('')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

describe('formatIops', () => {
  it('formats with thousands separator', () => {
    expect(formatIops(98368)).toBe('98,368');
  });
});

describe('formatBandwidth', () => {
  it('formats GiB/s for large values', () => {
    const result = formatBandwidth(2 * 1024 * 1024); // 2 GiB/s in KiB
    expect(result).toBe('2.0 GiB/s');
  });

  it('formats MiB/s for medium values', () => {
    const result = formatBandwidth(542447);
    expect(result).toMatch(/MiB\/s/);
  });

  it('formats KiB/s for small values', () => {
    const result = formatBandwidth(500);
    expect(result).toBe('500 KiB/s');
  });
});

describe('formatLatency', () => {
  it('formats milliseconds for large values', () => {
    expect(formatLatency(5_000_000)).toBe('5.00 ms');
  });

  it('formats microseconds for medium values', () => {
    expect(formatLatency(97_222)).toBe('97.2 µs');
  });

  it('formats nanoseconds for small values', () => {
    expect(formatLatency(500)).toBe('500 ns');
  });
});

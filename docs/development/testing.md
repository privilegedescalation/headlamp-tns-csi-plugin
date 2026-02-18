# Testing Guide

## Test Suite Overview

The plugin has 67 unit tests across 4 test files:

| File | Tests | Coverage |
| ---- | ----- | -------- |
| `src/api/k8s.test.ts` | Type guards, filter helpers, format utilities | k8s.ts |
| `src/api/metrics.test.ts` | Prometheus text format parser | metrics.ts |
| `src/api/kbench.test.ts` | FIO log parser, manifest builders, format helpers | kbench.ts |
| `src/api/TnsCsiDataContext.test.tsx` | Context provider integration | TnsCsiDataContext.tsx |

## Running Tests

```bash
# Run all tests once
npm test

# Watch mode (re-runs on file changes)
npm run test:watch

# TypeScript type-check (no emit)
npm run tsc
```

All tests must pass before committing. The CI workflow enforces this.

## Test Framework

- **Vitest** — test runner
- **@testing-library/react** — React component testing utilities
- **jsdom** — DOM environment (configured in `vitest.config.mts`)

## Mocking Headlamp APIs

Headlamp APIs must be mocked in tests. Use this pattern:

```typescript
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@kinvolk/headlamp-plugin/lib', () => ({
  ApiProxy: {
    request: vi.fn().mockResolvedValue({ items: [] }),
  },
  K8s: {
    ResourceClasses: {
      StorageClass: {
        useList: vi.fn(() => [[], null]),
      },
      PersistentVolume: {
        useList: vi.fn(() => [[], null]),
      },
      PersistentVolumeClaim: {
        useList: vi.fn(() => [[], null]),
      },
    },
  },
}));

vi.mock('@kinvolk/headlamp-plugin/lib/CommonComponents', () => ({
  SectionBox: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SectionHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
  SimpleTable: ({ data, emptyMessage }: { data: unknown[]; emptyMessage: string }) =>
    data.length === 0 ? <p>{emptyMessage}</p> : <table />,
  Loader: ({ title }: { title: string }) => <div>{title}</div>,
  // add other CommonComponents as needed
}));
```

## Testing the Prometheus Parser

```typescript
import { parsePrometheusText, extractTnsCsiMetrics } from '../metrics';

it('parses gauge metrics correctly', () => {
  const text = `
# HELP kubelet_volume_stats_capacity_bytes Capacity in bytes of the volume
# TYPE kubelet_volume_stats_capacity_bytes gauge
kubelet_volume_stats_capacity_bytes{namespace="default",persistentvolumeclaim="my-pvc"} 10737418240
`;
  const metrics = parsePrometheusText(text);
  expect(metrics.get('kubelet_volume_stats_capacity_bytes{namespace="default",persistentvolumeclaim="my-pvc"}')).toBe(10737418240);
});
```

## Testing the FIO Log Parser

```typescript
import { parseKbenchLog } from '../kbench';

it('parses kbench FIO output into result cards', () => {
  const log = `
READ: bw=512MiB/s (537MB/s), 512MiB/s-512MiB/s (537MB/s-537MB/s), io=32.0GiB (34.4GB), run=63999-63999msec
  iops        : min=128000, max=135000, avg=131072.00, stdev=1024.00, samples=64
  lat (usec)  : min=10, max=500, avg=50.00, stdev=20.00
`;
  const result = parseKbenchLog(log);
  expect(result).not.toBeNull();
  expect(result!.readBandwidthMBs).toBeGreaterThan(0);
});
```

## Testing Type Guards

```typescript
import { isTnsCsiStorageClass } from '../k8s';

it('identifies tns.csi.io provisioner', () => {
  expect(isTnsCsiStorageClass({ provisioner: 'tns.csi.io', metadata: { name: 'test' } })).toBe(true);
  expect(isTnsCsiStorageClass({ provisioner: 'other.csi.io', metadata: { name: 'test' } })).toBe(false);
  expect(isTnsCsiStorageClass(null)).toBe(false);
  expect(isTnsCsiStorageClass(undefined)).toBe(false);
});
```

## vitest.setup.ts

The setup file shims `localStorage` for Node 22+ (jsdom doesn't provide it in some versions):

```typescript
// vitest.setup.ts
if (typeof localStorage === 'undefined') {
  const store: Record<string, string> = {};
  Object.defineProperty(global, 'localStorage', {
    value: {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
      clear: () => { Object.keys(store).forEach(k => delete store[k]); },
    },
  });
}
```

## CI Test Enforcement

The GitHub Actions CI workflow runs tests on every push and pull request:

```yaml
- name: Run unit tests
  run: npm test

- name: Type-check
  run: npx tsc --noEmit
```

Both must pass for the PR to merge.

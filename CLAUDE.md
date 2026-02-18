# headlamp-tns-csi-plugin

Headlamp plugin for tns-csi CSI driver visibility and kbench benchmarking.

## Project

- **Plugin name**: `headlamp-tns-csi-plugin`
- **Provisioner**: `tns.csi.io`
- **Upstream driver**: https://github.com/fenio/tns-csi
- **Benchmark tool**: https://github.com/longhorn/kbench
- **Reference plugin**: `../headlamp-polaris-plugin`

## Commands

```bash
npm start          # dev server with hot reload
npm run build      # production build
npm run package    # package for headlamp
npm run tsc        # TypeScript type check (no emit)
npm run lint       # ESLint
npm test           # vitest run
npm run test:watch # vitest watch mode
```

## Architecture

```
src/
├── index.tsx                    # Plugin entry: registerRoute, registerSidebarEntry, etc.
├── api/
│   ├── k8s.ts                   # Types + filtering helpers (provisioner: tns.csi.io)
│   ├── metrics.ts               # Prometheus text format parser
│   ├── kbench.ts                # kbench Job/PVC lifecycle + FIO log parser
│   └── TnsCsiDataContext.tsx    # Shared React context provider
└── components/
    ├── OverviewPage.tsx
    ├── StorageClassesPage.tsx
    ├── VolumesPage.tsx
    ├── SnapshotsPage.tsx
    ├── MetricsPage.tsx
    ├── BenchmarkPage.tsx        # ONLY write operation in the plugin
    ├── DriverStatusCard.tsx
    └── PVCDetailSection.tsx     # Injected into Headlamp PVC detail view
```

## Key constants

- Provisioner: `tns.csi.io`
- Controller pod selector: `app.kubernetes.io/name=tns-csi-driver,app.kubernetes.io/component=controller`
- Node pod selector: `app.kubernetes.io/name=tns-csi-driver,app.kubernetes.io/component=node`
- Driver namespace: `kube-system`
- Metrics port: `8080`
- kbench image: `yasker/kbench:latest`
- kbench managed-by label: `app.kubernetes.io/managed-by=headlamp-tns-csi-plugin`

## Code conventions

- Functional React components only — no class components
- All imports from `@kinvolk/headlamp-plugin/lib` and `@kinvolk/headlamp-plugin/lib/CommonComponents`
- No additional UI libraries (no MUI direct imports, no Ant Design, etc.)
- TypeScript strict mode — no `any`, use `unknown` + type guards at API boundaries
- Slide-in detail panels follow the polaris plugin pattern: URL hash state, Escape to close, backdrop overlay
- Context provider (`TnsCsiDataProvider`) wraps each route component in `index.tsx`
- Tests: vitest + @testing-library/react, mock with `vi.mock('@kinvolk/headlamp-plugin/lib', ...)`

## Subagent guidance

When launching subagents for tasks in this repo:

- **Research tasks** (reading files, searching code, exploring GitHub): use `subagent_type: Explore`
  with tools: Read, Glob, Grep, Bash, WebFetch, GitHub MCP
- **Implementation tasks** (writing/editing files): use `subagent_type: general-purpose`
- **Debugging**: use `subagent_type: debugger`
- **Avoid** launching background agents for open-ended research — do research in the main session
  using Glob, Grep, Read, and GitHub MCP directly, then delegate scoped write tasks to agents
- The main session has broader tool approvals than subagent sandboxes; use it for exploration

## Testing

All tests must pass before committing:

```bash
npm test        # 67 tests across 4 test files
npm run tsc     # must exit 0
```

Mock pattern for headlamp APIs:
```typescript
vi.mock('@kinvolk/headlamp-plugin/lib', () => ({
  ApiProxy: { request: vi.fn().mockResolvedValue({ items: [] }) },
  K8s: {
    ResourceClasses: {
      StorageClass: { useList: vi.fn(() => [[], null]) },
      PersistentVolume: { useList: vi.fn(() => [[], null]) },
      PersistentVolumeClaim: { useList: vi.fn(() => [[], null]) },
    },
  },
}));
```

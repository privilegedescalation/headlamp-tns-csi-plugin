# Contributing to Headlamp TNS-CSI Plugin

Thank you for your interest in contributing! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Branching Strategy](#branching-strategy)
- [Commit Message Guidelines](#commit-message-guidelines)
- [Pull Request Process](#pull-request-process)
- [Code Style](#code-style)
- [Testing Requirements](#testing-requirements)
- [Documentation](#documentation)
- [Release Process](#release-process)

## Code of Conduct

This project follows a standard code of conduct:
- Be respectful and inclusive
- Welcome newcomers and help them get started
- Focus on constructive feedback
- Assume good intentions

## Getting Started

### Prerequisites

- Node.js 20 or later
- npm
- Access to a Kubernetes cluster with Headlamp and tns-csi installed (for end-to-end testing)
- Git

### Development Setup

1. **Fork and clone the repository:**
   ```bash
   git clone https://github.com/YOUR_USERNAME/headlamp-tns-csi-plugin.git
   cd headlamp-tns-csi-plugin
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start development mode:**
   ```bash
   npm start
   # Plugin will be available at http://localhost:4466
   ```

4. **Run tests:**
   ```bash
   npm test          # 67 unit tests
   npm run tsc       # TypeScript type-check
   ```

5. **Build the plugin:**
   ```bash
   npm run build
   ```

## Development Workflow

### Feature Development

1. Create a feature branch from `main`
2. Make your changes
3. Write/update tests
4. Update documentation
5. Run lint and tests locally
6. Submit a pull request

### Local Testing

**Option 1: Development Mode**
```bash
npm start
# Opens Headlamp at http://localhost:4466 with hot reload
```

**Option 2: Production Build**
```bash
npm run build
npm run package
# Installs the packaged tarball into a running Headlamp instance
```

### Connecting to a Real Cluster

The plugin requires a running tns-csi driver to display meaningful data. For development:

1. Configure `KUBECONFIG` to point at a cluster with tns-csi installed
2. Run `npm start` — Headlamp dev server will proxy API requests through your kubeconfig
3. The Benchmark page requires RBAC permissions for Jobs and PVCs in the target namespace

## Branching Strategy

### Main Branch

- **Purpose:** Stable, production-ready code
- **Protection:** Only merge via pull requests
- **Naming:** `main`

### Feature Branches

- **Purpose:** Development of new features or fixes
- **Naming Convention:**
  - Features: `feat/description`
  - Bug fixes: `fix/description`
  - Documentation: `docs/description`
  - Refactoring: `refactor/description`
  - Chores: `chore/description`

**Examples:**
```bash
feat/add-volume-clone-support
fix/metrics-page-empty-on-restart
docs/update-rbac-guide
refactor/kbench-state-machine
chore/upgrade-dependencies
```

### Branching Rules

**✅ ALWAYS use feature branches for:**
- Code changes (new features, bug fixes, refactors)
- Test updates
- CI/CD workflow changes
- Dependency updates

**✅ MAY push directly to main for:**
- Documentation-only changes (README, CLAUDE.md, comments)
- Version bump commits (`package.json` + `artifacthub-pkg.yml`)

**❌ NEVER push directly to main for:**
- Any code changes to `src/`
- Test file changes
- Workflow changes

## Commit Message Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/) format:

### Format

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Types

- **feat:** New feature
- **fix:** Bug fix
- **docs:** Documentation only
- **style:** Code style (formatting, no logic change)
- **refactor:** Code change that neither fixes a bug nor adds a feature
- **perf:** Performance improvement
- **test:** Adding or updating tests
- **chore:** Maintenance tasks (deps, build, CI)
- **ci:** CI/CD changes

### Scope (Optional)

- `api` — API-related changes
- `ui` — UI component changes
- `metrics` — Prometheus metrics changes
- `kbench` — Benchmark changes
- `tests` — Test-related changes
- `docs` — Documentation changes

### Examples

```bash
feat(ui): add PV clone button to Volumes detail panel

fix(api): extract jsonData from headlamp KubeObject instances for parameter access

docs: add RBAC examples for Benchmark page

chore: bump version to 0.2.0

test(kbench): add FIO log parser edge case tests
```

### Footer

Add `Co-Authored-By` for pair programming or AI assistance:

```
feat: add NVMe-oF protocol notes to StorageClass detail panel

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
```

## Pull Request Process

### Before Creating a PR

1. **Run all checks locally:**
   ```bash
   npm run build      # Verify build succeeds
   npm run lint       # Check for linting errors
   npm run tsc        # Type-check TypeScript
   npm test           # Run 67 unit tests
   ```

2. **Update documentation:**
   - Update README.md if you added features or changed behavior
   - Update CLAUDE.md if you changed architecture or constraints
   - Add JSDoc comments for new exported APIs

3. **Write/update tests:**
   - Add unit tests for new functions/components
   - Ensure all 67 tests (plus yours) pass

### Creating a PR

1. **Push your branch:**
   ```bash
   git push origin feat/your-feature
   ```

2. **Create PR on GitHub:**
   - Use a descriptive title following commit conventions
   - Link related issues with `Fixes #123` or `Closes #456`

3. **PR Title Format:**
   ```
   feat: add VolumeSnapshot creation from Volumes page
   fix: correct FIO log parser for multi-job output
   docs: improve Benchmark RBAC setup guide
   ```

4. **PR Description Should Include:**
   - Summary of changes
   - Motivation and context
   - Testing performed (which cluster/driver version)
   - Screenshots for UI changes
   - Breaking changes (if any)

### PR Review Process

1. **Automated Checks:**
   - ✅ CI workflow (lint, type-check, build, test)

2. **Maintainer Review:**
   - Code quality and style
   - Test coverage
   - Documentation completeness
   - No new `any` types introduced

3. **Merging:**
   - Use **merge commits** (not squash, not rebase)
   - Delete feature branch after merge

## Code Style

### TypeScript

- **Strictness:** Full TypeScript strict mode — zero `any` types
- **Unknown at boundaries:** Use `unknown` + type guards at API boundaries (headlamp hooks, ApiProxy responses)
- **Interfaces over types:** Prefer `interface` for object shapes
- **No class components:** Functional components with hooks only

### React

- **Functional components only** — no class components
- **Props interfaces:** Always define props as named interfaces
- **Headlamp components:** Use only `@kinvolk/headlamp-plugin/lib/CommonComponents` — no direct MUI imports
- **Detail panels:** Follow the slide-in drawer pattern — URL hash state, Escape to close, backdrop overlay

### Headlamp KubeObject Access

Headlamp's `useList()` hooks return KubeObject class instances that store raw JSON under `.jsonData`. Always extract `jsonData` before passing objects to plain-object type helpers:

```typescript
// ✅ Correct — extract jsonData so .parameters, .spec, .status are accessible
const rawItems = items.map(item =>
  item && typeof item === 'object' && 'jsonData' in item
    ? (item as { jsonData: unknown }).jsonData
    : item
);

// ❌ Wrong — sc.parameters will be undefined on KubeObject instances
const scs = (allStorageClasses as unknown[]).filter(isTnsCsiStorageClass);
```

### Linting and Formatting

```bash
npm run lint         # ESLint
npm run tsc          # TypeScript check
```

### Naming Conventions

- **Components:** PascalCase (`OverviewPage`, `BenchmarkPage`)
- **Files:** Match component name (`OverviewPage.tsx`)
- **Hooks:** Prefix with `use` (`useTnsCsiContext`)
- **Utilities:** camelCase (`formatProtocol`, `parsePrometheusText`)
- **Constants:** UPPER_SNAKE_CASE (`TNS_CSI_PROVISIONER`)

### Import Organization

1. React imports
2. Third-party libraries
3. Headlamp plugin imports (`@kinvolk/headlamp-plugin/lib`)
4. Local imports (components, API, types)

## Testing Requirements

### Unit Tests (Required)

All 67 tests must pass before committing:

```bash
npm test        # vitest run
npm run tsc     # must exit 0
```

- All new functions must have unit tests
- Bug fixes should include regression tests
- Use descriptive test names

**Mock pattern for headlamp APIs:**

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

### Test File Structure

```
src/api/k8s.test.ts              -- Type guards, filter helpers, format utilities
src/api/metrics.test.ts          -- Prometheus text parser
src/api/kbench.test.ts           -- FIO log parser, manifest builders, format helpers
src/api/TnsCsiDataContext.test.tsx -- Context provider integration
```

## Documentation

### Documentation Updates Required

When making changes, update relevant documentation:

#### Code Changes
- **README.md** — User-facing features, installation, configuration, troubleshooting table
- **CLAUDE.md** — Architecture constraints, key constants, subagent guidance
- **CHANGELOG.md** — Add entry under `[Unreleased]`
- **JSDoc** — All exported functions and components

#### Architecture Changes
- **docs/architecture/overview.md** — If the data flow or component structure changes
- **CLAUDE.md** — Update architecture section

### JSDoc Style

Use JSDoc for all exported functions and types:

```typescript
/**
 * Parses Prometheus text format exposition into a flat key→value map.
 *
 * Ignores comment lines and HELP/TYPE metadata. Returns only the last
 * sample value for each unique metric+label combination.
 *
 * @param text - Raw Prometheus text format string
 * @returns Map of metric name (with labels) to numeric value
 */
export function parsePrometheusText(text: string): Map<string, number> {
  // ...
}
```

## Release Process

### Version Numbering

We follow [Semantic Versioning](https://semver.org/):
- **Major (1.0.0):** Breaking changes
- **Minor (0.1.0):** New features, backward compatible
- **Patch (0.0.1):** Bug fixes, backward compatible

### Creating a Release (Maintainers Only)

1. **Update CHANGELOG.md:**
   - Move items from `[Unreleased]` to a new `[X.Y.Z] - YYYY-MM-DD` section

2. **Trigger the release workflow:**
   - Go to **Actions → Release → Run workflow**
   - Enter the version number (e.g., `0.2.0`)

3. **GitHub Actions automatically:**
   - Updates `package.json` and `artifacthub-pkg.yml` version
   - Builds plugin tarball
   - Computes SHA256 checksum and updates metadata
   - Commits, creates tag, and publishes GitHub release

4. **ArtifactHub syncs within 30 minutes**

### Pre-release Versions

For testing before stable release, use `-rc.N` suffix: `v0.2.0-rc.1`. Mark as "pre-release" on GitHub.

## Getting Help

- **Questions:** Open a [GitHub Discussion](https://github.com/privilegedescalation/headlamp-tns-csi-plugin/discussions)
- **Bugs:** Open a [GitHub Issue](https://github.com/privilegedescalation/headlamp-tns-csi-plugin/issues)
- **Architecture:** See [CLAUDE.md](CLAUDE.md) and [docs/architecture/overview.md](docs/architecture/overview.md)

## License

By contributing, you agree that your contributions will be licensed under the Apache-2.0 License.

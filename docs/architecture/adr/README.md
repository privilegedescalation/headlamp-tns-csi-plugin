# Architecture Decision Records

## What is an ADR?

An Architecture Decision Record (ADR) captures an important architectural decision made along with its context and consequences. ADRs are a lightweight way to document the "why" behind technical choices, ensuring that future contributors understand the reasoning behind the current architecture.

## Format

This project uses the [Nygard-style ADR format](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions):

- **Title**: Short noun phrase describing the decision
- **Status**: Proposed | Accepted | Deprecated | Superseded
- **Date**: When the decision was made
- **Context**: What is the issue that we're seeing that motivates this decision?
- **Decision**: What is the change that we're proposing and/or doing?
- **Consequences**: What becomes easier or more difficult to do because of this change?
- **Alternatives Considered**: What other options were evaluated?

## Index

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [001](001-react-context-state.md) | React Context for Shared CSI Driver State | Accepted | 2026-03-05 |
| [002](002-read-only-benchmark-exception.md) | Read-Only Plugin with Benchmark Exception | Accepted | 2026-03-05 |
| [003](003-optional-crd-degradation.md) | Graceful Degradation for Optional CRDs | Accepted | 2026-03-05 |
| [004](004-url-hash-detail-panels.md) | URL Hash-Based Detail Panel State | Accepted | 2026-03-05 |
| [005](005-prometheus-pod-proxy.md) | Prometheus Metrics via Pod Proxy | Accepted | 2026-03-05 |

## Creating New ADRs

1. Copy an existing ADR as a template
2. Assign the next sequential number (e.g., `006-your-title.md`)
3. Fill in all sections: Status, Date, Context, Decision, Consequences, Alternatives
4. Set the status to `Proposed` until reviewed
5. Update this README index table
6. Submit as part of a pull request for review

ADRs should not be deleted. If a decision is reversed, create a new ADR that supersedes the old one and update the old ADR's status to `Superseded by [ADR NNN](NNN-title.md)`.

## References

- [Michael Nygard - Documenting Architecture Decisions](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
- [ADR GitHub Organization](https://adr.github.io/)
- [Joel Parker Henderson - Architecture Decision Record](https://github.com/joelparkerhenderson/architecture-decision-record)

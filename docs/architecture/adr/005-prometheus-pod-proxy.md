# ADR 005: Prometheus Metrics via Pod Proxy

**Status**: Accepted

**Date**: 2026-03-05

**Deciders**: Development Team

---

## Context

The plugin displays CSI driver metrics (operation latencies, error rates, volume stats). The CSI driver pods expose a Prometheus metrics endpoint on port 8080 in the standard text exposition format. The plugin needs to fetch and parse these metrics. Options:

- **Query a Prometheus server** — Requires Prometheus to be installed in the cluster
- **Scrape the pod directly via Kubernetes pod proxy** — No additional dependencies
- **Use a metrics aggregation service** — Requires additional infrastructure

---

## Decision

Fetch metrics directly from the CSI driver pod's `/metrics` endpoint via Kubernetes pod proxy (`ApiProxy.request` to `/api/v1/namespaces/{ns}/pods/{pod}:8080/proxy/metrics`). Parse the Prometheus text exposition format in-browser using a custom parser in `metrics.ts`. No dependency on a Prometheus server installation.

---

## Consequences

- ✅ Works without Prometheus server installed — no additional infrastructure dependency
- ✅ Direct from source with no aggregation delay — metrics are always current
- ✅ Leverages existing Kubernetes API authentication and authorization
- ✅ No additional service dependencies to configure or maintain
- ⚠️ Custom Prometheus text format parser to maintain — mitigated by the parser being well-tested
- ⚠️ Only gets metrics from one pod at a time (no aggregation across replicas) — acceptable since CSI controller typically runs one replica
- ⚠️ No historical data (point-in-time only) — users needing historical trends should use a full Prometheus setup

---

## Alternatives Considered

1. **Query Prometheus server via service proxy** (like the intel-gpu plugin) — Rejected. Would require Prometheus to be installed, adding a hard infrastructure dependency.

2. **Use a metrics library (prom-client) for parsing** — Rejected. Adds a runtime dependency for a relatively simple parsing task.

3. **JSON metrics endpoint instead of Prometheus format** — Rejected. The CSI driver only exposes Prometheus text format; a JSON endpoint would require changes to the driver itself.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-03-05 | Initial decision |

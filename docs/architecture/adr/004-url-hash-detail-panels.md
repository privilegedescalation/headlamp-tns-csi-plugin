# ADR 004: URL Hash-Based Detail Panel State

**Status**: Accepted

**Date**: 2026-03-05

**Deciders**: Development Team

---

## Context

Several pages need to show detail panels for selected resources (e.g., clicking a PVC row shows PVC details). The detail panel state (which resource is selected) needs to be shareable via URL and survive page refresh. Options include:

- **React state** — Lost on refresh, not shareable
- **URL query parameters** — May cause full page reload, potential conflicts with Headlamp routing
- **URL hash fragments** — Client-side only, no reload, compatible with SPA routing

---

## Decision

Use URL hash fragments to encode detail panel state. When a user selects a resource, the hash is updated (e.g., `#pvc/namespace/name`). On page load, the hash is parsed to restore the selected resource. This enables deep-linking to specific resource details and browser back/forward navigation.

---

## Consequences

- ✅ Deep-linkable resource details — users can share URLs pointing to specific resources
- ✅ Survives page refresh without losing selected resource
- ✅ Browser back/forward navigation works naturally
- ✅ No server round-trip — hash changes are purely client-side
- ✅ Compatible with Headlamp's client-side routing
- ⚠️ Hash-based state is not a standard React pattern — requires team familiarity
- ⚠️ Requires manual hash parsing and updating logic
- ⚠️ Hash changes don't trigger React re-renders by default — requires `hashchange` event listener

---

## Alternatives Considered

1. **React state only** — Rejected. State is lost on refresh and cannot be shared via URL.

2. **URL query parameters** — Rejected. May conflict with Headlamp's routing and could trigger unintended navigation behavior.

3. **Separate detail routes** — Rejected. Too heavyweight for inline detail panels; would require full page transitions for what should be a panel toggle.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-03-05 | Initial decision |

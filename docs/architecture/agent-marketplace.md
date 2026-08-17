# Agent Registry & Marketplace Architecture

## Overview
The Agent Marketplace is an organization-scoped UI surface layered on top of the global `AgentRegistry` and tenant-isolated `AgentService`.

## Architecture Layers

```
Marketplace UI (/workspace/agents/*)
      ↓
AgentService (Tenant Isolation Boundary)
      ↓
AgentRegistry (Global Template Definitions)
```

## Discovery vs. Activation

### Discovery
When an organization views the marketplace (`/workspace/agents/discover`), they are querying the global `AgentRegistry` for available `AgentTemplate` definitions. These templates define what an agent *can* do, but they are not yet active or configured for the organization.

### Activation
When an organization activates a template, the `AgentService` provisions an `AgentInstance` specifically for that `organizationId`. This instance stores the organization's unique configuration, state, and permissions. It appears in `/workspace/agents/active`.

## Isolation and Security
The `AgentService` is responsible for ensuring that all interactions with agent instances strictly require the current `organizationId`. An organization cannot fetch, configure, or execute an `AgentInstance` belonging to another organization.

## Future Expansion
The marketplace is designed to accommodate industry-specific agents (e.g., "Worksheet Creator" for Education). These agents will be registered dynamically by their respective Industry Modules at boot time, making them instantly available in the marketplace without modifying marketplace code.

# AI Agent Platform Architecture

## Overview
The HAZA AIOS AI Agent Platform is an industry-neutral foundation that provides the architecture, lifecycle management, and UI for configuring AI capabilities across the platform.

## Architecture

The system is separated into **Templates** and **Instances**:
- **AgentTemplate**: A global, platform-level definition of a reusable agent (e.g., "Worksheet Creator"). It declares the tools, capabilities, and schemas needed for execution.
- **AgentInstance**: An organization-owned configuration of a template. When an organization "activates" a template, they create an instance that tracks their specific configuration, enablement status, and execution history.

## Strict Boundaries & Education/SIS Integration
The Agent Platform does **not** contain industry-specific business logic.
For example, the Education module will eventually register its own agents (like "Lesson Planner") into the global `AgentRegistry`. 

**Critical Rule:** Agents do not directly manipulate underlying database tables (e.g. SIS data). They operate through approved, permission-gated `Tool` capabilities provided by the host module's API layer.

## Lifecycle
Agent Templates support a full lifecycle (`draft` -> `available` -> `deprecated`).
Agent Instances support an execution lifecycle (`active` -> `paused` -> `disabled`).

## Data Ownership
All `AgentInstance`, `AgentRun`, and `MemoryContext` objects belong strictly to an `organizationId`. Isolation is enforced at the service boundary.

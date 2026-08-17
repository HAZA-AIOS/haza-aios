# Agent Configuration & Builder Architecture

## Overview
The Agent Builder provides an organization-scoped configuration layer on top of a global Agent Template. It allows organizations to customize how an AI Agent behaves within their namespace without altering the base template.

## Agent Template vs Agent Instance

### Agent Template
- Global, immutable by users.
- Defines core capabilities, required tools, and base instructions.
- Acts as the blueprint.

### Agent Instance
- Organization-scoped.
- Contains the `AgentConfiguration` object.
- Stores organization-specific instructions, input/output definitions, tool authorizations, and behavior settings.

## Configuration Architecture

The `AgentConfiguration` is a robust nested object containing:
- **General**: Name and description.
- **Instructions**: Organization-specific system instructions, constraints, and objectives.
- **Behavior**: Tone, formality, creativity (temperature proxy).
- **Inputs & Outputs**: Dynamic definitions of data the agent consumes and returns.
- **Tools**: Subset of authorized tools the agent is permitted to use.
- **Model**: Provider preferences and execution limits.
- **Memory**: State retention and RAG (organization knowledge) settings.

### Configuration Versioning
Future implementations will track configuration changes using the `version` and `updatedBy` fields on the `AgentConfiguration` object, allowing rollbacks and audit logs.

## Security Boundaries
- Configuration is loaded via `AgentService.getInstance(id, organizationId)` ensuring cross-tenant isolation.
- Only authorized tools (as defined by the Platform) can be enabled. The Builder UI prevents bypassing permission requirements.
- API keys and provider credentials are NEVER exposed to the frontend builder.

# DB-14: Agent Knowledge Persistence

## Implemented baseline

Knowledge sources and text chunks are stored in MySQL, separately from DB-13 memory.
The existing agent configuration stores selected source IDs. Configuration writes validate
that every source is active, belongs to the organization, and is visible to the caller.
The Knowledge tab uses the active organization and supports adding and selecting sources.

Migration: `0011_dazzling_zaran.sql`, generated using the existing Drizzle tooling.
It adds `knowledge_sources` and `knowledge_chunks` without modifying existing data.

## Access and retrieval

- All endpoints authenticate organization membership and require `agent.read` or `agent.manage`.
- `internal` sources are visible within the organization; `private` sources only to their creator.
- Retrieval uses the persisted agent's assigned source IDs. Client-supplied source IDs do not authorize access.
- Archived sources are excluded immediately. Archival retains stored content and chunks.
- Document text and chunks are inserted in one transaction; committed sources are marked `ready`.
- Text is limited to 12,000 UTF-16 code units. Chunks contain up to 2,000 Unicode code points with 200-point overlap.
- Search returns only keyword matches with source and chunk IDs. Scores are keyword relevance, not semantic similarity.
- The source list returns at most 200 metadata records. Each agent can select at most 100 sources.

## API

Base: `/api/v1/organizations/:organizationId`

| Method | Route                               | Permission   | Behavior                                                         |
| ------ | ----------------------------------- | ------------ | ---------------------------------------------------------------- |
| GET    | `/knowledge`                        | agent.read   | List visible active source metadata                              |
| POST   | `/knowledge`                        | agent.manage | Ingest name, text content, optional description/type/visibility  |
| GET    | `/knowledge/:sourceId`              | agent.read   | Read a visible active source                                     |
| DELETE | `/knowledge/:sourceId`              | agent.manage | Archive a visible source                                         |
| PATCH  | `/agents/:agentId/configuration`    | agent.manage | Validate and persist `configuration.knowledge` IDs               |
| POST   | `/agents/:agentId/knowledge/search` | agent.read   | Search assigned sources with `query` and optional `limit` (1-20) |

## Verification

- Four unit tests cover input validation, ownership input exclusion, Unicode chunk boundaries, and truthful keyword scores.
- Database integration test runs the full migration chain on a separate local MariaDB instance.
- Integration coverage includes persistence, cross-tenant read/archive rejection, invalid assignment rejection,
  ignored caller-supplied authorization IDs, assigned chunk retrieval, and archived content exclusion.
- Existing frontend regression suite: 171 tests passed.
- API unit suite: 24 tests passed; opt-in integration suites are skipped in the default invocation.
- API lint/type-check/build and Drizzle consistency check pass.
- Existing frontend lint findings remain; comparison with HEAD found no additional findings in edited files.

Integration validation used a disposable instance on port 3314 and database `haza_aios_test`.
A real browser flow created a source in the Knowledge tab, selected it, saved the agent
configuration, reloaded the page, and retrieved an assigned chunk. No browser page errors
were reported in that flow.

On September 18, 2026, the normal XAMPP database was reachable. A local SQL backup was
created outside Git before applying `npm run db:migrate` to `haza_aios` on port 3306.
The command succeeded and the migration journal now contains 12 entries, with DB-14
timestamp `1789665486335`. No existing application tables or records were removed.

## Remaining capabilities

This baseline accepts extracted text. It does not claim binary PDF/Office parsing, web crawling,
asynchronous ingestion workers, embeddings, vector search, or a production RAG provider.
Those require explicit provider/storage choices and further implementation. Existing documents
are replaced by creating a new source, assigning it, and archiving the old source.

## Brand asset

The shared LogoMark renders `apps/web/public/branding/haza-logo.png`, an unchanged copy of
the owner's supplied image. Public header/footer, dashboard and workspace navigation share it.
Browser checks verified a decoded image on public and dashboard routes at 1440px and 390px widths.
The initial logo-only browser check used isolated authentication fixtures, not a live login test.

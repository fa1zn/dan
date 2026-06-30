# INTEGRATION.md — parallel build coordination

Two agents build Dan simultaneously. This file is the contract that keeps them from
colliding. Read it before touching shared files.

## Branches
- `main` — the **data + intelligence layer** (sources, pipeline steps, integrations, enrichment, pam-fit, intel). Owned by the data shell.
- `feat/master-sequence` — the **sales motion layer** (autonomous call → text → edible sequencing, worklist queue, temperature). Owned by the sequence shell. Merges back into `main` via PR.

Work in **separate git worktrees** so neither shell edits the other's files on disk:
```bash
# data shell stays in ~/Desktop/dealership-sor on main
# sequence shell:
git worktree add ../dealership-sor-seq -b feat/master-sequence
```

## Ownership map
| Area | Owner | Path |
| --- | --- | --- |
| Sources / pipeline / enrichment / intel | **data shell** | `pipeline/sources/**`, `pipeline/steps/**`, `pipeline/integrations/**`, `pipeline/enrich/**`, `lib/pamfit.ts`, `lib/intel.ts`, `lib/queries.ts`, `lib/explain.ts` |
| Sequencing / motion / worklist motion columns | **sequence shell** | `pipeline/sequence/**`, `lib/sequence*.ts`, `components/sequence-card.tsx`, `app/sequences/**` |
| CRM read/write API | shared, stable | `lib/crm.ts`, `lib/crm-constants.ts` |

## The seam contract (how the sequence layer stays decoupled)
The sequence layer is **read-only** against the data/intel layer. It consumes:
- the `dealerships` row (`name`, `phone`, `address_*`, `contacts` JSON),
- the pam-fit score via `lib/pamfit.ts` (for the "Fit" axis of temperature),
- decision-makers from the `contacts` JSON.

It **writes** only its own 3 tables (`sequences`, `enrollments`, `sequence_step_runs`)
plus `account_crm` / `activity` **through the existing `lib/crm.ts` API** (`logActivity`, `setStatus`).

As long as the data shell does not rename `getCrm` / `logActivity` / `setStatus` or the
`dealerships` columns, the two layers do not block each other.

## Zero-shared-edit rule (why merges are clean)
The sequence layer is built to touch **no shared source files**, following the `lib/crm.ts`
conventions:
- raw `better-sqlite3` prepared statements (no `lib/schema.ts` edit),
- lazy `CREATE TABLE IF NOT EXISTS` inside `lib/sequence.ts` init against the shared db (no `lib/db.ts` edit),
- its own activity-kind constants; `activity.kind` is unconstrained TEXT (no `lib/crm-constants.ts` edit),
- a separate CLI entry `pipeline/sequence/run.ts` (no `pipeline/run.ts` edit).

The only shared touch is an **append-only** `sequence:*` block in `package.json` scripts.

## Merge cadence
- Sequence shell rebases onto `main` whenever the data shell pushes: `git rebase main`. Near-instant given zero shared source edits.
- Final integration: PR `feat/master-sequence` → `main` once the data/intel layer is stable.

## Gotcha: the SQLite db is gitignored
`data/dealerships.sqlite` is not in git, so a fresh worktree starts empty. To test against
real data, snapshot it once: `cp ../dealership-sor/data/dealerships.sqlite data/`. The
sequence tables are `IF NOT EXISTS`, so they attach to the populated db without touching rows.

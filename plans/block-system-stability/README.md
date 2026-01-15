# Block System Stability Plan (Start Point)

## Scope
This plan unifies and stabilizes the block system across issues #79, #80, #117, #128.  
Focus: deterministic split/merge behavior, consistent partial updates, and a race-free open/create flow with DB as write-through cache and file as source of truth.

## Principles
- File is the source of truth; DB is write-through cache.
- All mutations write to DB, then patch the file via UUID anchors when safe.
- No reload-based reconciliation; use deterministic state transitions.
- Single source of decision-making for merge/split placement (store-level).

## Issues Covered
- #79: split behavior with children (new block placement)
- #80: backspace merge behavior
- #117: deterministic initial page open/create flow
- #128: partial updates and block store consistency

## Document Map
- `issue-79.md`: Split behavior with children (placement rules, store changes)
- `issue-80.md`: Backspace merge behavior (previous-visible logic, empty block delete)
- `issue-117.md`: Deterministic open/create flow (idempotent initial block)
- `issue-128.md`: Partial updates and rendering stability (parent rebuild, no reloads)
- `system-sync.md`: File/DB sync invariants and patching strategy
- `implementation-plan.md`: Integrated execution plan and sequencing
- `acceptance-checklist.md`: End-to-end acceptance tests

## Key Invariants
1. **Canonical navigation order**
   - “Previous block” and “insert below” are derived from a single store-level rule.
2. **Deterministic open/create**
   - Opening a new page creates at most one initial block without extra reloads.
3. **Stable partial updates**
   - Parent changes must update both old and new parents’ children lists.
4. **File patching safety**
   - Patch only when anchors and file metadata match; otherwise full rewrite.

## Execution Strategy (High-Level)
1. Define canonical placement and navigation semantics.
2. Centralize merge/split into store actions.
3. Fix open/create flow with idempotent orchestration.
4. Ensure partial updates cover parent moves and deletions.
5. Validate file patching and sync invariants.
6. Add regression coverage.

## Start Here
Read `implementation-plan.md` to get the step-by-step sequence and dependencies.
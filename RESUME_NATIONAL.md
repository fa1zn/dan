# National crawl — PAUSED checkpoint

Paused by user (leaving, internet going). Resume when they say "get back".

## State at pause
- **29,248 confirmed rooftops on disk** in 14 worktree DBs (`~/Desktop/dan-shell-*`), NOT yet merged.
  - US: 24,448 (5,371 CA/TX/FL baseline + 19,077 rest-of-US)
  - Canada: 4,800
- Canonical `data/dealerships.sqlite` UNTOUCHED (no partial merge).
- All crawl processes killed; monitor stopped; agents halted.
- Separate Honda phone-fix session (task_a67f3458) runs independently in its own worktree — ignore.

## Resume steps (in order)
1. **Re-run any incomplete brands** before merging:
   - `germanlux-misc`: Mercedes done; **Mitsubishi/Jaguar/Land Rover were mid-run** — verify counts, re-run if short.
   - `nissan-kia`: Nissan throttled re-run + Infiniti — verify both landed (Nissan was recovering from a 429 hang).
   - Spot-check GM (recovered to +2,559) actually complete.
2. **Merge**: `node merge-oem.mjs` (already US+CA country-aware; idempotent).
3. **Backfill short luxury brands** (rural anchor holes): Lexus, Genesis, Mazda, Mini — re-run with fuller anchor grid if below real footprint.
4. **Filter 86 VW-Canada `9R`-prefix service points** (not sales rooftops) out of the dealership count.
5. **Final QA**: 0 dup (oem,dealer_code); phone-collision check (Honda/Lincoln had latent phone-match bug — data was fixed, crawler bug is the separate task_a67f3458); per-state breakdown.
6. Update methodology page live counts; commit.

## Known crawler weaknesses to harden (post-merge)
- Single shared browser dies under memory pressure after ~300 anchors (stranded West Coast on Honda/Lincoln/Stellantis first passes) → recycle browser every ~120 anchors.
- Rate-limit (429) hangs on Nissan/Jeep long sweeps → throttle + backoff, lean DB-anchored grids not giant uniform grids.
- Phone-collision: geo/phone match can stamp a neighbor's code when two rooftops share a group phone.

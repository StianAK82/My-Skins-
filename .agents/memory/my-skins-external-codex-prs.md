---
name: External Codex PRs can clobber the working app
description: GitHub PRs from the user's Codex sessions replaced the working Create flow; how it was detected and restored
---

The user also runs external Codex sessions that open PRs on the GitHub repo (StianAK82/...). In late July 2026, merged PRs (#78–80, "outfit-spec / white hoodie vertical slice") **replaced the working app**: Create.tsx shrunk to a broken stub with duplicate imports (white page), the `/ai/hero-image` route was deleted, shirt-template leg zones removed, and `"packageManager": "pnpm@10.28.1"` was added to root package.json (installed pnpm is older → every pnpm command SIGABRTs trying to self-update).

**Why:** the user is non-technical and merges these PRs without knowing they conflict with the app built here.

**How to apply:**
- If "siden er hvit" reports recur, don't just restart workflows — check `git log` for fresh merge commits and run tsc; a broken merge is the likely cause.
- The `gitsafe-backup/main` ref holds an auto-committed snapshot of the working tree (including uncommitted session edits). Restore with `git checkout gitsafe-backup/main -- <paths>`, then delete tracked files added by the merge (`comm -13` on `git ls-tree` lists).
- If pnpm aborts with "pnpm add pnpm@X", remove/fix the `packageManager` field in root package.json.
- Known-good state: Create.tsx ~700 lines with garment-top/garment-bottom/motif hero-image flow; ai-v2.ts has `kind` enum with 4 values.

# Avatar preview visibility audit (main editor screen)

Date: 2026-04-05

## Result

The implemented `AvatarPreview` **is mounted inside `Editor.tsx` main center panel** and also in the optional modal dialog.

The most likely reason users report “avatar preview still not visible in the center” is that they are still on the **Dashboard creation screen** (`/dashboard`), not the editor route (`/editor/:id`).

## Evidence

- `AvatarPreview` is rendered in the center workspace of the editor, unconditionally (not gated by mode/tabs/dialog state).
- `AvatarPreview` also appears in the dialog opened by “Preview on Avatar”.
- The 3-panel grid lives in `Editor.tsx` and only appears on `/editor/:id`.
- The dashboard remains a separate pre-create flow and routes to `/editor/:id` only after project creation.

## Classification

- Primary issue type: **routing/state mismatch** (user on pre-create screen instead of editor workspace).
- Secondary issue type: **none confirmed** in editor center preview mount path (no conditional render guard blocking center preview, no zero-height class on preview container).

## Exact fix needed

1. Ensure QA/user opens a project route (`/editor/:projectId`) before validating center preview.
2. If desired UX-wise, add explicit “You are in pre-create mode” labels in dashboard and “Open Editor” CTA confirmation.
3. If reports persist while on `/editor/:id`, capture DOM + runtime errors to verify WebGL context creation in browser.


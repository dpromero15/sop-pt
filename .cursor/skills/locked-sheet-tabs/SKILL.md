---
name: locked-sheet-tabs
description: >-
  SOP-PT mobile UI pattern: keep locked overlays/sheets (no background scroll)
  and split dense content into tabs so a phone can see header + actions.
  Use when building or editing modals, sheets, player/edit forms, Config
  dialogs, or any screen that overflows the viewport on mobile.
---

# Locked sheets + tabs (mobile)

Coaches use phones. A **locked** overlay (page behind does not scroll; card stays put) is the right feel. A **single long stack** inside that lock is the bug: Save and lower fields fall off-screen.

## When this applies

- Add/edit player, profile, Config, compliance, equipment, or any `fixed inset-0` modal
- A form/view with more than ~one screen of fields, lists, or checklists
- User reports a screen “locked”, “too long”, or “can’t reach Save” on mobile

## Layout (required)

```
overlay: fixed inset-0  +  items-end sm:items-center  (no overflow-y-auto on overlay)
card:    max-h-[min(92dvh,100%)]  flex flex-col  overflow-hidden
header:  shrink-0
tabs:    shrink-0  (segmented control, same as Players/Rankings panes)
panel:   flex-1 min-h-0  overflow-y-auto overscroll-contain  (last resort)
footer:  shrink-0  (Save/Cancel always visible + safe-area padding)
```

- Do **not** scroll the overlay or the whole card to “fix” overflow.
- Do **not** drop the lock (no page-scroll modal, no unbounded height).
- Inner scroll is only for **one tab** that is still long (e.g. a checklist).

## Tabs

Split by job, not by widget count. Example — player add/edit (`PlayersView`):

| Tab | Contents |
|---|---|
| **Info** | Identity fields (name, jersey, position, demographics) |
| **Status** | Flags + notes |
| **Compliance** | Checklist (edit only, when requirements exist) |

Rules:

- 2–4 tabs. Hide tabs that do not apply (e.g. Compliance on Register).
- Save from any tab persists the **whole** form. Validate in submit; if a required field is on another tab, switch to that tab (do not use HTML `required` on hidden inputs).
- Match existing segmented control: `inline-flex rounded-xl border border-slate-800 bg-slate-950/80 p-1` + active `bg-emerald-500 text-slate-950` (or the pane’s accent).
- `role="tablist"` / `role="tab"` / `aria-selected`.

## Related

- Logger cockpit zoom/body lock (`src/utils/viewportLock.ts`) is a different lock (pinch-zoom). Do not reuse it for ordinary sheets.
- Player add/edit sheet: `src/components/PlayersView.tsx` (reference: locked card + Info / Status / Compliance).

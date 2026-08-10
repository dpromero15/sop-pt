# Working ledger — release v2.8.3

| Field | Value |
|---|---|
| **Release** | `2.8.3` |
| **Branch** | `release/v2.8.3` |
| **Last updated** | 2026-08-10 |

## Ready to ship

### Team picker “frozen” add-team UX + API/popup feedback
- **Status:** implemented (verify acceptance before PR)
- **Notes:** Empty picker shows the name field + **Create & enter** inline (no fake popup / dead “Add new team” button). API calls time out with a clear error when `VITE_API_BASE_URL` is unreachable. Google sign-in maps popup-blocked / closed errors to visible copy.
- **Touchpoints:** `TeamPickerPage.tsx`, `adminApi.ts`, `LandingPage.tsx`, `firebase.ts`

### Local mock: coach with empty roster
- **Status:** implemented (verify acceptance before PR)
- **Notes:** With `VITE_DEV_SIMULATE_AUTH=true`, landing offers **Continue as coach (empty roster)** — teamAdmin, one mock team, players/sessions cleared for local QA.
- **Touchpoints:** `firebase.ts`, `AccessProvider.tsx`, `LandingPage.tsx`, `.env.example`

**Suggested PR Closes:**
```
(none)
```

## Still open (later release)

### System Admin team hub + shadow mode (attribution-first)
- Admin lands on all teams, enters in shadow mode (never as another user); every change tracked to signed-in admin.

## Agent notes

- `2.8.2` shipped via PR #94 (empty-teams picker + Admin entry freeze).
- This line: picker UX / hung-API feedback + empty-roster coach local mock.
- Local QA: `.env.local` needs `VITE_DEV_SIMULATE_AUTH=true`, then landing → **Continue as coach (empty roster)**.

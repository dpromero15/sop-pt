# Working ledger — release v2.8.2

| Field | Value |
|---|---|
| **Release** | `2.8.2` |
| **Branch** | `release/v2.8.2` |
| **Last updated** | 2026-08-10 |

## Ready to ship

### Fix System Admin empty-teams picker and Admin entry freeze
- **Status:** implemented
- **Notes:** Opening Admin with `teamId=null` no longer dead-ends. No-API System Admin sees browser-local squad + create/rename on picker. Admin entry prefers that squad id.
- **Touchpoints:** `App.tsx`, `AccessProvider.tsx`, `TeamPickerPage.tsx`, `AdminPageView.tsx`

**Suggested PR Closes:**
```
(none)
```

## Still open (later release)

### System Admin team hub + shadow mode (attribution-first)
- Admin lands on all teams, enters in shadow mode (never as another user); every change tracked to signed-in admin.

## Agent notes

- `2.8.1` shipped via PR #93 (Hosting env guard, metrics repair, local debug mock).
- This line is the Admin empty-teams / freeze hotfix only.

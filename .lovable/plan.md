# Mobile UI cleanup: header, blue top bar, prominent Scan Book

## Goal
On phone-sized screens, clean up the top area of the app: the long library name ("Avalon Heights International School Library") currently wraps and crowds the header. The top bar should be blue, and the Scan Book button should stand out as the primary action.

## Changes

### 1. Blue mobile header (both main pages)
Files: `src/pages/Index.tsx`, `src/pages/CategoryBooks.tsx`

- On mobile (`< md`), the sticky top header gets the theme's slate-blue background (`bg-primary` / sidebar tokens) with light text — no hardcoded colors; use existing design tokens so it stays consistent in dark mode.
- On desktop, keep the current light header.

### 2. De-clutter the library name on mobile
`src/pages/Index.tsx` header:

- Title becomes a single line: smaller size on mobile, truncated with an ellipsis (`truncate`), so "Avalon Heights International School Library" never wraps or pushes buttons around.
- Subtitle ("Student: name" / "Librarian: name") hidden on very small screens or shown as one short line.
- Sign Out moves into a small overflow (⋮) menu on mobile so the top row only holds: menu toggle, app icon, one-line title, profile avatar.
- `CategoryBooks.tsx` header gets the same single-line treatment for the category title (e.g. "Fiction") with the book count as a short subtitle.

### 3. Scan Book as the most prominent action (librarian, mobile)
`src/pages/Index.tsx` action row:

- On mobile, "Scan Book" renders as a large, full-width button directly under the search bar, using the accent/gold token with a shadow — visually the strongest button on the screen.
- "Add New Book" becomes a secondary/outline button beside or below it, clearly less prominent.
- On desktop nothing changes.

## Verification
- Preview at mobile viewport (393px) as both librarian and student; confirm the title is one line, header is blue, Scan Book is the dominant button.
- Confirm desktop layout is unchanged.

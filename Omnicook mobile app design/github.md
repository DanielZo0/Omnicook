repo: DanielZo0/Omnicook
branch: main

## Last sync
date: 2026-09-14T16:31:45Z

### Updated in this project
- Recreated the web prototype's visual language (DM Sans + Playfair Display, forest green #244f3c, cream #f8f6f0, coral #ec795c, lime #d9f08b, geometric glyph icons) as a mobile app.
- Added mobile screens the web app doesn't have: onboarding, share-sheet import, AI extraction progress, review-before-save, cook mode, profile/collections.
- Vault gained three switchable layouts (grid, feed, editorial) and AI smart groups.
- Recipe data, sources and images carried over verbatim from index.html.

## Screen map
| Project screen | Repo source |
| --- | --- |
| Onboarding | index.html (palette, type, tip copy) |
| Vault / search | index.html — `.page#vault`, `.search`, `.filters`, `.grid`, `.card` |
| Import + extraction + review | index.html — `.page#import`, `.import`, `importIt()` |
| Recipe detail | index.html — `.modal`, `.recipe`, `.hero`, `.body`, `openR()`, `.chef` |
| Cook mode | index.html — `.step` method list (new mobile screen) |
| Meal planner | index.html — `.page#planner`, `.week`, `.day`, `weekDraw()` |
| Grocery list | index.html — `.grocery`, `groceries` |
| Profile / collections | index.html (avatar, sidebar nav — new mobile screen) |

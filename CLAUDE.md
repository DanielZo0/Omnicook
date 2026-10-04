# Omnicook

<!-- devwiki:pointer:start -->

## DevWiki

This project's page: `../DevWiki/projects/omnicook.md`

**At the start of a session**, read that page. It holds the decisions, open threads and
gotchas that are not in this repo. Read `../DevWiki/INDEX.md` too if you need the wider
picture, and `../DevWiki/shared/patterns/document-extraction.md` before building anything
that pulls data out of documents.

**Before the session ends**, update that page: rewrite Status and Next, append a dated
bullet under Decisions for anything expensive to re-derive, update Open threads, and add
one line to `../DevWiki/log/<YYYY-MM>.md`. Then commit the vault separately:
`wiki: <project> - <what changed>`. Decisions are append-only; supersede, never edit.

Say `/update-wiki` to do this on demand. Full protocol in `../DevWiki/CLAUDE.md`.

Never write a secret value into the vault. Key names are fine; values are not.

<!-- devwiki:pointer:end -->

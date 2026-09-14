# Omnicook browser-app plan

## Completed MVP foundation

- Responsive browser UI for saved recipes, source/category filtering, search, serving scaling, cooking checklists, and meal planning.
- Local-first recipe storage in the browser, so imported recipes remain available after refresh.
- Smart grocery-list consolidation from planned meals.
- Progressive-web-app manifest and offline app shell for installable, resilient browser use.

## Next: real AI extraction

1. Add a server-side endpoint (`POST /api/recipes/extract`) that accepts a URL or pasted caption.
2. Call Gemini from the server only; the Gemini API key must never be included in browser JavaScript.
3. Validate Gemini's structured response against a recipe schema before saving it.
4. Store source URL, creator, citation/attribution, extraction status, and any uncertainty for user review.

## Production layer

1. Add authentication and a database so each user has a private recipe vault.
2. Deploy the frontend and API together (Vercel is a good fit for this stack).
3. Add shareable recipe links, favourites, and sync across devices.

## Privacy and platform notes

Importing social-media content needs to respect each platform's access rules and creators' attribution. A real extractor should use official APIs where required and save the original source link alongside each recipe.

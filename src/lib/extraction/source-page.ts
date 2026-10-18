export function decodeEntities(text: string): string {
  return text.replace(/&#(x[0-9a-f]+|\d+);/gi, (original, code) => {
    const point = code[0].toLowerCase() === 'x' ? parseInt(code.slice(1), 16) : Number(code);
    return point >= 0 && point <= 0x10ffff ? String.fromCodePoint(point) : original;
  }).replace(/&(nbsp|quot|apos|lt|gt|amp);/g, (_, key: string) => ({nbsp: ' ', quot: '"', apos: "'", lt: '<', gt: '>', amp: '&'}[key]!));
}
function attributes(tag: string): Record<string, string> {
  const output: Record<string, string> = {};
  for (const match of tag.matchAll(/([^\s=<>]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) output[match[1].toLowerCase()] = decodeEntities(match[2] ?? match[3] ?? match[4] ?? '');
  return output;
}
export function parseSourcePage(html: string, sourceUrl?: string) {
  const meta: Record<string, string> = {};
  for (const tag of html.match(/<meta\b(?:[^"'<>]|"[^"]*"|'[^']*')*>/gi) ?? []) {
    const attr = attributes(tag), key = (attr.property || attr.name || '').toLowerCase();
    if (key && attr.content && !meta[key]) meta[key] = attr.content;
  }
  const objects: Record<string, unknown>[] = [];
  const walk = (value: unknown, depth = 0) => {
    if (depth > 25 || objects.length > 10000 || !value || typeof value !== 'object') return;
    if (Array.isArray(value)) { for (const item of value) walk(item, depth + 1); return; }
    objects.push(value as Record<string, unknown>);
    for (const child of Object.values(value)) walk(child, depth + 1);
  };
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (!/application\/(?:ld\+)?json/i.test(attributes(match[1]).type || '')) continue;
    try { walk(JSON.parse(match[2])); } catch { /* malformed data isn't a recipe */ }
  }
  const instructions = (value: unknown): string[] => {
    if (typeof value === 'string') return value.trim() ? [value.trim()] : [];
    if (Array.isArray(value)) return value.flatMap(instructions);
    if (value && typeof value === 'object') { const item = value as Record<string, unknown>; return instructions(item.itemListElement ?? item.text ?? item.name); }
    return [];
  };
  const source = sourceUrl ? new URL(sourceUrl) : null;
  const instagram = Boolean(source && /(?:^|\.)instagram\.com$/.test(source.hostname));
  const pinterest = Boolean(source && /(?:^|\.)pinterest\.[a-z.]+$/.test(source.hostname));
  const shortcode = instagram ? source?.pathname.match(/\/(?:p|reels?|tv)\/([^/]+)/)?.[1] : null;
  const pinId = pinterest ? source?.pathname.match(/\/pin\/(?:[^/]*--)?(\d+)\/?$/)?.[1] : null;
  const matchesPage = (value: unknown) => {
    if (value && typeof value === 'object') value = (value as Record<string, unknown>)['@id'];
    if (typeof value !== 'string' || !value.trim() || !source) return false;
    try { const candidate = new URL(value, source); return candidate.hostname === source.hostname && candidate.pathname.replace(/\/$/, '') === source.pathname.replace(/\/$/, ''); }
    catch { return false; }
  };
  const primaryObjects = instagram ? objects.filter(obj => Boolean(shortcode) && (obj.shortcode === shortcode || obj.code === shortcode) || matchesPage(obj.url))
    : pinterest ? objects.filter(obj => Boolean(pinId) && (obj.id === pinId || obj.entityId === pinId) || matchesPage(obj.url)) : objects;
  const ingredientText = (value: unknown): string => {
    if (typeof value === 'string') return value.trim();
    if (value && typeof value === 'object') { const item = value as Record<string, unknown>; return typeof item.name === 'string' ? [item.value, item.unitText ?? item.unitCode, item.name].filter(part => part != null).join(' ').trim() : ''; }
    return '';
  };
  const recipeCandidates = (instagram || pinterest ? primaryObjects : objects).filter(obj => [obj['@type']].flat().includes('Recipe')
    && Array.isArray(obj.recipeIngredient) && obj.recipeIngredient.some(item => ingredientText(item))
    && instructions(obj.recipeInstructions).length > 0);
  const recipe = recipeCandidates.find(obj => matchesPage(obj.url) || matchesPage(obj.mainEntityOfPage))
    ?? (recipeCandidates.length === 1 ? recipeCandidates[0] : undefined);
  const image = (value: unknown): string => {
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) return image(value[0]);
    if (value && typeof value === 'object') { const item = value as Record<string, unknown>; return image(item.url ?? item.contentUrl); }
    return '';
  };
  const captions = primaryObjects.flatMap(obj => {
    if (typeof obj.caption === 'string') return [obj.caption];
    if (obj.caption && typeof obj.caption === 'object' && typeof (obj.caption as Record<string, unknown>).text === 'string') return [(obj.caption as {text: string}).text];
    if (obj.edge_media_to_caption && typeof obj.edge_media_to_caption === 'object') return ((obj.edge_media_to_caption as {edges?: {node?: {text?: string}}[]}).edges ?? []).flatMap(edge => edge.node?.text ? [edge.node.text] : []);
    return [];
  });
  const destinations = [meta['og:see_also'], meta['pinterestapp:source']].filter(Boolean).concat(primaryObjects.flatMap(obj => {
    if (typeof obj.link === 'string' && obj.link) return [obj.link];
    if (obj.sharedContent && typeof obj.sharedContent === 'object' && typeof (obj.sharedContent as Record<string, unknown>).url === 'string') return [(obj.sharedContent as {url: string}).url];
    return [];
  }));
  const author = typeof recipe?.author === 'string' ? recipe.author : recipe?.author && typeof recipe.author === 'object' ? String((recipe.author as Record<string, unknown>).name || '') : '';
  const structuredText = recipe ? [`Recipe: ${String(recipe.name || '')}`, `Creator: ${author}`, `Servings: ${String(recipe.recipeYield || '')}`, `Prep time: ${String(recipe.prepTime || '')}; Cook time: ${String(recipe.cookTime || '')}`, 'Ingredients:', ...(recipe.recipeIngredient as unknown[]).map(ingredientText).filter(Boolean), 'Method:', ...instructions(recipe.recipeInstructions)].join('\n') : '';
  const body = decodeEntities(html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' ').replace(/<\/(?:p|div|li|h[1-6])>|<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' ')).replace(/[^\S\n]+/g, ' ').replace(/\n\s*\n/g, '\n').trim();
  return {structuredText, caption: [...new Set(captions)].join('\n\n'), title: meta['og:title'] || decodeEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || ''), description: meta['og:description'] || meta.description || meta['twitter:description'] || '', image: image(recipe?.image) || meta['og:image'] || meta['twitter:image'] || '', body, destinations};
}

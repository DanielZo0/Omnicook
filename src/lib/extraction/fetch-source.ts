import type { ImportBudget } from './import-budget';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { Agent } from 'undici';
import { normalizeImageUrl } from '../image-url';
import { parseSourcePage } from './source-page';
import { extractYoutubeVideoId, fetchYoutubeDescription } from './youtube';

const MAX_TEXT_CHARS = 10000;
const MAX_PAGE_BYTES = 2_000_000;
export class SourceReadError extends Error {}
export type ExtractedSource = {sourceUrl: string | null; imageUrl: string | null; text: string};
function isPublicAddress(address: string): boolean {
  if (isIP(address) === 6) return /^[23][0-9a-f]{3}:/i.test(address) && !/^2001:(?:db8|0):/i.test(address);
  if (isIP(address) !== 4) return false;
  const [a, b] = address.split('.').map(Number);
  return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0)) || (a === 100 && b >= 64 && b <= 127) || a === 198 && (b === 18 || b === 19));
}
export async function publicUrl(value: string) {
  let url: URL;
  try { url = new URL(value); } catch { throw new SourceReadError('Use a valid public recipe address.'); }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port && !['80', '443'].includes(url.port)) throw new SourceReadError('Use a public http or https recipe address.');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if ((!host.includes('.') && !isIP(host)) || /(?:^|\.)(?:localhost|local|internal)$/.test(host)) throw new SourceReadError('Only public recipe addresses can be imported.');
  const addresses = isIP(host) ? [{address: host, family: isIP(host)}] : await lookup(host, {all: true});
  if (!addresses.length || addresses.some(item => !isPublicAddress(item.address))) throw new SourceReadError('Only public recipe addresses can be imported.');
  return {url, addresses};
}
export async function fetchSourcePage(value: string, signal: AbortSignal, onRequest?:()=>void, allowedOrigin?:(url:URL)=>boolean) {
  let current = value;
  for (let redirects = 0; redirects <= 5; redirects++) {
    if(allowedOrigin && !allowedOrigin(new URL(current)))throw new SourceReadError('Creator search cannot leave its linked website.');
    onRequest?.();
    const {url, addresses} = await publicUrl(current);
    // Pin this request to the validated DNS answers, so a second DNS lookup
    // cannot rebind the hostname to a private destination after validation.
    const dispatcher = new Agent({connect: {autoSelectFamily: true, lookup: (_host, options, callback) => {
      if (options.all) callback(null, addresses);
      else callback(null, addresses[0].address, addresses[0].family);
    }}});
    try {
      const init: RequestInit & {dispatcher: Agent} = {signal, dispatcher, redirect: 'manual', headers: {'User-Agent': 'Mozilla/5.0 (compatible; OmnicookBot/0.2)', Accept: 'text/html,application/xhtml+xml'}};
      const response = await fetch(url.href, init);
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        await response.body?.cancel();
        if (!location) throw new SourceReadError('The source redirected without a destination. Paste its caption instead.');
        current = new URL(location, url).href;
        continue;
      }
      if (!response.ok || !/(?:text\/html|application\/xhtml\+xml)/i.test(response.headers.get('content-type') || '')) {
        await response.body?.cancel();
        throw new SourceReadError('This page could not be read. Paste the recipe caption or original recipe link instead.');
      }
      if (Number(response.headers.get('content-length')) > MAX_PAGE_BYTES) { await response.body?.cancel(); throw new SourceReadError('The source page is too large. Paste its recipe text instead.'); }
      const reader = response.body?.getReader();
      if (!reader) throw new SourceReadError('The source is empty. Paste its recipe caption instead.');
      const decoder = new TextDecoder();
      let bytes = 0, html = '';
      try {
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          bytes += chunk.value.byteLength;
          if (bytes > MAX_PAGE_BYTES) throw new SourceReadError('The source page is too large. Paste its recipe text instead.');
          html += decoder.decode(chunk.value, {stream: true});
        }
        html += decoder.decode();
      } finally { await reader.cancel().catch(() => {}); }
      return {url: url.href, page: parseSourcePage(html, url.href)};
    } finally { await dispatcher.close(); }
  }
  throw new SourceReadError('This link redirects too many times. Paste the original recipe link instead.');
}
function socialHost(host: string) { return /(?:^|\.)(?:instagram\.com|pinterest\.[a-z.]+|pin\.it)$/.test(host); }
function hasRecipeContent(text: string) {
  const measuredIngredients = /\b(?:g|kg|ml|cup|cups|tbsp|tsp|tablespoon|teaspoon|ingredients)\b/i.test(text);
  const countedIngredients = /\b\d+(?:[/.]\d+)?\s+(?!(?:likes?|comments?|followers?|views?|minutes?|hours?|seconds?|days?|steps?|recipes?)\b)[a-z]+/i.test(text);
  return text.length >= 60 && (measuredIngredients || countedIngredients) && /\b(?:method|instructions|cook|boil|fry|bake|blend|mix|stir|toss|roast|whisk|add|heat|simmer|mash)\b/i.test(text);
}
export async function resolveSource(source: string): Promise<ExtractedSource> {
  const trimmed = source.trim();
  if (!/^https?:\/\//i.test(trimmed)) return {sourceUrl: null, imageUrl: null, text: trimmed.slice(0, MAX_TEXT_CHARS)};
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 14000);
  try {
    const parsed = new URL(trimmed);
    if (/(?:^|\.)(?:instagram\.com|pinterest\.[a-z.]+)$/.test(parsed.hostname)) for (const key of [...parsed.searchParams.keys()]) if (/^(?:igsh|utm_|fbclid)/i.test(key)) parsed.searchParams.delete(key);
    const videoId = extractYoutubeVideoId(parsed.href);
    if (videoId) {
      await publicUrl(parsed.href);
      const video = await fetchYoutubeDescription(videoId, controller.signal).catch(() => null);
      if (video) return {sourceUrl: parsed.href, imageUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`, text: `${video.title}\n\n${video.description}`.slice(0, MAX_TEXT_CHARS)};
    }
    const original = await fetchSourcePage(parsed.href, controller.signal);
    let selected = original;
    if (/(?:^|\.)(?:pinterest\.[a-z.]+|pin\.it)$/.test(new URL(original.url).hostname)) {
      for (const link of original.page.destinations.slice(0, 3)) {
        let destination: URL;
        try { destination = new URL(link, original.url); } catch { continue; }
        if (socialHost(destination.hostname)) continue;
        try {
          const candidate = await fetchSourcePage(destination.href, controller.signal);
          if (candidate.page.structuredText || hasRecipeContent(candidate.page.body)) { selected = candidate; break; }
        } catch (error) {
          if (error instanceof SourceReadError && /public|address/.test(error.message)) throw error;
        }
      }
    }
    const page = selected.page, isSocial = socialHost(new URL(selected.url).hostname);
    const text = page.structuredText || (isSocial ? [page.caption, page.description].filter(Boolean).join('\n\n') : [page.title, page.description, page.body].filter(Boolean).join('\n\n'));
    if (!text.trim() || (isSocial && !hasRecipeContent(text) && !page.structuredText)) throw new SourceReadError('This post does not expose a complete recipe. Paste the full caption or the original recipe link instead.');
    return {sourceUrl: original.url, imageUrl: normalizeImageUrl(page.image, selected.url), text: text.slice(0, MAX_TEXT_CHARS)};
  } catch (error) {
    if (error instanceof SourceReadError) throw error;
    throw new SourceReadError('Could not read this source. Paste the full recipe caption or original recipe link instead.');
  } finally { clearTimeout(timer); }
}

export type SourceDocument={sourceUrl:string|null;imageUrl:string|null;text:string;page:ReturnType<typeof parseSourcePage>|null};
export async function readSource(source:string,budget:ImportBudget):Promise<SourceDocument>{
 const input=source.trim();
 if(!/^https?:\/\//i.test(input))return {sourceUrl:null,imageUrl:null,text:input.slice(0,10000),page:null};
 if(extractYoutubeVideoId(input)){const result=await budget.runSource(()=>resolveSource(input));return {...result,page:null};}
 const result=await budget.runSource(signal=>fetchSourcePage(input,signal));
 const page=result.page,isSocial=socialHost(new URL(result.url).hostname);
 const text=page.structuredText||(isSocial?[page.caption,page.description].filter(Boolean).join('\n\n'):[page.title,page.description,page.body].filter(Boolean).join('\n\n'));
 if(!text.trim()||(isSocial&&text.length<60))throw new SourceReadError('This post cannot be read. Paste its full caption or original recipe link.');
 return {sourceUrl:result.url,imageUrl:normalizeImageUrl(page.image,result.url),text:text.slice(0,10000),page};
}

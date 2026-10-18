import { Agent } from 'undici';
import { publicUrl } from '../extraction/fetch-source';

export async function readBounded(response: Response, limit: number): Promise<Buffer> {
  if (Number(response.headers.get('content-length')) > limit) {
    await response.body?.cancel();
    throw new Error('Response too large');
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Empty response');
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > limit) throw new Error('Response too large');
      chunks.push(value);
    }
    return Buffer.concat(chunks);
  } finally { await reader.cancel().catch(() => {}); }
}

export async function fetchPublicPhoto(value: string, signal: AbortSignal): Promise<Buffer> {
  let current = value;
  for (let redirects = 0; redirects <= 3; redirects++) {
    signal.throwIfAborted();
    // DNS resolution itself must also fit the deadline.
    let abort: (() => void) | undefined;
    const validated = await Promise.race([
      publicUrl(current),
      new Promise<never>((_resolve, reject) => {
        abort = () => reject(signal.reason);
        signal.addEventListener('abort', abort, {once:true});
      }),
    ]).finally(() => { if (abort) signal.removeEventListener('abort', abort); });
    const {url, addresses} = validated;
    const dispatcher = new Agent({connect:{autoSelectFamily:true, lookup: (_host, options, callback) => {
      if (options.all) callback(null, addresses);
      else callback(null, addresses[0].address, addresses[0].family);
    }}});
    try {
      const init: RequestInit & {dispatcher: Agent} = {dispatcher, signal, redirect:'manual', headers:{Accept:'image/jpeg,image/png,image/webp,image/avif', 'User-Agent':'Omnicook/0.1 (recipe photos)'}};
      const response = await fetch(url.href, init);
      if ([301,302,303,307,308].includes(response.status)) {
        const location = response.headers.get('location');
        await response.body?.cancel();
        if (!location) throw new Error('Missing image redirect');
        current = new URL(location,url).href;
        continue;
      }
      if (!response.ok || !/^image\/(?:jpeg|png|webp|avif|heif|heic)(?:;|$)/i.test(response.headers.get('content-type') || '')) {
        await response.body?.cancel();
        throw new Error('Not a readable recipe photo');
      }
      return await readBounded(response, 4_000_000);
    } finally { await dispatcher.close(); }
  }
  throw new Error('Too many image redirects');
}

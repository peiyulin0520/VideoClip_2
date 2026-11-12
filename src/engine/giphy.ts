export type GiphySticker = { id: string; title: string; url: string; gif: string; preview: string };
export function safeGiphyUrl(value: unknown): string | null {
  try {
    const u = new URL(String(value));
    return u.protocol === 'https:' &&
      (u.hostname === 'giphy.com' ||
        u.hostname.endsWith('.giphy.com') ||
        u.hostname.endsWith('.giphyusercontent.com'))
      ? u.href
      : null;
  } catch {
    return null;
  }
}
export async function searchGiphy(
  key: string,
  query: string,
  signal?: AbortSignal,
  offset = 0,
): Promise<GiphySticker[]> {
  if (!key.trim()) throw Error('請先貼上並儲存自己的 GIPHY API Key');
  const url = new URL(`https://api.giphy.com/v1/stickers/${query.trim() ? 'search' : 'trending'}`);
  url.searchParams.set('api_key', key.trim());
  url.searchParams.set('limit', '20');
  url.searchParams.set('offset', String(offset));
  url.searchParams.set('rating', 'g');
  if (query.trim()) url.searchParams.set('q', query.trim());
  const response = await fetch(url, {
    signal,
    credentials: 'omit',
    cache: 'no-store',
    referrerPolicy: 'no-referrer',
  });
  if (!response.ok)
    throw Error(
      response.status === 429
        ? 'GIPHY 搜尋額度已達上限，請稍後再試'
        : 'GIPHY 無法搜尋，請確認 Key 或稍後再試',
    );
  const body = (await response.json()) as {
    data?: {
      id?: string;
      title?: string;
      url?: string;
      images?: { original?: { url?: string }; fixed_width?: { url?: string } };
    }[];
  };
  return (body.data ?? []).flatMap((entry) => {
    const gif = safeGiphyUrl(entry.images?.original?.url),
      preview = safeGiphyUrl(entry.images?.fixed_width?.url) ?? gif,
      page = safeGiphyUrl(entry.url);
    return gif && preview && page && entry.id
      ? [{ id: entry.id, title: entry.title || 'GIPHY 貼圖', url: page, gif, preview }]
      : [];
  });
}

/**
 * YouTube Data API v3: search by concept, filter by views (>= 5k) and duration (1–5 min).
 * Hybrid: use curated video IDs first if present for the concept.
 */

const MIN_VIEWS = 5000;
const MIN_DURATION_SEC = 60;
const MAX_DURATION_SEC = 300;

export interface YouTubeVideo {
  videoId: string;
  title: string;
  thumbnailUrl: string;
  viewCount: number;
  durationSec: number;
  wellExplained: boolean;
}

function parseDuration(iso: string): number {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const h = parseInt(match[1] || '0', 10);
  const m = parseInt(match[2] || '0', 10);
  const s = parseInt(match[3] || '0', 10);
  return h * 3600 + m * 60 + s;
}

function parseViewCount(s: string | undefined): number {
  if (s === undefined) return 0;
  const n = parseInt(s, 10);
  return isNaN(n) ? 0 : n;
}

/**
 * Fetch one "well-explained" video for a concept.
 * Uses curated IDs first if provided; otherwise searches with viewCount and duration filters.
 */
export async function fetchVideoForConcept(
  apiKey: string,
  conceptId: string,
  conceptLabel: string,
  curatedVideoIds: string[] | undefined
): Promise<YouTubeVideo | null> {
  const query = `${conceptLabel} python explanation`;
  const base = 'https://www.googleapis.com/youtube/v3';

  // If we have curated IDs, try to use the first one that has stats meeting our bar
  if (curatedVideoIds && curatedVideoIds.length > 0) {
    const details = await fetchVideoDetails(apiKey, base, curatedVideoIds.slice(0, 5));
    for (const v of details) {
      if (v.viewCount >= MIN_VIEWS && v.durationSec >= MIN_DURATION_SEC && v.durationSec <= MAX_DURATION_SEC) {
        return { ...v, wellExplained: true };
      }
    }
    // If none of curated pass, still return first curated with any stats
    if (details.length > 0) {
      return { ...details[0], wellExplained: details[0].viewCount >= MIN_VIEWS };
    }
  }

  // Search: short duration, order by viewCount
  const searchUrl = `${base}/search?part=snippet&type=video&videoDuration=short&order=viewCount&maxResults=10&q=${encodeURIComponent(query)}&key=${apiKey}`;
  let res: Response;
  try {
    res = await fetch(searchUrl);
  } catch (e) {
    return null;
  }
  if (!res.ok) return null;
  const searchData = (await res.json()) as { items?: { id?: { videoId?: string } }[] };
  const videoIds = (searchData.items || [])
    .map((i) => i.id?.videoId)
    .filter((id): id is string => !!id)
    .slice(0, 10);
  if (videoIds.length === 0) return null;

  const details = await fetchVideoDetails(apiKey, base, videoIds);
  const passing = details.filter(
    (v) => v.viewCount >= MIN_VIEWS && v.durationSec >= MIN_DURATION_SEC && v.durationSec <= MAX_DURATION_SEC
  );
  const pick = passing[0] ?? details[0];
  return pick ? { ...pick, wellExplained: passing.length > 0 } : null;
}

async function fetchVideoDetails(
  apiKey: string,
  base: string,
  videoIds: string[]
): Promise<Omit<YouTubeVideo, 'wellExplained'>[]> {
  const idParam = videoIds.join(',');
  const url = `${base}/videos?part=snippet,statistics,contentDetails&id=${idParam}&key=${apiKey}`;
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    return [];
  }
  if (!res.ok) return [];
  const data = (await res.json()) as {
    items?: {
      id: string;
      snippet?: { title?: string; thumbnails?: { default?: { url?: string }; medium?: { url?: string } } };
      statistics?: { viewCount?: string };
      contentDetails?: { duration?: string };
    }[];
  };
  const items = data.items || [];
  return items.map((item) => {
    const thumb = item.snippet?.thumbnails?.medium?.url ?? item.snippet?.thumbnails?.default?.url ?? '';
    const durationSec = parseDuration(item.contentDetails?.duration ?? '');
    const viewCount = parseViewCount(item.statistics?.viewCount);
    return {
      videoId: item.id,
      title: item.snippet?.title ?? '',
      thumbnailUrl: thumb,
      viewCount,
      durationSec,
    };
  });
}

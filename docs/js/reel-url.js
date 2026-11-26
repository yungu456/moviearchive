const INSTAGRAM_HOSTS = new Set(["instagram.com", "www.instagram.com", "m.instagram.com"]);
const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"]);
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const verifiedReelTitles = new Map([
  ["https://www.instagram.com/reel/DZARatCoe8N/", "월플라워"],
]);

export function verifiedReelTitle(reelUrl) {
  return verifiedReelTitles.get(reelUrl);
}

export function normalizeSourceUrl(input) {
  const value = input.trim();
  if (!value) return undefined;

  const message = "인스타그램 릴스나 유튜브 쇼츠의 HTTPS 링크를 입력해 주세요.";
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(message);
  }

  if (url.protocol === "https:" && !url.port && !url.username && !url.password) {
    if (INSTAGRAM_HOSTS.has(url.hostname)) {
      const reel = /^\/(?:reel|reels)\/([A-Za-z0-9_-]+)\/?$/.exec(url.pathname);
      if (reel) return `https://www.instagram.com/reel/${reel[1]}/`;
    }
    if (YOUTUBE_HOSTS.has(url.hostname)) {
      const id = url.hostname === "youtu.be"
        ? /^\/([^/]+)\/?$/.exec(url.pathname)?.[1]
        : url.pathname === "/watch"
          ? url.searchParams.get("v")
          : /^\/shorts\/([^/]+)\/?$/.exec(url.pathname)?.[1];
      if (id && YOUTUBE_ID.test(id)) return `https://www.youtube.com/shorts/${id}`;
    }
  }
  throw new Error(message);
}

export function extractSharedSource(fields) {
  for (const field of fields) {
    if (typeof field !== "string") continue;
    const links = field.slice(0, 8192).matchAll(/https:\/\/[^\s<>"']+/gi);
    for (const [link] of links) {
      try {
        return normalizeSourceUrl(link.replace(/[),.!?\]}>]+$/, ""));
      } catch {
        // Sharing apps can include unrelated links alongside the video.
      }
    }
  }
}

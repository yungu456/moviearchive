import { fillMovieTitle } from "./db.js?v=13";
import { reelTitleEndpoint } from "./settings.js?v=17";
import { verifiedReelTitle } from "./reel-url.js?v=17";

export async function resolveReelTitle(movie) {
  if (!movie.reelUrl || movie.title) return { movie };
  let title = verifiedReelTitle(movie.reelUrl);
  let releaseYear;
  if (!title) {
    try {
      const response = await fetch(reelTitleEndpoint, {
        method: "POST",
        body: new URLSearchParams({ reelUrl: movie.reelUrl }),
        credentials: "omit",
        signal: AbortSignal.timeout(9000),
      });
      if (!response.ok) return { movie, reason: "connection" };
      const result = await response.json();
      if (typeof result.title !== "string" || !result.title.trim() || result.title.length > 160) {
        return { movie, reason: result.reason === "upstream-unavailable" ? result.reason : "title-not-found" };
      }
      title = result.title.trim();
      releaseYear = result.releaseYear;
    } catch {
      return { movie, reason: "connection" };
    }
  }
  try {
    const updated = await fillMovieTitle(movie.id, movie.reelUrl, title, releaseYear);
    return updated?.title ? { movie: updated } : { movie, reason: "storage" };
  } catch {
    return { movie, reason: "storage" };
  }
}

export async function fillReelTitle(movie) {
  return (await resolveReelTitle(movie)).movie;
}

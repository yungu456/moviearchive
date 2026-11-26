import { fillMovieTitle } from "./db.js?v=13";
import { reelTitleEndpoint } from "./settings.js";

export async function fillReelTitle(movie) {
  if (!movie.reelUrl || movie.title) return movie;
  try {
    const response = await fetch(reelTitleEndpoint, {
      method: "POST",
      body: new URLSearchParams({ reelUrl: movie.reelUrl }),
      credentials: "omit",
      signal: AbortSignal.timeout(9000),
    });
    if (!response.ok) return movie;
    const { title, releaseYear } = await response.json();
    if (typeof title === "string" && title.trim() && title.length <= 160) {
      return (await fillMovieTitle(movie.id, movie.reelUrl, title.trim(), releaseYear)) ?? movie;
    }
  } catch {
    // The link has already been committed. It can be saved or shared again to retry.
  }
  return movie;
}

const lookupCache = new Map();
const filmPageCache = new Map();
const imageHosts = new Set(["upload.wikimedia.org", "thumb.wikimedia.org"]);
const lookupLimit = 160;
let lookupQueue = Promise.resolve();

const verifiedPosters = [
  {
    localTitle: "기생충", originalTitle: "Parasite", year: 2019, originalTitleNeedsYear: true,
    filename: "기생충_포스터.jpg", imagePath: "/wikipedia/ko/6/60/기생충_포스터.jpg",
    host: "upload.wikimedia.org",
  },
  {
    localTitle: "그랜드 부다페스트 호텔", originalTitle: "The Grand Budapest Hotel", year: 2014,
    filename: "그랜드부다페스트호텔_포스터.jpg",
    imagePath: "/wikipedia/ko/thumb/5/5a/그랜드부다페스트호텔_포스터.jpg/330px-그랜드부다페스트호텔_포스터.jpg",
    host: "thumb.wikimedia.org",
  },
];

function titleKey(value) {
  return value.normalize("NFKC").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

function verifiedPoster(title, year) {
  const key = titleKey(title);
  const poster = verifiedPosters.find((item) => {
    if (year && Number(year) !== item.year) return false;
    return key === titleKey(item.localTitle) ||
      ((!item.originalTitleNeedsYear || year) && key === titleKey(item.originalTitle));
  });
  if (!poster) return null;
  return {
    image: new URL(poster.imagePath, `https://${poster.host}`).href,
    source: new URL(`/wiki/File:${poster.filename}`, "https://ko.wikipedia.org").href,
  };
}

function baseTitle(value) {
  return value.replace(/\s+\((?:(?:18|19|20)\d{2}(?:년)?\s+)?(?:film|movie|영화)\)$/i, "");
}

async function pagesFor(language, query, exact = false) {
  const url = new URL(`https://${language}.wikipedia.org/w/api.php`);
  url.search = new URLSearchParams({
    action: "query", format: "json", formatversion: "2", origin: "*",
    prop: "pageimages|pageterms|langlinks", piprop: "name|thumbnail", pithumbsize: "330",
    pilicense: "any", wbptterms: "description", lllang: "en", redirects: "1",
    ...(exact ? { titles: query } : { generator: "prefixsearch", gpssearch: query, gpslimit: "12" }),
  });
  const response = await fetch(url, {
    credentials: "omit", referrerPolicy: "no-referrer", signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error("Wikipedia poster lookup failed");
  const data = await response.json();
  return data.query?.pages ?? [];
}

function isMatchingFilm(page, key) {
  if (titleKey(baseTitle(page.title)) !== key) return false;
  const description = page.terms?.description?.[0] ?? "";
  return /\bfilm\b|영화/i.test(description) || baseTitle(page.title) !== page.title ||
    (!description && /poster|포스터/i.test(page.pageimage ?? ""));
}

function filmYear(page) {
  const inTitle = page.title.match(/\(((?:18|19|20)\d{2})(?:년)?\s+(?:film|movie|영화)\)$/i)?.[1];
  const inDescription = (page.terms?.description?.[0] ?? "").match(/\b(?:18|19|20)\d{2}\b/)?.[0];
  return inTitle ?? inDescription;
}

function posterFrom(page, language) {
  const image = page.thumbnail;
  if (!image?.source || !page.pageimage || image.width < 100 || image.width / image.height > 0.83 ||
      !/\.(?:jpe?g|png|webp)$/i.test(page.pageimage) || /soundtrack|album|logo|screenshot|사운드트랙/i.test(page.pageimage)) {
    return null;
  }
  const url = new URL(image.source);
  if (url.protocol !== "https:" || !imageHosts.has(url.hostname) || url.port || url.username || url.password ||
      !url.pathname.startsWith("/wikipedia/")) return null;
  url.search = "";
  url.hash = "";
  const source = new URL(`/wiki/File:${encodeURIComponent(page.pageimage.replaceAll(" ", "_"))}`,
    `https://${language}.wikipedia.org`);
  return { image: url.href, source: source.href };
}

async function resolveFilmPage({ title, releaseYear }) {
  const language = /\p{Script=Hangul}/u.test(title) ? "ko" : "en";
  const key = titleKey(title);
  const year = releaseYear ? String(releaseYear) : undefined;
  let pages = (await pagesFor(language, title)).filter((page) => isMatchingFilm(page, key));
  if (year) {
    const sameYear = pages.filter((page) => filmYear(page) === year);
    pages = sameYear.length ? sameYear : pages.filter((page) => !filmYear(page));
  }
  if (pages.length !== 1) return null;
  const page = pages[0];
  const confirmedYear = !year || filmYear(page) === year;
  const englishTitle = page.langlinks?.find((link) => link.lang === "en")?.title;
  if (confirmedYear) return { page, language, englishTitle };
  if (language === "en" || !englishTitle) return null;
  const [englishPage] = await pagesFor("en", englishTitle, true);
  return englishPage && filmYear(englishPage) === year ? { page, language, englishTitle, englishPage } : null;
}

export function lookupFilmPage(movie) {
  const key = JSON.stringify([movie.title, movie.releaseYear]);
  if (!filmPageCache.has(key)) {
    const lookup = resolveFilmPage(movie).catch(() => {
      filmPageCache.delete(key);
      return null;
    });
    filmPageCache.set(key, lookup);
  }
  return filmPageCache.get(key);
}

async function findPoster(movie) {
  const film = await lookupFilmPage(movie);
  if (!film) return null;
  const { page, language, englishTitle } = film;
  const poster = posterFrom(page, language);
  if (poster || language === "en" || !englishTitle) return poster;
  const englishPage = film.englishPage ?? (await pagesFor("en", englishTitle, true))[0];
  return englishPage ? posterFrom(englishPage, "en") : null;
}

export function lookupPoster(movie) {
  const title = movie.title?.trim();
  if (!title || title.length > lookupLimit) return Promise.resolve(null);
  const poster = verifiedPoster(title, movie.releaseYear);
  if (poster) return Promise.resolve(poster);
  const key = JSON.stringify([title, movie.releaseYear]);
  if (!lookupCache.has(key)) {
    const lookup = lookupQueue.then(async () => {
      const result = await findPoster({ ...movie, title });
      if (!result && !filmPageCache.has(key)) lookupCache.delete(key);
      return result;
    }).catch(() => {
      lookupCache.delete(key);
      return null;
    });
    lookupQueue = lookup;
    lookupCache.set(key, lookup);
  }
  return lookupCache.get(key);
}

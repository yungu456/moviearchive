import { lookupFilmPage, lookupFilmSummary } from "./poster-lookup.js?v=22";
import { articleDocument, fetchArticle, isFilmArticle, openingPlot, receptionExcerpt } from "./article-content.js?v=25";
import { reelTitleEndpoint } from "./settings.js?v=17";

const watcha = (id, summary) => ({
  author: "이동진", publisher: "왓챠피디아", summary, url: `https://pedia.watcha.com/ko/comments/${id}`,
});
const ebert = (author, slug, summary) => ({
  author, publisher: "RogerEbert.com", summary, url: `https://www.rogerebert.com/reviews/${slug}`,
});
const guardian = (author, path, summary) => ({
  author, publisher: "The Guardian", summary, url: `https://www.theguardian.com/film/${path}`,
});

const featured = [
  {
    titles: ["라라랜드", "La La Land"], year: 2016, genre: "뮤지컬 · 로맨스",
    reviews: [
      watcha("GO6MZX4l9bENx", "영화가 쌓아 올린 기쁨과 아쉬움이 한순간에 응축되는 연출에 주목했다."),
      ebert("브라이언 탈레리코", "la-la-land-2016", "사랑과 꿈이 서로에게 미치는 영향을 두 배우의 연기와 음악으로 설득력 있게 그린다고 평가했다."),
    ],
  },
  {
    titles: ["듄: 파트 2", "Dune: Part Two", "Dune: Part 2"], year: 2024, genre: "SF · 모험",
    reviews: [
      watcha("8n92V8DnAeQAJ", "디테일을 치밀하게 다듬은 연출과 이야기를 풀어가는 우아한 방식에 주목했다."),
      ebert("브라이언 탈레리코", "dune-part-two-movie-review-2024", "대규모 볼거리와 권력에 대한 질문을 결합한 속편이라며, 특히 촬영과 미술의 완성도를 높이 평가했다."),
      guardian("피터 브래드쇼", "2024/feb/21/dune-part-two-review-denis-villeneuve", "강렬한 이미지가 저항과 권력, 로맨스를 한데 묶는 장대한 SF라고 평했다."),
    ],
  },
  {
    titles: ["듄", "Dune"], year: 2021, requireYear: true, genre: "SF · 모험",
    reviews: [
      ebert("글렌 케니", "dune-movie-review-2021", "원작의 세계를 충실하게 옮기면서도 기술진의 솜씨로 장대한 극장 경험을 만든 점을 높이 평가했다."),
      guardian("피터 브래드쇼", "2021/oct/20/dune-review-denis-villeneuves-awe-inspiring-epic-is-a-moment-of-triumph", "방대한 원작을 압도적인 규모의 영화로 구현한 빌뇌브의 연출을 호평했다."),
    ],
  },
  {
    titles: ["인터스텔라", "Interstellar"], year: 2014, genre: "SF · 드라마",
    reviews: [
      ebert("맷 졸러 사이츠", "interstellar-2014", "거대한 스케일과 필름의 질감에 주목하면서도, 과도한 설명과 음향에는 비판적인 평가를 내렸다."),
      {
        author: "이동진", publisher: "이동진의 파이아키아", summary: "궤도와 함께 영화가 다루는 우주 과학과 사랑을 짚은 영상 해설.",
        url: "https://www.youtube.com/watch?v=olY3yQkIpmA",
      },
    ],
  },
  {
    titles: ["컨택트", "Arrival"], year: 2016, genre: "SF · 드라마",
    reviews: [
      watcha("Vw8MLqw93DQel", "전례를 찾기 어려운 이야기와 처음부터 끝까지 이어지는 지적인 긴장감을 호평했다."),
      ebert("브라이언 탈레리코", "arrival-2016", "외계와의 조우를 통해 소통과 공감을 이야기하는 영화로 보았으며, 에이미 애덤스의 연기를 높이 평가했다."),
    ],
  },
  {
    titles: ["기생충", "Parasite"], year: 2019, genre: "블랙코미디 · 스릴러",
    reviews: [
      watcha("xzaQAkqBWN2g5", "위와 아래를 오가는 공간의 연출로 계급 차이를 선명하게 드러낸다고 보았다."),
      ebert("브라이언 탈레리코", "parasite-movie-review-2019", "예측하기 어려운 전개 자체가 재미있는 동시에 사회의 구조적 불평등을 날카롭게 파고든다고 평가했다."),
    ],
  },
  {
    titles: ["그랜드 부다페스트 호텔", "The Grand Budapest Hotel"], year: 2014, genre: "코미디 · 모험",
    reviews: [
      watcha("j7kQzKbKNEl4J", "직접 살아본 적 없는 시대와 세계를 향한 깊은 향수를 읽었다."),
      guardian("피터 브래드쇼", "2014/mar/06/the-grand-budapest-hotel-wes-anderson-review", "정교하게 설계된 호텔과 그 안에서 벌어지는 희극에 관객을 깊이 몰입시킨다고 평가했다."),
    ],
  },
];

const critics = new Map([
  ["Roger Ebert", "로저 이버트"], ["Peter Bradshaw", "피터 브래드쇼"],
  ["Mark Kermode", "마크 커모드"], ["Brian Tallerico", "브라이언 탈레리코"],
  ["Matt Zoller Seitz", "맷 졸러 사이츠"], ["Glenn Kenny", "글렌 케니"],
  ["Manohla Dargis", "마놀라 다기스"], ["A. O. Scott", "A. O. 스콧"],
]);
const publishers = new Map([
  ["rogerebert.com", "RogerEbert.com"], ["theguardian.com", "The Guardian"],
  ["nytimes.com", "The New York Times"],
  ["latimes.com", "Los Angeles Times"], ["rollingstone.com", "Rolling Stone"], ["variety.com", "Variety"],
  ["hollywoodreporter.com", "The Hollywood Reporter"], ["chicagotribune.com", "Chicago Tribune"],
  ["washingtonpost.com", "The Washington Post"], ["empireonline.com", "Empire"], ["indiewire.com", "IndieWire"],
]);
const detailCache = new Map();
const fightClub = {
  title: "Fight Club",
  year: 1999,
  intro: "보험사에서 일하는 이름 없는 남자가 수면 문제로 의사를 찾아간다.",
  reviews: [
    ebert("로저 이버트", "fight-club-1999", "초반부의 풍자와 연출은 높게 평가했지만, 영화가 폭력을 다루는 방식에는 비판적이었다."),
    guardian("피터 브래드쇼", "2024/mar/13/fight-club-review-prescient-tremendously-acted-classic-still-feels-overblown",
      "배우들의 연기와 시대를 앞서 읽은 면은 호평하면서도 영화의 과장된 표현에는 거리를 뒀다."),
  ],
};

const shawshank = {
  year: 1994,
  title: "The Shawshank Redemption",
  intro: "1947년, 은행원 앤디 듀프레인은 두 사람을 살해한 혐의로 종신형을 선고받고 쇼생크 교도소에 수감된다.",
  reviews: [
    ebert("로저 이버트", "the-shawshank-redemption-1994", "절망에 맞서는 두 사람의 우정을 통해 인내와 신뢰의 가치를 보여준다고 평했다."),
    guardian("스콧 토비어스", "2024/sep/23/shawshank-redemption-30th-anniversary",
      "역대 최고의 영화라는 평에는 동의하지 않으면서도, 모건 프리먼의 연기와 오랫동안 관객에게 울림을 준 점에 주목했다."),
  ],
};
const wallflower = {
  year: 2012,
  title: "The Perks of Being a Wallflower (film)",
  intro: "1991년, 내성적인 찰리가 고등학교에 입학한다. 낯선 학교생활을 시작한 찰리는 상급생 패트릭과 샘을 만난다.",
  reviews: [
    ebert("로저 이버트", "the-perks-of-being-a-wallflower-2012", "원작자가 직접 연출한 각색과 배역에 잘 맞는 배우들의 연기를 호평했다."),
    guardian("피터 브래드쇼", "2012/oct/04/perks-of-being-wallflower-review",
      "십 대의 고민을 다루는 방식이 작위적이며, 에즈라 밀러가 맡은 인물을 충분히 깊게 그리지 못했다고 평했다."),
  ],
};

function key(value) {
  return value.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

function filmArticle(language, title) {
  return `https://${language}.wikipedia.org/wiki/${encodeURIComponent(title.replaceAll(" ", "_"))}`;
}

export function findReviewLinks(html, title) {
  const document = articleDocument(html);
  const titleKey = key(title.replace(/\s+\([^)]*\)$/, ""));
  if (titleKey.length < 3) return [];
  const reviews = new Map();
  for (const citation of document.querySelectorAll("cite")) {
    const link = citation.querySelector("a.external[href], a[rel~='mw:ExtLink'][href]");
    if (!link?.textContent.trim()) continue;
    let url;
    try {
      url = new URL(link.getAttribute("href"), "https://en.wikipedia.org");
    } catch {
      continue;
    }
    if (url.protocol !== "https:" || url.port || url.username || url.password) continue;
    const publisher = publishers.get(url.hostname.replace(/^www\./, ""));
    if (!publisher) continue;
    const label = link.textContent.trim().replace(/^(?:(?:movie|film) )?review\s*:\s*/i, "")
      .split(/\s+(?:(?:(?:movie|film) )?review\b|\((?:18|19|20)\d{2}\))/i)[0];
    const slug = url.pathname.split("/").filter(Boolean).at(-1)?.replace(/^great-movie-/, "")
      .replace(/-(?:movie-review-|film-review-|review-)?(?:18|19|20)\d{2}$/, "");
    if (key(label) !== titleKey && (!slug || key(slug) !== titleKey)) continue;
    const byline = citation.textContent.split(link.textContent)[0].trim();
    const prefix = key(byline);
    const known = [...critics].find(([name]) => {
      const names = name.split(" ");
      return prefix.includes(key(name)) || prefix.includes(key([names.at(-1), ...names.slice(0, -1)].join(" ")));
    });
    const raw = byline.match(/^([\p{L}.'’ -]{2,35}),\s*([\p{L}.'’ -]{2,35})\s*\(/u);
    const name = known?.[0] ?? (raw && `${raw[2].trim()} ${raw[1].trim()}`);
    const author = known?.[1] ?? name;
    if (!author || reviews.has(author)) continue;
    const summary = receptionExcerpt(document, name);
    if (!summary && !/review/i.test(url.pathname + " " + link.textContent)) continue;
    reviews.set(author, { author, publisher, summary, url: url.href });
    if (reviews.size >= 8) break;
  }
  return [...reviews.values()];
}

async function englishArticle(item) {
  if (!/^Q\d+$/.test(item ?? "")) return undefined;
  const endpoint = new URL("https://www.wikidata.org/w/api.php");
  endpoint.search = new URLSearchParams({
    action: "wbgetentities", ids: item, props: "sitelinks", sitefilter: "enwiki", format: "json", origin: "*",
  });
  const response = await fetch(endpoint, {
    credentials: "omit", referrerPolicy: "no-referrer", signal: AbortSignal.timeout(3500),
  });
  if (!response.ok) return undefined;
  const { entities } = await response.json();
  return entities?.[item]?.sitelinks?.enwiki?.title;
}

async function fetchReviews(title) {
  const html = await fetchArticle("en", title);
  if (!html) return [];
  const candidates = findReviewLinks(html, title);
  const reviews = candidates.filter(({ summary }) => summary);
  if (reviews.length >= 2) return reviews.slice(0, 3);
  const missing = candidates.filter(({ summary }) => !summary).slice(0, 4);
  if (!missing.length) return reviews;

  const body = new URLSearchParams(missing.map(({ url }) => ["url", url]));
  const endpoint = new URL("review-previews", reelTitleEndpoint);
  const response = await fetch(endpoint, {
    method: "POST", body, credentials: "omit", referrerPolicy: "no-referrer", signal: AbortSignal.timeout(4500),
  }).catch(() => null);
  if (!response?.ok) return reviews;
  const data = await response.json().catch(() => ({}));
  const previews = new Map((data.previews ?? []).filter(({ summary }) =>
    typeof summary === "string" && summary.trim() && summary.length <= 500).map(({ url, summary }) => [url, summary]));
  return [...reviews, ...missing.filter(({ url }) => previews.has(url)).map((review) =>
    ({ ...review, summary: previews.get(review.url) }))].slice(0, 3);
}

function verifiedPlot(movie) {
  const title = key(movie.title ?? "");
  if ((!movie.releaseYear || movie.releaseYear === 1999) && ["fightclub", "파이트클럽"].includes(title)) return fightClub;
  if ((!movie.releaseYear || movie.releaseYear === 1994) && ["theshawshankredemption", "쇼생크탈출"].includes(title)) return shawshank;
  if ((!movie.releaseYear || movie.releaseYear === 2012) &&
      ["theperksofbeingawallflower", "theperksofbeingawallflowerfilm", "월플라워"].includes(title)) return wallflower;
}

export function featuredFilm(movie) {
  const title = key(movie.title ?? "");
  return featured.find((film) =>
    (!movie.releaseYear ? !film.requireYear : film.year === movie.releaseYear) &&
    film.titles.some((name) => key(name) === title));
}

export async function lookupFilmIntroduction(movie) {
  if (!movie.title) return {};
  const verified = verifiedPlot(movie);
  if (verified) {
    return { ...verified, source: filmArticle("en", verified.title) + "#Plot" };
  }
  const known = featuredFilm(movie);
  const film = await lookupFilmPage(movie);
  const fallback = film ? null : await lookupFilmSummary(movie);
  const localTitle = film?.page.title ?? fallback?.summary.title;
  const language = film?.language ?? fallback?.language;
  const knownEnglish = known?.requireYear ? "Dune (2021 film)" :
    known?.titles.find((title) => !/\p{Script=Hangul}/u.test(title));
  const reviewTitle = language === "en" ? localTitle : film?.englishTitle ?? knownEnglish;
  const details = { ...known, year: known?.year ?? fallback?.year, reviewTitle, item: fallback?.summary.wikibase_item };
  const variants = localTitle ? [[language, localTitle, true]] : [];
  if (reviewTitle && (language !== "en" || !localTitle)) variants.push(["en", reviewTitle]);
  if (!localTitle && !reviewTitle) {
    variants.push([/\p{Script=Hangul}/u.test(movie.title) ? "ko" : "en", movie.title.trim()]);
  }
  for (const [wiki, title, identified] of variants) {
    const html = await fetchArticle(wiki, title);
    if (!html) continue;
    const document = articleDocument(html);
    if (!identified && !isFilmArticle(document, known?.year ?? movie.releaseYear)) continue;
    const intro = openingPlot(document, wiki);
    if (intro) return {
      ...details, intro, reviewTitle: details.reviewTitle ?? (wiki === "en" ? title : undefined),
      source: filmArticle(wiki, title) + (wiki === "ko" ? "#줄거리" : "#Plot"),
    };
  }
  return details;
}

export async function lookupFilmReviews(movie, details) {
  if (details.reviews) return details.reviews;
  let reviewTitle = details.reviewTitle;
  if (!reviewTitle) {
    const item = details.item ?? (await lookupFilmSummary(movie))?.summary.wikibase_item;
    reviewTitle = await englishArticle(item).catch(() => undefined);
  }
  if (!reviewTitle) return [];
  if (!detailCache.has(reviewTitle)) {
    const lookup = fetchReviews(reviewTitle).then((reviews) => {
      if (!reviews.length) detailCache.delete(reviewTitle);
      return reviews;
    });
    detailCache.set(reviewTitle, lookup);
  }
  return detailCache.get(reviewTitle);
}

import { lookupFilmPage } from "./poster-lookup.js?v=21";

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
    intro: "로스앤젤레스에서 배우를 꿈꾸는 미아와 재즈 음악가 세바스찬이 만난다. 두 사람이 각자의 꿈을 좇는 시간을 노래와 춤으로 그린 뮤지컬이다.",
    source: "https://www.lionsgate.com/movies/la-la-land",
    reviews: [
      watcha("GO6MZX4l9bENx", "영화가 쌓아 올린 기쁨과 아쉬움이 한순간에 응축되는 연출에 주목했다."),
      ebert("브라이언 탈레리코", "la-la-land-2016", "사랑과 꿈이 서로에게 미치는 영향을 두 배우의 연기와 음악으로 설득력 있게 그린다고 평가했다."),
    ],
  },
  {
    titles: ["듄: 파트 2", "Dune: Part Two", "Dune: Part 2"], year: 2024, genre: "SF · 모험",
    intro: "사막 행성 아라키스에서 폴 아트레이데스는 차니와 프레멘에 합류한다. 행성의 운명을 둘러싼 갈등 속에서 자기 앞에 놓인 선택과 마주하는 SF 대작이다.",
    source: "https://www.warnerbros.com/movies/dune-part-two",
    reviews: [
      watcha("8n92V8DnAeQAJ", "디테일을 치밀하게 다듬은 연출과 이야기를 풀어가는 우아한 방식에 주목했다."),
      ebert("브라이언 탈레리코", "dune-part-two-movie-review-2024", "대규모 볼거리와 권력에 대한 질문을 결합한 속편이라며, 특히 촬영과 미술의 완성도를 높이 평가했다."),
      guardian("피터 브래드쇼", "2024/feb/21/dune-part-two-review-denis-villeneuve", "강렬한 이미지가 저항과 권력, 로맨스를 한데 묶는 장대한 SF라고 평했다."),
    ],
  },
  {
    titles: ["듄", "Dune"], year: 2021, requireYear: true, genre: "SF · 모험",
    intro: "귀족 가문의 후계자 폴 아트레이데스가 막대한 가치를 지닌 자원의 산지인 아라키스로 향한다. 사막 행성을 둘러싼 권력 다툼 속에서 시작되는 이야기다.",
    source: "https://www.warnerbros.com/movies/dune",
    reviews: [
      ebert("글렌 케니", "dune-movie-review-2021", "원작의 세계를 충실하게 옮기면서도 기술진의 솜씨로 장대한 극장 경험을 만든 점을 높이 평가했다."),
      guardian("피터 브래드쇼", "2021/oct/20/dune-review-denis-villeneuves-awe-inspiring-epic-is-a-moment-of-triumph", "방대한 원작을 압도적인 규모의 영화로 구현한 빌뇌브의 연출을 호평했다."),
    ],
  },
  {
    titles: ["인터스텔라", "Interstellar"], year: 2014, genre: "SF · 드라마",
    intro: "지구에서 살아가기 어려워진 미래, 전직 조종사 쿠퍼는 인류가 살 새로운 터전을 찾는 우주 탐사에 나선다. 머나먼 우주를 배경으로 가족과 시간의 이야기를 펼친다.",
    source: "https://www.paramountpictures.com/movies/interstellar",
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
    intro: "정체를 알 수 없는 비행체가 세계 곳곳에 나타나자, 언어학자 루이즈는 그들과 소통하는 임무를 맡는다. 낯선 존재를 이해하려는 과정에 초점을 맞춘 SF 영화다.",
    source: "https://www.paramountpictures.com/movies/arrival",
    reviews: [
      watcha("Vw8MLqw93DQel", "전례를 찾기 어려운 이야기와 처음부터 끝까지 이어지는 지적인 긴장감을 호평했다."),
      ebert("브라이언 탈레리코", "arrival-2016", "외계와의 조우를 통해 소통과 공감을 이야기하는 영화로 보았으며, 에이미 애덤스의 연기를 높이 평가했다."),
    ],
  },
  {
    titles: ["기생충", "Parasite"], year: 2019, genre: "블랙코미디 · 스릴러",
    intro: "생활이 빠듯한 기택 가족의 장남 기우에게 부유한 박 사장 집의 과외 자리가 들어온다. 그 일을 계기로 전혀 다른 환경에서 살던 두 가족이 만난다.",
    source: "https://www.neonrated.com/film/parasite",
    reviews: [
      watcha("xzaQAkqBWN2g5", "위와 아래를 오가는 공간의 연출로 계급 차이를 선명하게 드러낸다고 보았다."),
      ebert("브라이언 탈레리코", "parasite-movie-review-2019", "예측하기 어려운 전개 자체가 재미있는 동시에 사회의 구조적 불평등을 날카롭게 파고든다고 평가했다."),
    ],
  },
  {
    titles: ["그랜드 부다페스트 호텔", "The Grand Budapest Hotel"], year: 2014, genre: "코미디 · 모험",
    intro: "가상의 유럽 국가에 있는 화려한 호텔에서 지배인 구스타브와 신입 직원 제로가 만난다. 유산을 둘러싼 소동에 휘말린 두 사람의 모험을 그린 웨스 앤더슨의 영화다.",
    source: "https://www.searchlightpictures.com/thegrandbudapesthotel/",
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
]);
const detailCache = new Map();

function key(value) {
  return value.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

function filmArticle(language, title) {
  return `https://${language}.wikipedia.org/wiki/${encodeURIComponent(title.replaceAll(" ", "_"))}`;
}

export function findReviewLinks(html, title) {
  const template = document.createElement("template");
  template.innerHTML = html;
  const titleKey = key(title.replace(/\s+\([^)]*\)$/, ""));
  if (titleKey.length < 3) return [];
  const reviews = new Map();
  for (const citation of template.content.querySelectorAll("cite")) {
    const link = citation.querySelector("a.external[href]");
    if (!link?.textContent.trim()) continue;
    let url;
    try {
      url = new URL(link.getAttribute("href"), "https://en.wikipedia.org");
    } catch {
      continue;
    }
    if (url.protocol !== "https:" || url.port || url.username || url.password) continue;
    const publisher = publishers.get(url.hostname.replace(/^www\./, ""));
    if (!publisher || !/review/i.test(url.pathname + " " + link.textContent) ||
        !key(link.textContent + url.pathname).includes(titleKey)) continue;
    const prefix = key(citation.textContent.split(link.textContent)[0]);
    const author = [...critics].find(([name]) => {
      const names = name.split(" ");
      return prefix.includes(key(name)) || prefix.includes(key([names.at(-1), ...names.slice(0, -1)].join(" ")));
    })?.[1];
    if (!author || reviews.has(author)) continue;
    reviews.set(author, { author, publisher, url: url.href });
    if (reviews.size === 3) break;
  }
  return [...reviews.values()];
}

async function fetchReviews(englishTitle) {
  if (!englishTitle) return [];
  const endpoint = new URL("https://en.wikipedia.org/w/api.php");
  endpoint.search = new URLSearchParams({
    action: "parse", page: englishTitle, prop: "text", format: "json", formatversion: "2",
    origin: "*", disableeditsection: "1", redirects: "1",
  });
  const response = await fetch(endpoint, {
    credentials: "omit", referrerPolicy: "no-referrer", signal: AbortSignal.timeout(6000),
  });
  if (!response.ok) return [];
  const { parse } = await response.json();
  return parse?.text ? findReviewLinks(parse.text, englishTitle) : [];
}

export function featuredFilm(movie) {
  const title = key(movie.title ?? "");
  return featured.find((film) =>
    (!movie.releaseYear ? !film.requireYear : film.year === movie.releaseYear) &&
    film.titles.some((name) => key(name) === title));
}

export async function lookupFilmIntroduction(movie) {
  const known = featuredFilm(movie);
  if (known) return known;
  if (!movie.title) return {};
  const film = await lookupFilmPage(movie);
  if (!film) return {};
  const { page, language, englishTitle, englishPage } = film;
  const intro = page.terms?.description?.[0] ?? englishPage?.terms?.description?.[0];
  const source = filmArticle(language, page.title);
  const reviewTitle = language === "en" ? page.title : englishTitle;
  return { intro, source, reviewTitle };
}

export async function lookupFilmDetails(movie) {
  const { reviewTitle, ...details } = await lookupFilmIntroduction(movie);
  if (!reviewTitle) return details;
  if (!detailCache.has(reviewTitle)) {
    detailCache.set(reviewTitle, fetchReviews(reviewTitle).catch(() => {
      detailCache.delete(reviewTitle);
      return [];
    }));
  }
  return { ...details, reviews: await detailCache.get(reviewTitle) };
}

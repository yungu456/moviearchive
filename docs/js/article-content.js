const articleCache = new Map();

function sectionElements(document, labels) {
  const heading = [...document.querySelectorAll("h2, h3")].find((node) =>
    labels.test(node.querySelector(".mw-headline")?.textContent.trim() ?? node.textContent.trim()));
  if (!heading) return [];
  const elements = [];
  for (let node = (heading.closest(".mw-heading") ?? heading).nextElementSibling; node; node = node.nextElementSibling) {
    const nextHeading = node.matches(".mw-heading") ? node.firstElementChild : node;
    if (nextHeading?.matches("h2") || (heading.matches("h3") && nextHeading?.matches("h3"))) break;
    elements.push(node);
  }
  return elements;
}

export function articleDocument(html) {
  const template = document.createElement("template");
  template.innerHTML = html;
  return template.content;
}

function cleanText(node) {
  const copy = node.cloneNode(true);
  copy.querySelectorAll("sup, style, script, .mw-editsection, .reference").forEach((part) => part.remove());
  return copy.textContent.replace(/\s+/g, " ").trim();
}

function excerpt(value, maxWords) {
  const words = value.split(/\s+/);
  const limited = words.slice(0, maxWords).join(" ");
  if (limited.length > 220) return limited.slice(0, 220).replace(/\s+\S*$/, "") + "…";
  return limited + (words.length > maxWords ? "…" : "");
}

export function openingPlot(document, language) {
  const paragraph = sectionElements(document, /^(?:plot|plot summary|줄거리)$/i)
    .find((node) => node.matches("p") && node.textContent.trim());
  if (!paragraph) return "";
  const sentences = new Intl.Segmenter(language, { granularity: "sentence" }).segment(cleanText(paragraph));
  const opening = [];
  for (const { segment } of sentences) {
    if (opening.length === 2 || /\b(?:ultimately|in the end|it is revealed|at the end)\b|결말|반전|밝혀진다/i.test(segment)) break;
    opening.push(segment.trim());
  }
  return excerpt(opening.join(" "), 24);
}

export function isFilmArticle(document, year) {
  const credits = document.querySelector("table.infobox");
  if (!credits || ![...credits.querySelectorAll("th")].some((cell) =>
    /^(?:directed by|감독)$/i.test(cell.textContent.trim()))) return false;
  if (!year) return true;
  const lead = document.querySelector('section[data-mw-section-id="0"] p, .mw-parser-output > p');
  return new RegExp(`\\b${year}\\b`).test(credits.textContent + (lead?.textContent ?? ""));
}

export function receptionExcerpt(document, author) {
  const elements = sectionElements(document, /^(?:critical reception|critical response|critical reviews|reception)$/i);
  const splitter = new Intl.Segmenter("en", { granularity: "sentence" });
  const name = author.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const attribution = new RegExp(`\\b${name}\\b[^.!?]{0,130}\\b(?:wrote|called|praised|criticized|criticised|described|considered|found|gave|noted)\\b`, "i");
  for (const element of elements) {
    const paragraphs = element.matches("p") ? [element] : [...element.querySelectorAll("p")];
    for (const paragraph of paragraphs) {
      for (const { segment } of splitter.segment(cleanText(paragraph))) {
        if (attribution.test(segment) && !/\b(?:ending|spoiler|final scene|twist|is revealed)\b/i.test(segment)) {
          return excerpt(segment.trim(), 20);
        }
      }
    }
  }
  return undefined;
}

export async function fetchArticle(language, title) {
  if (!title) return "";
  const cacheKey = JSON.stringify([language, title]);
  if (!articleCache.has(cacheKey)) {
    const request = (async () => {
      const base = `https://${language}.wikipedia.org`;
      const rest = new URL(`/w/rest.php/v1/page/${encodeURIComponent(title.replaceAll(" ", "_"))}/html`, base);
      rest.searchParams.set("origin", "*");
      const get = (url) => fetch(url, {
        credentials: "omit", referrerPolicy: "no-referrer", signal: AbortSignal.timeout(4500),
      }).catch(() => null);
      const response = await get(rest);
      if (response?.ok) return response.text();
      const action = new URL("/w/api.php", base);
      action.search = new URLSearchParams({
        action: "parse", page: title, prop: "text", format: "json", formatversion: "2",
        origin: "*", disableeditsection: "1", redirects: "1",
      });
      const fallback = await get(action);
      return fallback?.ok ? (await fallback.json()).parse?.text ?? "" : "";
    })().catch(() => "").then((html) => {
      if (!html) articleCache.delete(cacheKey);
      return html;
    });
    articleCache.set(cacheKey, request);
  }
  return articleCache.get(cacheKey);
}

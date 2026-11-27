import { BackupError, createBackup, readBackup } from "./backup.js?v=13";
import { addMovie, deleteMovie, editMovie, listMovies, mergeMovies, saveMovieReview, toggleWatched } from "./db.js?v=13";
import { lookupFallbackPoster, lookupPoster } from "./poster-lookup.js?v=22";
import { lookupFilmIntroduction, lookupFilmReviews } from "./film-details.js?v=22";
import { resolveReelTitle } from "./reel-title.js?v=17";
import { normalizeSourceUrl, verifiedReelTitle } from "./reel-url.js?v=17";

const get = (id) => document.getElementById(id);
const grid = get("movie-grid");
const libraryTitle = get("library-title");
const emptyState = get("empty-state");
const search = get("search");
const filterButtons = [...document.querySelectorAll("[data-filter]")];
const watchedSort = get("watched-sort");
const addButton = get("add-movie");
const dialog = get("movie-dialog");
const deleteDialog = get("delete-dialog");
const detailDialog = get("film-details");
const detailWatch = get("detail-watch");
const detailRetryTitle = get("detail-retry-title");
const reviewDialog = get("review-dialog");
const reviewForm = get("review-form");
const saveReviewButton = get("save-review");
const ratingInput = get("review-rating");
const reviewDraft = get("review-draft");
const form = get("movie-form");
const saveButton = form.querySelector('[type="submit"]');
const deleteButton = get("delete-movie");
const confirmDelete = get("confirm-delete");
const openBackup = get("open-backup");
const backupDialog = get("backup-dialog");
const backupFile = get("backup-file");
const importButton = get("import-backup");
const exportButton = get("export-backup");
const titleInput = get("movie-title");
const yearInput = get("release-year");
const reelInput = get("reel-url");
const reviewInput = get("review");
const notice = get("notice");
const cardTemplate = get("movie-card");
const heroImages = [...document.querySelectorAll(".hero-strip img")];

const posterUrls = [];
let movies = [];
let ready = false;
let filter = "all";
let editing;
let activeDetails;
let reviewing;
let noticeTimer;
let retryingTitles = false;
const lastTitleAttempt = new Map();
const titleLookups = new Map();
const titleLookupMessages = {
  pending: "영화 제목을 찾는 중이에요.",
  connection: "제목 조회 서버에 연결할 수 없어요.",
  "upstream-unavailable": "영상 서비스의 공개 정보를 가져오지 못했어요.",
  "title-not-found": "공개 영상 정보에서 영화 제목을 확인하지 못했어요.",
  storage: "찾은 제목을 이 기록에 저장하지 못했어요.",
};

function titleLookupFor(movie) {
  const lookup = titleLookups.get(movie.id);
  return lookup?.url === movie.reelUrl ? lookup : undefined;
}

function showTitleLookup(movie, status, button) {
  const reason = titleLookupFor(movie)?.reason;
  status.textContent = titleLookupMessages[reason] ?? "영상 링크를 저장했어요.";
  button.disabled = reason === "pending";
}

function updateTitleLookup(movie) {
  const card = renderedCard(movie.id);
  if (card && !card.querySelector(".card-title-lookup").hidden) {
    showTitleLookup(movie, card.querySelector(".card-title-status"), card.querySelector(".card-retry-title"));
  }
  if (detailDialog.open && activeDetails.movie.id === movie.id && activeDetails.movie.reelUrl === movie.reelUrl &&
      !activeDetails.movie.title) {
    showTitleLookup(movie, get("detail-intro"), detailRetryTitle);
  }
}

function lookupMissingTitle(movie) {
  const existing = titleLookupFor(movie);
  if (existing?.reason === "pending") return existing.promise;

  const lookup = { url: movie.reelUrl, reason: "pending" };
  lastTitleAttempt.set(movie.id, Date.now());
  titleLookups.set(movie.id, lookup);
  lookup.promise = resolveReelTitle(movie).then(({ movie: updated, reason }) => {
    lookup.reason = reason;
    if (titleLookupFor(movie) === lookup && !updated.title) updateTitleLookup(movie);
    return updated;
  });
  updateTitleLookup(movie);
  return lookup.promise;
}

async function retryTitle(movie) {
  const updated = await lookupMissingTitle(movie);
  if (!updated.title) return;
  await refresh();
  if (detailDialog.open && activeDetails.movie.id === updated.id && activeDetails.movie.reelUrl === updated.reelUrl &&
      !activeDetails.movie.title) {
    const details = openDetails(updated);
    get("close-details").focus();
    await details;
  } else if (grid.contains(document.activeElement) || document.activeElement === document.body) {
    focusCard(updated.id, ".title-open");
  }
}

function setMessage(id, message = "") {
  const element = get(id);
  element.textContent = message;
  element.hidden = !message;
}

function announce(message) {
  notice.textContent = message;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => { notice.textContent = ""; }, 4500);
}

function titleOf(movie) {
  return movie.title || "제목 미입력";
}

function sourceLabel(url) {
  return url?.startsWith("https://www.youtube.com/") ? "쇼츠" : "릴스";
}

function setPosterImage(image, url, onError) {
  image.onerror = () => {
    image.hidden = true;
    onError?.();
  };
  image.src = url;
  image.hidden = false;
}

async function showRemotePoster(image, movie, isCurrent, onLoad) {
  const failedImages = new Set();
  function show(poster) {
    if (!poster || !isCurrent()) return;
    image.onload = () => {
      if (isCurrent()) onLoad?.(poster.source);
    };
    const url = poster.image;
    setPosterImage(image, url, async () => {
      if (!isCurrent()) return;
      failedImages.add(url);
      show(await lookupFallbackPoster(movie, failedImages));
    });
  }
  show(await lookupPoster(movie));
}

function renderedCard(id) {
  return grid.querySelector(`[data-id="${CSS.escape(id)}"]`);
}

function loadCardPoster(card, movie) {
  const image = card.querySelector(".poster-image");
  if (movie.poster) {
    const url = URL.createObjectURL(movie.poster);
    posterUrls.push(url);
    setPosterImage(image, url);
    return;
  }
  if (!movie.title) return;
  showRemotePoster(image, movie, () => card.isConnected, (source) => {
    card.dataset.posterSource = source;
    if (detailDialog.open && activeDetails.movie.id === movie.id && activeDetails.movie.title === movie.title) {
      setPosterSource(source);
    }
  });
}

let featuredMovies = [];
function renderHero() {
  const featured = movies.filter((movie) => movie.title && !movie.poster).slice(0, heroImages.length);
  if (JSON.stringify(featured.map(({ title, releaseYear }) => [title, releaseYear])) ===
      JSON.stringify(featuredMovies.map(({ title, releaseYear }) => [title, releaseYear]))) return;
  featuredMovies = featured;
  heroImages.forEach((image, index) => {
    image.hidden = true;
    image.removeAttribute("src");
    if (!featured[index]) return;
    showRemotePoster(image, featured[index], () => featuredMovies === featured);
  });
}

function setDetailLink(link, url) {
  if (url) link.href = url;
  else link.removeAttribute("href");
  link.hidden = !url;
}

function setPosterSource(url) {
  const link = get("poster-source");
  link.textContent = url ? "포스터 출처" : "";
  setDetailLink(link, url);
}

function watchLabel(watched) {
  return watched ? "시청 완료" : "시청 전";
}

function updateDetailWatch(movie) {
  detailWatch.setAttribute("aria-pressed", String(movie.watched));
  detailWatch.textContent = watchLabel(movie.watched);
}

function showPersonalReview(movie) {
  const recorded = Boolean(movie.review || movie.rating);
  get("detail-personal-review").hidden = !movie.watched && !recorded;
  get("detail-review-edit").textContent = recorded ? "수정하기" : "작성하기";
  setMessage("personal-rating", movie.rating ? `${movie.rating} / 5점` : "");
  setMessage("personal-review-text", movie.review);
}

function showReviewForm() {
  get("review-dialog-title").textContent = "감상평과 점수";
  get("review-prompt").hidden = true;
  reviewForm.hidden = false;
  ratingInput.focus();
}

function openReviewDialog(movie, prompt) {
  reviewing = movie;
  get("review-film-title").textContent = titleOf(movie);
  get("review-dialog-title").textContent = "감상평을 작성하시겠습니까?";
  ratingInput.value = movie.rating ? String(movie.rating) : "";
  reviewDraft.value = movie.review ?? "";
  setMessage("review-error");
  get("review-prompt").hidden = !prompt;
  reviewForm.hidden = true;
  reviewDialog.showModal();
  if (prompt) get("review-later").focus();
  else showReviewForm();
}

function reviewItem({ author, publisher, summary, url }) {
  const item = document.createElement("li");
  const name = document.createElement("strong");
  name.textContent = author;
  item.append(name);
  if (summary) {
    const text = document.createElement("p");
    text.textContent = summary;
    item.append(text);
  }
  const link = document.createElement("a");
  link.className = "detail-link";
  link.textContent = `${publisher}에서 원문 보기`;
  link.href = url;
  link.rel = "noopener noreferrer";
  link.target = "_blank";
  item.append(link);
  return item;
}

async function openDetails(movie) {
  const request = { movie };
  activeDetails = request;
  get("detail-title").textContent = titleOf(movie);
  setMessage("detail-meta", movie.releaseYear ? String(movie.releaseYear) : "");
  get("detail-intro").textContent = movie.title
    ? "영화 소개를 찾는 중이에요."
    : "영화 제목을 입력하면 소개를 찾을 수 있어요.";
  setDetailLink(get("intro-source"));
  setPosterSource();
  setDetailLink(get("detail-reel"), movie.reelUrl);
  get("detail-reel").textContent = `원본 ${sourceLabel(movie.reelUrl)}`;
  get("detail-reviews").replaceChildren();
  setMessage("detail-reviews-status", movie.title ? "평론을 찾는 중이에요." : "");
  get("detail-critics-title").parentElement.hidden = !movie.title;
  showPersonalReview(movie);
  updateDetailWatch(movie);
  detailRetryTitle.hidden = Boolean(movie.title) || !movie.reelUrl;
  if (!detailRetryTitle.hidden) showTitleLookup(movie, get("detail-intro"), detailRetryTitle);
  if (!detailDialog.open) detailDialog.showModal();
  if (!movie.title) return;

  if (!movie.poster) {
    lookupPoster(movie).then((poster) => {
      if (detailDialog.open && activeDetails === request) {
        setPosterSource(renderedCard(movie.id)?.dataset.posterSource ?? poster?.source);
      }
    });
  }

  const details = await lookupFilmIntroduction(movie).catch(() => ({}));
  if (!detailDialog.open || activeDetails !== request) return;
  const year = details.year ?? movie.releaseYear;
  setMessage("detail-meta", [year, details.genre].filter(Boolean).join(" · "));
  get("detail-intro").textContent = details.intro || "확인된 영화 소개가 없어요.";
  setDetailLink(get("intro-source"), details.intro ? details.source : undefined);
  const reviews = await lookupFilmReviews(movie, details).catch(() => []);
  if (!detailDialog.open || activeDetails !== request) return;
  get("detail-reviews").replaceChildren(...reviews.map(reviewItem));
  setMessage("detail-reviews-status", reviews.length ? "" : "확인된 평론을 찾지 못했어요.");
}

get("close-details").addEventListener("click", () => detailDialog.close());
detailRetryTitle.addEventListener("click", async () => {
  if (!activeDetails || detailRetryTitle.disabled) return;
  await retryTitle(activeDetails.movie).catch(() => announce("영화 목록을 갱신하지 못했어요."));
});
detailWatch.addEventListener("click", () => changeWatched(activeDetails.movie.id, detailWatch));
get("detail-review-edit").addEventListener("click", () => openReviewDialog(activeDetails.movie, false));
get("write-review").addEventListener("click", showReviewForm);
detailDialog.addEventListener("close", () => {
  if (!detailDialog.open) setPosterSource();
});
get("detail-edit").addEventListener("click", () => {
  detailDialog.close();
  openEditor(activeDetails.movie);
});

function cardFor(movie) {
  const card = cardTemplate.content.firstElementChild.cloneNode(true);
  const title = titleOf(movie);
  const open = card.querySelector(".poster-open");
  const edit = card.querySelector(".edit-movie");
  const status = card.querySelector(".watch-status");
  const intro = card.querySelector(".card-intro");
  const reel = card.querySelector(".reel-link");

  card.dataset.id = movie.id;
  const titleButton = card.querySelector(".title-open");
  titleButton.textContent = title;
  open.setAttribute("aria-label", `${title} 소개 보기`);
  edit.setAttribute("aria-label", `${title} 수정`);
  open.addEventListener("click", () => openDetails(movie));
  titleButton.addEventListener("click", () => openDetails(movie));
  edit.addEventListener("click", () => openEditor(movie));

  status.setAttribute("aria-label", `${title} 시청 완료`);
  status.setAttribute("aria-pressed", String(movie.watched));
  status.querySelector("use").setAttribute("href", movie.watched ? "#icon-check" : "#icon-clock");
  status.querySelector("span").textContent = watchLabel(movie.watched);
  status.addEventListener("click", () => changeWatched(movie.id, status));

  loadCardPoster(card, movie);

  if (movie.title) {
    lookupFilmIntroduction(movie).then((film) => {
      if (!card.isConnected || !film.intro) return;
      intro.textContent = film.intro;
      intro.hidden = false;
    });
  } else if (movie.reelUrl) {
    const retry = card.querySelector(".card-retry-title");
    card.querySelector(".card-title-lookup").hidden = false;
    showTitleLookup(movie, card.querySelector(".card-title-status"), retry);
    retry.addEventListener("click", () => retryTitle(movie).catch(() => announce("영화 목록을 갱신하지 못했어요.")));
  }
  if (movie.reelUrl) {
    const label = sourceLabel(movie.reelUrl);
    reel.href = movie.reelUrl;
    reel.setAttribute("aria-label", `${title} ${label} 열기`);
    reel.querySelector("span").textContent = label;
    reel.hidden = false;
  }
  return card;
}

function render() {
  if (!ready) return;

  const phrase = search.value.trim().normalize("NFC").toLocaleLowerCase("ko");
  const watched = movies.filter((movie) => movie.watched).length;
  const visible = movies.filter((movie) => {
    const matchesStatus = filter === "all" || movie.watched === (filter === "watched");
    return matchesStatus && [titleOf(movie), movie.review].some(
      (value) => value.normalize("NFC").toLocaleLowerCase("ko").includes(phrase),
    );
  });
  const showingWatched = filter === "watched";
  get("watched-sort-control").hidden = !showingWatched;
  if (showingWatched && watchedSort.value === "rating") {
    visible.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  } else if (showingWatched && watchedSort.value === "watched") {
    visible.sort((a, b) => (b.watchedAt ?? "").localeCompare(a.watchedAt ?? ""));
  }

  get("total-count").textContent = movies.length;
  get("unwatched-count").textContent = movies.length - watched;
  get("watched-count").textContent = watched;
  get("result-count").textContent = `${visible.length}편`;
  get("sample-note").hidden = !visible.some((movie) => Number.isInteger(movie.sampleArt));
  filterButtons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.filter === filter)));

  posterUrls.forEach((url) => URL.revokeObjectURL(url));
  posterUrls.length = 0;
  grid.replaceChildren(...visible.map(cardFor));

  emptyState.hidden = visible.length > 0;
  if (visible.length === 0) {
    if (!movies.length) {
      emptyState.textContent = "보고 싶은 영화를 발견하면 ‘영화 저장’을 눌러 영상 링크를 남겨보세요.";
    } else if (phrase) {
      emptyState.textContent = "검색 조건에 맞는 영화가 없어요.";
    } else {
      emptyState.textContent = filter === "watched" ? "시청 완료한 영화가 없어요." : "시청 전인 영화가 없어요.";
    }
  }
}

async function refresh() {
  movies = (await listMovies()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  ready = true;
  addButton.disabled = false;
  openBackup.disabled = false;
  render();
  renderHero();
}

async function retryMissingTitles() {
  if (!ready || retryingTitles || document.hidden) return;
  const now = Date.now();
  const pending = movies.filter((movie) => !movie.title && movie.reelUrl);
  const verified = pending.filter((movie) => verifiedReelTitle(movie.reelUrl));
  const remote = navigator.onLine ? pending.filter((movie) =>
    !verifiedReelTitle(movie.reelUrl) && now - (lastTitleAttempt.get(movie.id) ?? 0) > 60000).slice(0, 3) : [];
  if (!verified.length && !remote.length) return;

  retryingTitles = true;
  try {
    for (const pendingMovie of [...verified, ...remote]) {
      const movie = await lookupMissingTitle(pendingMovie);
      if (!movie.title) continue;
      await refresh();
      if (detailDialog.open && activeDetails.movie.id === movie.id && activeDetails.movie.reelUrl === movie.reelUrl &&
          !activeDetails.movie.title) {
        openDetails(movie).catch(() => {});
      }
    }
  } finally {
    retryingTitles = false;
  }
}

function focusCard(id, selector) {
  const card = [...grid.children].find((item) => item.dataset.id === id);
  (card?.querySelector(selector) ?? libraryTitle).focus();
}

async function changeWatched(id, button) {
  button.disabled = true;
  try {
    const movie = await toggleWatched(id);
    await refresh();
    if (detailDialog.open && activeDetails.movie.id === id) {
      activeDetails.movie = movie;
      updateDetailWatch(movie);
      showPersonalReview(movie);
    } else if (!detailDialog.open) {
      focusCard(id, ".poster-open");
    }
    announce(movie.watched ? "시청 완료로 표시했어요." : "시청 전으로 표시했어요.");
    if (movie.watched && !reviewDialog.open) openReviewDialog(movie, true);
  } catch {
    announce("시청 상태를 변경하지 못했어요. 다시 시도해 주세요.");
  } finally {
    button.disabled = false;
  }
}

reviewForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (saveReviewButton.disabled) return;
  setMessage("review-error");
  saveReviewButton.disabled = true;
  const rating = ratingInput.value ? Number(ratingInput.value) : undefined;
  try {
    const movie = await saveMovieReview(reviewing.id, reviewDraft.value.trim(), rating);
    if (detailDialog.open && activeDetails.movie.id === movie.id) {
      activeDetails.movie = movie;
      showPersonalReview(movie);
    }
    await refresh().catch(() => {});
    reviewDialog.close();
    if (!detailDialog.open) focusCard(movie.id, ".poster-open");
    announce("감상 기록을 저장했어요.");
  } catch {
    if (reviewDialog.open) setMessage("review-error", "감상 기록을 저장할 수 없어요. 다시 시도해 주세요.");
  } finally {
    saveReviewButton.disabled = false;
  }
});

function openEditor(movie) {
  editing = movie;
  form.reset();
  setMessage("form-error");
  get("form-title").textContent = movie ? "영화 수정" : "영화 저장";
  deleteButton.hidden = !movie;
  titleInput.value = movie?.title ?? "";
  yearInput.value = movie?.releaseYear ?? "";
  reelInput.value = movie?.reelUrl ?? "";
  reviewInput.value = movie?.review ?? "";
  dialog.showModal();
  (movie ? titleInput : reelInput).focus();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (saveButton.disabled) return;
  setMessage("form-error");

  const title = titleInput.value.trim();
  let reelUrl;
  try {
    reelUrl = normalizeSourceUrl(reelInput.value);
  } catch (error) {
    setMessage("form-error", error.message);
    reelInput.focus();
    return;
  }
  if (!title && !reelUrl) {
    setMessage("form-error", "영화 제목이나 영상 링크 중 하나를 입력해 주세요.");
    reelInput.focus();
    return;
  }
  if (!yearInput.validity.valid) {
    setMessage("form-error", "개봉 연도는 1800년부터 2099년까지 입력할 수 있어요.");
    yearInput.focus();
    return;
  }

  const previous = editing;
  const fields = { title, review: reviewInput.value.trim() };
  if (reelUrl) fields.reelUrl = reelUrl;
  if (yearInput.value) fields.releaseYear = yearInput.valueAsNumber;
  saveButton.disabled = true;
  deleteButton.disabled = true;

  try {
    const saved = previous ? await editMovie(previous.id, fields) : await addMovie(fields);
    const movie = !saved.title && saved.reelUrl ? await lookupMissingTitle(saved) : saved;

    if (!previous) {
      search.value = "";
      filter = "all";
    }
    await refresh();
    dialog.close();
    focusCard(movie.id, ".poster-open");
    const message = movie.title
      ? previous ? "영화 정보를 수정했어요." : `‘${movie.title}’을(를) 저장했어요.`
      : "영상 링크를 저장했어요. 영화 제목은 아직 찾지 못했어요.";
    announce(message);
  } catch (error) {
    const message = error?.name === "ConstraintError" ? "이미 등록된 영상 링크예요." :
      error?.name === "NotFoundError" ? "다른 탭에서 삭제된 영화예요." :
        "영화를 저장하지 못했어요. 입력 내용을 확인하고 다시 시도해 주세요.";
    setMessage("form-error", message);
  } finally {
    saveButton.disabled = false;
    deleteButton.disabled = false;
  }
});

deleteButton.addEventListener("click", () => {
  setMessage("delete-error");
  get("delete-message").textContent = `‘${titleOf(editing)}’을(를) 영화 목록에서 삭제할까요?`;
  deleteDialog.showModal();
});

confirmDelete.addEventListener("click", async () => {
  if (confirmDelete.disabled) return;
  confirmDelete.disabled = true;
  setMessage("delete-error");
  try {
    await deleteMovie(editing.id);
    await refresh();
    deleteDialog.close();
    dialog.close();
    libraryTitle.focus();
    announce("영화를 삭제했어요.");
  } catch {
    setMessage("delete-error", "영화를 삭제하지 못했어요. 다시 시도해 주세요.");
  } finally {
    confirmDelete.disabled = false;
  }
});

async function runBackupTask(progress, fallback, task) {
  if (exportButton.disabled) return;
  exportButton.disabled = true;
  importButton.disabled = true;
  backupDialog.querySelector("[data-close]").disabled = true;
  setMessage("backup-error");
  setMessage("backup-status", progress);
  try {
    setMessage("backup-status", await task());
  } catch (error) {
    setMessage("backup-status");
    setMessage("backup-error", error instanceof BackupError ? error.message : fallback);
  } finally {
    exportButton.disabled = false;
    importButton.disabled = false;
    backupDialog.querySelector("[data-close]").disabled = false;
  }
}

openBackup.addEventListener("click", () => {
  setMessage("backup-error");
  setMessage("backup-status");
  backupDialog.showModal();
});

exportButton.addEventListener("click", () => runBackupTask(
  "백업 파일을 만드는 중이에요.",
  "백업 파일을 만들 수 없어요. 다시 시도해 주세요.",
  async () => {
    const { file, exportedAt } = await createBackup(await listMovies());
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = `moviearchive-${exportedAt.replace(/[:.]/g, "-")}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return "JSON 백업 다운로드를 시작했어요.";
  },
));

importButton.addEventListener("click", () => backupFile.click());
backupFile.addEventListener("change", () => {
  const file = backupFile.files[0];
  backupFile.value = "";
  if (!file) return;
  return runBackupTask(
    "백업 파일을 확인하는 중이에요.",
    "복원에 실패했어요. 브라우저 저장 공간을 확인한 뒤 다시 시도해 주세요.",
    async () => {
      const { restored, skipped } = await mergeMovies(await readBackup(file));
      const result = `복원 ${restored}편, 중복으로 건너뛴 영화 ${skipped}편.`;
      try {
        await refresh();
        return result;
      } catch {
        return `${result} 새로고침하면 목록에 반영돼요.`;
      }
    },
  );
});

for (const [modal, pending] of [[dialog, saveButton], [deleteDialog, confirmDelete], [backupDialog, exportButton], [reviewDialog, saveReviewButton]]) {
  modal.addEventListener("cancel", (event) => {
    if (pending.disabled) event.preventDefault();
  });
  modal.querySelectorAll("[data-close]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!pending.disabled) modal.close();
    });
  });
}

addButton.addEventListener("click", () => openEditor());
search.addEventListener("input", render);
watchedSort.addEventListener("change", render);
filterButtons.forEach((button) => button.addEventListener("click", () => {
  filter = button.dataset.filter;
  render();
}));

function showShareResult() {
  const url = new URL(location.href);
  const messages = new Map([
    ["saved", "영상 정보에서 영화 제목을 찾아 저장했어요."],
    ["untitled", "영상 링크를 저장했어요. 영화 제목은 아직 찾지 못했어요."],
    ["duplicate", "이미 저장한 영상이에요."],
    ["invalid", "공유한 내용에 유효한 릴스 또는 쇼츠 링크가 없어요."],
    ["error", "공유한 영상을 저장할 수 없어요."],
  ]);
  const result = messages.get(url.searchParams.get("share"));
  if (!result) return;
  url.searchParams.delete("share");
  history.replaceState(null, "", url);
  announce(result);
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register(new URL("./sw.js", document.baseURI), { type: "module" }).catch(() => {});
}

function retryWhenVisible() {
  retryMissingTitles().catch(() => {});
}

window.addEventListener("online", retryWhenVisible);
document.addEventListener("visibilitychange", retryWhenVisible);
window.addEventListener("pageshow", (event) => {
  if (event.persisted) refresh().then(retryWhenVisible).catch(() => {});
});

refresh().then(() => {
  showShareResult();
  retryWhenVisible();
}).catch((error) => {
  emptyState.textContent = error?.message === "다른 MovieArchive 탭을 닫고 새로고침해 주세요."
    ? error.message
    : "영화 목록을 열 수 없어요. 브라우저의 사이트 저장소 설정을 확인한 뒤 새로고침해 주세요.";
});

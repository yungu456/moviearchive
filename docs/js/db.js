import { normalizeSourceUrl } from "./reel-url.js";

const DB_NAME = "movie-archive";
const DB_VERSION = 1;
const STORE = "movies";

const examples = [
  ["인터스텔라", true, "시간과 공간을 넘어 이어지는 이야기."],
  ["듄: 파트 2", false, ""],
  ["라라랜드", true, "밤하늘 아래의 음악과 색이 오래 남았다."],
  ["컨택트", false, ""],
  ["기생충", true, "공간과 계단이 이야기의 일부처럼 느껴졌다."],
  ["그랜드 부다페스트 호텔", false, ""],
];

let opening;

export function openDatabase() {
  if (!opening) {
    opening = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const store = request.result.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("reelUrl", "reelUrl", { unique: true });
        const now = Date.now();
        examples.forEach(([title, watched, review], sampleArt) => {
          const date = new Date(now - sampleArt).toISOString();
          store.add({ id: `example-${sampleArt}`, title, watched, review, sampleArt, createdAt: date, updatedAt: date });
        });
      };
      request.onblocked = () => reject(new Error("다른 MovieArchive 탭을 닫고 새로고침해 주세요."));
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const database = request.result;
        database.onversionchange = () => {
          database.close();
          opening = undefined;
        };
        resolve(database);
      };
    }).catch((error) => {
      opening = undefined;
      throw error;
    });
  }
  return opening;
}

async function transact(mode, run) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE, mode);
    let result;
    let failure;
    transaction.oncomplete = () => resolve(result);
    transaction.onabort = () => reject(failure || transaction.error);
    run(
      transaction.objectStore(STORE),
      (value) => { result = value; },
      (error) => {
        failure = error;
        transaction.abort();
      },
    );
  });
}

export function listMovies() {
  return transact("readonly", (store, done) => {
    const request = store.getAll();
    request.onsuccess = () => done(request.result);
  });
}

function withNormalizedSource({ reelUrl, ...fields }) {
  const normalized = reelUrl === undefined ? undefined : normalizeSourceUrl(reelUrl);
  if (normalized) fields.reelUrl = normalized;
  return fields;
}

function newMovie(fields) {
  const now = new Date().toISOString();
  const randomBytes = crypto.getRandomValues(new Uint8Array(16));
  const id = Array.from(randomBytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return { ...withNormalizedSource(fields), id, createdAt: now, updatedAt: now };
}

export function addMovie(fields) {
  const movie = newMovie({ watched: false, ...fields });
  return transact("readwrite", (store, done) => {
    const request = store.add(movie);
    request.onsuccess = () => done(movie);
  });
}

export function saveSharedSource(reelUrl) {
  const movie = newMovie({ reelUrl, title: "", review: "", watched: false });
  return transact("readwrite", (store, done) => {
    const lookup = store.index("reelUrl").get(movie.reelUrl);
    lookup.onsuccess = () => {
      if (lookup.result) {
        done({ movie: lookup.result, created: false });
        return;
      }
      const write = store.add(movie);
      write.onsuccess = () => done({ movie, created: true });
    };
  });
}

export function fillMovieTitle(id, reelUrl, title, releaseYear) {
  return transact("readwrite", (store, done) => {
    const request = store.get(id);
    request.onsuccess = () => {
      const movie = request.result;
      if (!movie || movie.reelUrl !== reelUrl || movie.title) {
        done(movie);
        return;
      }
      const updated = { ...movie, title, updatedAt: new Date().toISOString() };
      if (!updated.releaseYear && Number.isInteger(releaseYear) && releaseYear >= 1800 && releaseYear <= 2099) {
        updated.releaseYear = releaseYear;
      }
      const write = store.put(updated);
      write.onsuccess = () => done(updated);
    };
  });
}

function updateMovie(id, update) {
  return transact("readwrite", (store, done, abort) => {
    const request = store.get(id);
    request.onsuccess = () => {
      if (!request.result) {
        abort(new DOMException("영화가 삭제되었습니다.", "NotFoundError"));
        return;
      }
      const movie = { ...update(request.result), updatedAt: new Date().toISOString() };
      const write = store.put(movie);
      write.onsuccess = () => done(movie);
    };
  });
}

export function editMovie(id, fields) {
  const normalized = withNormalizedSource(fields);
  return updateMovie(id, (previous) => {
    const movie = { ...previous, ...normalized };
    if (!normalized.reelUrl) delete movie.reelUrl;
    if (!normalized.releaseYear) delete movie.releaseYear;
    return movie;
  });
}

export function toggleWatched(id) {
  return updateMovie(id, (previous) => {
    const movie = { ...previous, watched: !previous.watched };
    if (movie.watched) movie.watchedAt = new Date().toISOString();
    else delete movie.watchedAt;
    return movie;
  });
}

export function saveMovieReview(id, review, rating) {
  return updateMovie(id, (previous) => {
    const movie = { ...previous, review };
    if (rating === undefined) delete movie.rating;
    else movie.rating = rating;
    return movie;
  });
}

export function deleteMovie(id) {
  return transact("readwrite", (store) => { store.delete(id); });
}

function isPristineExample(movie) {
  const index = examples.findIndex((_, i) => movie.id === `example-${i}`);
  if (index === -1) return false;
  const [title, watched, review] = examples[index];
  return movie.title === title && movie.watched === watched && movie.review === review &&
    movie.sampleArt === index && !movie.reelUrl && !movie.poster && !movie.rating && !movie.watchedAt &&
    movie.createdAt === movie.updatedAt;
}

export function mergeMovies(incoming) {
  const movies = incoming.map(withNormalizedSource);
  return transact("readwrite", (store, done, abort) => {
    const request = store.getAll();
    request.onsuccess = () => {
      const existing = new Map(request.result.map((movie) => [movie.id, movie]));
      const links = new Set(request.result.map((movie) => movie.reelUrl).filter(Boolean));
      const importedIds = new Set();
      let restored = 0;

      try {
        for (const movie of movies) {
          if (importedIds.has(movie.id) || (movie.reelUrl && links.has(movie.reelUrl))) continue;
          const current = existing.get(movie.id);
          if (current) {
            if (!isPristineExample(current) || isPristineExample(movie)) continue;
            store.put(movie);
          } else {
            store.add(movie);
          }
          importedIds.add(movie.id);
          if (movie.reelUrl) links.add(movie.reelUrl);
          restored++;
        }
        done({ restored, skipped: movies.length - restored });
      } catch (error) {
        abort(error);
      }
    };
  });
}

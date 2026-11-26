import { maxPosterBytes, validatePoster } from "./poster.js";
import { normalizeSourceUrl } from "./reel-url.js";

const formatVersion = 1;
const maxBackupBytes = 128 * 1024 * 1024;
const maxPosterBase64Length = Math.ceil(maxPosterBytes / 3) * 4;

export class BackupError extends Error {}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isText(value, maxLength) {
  return typeof value === "string" && value.length <= maxLength;
}

function isDate(value) {
  if (typeof value !== "string") return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString() === value;
}

function posterBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.slice(reader.result.indexOf(",") + 1));
    reader.onerror = () => reject(new BackupError("저장된 포스터를 읽을 수 없어요."));
    reader.onabort = reader.onerror;
    reader.readAsDataURL(blob);
  });
}

export async function createBackup(movies) {
  const exportedAt = new Date().toISOString();
  const header = new Blob([`{"formatVersion":${formatVersion},"exportedAt":"${exportedAt}","movies":[`]);
  const parts = [header];
  let size = header.size + 3;

  for (const movie of movies) {
    const { poster, ...fields } = movie;
    const posterSize = poster ? Math.ceil(poster.size / 3) * 4 : 0;
    if (size + posterSize > maxBackupBytes) {
      throw new BackupError("백업이 128 MiB를 초과해 JSON 파일을 만들 수 없어요.");
    }
    if (poster) fields.poster = { type: poster.type, base64: await posterBase64(poster) };
    const part = new Blob([parts.length === 1 ? "\n" : ",\n", JSON.stringify(fields)]);
    size += part.size;
    if (size > maxBackupBytes) {
      throw new BackupError("백업이 128 MiB를 초과해 JSON 파일을 만들 수 없어요.");
    }
    parts.push(part);
  }

  parts.push("\n]}");
  return { file: new Blob(parts, { type: "application/json" }), exportedAt };
}

async function readPoster(value) {
  if (!isObject(value) || !isText(value.type, 32) || !isText(value.base64, maxPosterBase64Length) ||
      value.base64.length === 0 || value.base64.length % 4 !== 0 ||
      /[^A-Za-z0-9+/]/.test(value.base64.replace(/={1,2}$/, ""))) {
    throw new Error("포스터 데이터가 올바르지 않아요.");
  }

  const binary = atob(value.base64);
  if (binary.length > maxPosterBytes) throw new Error("포스터가 5 MB를 초과해요.");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const poster = new Blob([bytes], { type: value.type });
  await validatePoster(poster);
  return poster;
}

async function readMovie(value) {
  if (!isObject(value) || !isText(value.id, 128) || !value.id.trim() ||
      !isText(value.title, 160) || !isText(value.review, 4000) ||
      typeof value.watched !== "boolean" || !isDate(value.createdAt) || !isDate(value.updatedAt)) {
    throw new Error("영화 정보나 날짜 형식이 올바르지 않아요.");
  }
  const { id, title, review, watched, createdAt, updatedAt, sampleArt } = value;
  const movie = { id, title: title.trim(), review, watched, createdAt, updatedAt };
  if (Object.hasOwn(value, "watchedAt")) {
    if (!isDate(value.watchedAt)) throw new Error("시청 완료 날짜가 올바르지 않아요.");
    movie.watchedAt = value.watchedAt;
  }
  if (Object.hasOwn(value, "rating")) {
    if (!Number.isInteger(value.rating) || value.rating < 1 || value.rating > 5) {
      throw new Error("감상 점수는 1점부터 5점까지 입력할 수 있어요.");
    }
    movie.rating = value.rating;
  }
  if (Object.hasOwn(value, "releaseYear")) {
    if (!Number.isInteger(value.releaseYear) || value.releaseYear < 1800 || value.releaseYear > 2099) {
      throw new Error("개봉 연도가 올바르지 않아요.");
    }
    movie.releaseYear = value.releaseYear;
  }
  if (Object.hasOwn(value, "reelUrl")) {
    if (!isText(value.reelUrl, 2048)) throw new Error("영상 링크 형식이 올바르지 않아요.");
    const reelUrl = normalizeSourceUrl(value.reelUrl);
    if (reelUrl) movie.reelUrl = reelUrl;
  }
  if (!movie.title && !movie.reelUrl) throw new Error("영화 제목이나 영상 링크가 필요해요.");
  if (Object.hasOwn(value, "sampleArt")) {
    if (!Number.isInteger(sampleArt) || sampleArt < 0 || sampleArt > 5 || Object.hasOwn(value, "poster")) {
      throw new Error("예시 포스터 정보가 올바르지 않아요.");
    }
    movie.sampleArt = sampleArt;
  }
  if (Object.hasOwn(value, "poster")) movie.poster = await readPoster(value.poster);
  return movie;
}

export async function readBackup(file) {
  if (file.size > maxBackupBytes) throw new BackupError("128 MiB 이하의 JSON 백업 파일을 선택해 주세요.");

  let backup;
  try {
    backup = JSON.parse(await file.text());
  } catch {
    throw new BackupError("JSON 백업 파일을 읽을 수 없어요.");
  }
  if (!isObject(backup) || backup.formatVersion !== formatVersion || !isDate(backup.exportedAt) ||
      !Array.isArray(backup.movies)) {
    throw new BackupError("MovieArchive의 지원되는 JSON 백업 파일을 선택해 주세요.");
  }

  const movies = [];
  for (const [index, value] of backup.movies.entries()) {
    try {
      movies.push(await readMovie(value));
    } catch (error) {
      throw new BackupError(`${index + 1}번째 영화 항목을 읽을 수 없어요. ${error.message}`);
    }
  }
  return movies;
}

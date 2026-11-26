const posterTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
export const maxPosterBytes = 5 * 1024 * 1024;

export async function validatePoster(file) {
  if (!file) return;
  if (!posterTypes.has(file.type) || file.size === 0 || file.size > maxPosterBytes) {
    throw new Error("5 MB 이하의 JPG, PNG, WebP 또는 AVIF 이미지를 선택해 주세요.");
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
  } catch {
    throw new Error("포스터 이미지를 읽을 수 없어요. 다른 파일을 선택해 주세요.");
  } finally {
    URL.revokeObjectURL(url);
  }
}

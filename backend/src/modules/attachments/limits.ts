const MB = 1024 * 1024;

/** Allowlist de MIME → limite de tamanho por arquivo. SVG fica de fora de propósito (pode carregar script). */
export const MIME_LIMITS: Record<string, number> = {
  'image/png': 10 * MB,
  'image/jpeg': 10 * MB,
  'image/webp': 10 * MB,
  'image/gif': 10 * MB,
  'image/avif': 10 * MB,
  'audio/mpeg': 50 * MB,
  'audio/mp4': 50 * MB,
  'audio/ogg': 50 * MB,
  'audio/webm': 50 * MB,
  'audio/wav': 50 * MB,
  'audio/flac': 50 * MB,
  'application/pdf': 20 * MB,
};

export const UPLOAD_URL_TTL_SECONDS = 15 * 60;
export const DOWNLOAD_URL_TTL_SECONDS = 5 * 60;

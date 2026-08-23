/** Max stored logo size: ~60KB of image data as a base64 data URI. */
export const MAX_LOGO_DATA_URL_LENGTH = 80_000;

const DATA_URL_RE = /^data:image\/(png|jpeg|gif);base64,[A-Za-z0-9+/]+={0,2}$/;

export function validateLogoDataUrl(
  value: string
): { ok: true } | { ok: false; reason: string } {
  if (value.length > MAX_LOGO_DATA_URL_LENGTH) {
    return { ok: false, reason: "Logo must be under 60KB. Try a smaller PNG." };
  }
  if (!DATA_URL_RE.test(value)) {
    return {
      ok: false,
      reason: "Logo must be a base64 data URI of a PNG, JPEG, or GIF.",
    };
  }
  return { ok: true };
}

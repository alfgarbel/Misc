import { describe, it, expect } from "vitest";
import { validateLogoDataUrl, MAX_LOGO_DATA_URL_LENGTH } from "@/lib/brand";

// 1x1 transparent PNG
const TINY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

describe("logo validation", () => {
  it("accepts a small png data URI", () => {
    expect(validateLogoDataUrl(TINY_PNG).ok).toBe(true);
  });

  it("accepts jpeg and gif, rejects other media types", () => {
    expect(validateLogoDataUrl("data:image/jpeg;base64,AAAA").ok).toBe(true);
    expect(validateLogoDataUrl("data:image/gif;base64,AAAA").ok).toBe(true);
    expect(validateLogoDataUrl("data:image/svg+xml;base64,AAAA").ok).toBe(false);
    expect(validateLogoDataUrl("data:text/html;base64,AAAA").ok).toBe(false);
  });

  it("rejects non-data-URIs and malformed base64", () => {
    expect(validateLogoDataUrl("https://example.com/logo.png").ok).toBe(false);
    expect(validateLogoDataUrl("data:image/png;base64,!!not-base64!!").ok).toBe(false);
    expect(validateLogoDataUrl("").ok).toBe(false);
  });

  it("rejects oversized payloads", () => {
    const big = "data:image/png;base64," + "A".repeat(MAX_LOGO_DATA_URL_LENGTH);
    expect(validateLogoDataUrl(big).ok).toBe(false);
  });
});

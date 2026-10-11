"use client";

import { useEffect } from "react";

export const ONBOARD_URL_KEY = "ogsmith:onboardUrl";

/**
 * Carries the page someone checked across signup. sessionStorage survives
 * both the password form and the round trip through Google, which a query
 * string would not, and the dashboard picks it up on first load.
 */
export default function RememberUrl({ url }: { url: string }) {
  useEffect(() => {
    try {
      sessionStorage.setItem(ONBOARD_URL_KEY, url);
    } catch {}
  }, [url]);
  return null;
}

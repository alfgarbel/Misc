const ERRORS: Record<string, string> = {
  google_unavailable: "Google sign-in isn't configured on this deployment yet.",
  google_denied: "Google sign-in was cancelled.",
  bad_state:
    "That sign-in link expired or didn't come from here. Please try again.",
  unverified_google_email:
    "Google hasn't verified that email address, so we can't link it to an existing account. Sign in with your password instead.",
  google_failed: "Google sign-in failed. Please try again.",
  rate_limited: "Too many attempts. Try again in a minute.",
};

export function GoogleError({ code }: { code?: string }) {
  if (!code) return null;
  const message = ERRORS[code] ?? "Something went wrong signing in.";
  return (
    <p className="w-full max-w-sm rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
      {message}
    </p>
  );
}

export default function GoogleButton({ label }: { label: string }) {
  return (
    <a
      href="/api/auth/google"
      className="flex w-full max-w-sm items-center justify-center gap-3 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5 font-medium text-white hover:border-zinc-500 hover:bg-zinc-800"
    >
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
        <path
          fill="#4285F4"
          d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
        />
        <path
          fill="#34A853"
          d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
        />
        <path
          fill="#FBBC05"
          d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
        />
        <path
          fill="#EA4335"
          d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
        />
      </svg>
      {label}
    </a>
  );
}

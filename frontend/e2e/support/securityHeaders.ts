/**
 * RECOMMENDED response headers for the static production host (Task 10.4).
 * docs/HOSTING.md documents them; e2e/security-headers.spec.ts serves the
 * production build with them and checks the app works with no Content
 * Security Policy violation in Chromium, Firefox, and WebKit.
 *
 * These are NOT active anywhere: no host is chosen yet. They must be
 * configured on the real host and verified there (docs/HOSTING.md §5).
 *
 * The policy is strict because the build allows it: index.html has no
 * inline script or style, the bundle loads only its own same-origin script
 * and stylesheet, uses no images, fonts, or data: URIs, and makes no network
 * requests (Option A). React sets element styles through the CSSOM, which
 * style-src does not restrict.
 */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self'",
  "font-src 'self'",
  // The client-only app makes no requests of its own; nothing may connect.
  "connect-src 'none'",
  "manifest-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
].join("; ");

export const SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy": CONTENT_SECURITY_POLICY,
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy":
    "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()",
  // For browsers without CSP frame-ancestors support.
  "X-Frame-Options": "DENY",
  "Cross-Origin-Opener-Policy": "same-origin",
};

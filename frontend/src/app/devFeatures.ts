import { parseLocalApiOrigin } from "../experiments/shared/localApi";

/**
 * Whether the Personal Observatory (Cycle 9) is offered: only in a dev-server
 * build, with a supported local test-backend address configured
 * (VITE_HB_LOCAL_SAVE_API, the same opt-in as saving).
 *
 * PRODUCTION GATING: every call site must ALSO test `import.meta.env.DEV`
 * literally, as in `import.meta.env.DEV && observatoryEnabled()`. Vite
 * replaces it with `false` in production builds, so the bundler removes the
 * Observatory route, navigation entry and its lazily imported code entirely
 * (verified on the built bundle; frontend/OBSERVATORY_UI.md).
 */
export function observatoryEnabled(): boolean {
  return (
    import.meta.env.DEV &&
    parseLocalApiOrigin(
      import.meta.env.VITE_HB_LOCAL_SAVE_API as string | undefined,
    ) !== null
  );
}

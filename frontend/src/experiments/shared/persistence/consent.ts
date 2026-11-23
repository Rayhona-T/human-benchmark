/**
 * Explicit, single-use consent authorization for ONE save request.
 *
 * The only way to obtain an authorization is `authorizeSave`, which requires
 * BOTH the panel's agreement state AND the live, visible agreement checkbox to
 * be ticked at the moment the participant asks to save. `saveSession` refuses
 * to send anything without an authorization that this module issued and that
 * has not been used before. Authorizations are tracked in a module-private
 * WeakSet, so other code cannot construct one.
 *
 * Trust limitation: this protects the participant's own browser flow. The
 * backend still only receives a client-asserted `consent.confirmed: true`; a
 * client-supplied boolean is not proof of consent (DATA_AND_PRIVACY.md).
 */
export interface SaveAuthorization {
  readonly noticeVersion: string;
}

const issued = new WeakSet<SaveAuthorization>();

export function authorizeSave(evidence: {
  /** The panel's agreement state at the moment of the click. */
  agreed: boolean;
  /** The agreement checkbox actually on the page. */
  checkbox: HTMLInputElement | null;
  noticeVersion: string;
}): SaveAuthorization | null {
  const { agreed, checkbox, noticeVersion } = evidence;
  if (agreed !== true) return null;
  if (
    checkbox === null ||
    !checkbox.isConnected ||
    checkbox.type !== "checkbox" ||
    checkbox.checked !== true
  ) {
    return null;
  }
  const authorization: SaveAuthorization = Object.freeze({ noticeVersion });
  issued.add(authorization);
  return authorization;
}

export class ConsentNotAuthorizedError extends Error {
  constructor() {
    super("No valid, unused consent authorization for this save request.");
  }
}

/** Uses up an authorization. Throws unless it was issued here and is unused. */
export function consumeAuthorization(
  authorization: SaveAuthorization | null | undefined,
  noticeVersion: string,
): void {
  if (
    !authorization ||
    !issued.has(authorization) ||
    authorization.noticeVersion !== noticeVersion
  ) {
    throw new ConsentNotAuthorizedError();
  }
  issued.delete(authorization);
}

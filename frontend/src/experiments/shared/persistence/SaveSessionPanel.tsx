import { useEffect, useId, useRef, useState } from "react";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Feedback } from "../../../components/ui/Feedback";
import { authorizeSave, ConsentNotAuthorizedError } from "./consent";
import { CONSENT_NOTICE, type SaveConfig } from "./saveConfig";
import {
  buildSessionSavePayload,
  saveEligibility,
  type ResultsSave,
} from "./sessionPayload";
import {
  canRetry,
  saveSession,
  SAVE_TIMEOUT_MS,
  type SaveOutcome,
} from "./saveSessionClient";
// Styles: loaded by SessionResults.tsx in development builds only.

/**
 * Optional, participant-initiated saving of a finished session to the LOCAL
 * DEVELOPMENT backend, under a PROVISIONAL notice. Nothing is sent until the
 * participant ticks the agreement and presses "Save this session".
 *
 * Consent covers exactly one request: the agreement is cleared as soon as an
 * attempt starts, so a retry needs the box ticked again. At the moment of
 * each click, both the agreement state and the checkbox on the page must be
 * ticked (consent.ts); saveSession refuses to send without that authorization.
 */
type PanelState =
  | { step: "offer" }
  | { step: "declined" }
  | { step: "saving" }
  /** No secure random source for a save ID; nothing is sent. */
  | { step: "unsupported" }
  | { step: "done"; outcome: SaveOutcome };

const EXPERIMENT_NAMES = { stroop: "Stroop", flanker: "Flanker" } as const;

function newClientSessionId(): string | null {
  if (
    typeof crypto === "undefined" ||
    typeof crypto.randomUUID !== "function"
  ) {
    return null;
  }
  return crypto.randomUUID();
}

function OutcomeMessage({
  outcome,
  experimentName,
}: {
  outcome: SaveOutcome;
  experimentName: string;
}) {
  const kept = "Your results and the CSV download on this page are unchanged.";
  const safeRetry =
    "Trying again is safe: the same save ID is sent, so the session cannot be stored twice.";
  switch (outcome.kind) {
    case "saved":
      return (
        <Feedback tone="success" title="Session saved">
          <p>
            The test server on this computer confirmed it stored this{" "}
            {experimentName} session:{" "}
            {outcome.trialsStored.practice + outcome.trialsStored.main} trials (
            {outcome.trialsStored.practice} practice,{" "}
            {outcome.trialsStored.main} main). It will not be saved again from
            this page. {kept}
          </p>
        </Feedback>
      );
    case "already_saved":
      return (
        <Feedback tone="success" title="Already saved">
          <p>
            The test server already has this session from an earlier attempt, so
            it was not stored a second time. {kept}
          </p>
        </Feedback>
      );
    case "rejected":
      return (
        <Feedback tone="error" title="Not saved">
          <p>
            {outcome.reason === "notice_not_recognized"
              ? "The test server does not recognize this page's consent notice version, so it refused to store the session."
              : outcome.reason === "too_large"
                ? "The session data was larger than the test server accepts, so it was not stored."
                : "The test server found a problem with this session's data and did not store it."}{" "}
            Trying again would not help. Nothing was stored. {kept}
          </p>
        </Feedback>
      );
    case "unavailable":
      return (
        <Feedback tone="error" title="Could not reach the test server">
          <p>
            Check that the local backend is running, then try again. Nothing was
            lost. {kept}
          </p>
        </Feedback>
      );
    case "timeout":
      return (
        <Feedback tone="error" title="No answer from the test server">
          <p>
            It did not reply within {SAVE_TIMEOUT_MS / 1000} seconds, so the
            save is not confirmed. It may or may not have stored the session.{" "}
            {safeRetry} {kept}
          </p>
        </Feedback>
      );
    case "server_error":
      return (
        <Feedback tone="error" title="The test server had a problem">
          <p>
            It did not confirm the save. {safeRetry} {kept}
          </p>
        </Feedback>
      );
    case "unexpected":
      return (
        <Feedback tone="error" title="Save not confirmed">
          <p>
            The test server&apos;s reply was not understood, so this page cannot
            confirm the session was stored. {safeRetry} {kept}
          </p>
        </Feedback>
      );
    case "cancelled":
      return (
        <Feedback tone="warning" title="Save stopped">
          <p>The save was stopped before the server answered. {safeRetry}</p>
        </Feedback>
      );
  }
}

export function SaveSessionPanel<TStimulus>({
  save,
  config,
  fetchImpl,
}: {
  save: ResultsSave<TStimulus>;
  config: SaveConfig;
  /** Test seam; the browser's fetch is used otherwise. */
  fetchImpl?: typeof fetch;
}) {
  const ids = useId();
  const [state, setState] = useState<PanelState>({ step: "offer" });
  const [agreed, setAgreed] = useState(false);
  const [consentMissing, setConsentMissing] = useState(false);
  /** Incremented on each save attempt without agreement, to move focus. */
  const [consentPrompt, setConsentPrompt] = useState(0);
  const clientSessionId = useRef<string | null>(null);
  const inFlight = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const checkboxRef = useRef<HTMLInputElement>(null);
  const eligibility = saveEligibility(save);
  const experimentName = EXPERIMENT_NAMES[save.experimentId];

  useEffect(() => () => controller.current?.abort(), []);

  useEffect(() => {
    if (consentPrompt > 0) checkboxRef.current?.focus();
  }, [consentPrompt]);

  useEffect(() => {
    if (state.step !== "offer") statusRef.current?.focus();
  }, [state]);

  const headingId = `${ids}-heading`;
  const checkboxId = `${ids}-agree`;

  const heading = (
    <div className="save-session__header">
      <h2 id={headingId}>Save this session (optional)</h2>
      <Badge tone="warning">Development test · provisional notice</Badge>
    </div>
  );

  if (!eligibility.eligible) {
    return (
      <section
        aria-labelledby={headingId}
        className="session-results__section save-session"
      >
        {heading}
        <p>
          Only complete sessions can be saved. This session was not completed,
          so it cannot be saved, and nothing was sent.
        </p>
      </section>
    );
  }

  async function startSave() {
    if (inFlight.current) return;
    // Consent for THIS request: the agreement state and the checkbox actually
    // on the page must both be ticked right now.
    const authorization = authorizeSave({
      agreed,
      checkbox: checkboxRef.current,
      noticeVersion: CONSENT_NOTICE.version,
    });
    if (authorization === null) {
      setAgreed(false);
      setConsentMissing(true);
      setConsentPrompt((count) => count + 1);
      return;
    }
    clientSessionId.current ??= newClientSessionId();
    if (clientSessionId.current === null) {
      setAgreed(false);
      setState({ step: "unsupported" });
      return;
    }
    // Built before anything is marked in flight, so a mapping problem can
    // never leave the panel stuck in "Saving…". Eligibility was checked above.
    const payload = buildSessionSavePayload(save, {
      clientSessionId: clientSessionId.current,
      noticeVersion: CONSENT_NOTICE.version,
    });
    inFlight.current = true;
    // The agreement covers this one attempt only.
    setAgreed(false);
    setConsentMissing(false);
    controller.current = new AbortController();
    setState({ step: "saving" });
    let outcome: SaveOutcome;
    try {
      outcome = await saveSession(config.apiBase, payload, authorization, {
        fetchImpl,
        signal: controller.current.signal,
      });
    } catch (error) {
      inFlight.current = false;
      if (!(error instanceof ConsentNotAuthorizedError)) throw error;
      // Nothing was sent. Ask for agreement again.
      setConsentMissing(true);
      setState({ step: "offer" });
      return;
    }
    inFlight.current = false;
    if (outcome.kind === "cancelled" && controller.current.signal.aborted) {
      // The panel was removed; there is nothing left to update.
      return;
    }
    setState({ step: "done", outcome });
  }

  const finished =
    state.step === "done" &&
    (state.outcome.kind === "saved" || state.outcome.kind === "already_saved");
  const retrying =
    state.step === "done" &&
    (canRetry(state.outcome) || state.outcome.kind === "cancelled");
  const showConsent = state.step === "offer" || retrying;

  return (
    <section
      aria-labelledby={headingId}
      className="session-results__section save-session"
    >
      {heading}
      <p>
        You can save this session&apos;s trial data to the HUMAN BENCHMARK test
        server running on this computer. Saving is optional. Your results and
        the CSV download above work the same either way.
      </p>

      <Feedback tone="warning" title="This is a development test, not a study">
        <p>
          The notice on this panel (version{" "}
          <code>{CONSENT_NOTICE.version}</code>) is a provisional draft. It has
          not been approved, and there is no ethics or research approval. Save
          only your own test sessions.
        </p>
      </Feedback>

      {!finished ? (
        <div className="save-session__notice">
          <h3>What would be saved</h3>
          <ul>
            <li>
              Which experiment and protocol version this was, and that the
              session was complete.
            </li>
            <li>
              The trial order: the random seed and the planned sequence of
              trials.
            </li>
            <li>
              For every practice and main trial: its condition and what was
              shown, the key you pressed (or none), whether it was correct, your
              response time, and the browser&apos;s timestamps for the trial.
            </li>
            <li>Whether you took the break, and how long it lasted.</li>
            <li>
              The notice version you agreed to, and the time the server stored
              the session.
            </li>
          </ul>
          <h3>What is not stored</h3>
          <ul>
            <li>No name, email, account or password. None is asked for.</li>
            <li>None of the results calculated on this page.</li>
            <li>
              No browser or device details. Like any web request, your browser
              automatically sends standard information such as its name, version
              and preferred language. The test server does not store or log it.
              No cookies are sent.
            </li>
            <li>
              This page&apos;s internal session ID is not sent. A new random
              save ID is created only so that the same session cannot be stored
              twice.
            </li>
            <li>
              Your IP address is not stored with the session. When the test
              server is started with its documented command, its request log
              does not record it either.
            </li>
          </ul>
          <h3>Where it goes, and for how long</h3>
          <p>
            Only to the test server at <code>{config.apiBase}</code>, which this
            page accepts only when it is on this computer. The server keeps the
            session in its database file. There is no automatic deletion: the
            session stays until the person running that server deletes it.
          </p>
          <p>
            Viewing or deleting a saved session is not available from this page
            yet, because there is no safe way to prove the session is yours.
            That will need to be designed first.
          </p>
        </div>
      ) : null}

      <div ref={statusRef} tabIndex={-1} className="save-session__status">
        {state.step === "declined" ? (
          <>
            <Feedback tone="info" title="Not saved">
              <p>Nothing from this session was sent.</p>
            </Feedback>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setState({ step: "offer" })}
            >
              Review saving again
            </Button>
          </>
        ) : null}
        {state.step === "unsupported" ? (
          <Feedback
            tone="warning"
            title="Saving is not available in this browser"
          >
            <p>
              This browser cannot create a secure random save ID, so nothing was
              sent.{" "}
              {"Your results and the CSV download on this page are unchanged."}
            </p>
          </Feedback>
        ) : null}
        {state.step === "saving" ? (
          <>
            <Feedback tone="info" title="Saving…">
              <p>
                Sending this session to the local test server. Please keep this
                page open.
              </p>
            </Feedback>
            <Button type="button" disabled aria-busy="true">
              Saving…
            </Button>
          </>
        ) : null}
        {state.step === "done" ? (
          <OutcomeMessage
            outcome={state.outcome}
            experimentName={experimentName}
          />
        ) : null}
      </div>

      {showConsent ? (
        <div className="save-session__consent">
          {retrying ? (
            <p>
              Each save attempt needs your agreement. To try again, tick the box
              again.
            </p>
          ) : null}
          <div className="save-session__agree">
            <input
              type="checkbox"
              className="checkbox"
              id={checkboxId}
              ref={checkboxRef}
              checked={agreed}
              aria-describedby={consentMissing ? `${ids}-missing` : undefined}
              onChange={(event) => setAgreed(event.currentTarget.checked)}
            />
            <label htmlFor={checkboxId}>
              I have read this provisional notice, and I agree to save this
              session to the local test server.
            </label>
          </div>
          {consentMissing && !agreed ? (
            <p
              id={`${ids}-missing`}
              className="save-session__error"
              role="alert"
            >
              To save, first tick the box to agree. Nothing has been sent.
            </p>
          ) : null}
          <div className="save-session__actions">
            <Button type="button" onClick={() => void startSave()}>
              {retrying ? "Try saving again" : "Save this session"}
            </Button>
            {state.step === "offer" ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setAgreed(false);
                  setConsentMissing(false);
                  setState({ step: "declined" });
                }}
              >
                Don&apos;t save
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

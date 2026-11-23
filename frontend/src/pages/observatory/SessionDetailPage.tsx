import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { usePageTitle } from "../../app/usePageTitle";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { Feedback } from "../../components/ui/Feedback";
import { Loading } from "../../components/ui/Loading";
import { FLANKER_CONFIGURATION } from "../../experiments/flanker/flanker";
import { FLANKER_RESULTS_COPY } from "../../experiments/flanker/flankerResultsCopy";
import {
  appObservatoryConfig,
  getSession,
  listSessions,
  type ObservatoryConfig,
  type RequestFailure,
  type StoredSessionDetail,
} from "../../experiments/shared/observatory/observatoryClient";
import {
  analyseStoredSession,
  experimentName,
  type AnalysedStoredSession,
} from "../../experiments/shared/observatory/storedSession";
import { SessionResults } from "../../experiments/shared/SessionResults";
import { STROOP_CONFIGURATION } from "../../experiments/stroop/stroop";
import { STROOP_RESULTS_COPY } from "../../experiments/stroop/stroopResultsFormat";
import { DeleteSessionDialog } from "./DeleteSessionDialog";
import { AccessDisabledNotice, SavedAt } from "./observatoryCopy";
import { formatSavedAt, readFailureMessage } from "./observatoryFormat";
import "../Page.css";
import "./Observatory.css";

type DetailState =
  | { phase: "loading" }
  | { phase: "invalid_link" }
  | { phase: "not_found" }
  | { phase: "failed"; kind: RequestFailure["kind"] }
  | {
      phase: "ready";
      session: StoredSessionDetail;
      analysed: AnalysedStoredSession;
    };

export function SessionDetailPage() {
  usePageTitle("Saved session");
  const [config] = useState(appObservatoryConfig);
  const { sessionId = "" } = useParams();
  if (!config) {
    return (
      <div className="page observatory">
        <Feedback tone="info" title="Not connected">
          <p>{readFailureMessage("not_configured")}</p>
        </Feedback>
      </div>
    );
  }
  return <ReloadableDetail config={config} sessionId={sessionId} />;
}

/** Each load (first view, retry, re-check) starts from a fresh loading state. */
function ReloadableDetail({
  config,
  sessionId,
}: {
  config: ObservatoryConfig;
  sessionId: string;
}) {
  const [attempt, setAttempt] = useState(0);
  return (
    <SessionDetail
      key={`${sessionId}:${attempt}`}
      config={config}
      sessionId={sessionId}
      reload={() => setAttempt((count) => count + 1)}
    />
  );
}

function SessionDetail({
  config,
  sessionId,
  reload,
}: {
  config: ObservatoryConfig;
  sessionId: string;
  reload: () => void;
}) {
  const navigate = useNavigate();
  const [state, setState] = useState<DetailState>({ phase: "loading" });
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void getSession(config, sessionId, { signal: controller.signal }).then(
      (outcome) => {
        if (controller.signal.aborted) return;
        if (outcome.kind === "ok") {
          setState({
            phase: "ready",
            session: outcome.session,
            analysed: analyseStoredSession(outcome.session, {
              expectedSessionId: sessionId,
            }),
          });
        } else if (outcome.kind === "not_found") {
          // With local-owner access off the backend has no per-session
          // route, so a 404 alone is ambiguous. One summary-list request
          // (limit 1) tells the cases apart without revealing anything the
          // list endpoint does not already reveal: it answers 405 when
          // access is off.
          void listSessions(config, { limit: 1 }).then((probe) => {
            if (controller.signal.aborted) return;
            setState(
              probe.kind === "access_disabled"
                ? { phase: "failed", kind: "access_disabled" }
                : { phase: "not_found" },
            );
          });
        } else if (outcome.kind === "rejected") {
          setState({ phase: "invalid_link" });
        } else {
          setState({ phase: "failed", kind: outcome.kind });
        }
      },
    );
    return () => controller.abort();
  }, [config, sessionId]);

  const back = (
    <Link className="text-link observatory-back" to="/observatory">
      ← All saved sessions
    </Link>
  );

  if (state.phase === "loading") {
    return (
      <div className="page observatory">
        {back}
        <Loading label="Loading the saved session" />
      </div>
    );
  }
  if (state.phase === "invalid_link" || state.phase === "not_found") {
    return (
      <div className="page observatory">
        {back}
        <EmptyState
          title={
            state.phase === "not_found"
              ? "This session is not stored"
              : "This is not a link to a saved session"
          }
          action={
            <Link className="text-link" to="/observatory">
              Go to saved sessions
            </Link>
          }
        >
          {state.phase === "not_found"
            ? "The local test server has no session with this ID. It may have been deleted."
            : "The address does not contain a valid session ID."}
        </EmptyState>
      </div>
    );
  }
  if (state.phase === "failed") {
    return (
      <div className="page observatory">
        {back}
        {state.kind === "access_disabled" ? (
          <AccessDisabledNotice />
        ) : (
          <Feedback tone="error" title="The saved session could not be loaded">
            <p>{readFailureMessage(state.kind)}</p>
            <Button type="button" variant="secondary" onClick={reload}>
              Try again
            </Button>
          </Feedback>
        )}
      </div>
    );
  }

  const { session, analysed } = state;
  const known =
    session.experiment_id === "stroop" || session.experiment_id === "flanker";
  const name = known
    ? experimentName(session.experiment_id as "stroop" | "flanker")
    : "Unknown experiment";
  const practice = session.trials.filter(
    (trial) => trial.phase === "practice",
  ).length;
  const main = session.trials.length - practice;

  return (
    <div className="page observatory">
      {back}
      <header className="page-header">
        <p className="page-eyebrow">Saved session · development only</p>
        <h1>{name} session</h1>
        <p className="page-intro">
          Saved by the local test server on <SavedAt iso={session.created_at} />{" "}
          (your local time). This is when the session was saved, not when it was
          run.
        </p>
      </header>

      <section aria-labelledby="session-identity">
        <h2 id="session-identity" className="visually-hidden">
          Session details
        </h2>
        <dl className="observatory-meta">
          <div>
            <dt>Experiment</dt>
            <dd>{name}</dd>
          </div>
          <div>
            <dt>Saved</dt>
            <dd>
              <SavedAt iso={session.created_at} />
            </dd>
          </div>
          <div>
            <dt>Protocol</dt>
            <dd>
              {session.protocol_id}, version {session.protocol_version}
            </dd>
          </div>
          <div>
            <dt>Configuration</dt>
            <dd>
              {session.configuration_id}, version{" "}
              {session.configuration_version}
            </dd>
          </div>
          <div>
            <dt>Trials stored</dt>
            <dd>
              {practice} practice · {main} main
            </dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{session.status}</dd>
          </div>
          <div>
            <dt>Consent notice</dt>
            <dd>
              <code>{session.consent_notice_version}</code>
            </dd>
          </div>
          <div>
            <dt>Session ID</dt>
            <dd>
              <code className="observatory-id">{session.session_id}</code>
            </dd>
          </div>
        </dl>
      </section>

      {analysed.ok ? (
        <>
          <Card as="section" aria-labelledby="before-reading">
            <h2 id="before-reading">Before you read these results</h2>
            <ul className="observatory-limits">
              <li>
                <strong>Descriptive, not diagnostic.</strong> These results
                describe this one session. They are not a diagnosis, a measure
                of intelligence or ability, or a comparison with other people.
              </li>
              <li>
                <strong>Calculated now.</strong>{" "}
                {analysed.session.analysisVersion.note}
              </li>
              <li>
                <strong>Shown on its own.</strong> Sessions are not compared
                here. Sessions can only be compared when the experiment,
                protocol, configuration and analysis versions match, and even
                then differences can come from practice, tiredness, time of day
                or the device.
              </li>
              <li>
                <strong>Device not recorded.</strong> The keyboard, browser and
                screen size used were not stored, so a difference between
                sessions may come from the device.
                {analysed.experimentId === "flanker"
                  ? " For Flanker, the arrows’ on-screen size and spacing also depend on the screen."
                  : ""}
              </li>
            </ul>
          </Card>
          {analysed.experimentId === "stroop" ? (
            <SessionResults
              results={analysed.results}
              copy={STROOP_RESULTS_COPY}
              responseWindowMs={STROOP_CONFIGURATION.main.responseDeadlineMs}
              saveConfig={null}
            />
          ) : (
            <SessionResults
              results={analysed.results}
              copy={FLANKER_RESULTS_COPY}
              responseWindowMs={FLANKER_CONFIGURATION.main.responseDeadlineMs}
              saveConfig={null}
            />
          )}
        </>
      ) : (
        <Feedback
          tone="warning"
          title="Results cannot be shown for this session"
        >
          <p>{analysed.problem.message}</p>
          <p>The stored data was not changed.</p>
        </Feedback>
      )}

      <section className="observatory-danger" aria-labelledby="delete-one">
        <h2 id="delete-one">Delete this session</h2>
        <p>
          Permanently deletes this session and all of its trials from the local
          test server’s database. Downloaded CSV files, backups and cloud-synced
          copies are not affected.
        </p>
        <Button
          type="button"
          variant="danger"
          onClick={() => setDeleting(true)}
        >
          Delete this session…
        </Button>
      </section>

      {deleting ? (
        <DeleteSessionDialog
          config={config}
          session={{
            sessionId: session.session_id,
            experimentName: name,
            createdAt: session.created_at,
          }}
          onDone={(result) => {
            setDeleting(false);
            if (result === "cancelled") return;
            if (result === "unknown") {
              reload();
              return;
            }
            navigate("/observatory", {
              replace: true,
              state: {
                deleted:
                  result === "deleted"
                    ? {
                        tone: "success",
                        title: "Session deleted",
                        body: `The ${name} session saved on ${formatSavedAt(session.created_at)} was deleted from the local test server’s database.`,
                      }
                    : {
                        tone: "info",
                        title: "That session was no longer stored",
                      },
              },
            });
          }}
        />
      ) : null}
    </div>
  );
}

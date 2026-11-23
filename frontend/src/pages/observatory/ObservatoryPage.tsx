import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { usePageTitle } from "../../app/usePageTitle";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { Feedback } from "../../components/ui/Feedback";
import { Label, Select } from "../../components/ui/FormControls";
import { Loading } from "../../components/ui/Loading";
import {
  appObservatoryConfig,
  listSessions,
  MAX_PAGE_SIZE,
  type ListOutcome,
  type ObservatoryConfig,
  type RequestFailure,
  type StoredSessionSummary,
} from "../../experiments/shared/observatory/observatoryClient";
import {
  experimentName,
  isSupportedVersion,
} from "../../experiments/shared/observatory/storedSession";
import type { SaveExperimentId } from "../../experiments/shared/persistence/sessionPayload";
import { DeleteAllPanel, type DeleteAllResult } from "./DeleteAllPanel";
import {
  DeleteSessionDialog,
  type SessionToDelete,
} from "./DeleteSessionDialog";
import {
  AccessDisabledNotice,
  LocalOwnerNotice,
  SavedAt,
} from "./observatoryCopy";
import { ObservatoryTabs } from "./ObservatoryTabs";
import { formatSavedAt, readFailureMessage } from "./observatoryFormat";
import "../Page.css";
import "./Observatory.css";

export const PAGE_SIZE = 20;

type Filter = "all" | SaveExperimentId;

type ListState =
  | { phase: "loading" }
  | { phase: "failed"; kind: RequestFailure["kind"] }
  | {
      phase: "ready";
      sessions: readonly StoredSessionSummary[];
      nextCursor: string | null;
      loadingMore: boolean;
      moreError: string | null;
    };

interface Flash {
  tone: "success" | "info";
  title: string;
  body?: string;
}

function filterFrom(value: string | null): Filter {
  return value === "stroop" || value === "flanker" ? value : "all";
}

export function ObservatoryPage() {
  usePageTitle("Saved sessions");
  const [config] = useState(appObservatoryConfig);
  if (!config) {
    return (
      <div className="page observatory">
        <Feedback tone="info" title="Not connected">
          <p>{readFailureMessage("not_configured")}</p>
        </Feedback>
      </div>
    );
  }
  return <FilteredHistory config={config} />;
}

/** A fresh list (starting in its loading state) for each filter. */
function FilteredHistory({ config }: { config: ObservatoryConfig }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const filter = filterFrom(searchParams.get("experiment"));
  return (
    <SessionHistory
      key={filter}
      config={config}
      filter={filter}
      onFilter={(next) =>
        setSearchParams(next === "all" ? {} : { experiment: next })
      }
    />
  );
}

function SessionHistory({
  config,
  filter,
  onFilter,
}: {
  config: ObservatoryConfig;
  filter: Filter;
  onFilter: (next: Filter) => void;
}) {
  const location = useLocation();
  const [state, setState] = useState<ListState>({ phase: "loading" });
  const [toDelete, setToDelete] = useState<SessionToDelete | null>(null);
  const [flash, setFlash] = useState<Flash | null>(() => {
    const deleted = (location.state as { deleted?: Flash } | null)?.deleted;
    return deleted ?? null;
  });
  const flashRef = useRef<HTMLDivElement>(null);
  const loaded = useRef<readonly StoredSessionSummary[]>([]);

  const query = filter === "all" ? {} : { experimentId: filter };

  // First page, newest first. The current list stays on screen while the
  // server is asked (callers show the loading state themselves if wanted).
  const requestFirst = useCallback(
    (signal: AbortSignal, size = PAGE_SIZE) =>
      listSessions(
        config,
        { ...(filter === "all" ? {} : { experimentId: filter }), limit: size },
        { signal },
      ),
    [config, filter],
  );

  const showFirst = useCallback((outcome: ListOutcome) => {
    if (outcome.kind !== "ok") {
      setState({ phase: "failed", kind: outcome.kind });
      return;
    }
    loaded.current = outcome.page.sessions;
    setState({
      phase: "ready",
      sessions: outcome.page.sessions,
      nextCursor: outcome.page.next_cursor,
      loadingMore: false,
      moreError: null,
    });
  }, []);

  const loadFirst = useCallback(
    (size = PAGE_SIZE) => {
      const controller = new AbortController();
      void requestFirst(controller.signal, size).then(showFirst);
    },
    [requestFirst, showFirst],
  );

  useEffect(() => {
    const controller = new AbortController();
    void requestFirst(controller.signal).then((outcome) => {
      if (!controller.signal.aborted) showFirst(outcome);
    });
    return () => controller.abort();
  }, [requestFirst, showFirst]);

  const reconcile = useCallback(() => {
    // Ask the server again for at least as many sessions as were shown.
    loadFirst(
      Math.min(MAX_PAGE_SIZE, Math.max(PAGE_SIZE, loaded.current.length)),
    );
  }, [loadFirst]);

  function retry() {
    setState({ phase: "loading" });
    loadFirst();
  }

  useEffect(() => {
    if (flash) flashRef.current?.focus();
  }, [flash]);

  async function loadMore() {
    if (state.phase !== "ready" || !state.nextCursor) return;
    const cursor = state.nextCursor;
    setState({ ...state, loadingMore: true, moreError: null });
    const outcome = await listSessions(config, {
      ...query,
      limit: PAGE_SIZE,
      cursor,
    });
    setState((current) => {
      if (current.phase !== "ready") return current;
      if (outcome.kind !== "ok") {
        return {
          ...current,
          loadingMore: false,
          moreError: readFailureMessage(outcome.kind),
        };
      }
      const known = new Set(current.sessions.map((entry) => entry.session_id));
      const sessions = [
        ...current.sessions,
        ...outcome.page.sessions.filter(
          (entry) => !known.has(entry.session_id),
        ),
      ];
      loaded.current = sessions;
      return {
        phase: "ready",
        sessions,
        nextCursor: outcome.page.next_cursor,
        loadingMore: false,
        moreError: null,
      };
    });
  }

  function removeFromList(sessionId: string) {
    setState((current) => {
      if (current.phase !== "ready") return current;
      const sessions = current.sessions.filter(
        (entry) => entry.session_id !== sessionId,
      );
      loaded.current = sessions;
      return { ...current, sessions };
    });
  }

  function deleteDone(
    result: "deleted" | "already_gone" | "unknown" | "cancelled",
  ) {
    const target = toDelete;
    setToDelete(null);
    if (!target || result === "cancelled") return;
    if (result === "deleted") {
      removeFromList(target.sessionId);
      setFlash({
        tone: "success",
        title: "Session deleted",
        body: `The ${target.experimentName} session saved on ${formatSavedAt(target.createdAt)} was deleted from the local test server’s database.`,
      });
    } else if (result === "already_gone") {
      removeFromList(target.sessionId);
      setFlash({
        tone: "info",
        title: "That session was no longer stored",
        body: "The list has been checked again with the test server.",
      });
    } else {
      setFlash({
        tone: "info",
        title: "The list was checked again",
        body: "The deletion could not be confirmed, so the list now shows what the test server reports.",
      });
    }
    reconcile();
  }

  function deleteAllDone(result: DeleteAllResult) {
    if (result.kind === "deleted") {
      setFlash(
        result.sessions === 0
          ? { tone: "info", title: "There was nothing to delete" }
          : {
              tone: "success",
              title: "All saved sessions deleted",
              body: `${result.sessions} session${result.sessions === 1 ? "" : "s"} (${result.trials} trials) were deleted from the local test server’s database.`,
            },
      );
      if (state.phase === "ready") {
        loaded.current = [];
        setState({ ...state, sessions: [], nextCursor: null });
      }
    } else {
      setFlash({
        tone: "info",
        title: "The list was checked again",
        body: "The deletion could not be confirmed, so the list now shows what the test server reports.",
      });
    }
    reconcile();
  }

  const knownEmpty =
    filter === "all" && state.phase === "ready" && state.sessions.length === 0;

  return (
    <div className="page observatory">
      <header className="page-header">
        <p className="page-eyebrow">Personal Observatory · development only</p>
        <h1>Saved sessions</h1>
        <p className="page-intro">
          Look back at sessions you saved to the local test server. Each session
          is shown on its own, as it was recorded. Results are calculated when
          you open a session; this list loads no trial data.
        </p>
      </header>

      <ObservatoryTabs />
      <LocalOwnerNotice apiBase={config.apiBase} />

      <div ref={flashRef} tabIndex={-1} className="observatory-flash">
        {flash ? (
          <Feedback tone={flash.tone} title={flash.title}>
            {flash.body ? <p>{flash.body}</p> : null}
          </Feedback>
        ) : null}
      </div>

      <section
        className="observatory-history"
        aria-labelledby="history-heading"
      >
        <div className="observatory-toolbar">
          <h2 id="history-heading">History</h2>
          <div className="observatory-filter">
            <Label htmlFor="observatory-filter">Experiment</Label>
            <Select
              id="observatory-filter"
              value={filter}
              onChange={(event) => {
                onFilter(filterFrom(event.currentTarget.value));
              }}
            >
              <option value="all">All experiments</option>
              <option value="stroop">Stroop</option>
              <option value="flanker">Flanker</option>
            </Select>
          </div>
        </div>

        {state.phase === "loading" ? (
          <Loading label="Loading saved sessions" />
        ) : null}

        {state.phase === "failed" ? (
          state.kind === "access_disabled" ? (
            <AccessDisabledNotice />
          ) : (
            <Feedback tone="error" title="Saved sessions could not be loaded">
              <p>{readFailureMessage(state.kind)}</p>
              <Button type="button" variant="secondary" onClick={retry}>
                Try again
              </Button>
            </Feedback>
          )
        ) : null}

        {state.phase === "ready" && state.sessions.length === 0 ? (
          filter === "all" ? (
            <EmptyState
              title="No saved sessions"
              action={
                <Link className="text-link" to="/experiments">
                  Go to the experiments
                </Link>
              }
            >
              Complete a Stroop or Flanker session and choose “Save this
              session” on its results page. Saved sessions appear here.
            </EmptyState>
          ) : (
            <EmptyState
              title={`No saved ${experimentName(filter)} sessions`}
              action={
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => onFilter("all")}
                >
                  Show all experiments
                </Button>
              }
            >
              None of the saved sessions is from this experiment.
            </EmptyState>
          )
        ) : null}

        {state.phase === "ready" && state.sessions.length > 0 ? (
          <>
            <p className="observatory-muted" aria-live="polite">
              Showing {state.sessions.length} saved session
              {state.sessions.length === 1 ? "" : "s"}, newest first.
              {state.nextCursor ? " Older sessions are available below." : ""}
            </p>
            <div className="observatory-table-wrap">
              <table className="observatory-table">
                <caption>
                  Saved sessions. “Saved” is when the test server stored the
                  session, in your local time, not when it was run.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Experiment</th>
                    <th scope="col">Saved</th>
                    <th scope="col">Status</th>
                    <th scope="col">Trials stored</th>
                    <th scope="col">Version</th>
                    <th scope="col">
                      <span className="visually-hidden">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {state.sessions.map((entry) => (
                    <HistoryRow
                      key={entry.session_id}
                      entry={entry}
                      onDelete={() =>
                        setToDelete({
                          sessionId: entry.session_id,
                          experimentName: experimentName(entry.experiment_id),
                          createdAt: entry.created_at,
                        })
                      }
                    />
                  ))}
                </tbody>
              </table>
            </div>
            {state.moreError ? (
              <Feedback tone="error" title="Older sessions could not be loaded">
                <p>{state.moreError}</p>
              </Feedback>
            ) : null}
            {state.nextCursor ? (
              <Button
                type="button"
                variant="secondary"
                isLoading={state.loadingMore}
                onClick={() => void loadMore()}
              >
                Show older sessions
              </Button>
            ) : null}
          </>
        ) : null}
      </section>

      {state.phase === "ready" ? (
        <DeleteAllPanel
          config={config}
          knownEmpty={knownEmpty}
          onDone={deleteAllDone}
        />
      ) : null}

      {toDelete ? (
        <DeleteSessionDialog
          config={config}
          session={toDelete}
          onDone={deleteDone}
        />
      ) : null}
    </div>
  );
}

function HistoryRow({
  entry,
  onDelete,
}: {
  entry: StoredSessionSummary;
  onDelete: () => void;
}) {
  const name = experimentName(entry.experiment_id);
  const supported = isSupportedVersion(entry);
  return (
    <tr>
      <th scope="row" data-label="Experiment">
        {name}
      </th>
      <td data-label="Saved">
        <SavedAt iso={entry.created_at} />
      </td>
      <td data-label="Status">
        {entry.status === "complete" ? (
          <Badge tone="success">Complete</Badge>
        ) : (
          <Badge tone="warning">{entry.status}</Badge>
        )}
      </td>
      <td data-label="Trials stored">
        {entry.trial_counts.practice} practice · {entry.trial_counts.main} main
      </td>
      <td data-label="Version">
        <span className="observatory-version">
          {entry.protocol_id} · configuration {entry.configuration_version}
        </span>
        {supported ? null : (
          <Badge tone="warning">Not analysable in this version</Badge>
        )}
      </td>
      <td className="observatory-actions">
        <Link
          className="text-link"
          to={`/observatory/sessions/${entry.session_id}`}
          aria-label={`Open the ${name} session saved on ${formatSavedAt(entry.created_at)}`}
        >
          Open
        </Link>
        <Button
          type="button"
          variant="ghost"
          onClick={onDelete}
          aria-label={`Delete the ${name} session saved on ${formatSavedAt(entry.created_at)}`}
        >
          Delete
        </Button>
      </td>
    </tr>
  );
}

import { useId, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Feedback } from "../../components/ui/Feedback";
import { Label, TextInput } from "../../components/ui/FormControls";
import {
  DELETE_ALL_CONFIRMATION,
  deleteAllSessions,
  type ObservatoryConfig,
} from "../../experiments/shared/observatory/observatoryClient";
import { ConfirmDialog } from "./ConfirmDialog";
import { deleteFailureMessage } from "./observatoryFormat";

/** What the person types. The request always carries the backend's own
 * phrase, DELETE_ALL_CONFIRMATION. */
export const TYPED_CONFIRMATION = "delete all sessions";

export type DeleteAllResult =
  { kind: "deleted"; sessions: number; trials: number } | { kind: "unknown" };

/**
 * Deletes EVERY session in the local database, after a typed confirmation.
 * Kept visually and structurally apart from deleting one session.
 */
export function DeleteAllPanel({
  config,
  knownEmpty,
  onDone,
}: {
  config: ObservatoryConfig;
  /** True when the unfiltered list is known to be empty. */
  knownEmpty: boolean;
  onDone: (result: DeleteAllResult) => void;
}) {
  const ids = useId();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<{
    message: string;
    outcomeUnknown: boolean;
  } | null>(null);

  const matches = typed.trim() === TYPED_CONFIRMATION;

  function close() {
    const unknown = failure?.outcomeUnknown ?? false;
    setOpen(false);
    setTyped("");
    setFailure(null);
    if (unknown) onDone({ kind: "unknown" });
  }

  async function confirm() {
    if (!matches) return;
    setBusy(true);
    setFailure(null);
    const outcome = await deleteAllSessions(config, DELETE_ALL_CONFIRMATION);
    setBusy(false);
    if (outcome.kind === "deleted") {
      setOpen(false);
      setTyped("");
      onDone({
        kind: "deleted",
        sessions: outcome.deletedSessions,
        trials: outcome.deletedTrials,
      });
      return;
    }
    setFailure(deleteFailureMessage(outcome.kind));
  }

  return (
    <section className="observatory-danger" aria-labelledby={`${ids}-heading`}>
      <h2 id={`${ids}-heading`}>Delete all saved sessions</h2>
      <p>
        This deletes <strong>every</strong> session in the local test server’s
        database: Stroop and Flanker, including any not shown by the current
        filter, with all of their trials. It cannot be undone.
      </p>
      {knownEmpty ? (
        <p className="observatory-muted">
          There are no saved sessions to delete.
        </p>
      ) : null}
      <Button
        type="button"
        variant="danger"
        onClick={() => setOpen(true)}
        disabled={knownEmpty}
      >
        Delete all saved sessions…
      </Button>

      {open ? (
        <ConfirmDialog
          title="Delete all saved sessions?"
          confirmLabel={failure ? "Try deleting again" : "Delete all sessions"}
          confirmDisabled={!matches}
          busy={busy}
          onConfirm={() => void confirm()}
          onCancel={close}
          cancelLabel={failure ? "Close" : "Cancel"}
        >
          <p>
            Every saved session and all of its trials will be permanently
            deleted from the local test server’s database. CSV files you
            downloaded, backups and cloud-synced copies are not affected.
          </p>
          <div className="observatory-dialog__field">
            <Label htmlFor={`${ids}-typed`}>
              To confirm, type <strong>{TYPED_CONFIRMATION}</strong>
            </Label>
            <TextInput
              id={`${ids}-typed`}
              value={typed}
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => setTyped(event.currentTarget.value)}
              disabled={busy}
            />
          </div>
          {failure ? (
            <Feedback
              tone="error"
              title={
                failure.outcomeUnknown
                  ? "Deletion not confirmed"
                  : "Not deleted"
              }
            >
              <p>{failure.message}</p>
            </Feedback>
          ) : null}
        </ConfirmDialog>
      ) : null}
    </section>
  );
}

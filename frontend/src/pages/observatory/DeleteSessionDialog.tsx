import { useState } from "react";
import { Feedback } from "../../components/ui/Feedback";
import {
  deleteSession,
  type ObservatoryConfig,
} from "../../experiments/shared/observatory/observatoryClient";
import { ConfirmDialog } from "./ConfirmDialog";
import { SavedAt } from "./observatoryCopy";
import { deleteFailureMessage, shortId } from "./observatoryFormat";

export interface SessionToDelete {
  sessionId: string;
  experimentName: string;
  createdAt: string;
}

/**
 * Confirms and deletes ONE session. `onDone` reports what is known:
 *   - "deleted": the server confirmed the deletion;
 *   - "already_gone": the server no longer had it;
 *   - "unknown": the outcome could not be confirmed (the caller re-checks);
 *   - "cancelled": the person chose not to delete.
 * Nothing is reported as deleted unless the server confirmed it.
 */
export function DeleteSessionDialog({
  config,
  session,
  onDone,
}: {
  config: ObservatoryConfig;
  session: SessionToDelete;
  onDone: (
    result: "deleted" | "already_gone" | "unknown" | "cancelled",
  ) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<{
    message: string;
    outcomeUnknown: boolean;
  } | null>(null);

  async function confirm() {
    setBusy(true);
    setFailure(null);
    const outcome = await deleteSession(config, session.sessionId);
    setBusy(false);
    if (outcome.kind === "deleted") return onDone("deleted");
    if (outcome.kind === "not_found") return onDone("already_gone");
    setFailure(deleteFailureMessage(outcome.kind));
  }

  return (
    <ConfirmDialog
      title={`Delete this ${session.experimentName} session?`}
      confirmLabel={failure ? "Try deleting again" : "Delete this session"}
      busy={busy}
      onConfirm={() => void confirm()}
      onCancel={() => onDone(failure?.outcomeUnknown ? "unknown" : "cancelled")}
      cancelLabel={failure ? "Close" : "Cancel"}
    >
      <p>
        The {session.experimentName} session saved on{" "}
        <SavedAt iso={session.createdAt} /> (ID{" "}
        <code>{shortId(session.sessionId)}…</code>) and all of its trials will
        be permanently deleted from the local test server’s database. This
        cannot be undone.
      </p>
      <p>
        CSV files you downloaded, backups and cloud-synced copies of the
        database are not affected.
      </p>
      {failure ? (
        <Feedback
          tone="error"
          title={
            failure.outcomeUnknown ? "Deletion not confirmed" : "Not deleted"
          }
        >
          <p>{failure.message}</p>
        </Feedback>
      ) : null}
    </ConfirmDialog>
  );
}

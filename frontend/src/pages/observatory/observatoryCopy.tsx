import { Feedback } from "../../components/ui/Feedback";
import { formatSavedAt } from "./observatoryFormat";

export function SavedAt({ iso }: { iso: string }) {
  return <time dateTime={iso}>{formatSavedAt(iso)}</time>;
}

export function AccessDisabledNotice() {
  return (
    <Feedback tone="info" title="Viewing saved sessions is switched off">
      <p>
        The local test server only lists, shows and deletes saved sessions when
        it is started with local-owner access turned on (
        <code>HB_LOCAL_OWNER_ACCESS=true</code>, see{" "}
        <code>backend/README.md</code>, “Local-owner access”). Nothing was read.
      </p>
    </Feedback>
  );
}

/** The honest description of what this page is and what deletion reaches. */
export function LocalOwnerNotice({ apiBase }: { apiBase: string }) {
  return (
    <Feedback tone="warning" title="A development tool on this computer">
      <p>
        This page shows every session stored by the local test server at{" "}
        <code>{apiBase}</code>. There is no account and no proof that a session
        is yours: anyone who can use this computer while the server runs with
        local-owner access on can view and delete all of them.
      </p>
      <p>
        Sessions were saved under a provisional, unapproved notice for testing.
        They are not research data.
      </p>
      <p>
        Deleting removes a session from that server’s database. It does not
        remove CSV files you downloaded, backups, or copies made by cloud sync
        such as OneDrive, and it is not a guaranteed, unrecoverable erasure.
      </p>
    </Feedback>
  );
}

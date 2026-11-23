import type { RequestFailure } from "../../experiments/shared/observatory/observatoryClient";

/** The server's save time, in the viewer's local time zone. */
export function formatSavedAt(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    // Seconds included: sessions saved within the same minute must still be
    // told apart, especially in the delete confirmation.
    timeStyle: "medium",
  }).format(new Date(iso));
}

/** A short, recognisable form of a session ID (first 8 characters). */
export function shortId(sessionId: string): string {
  return sessionId.slice(0, 8);
}

/** Why a request did not succeed, in plain language (reading). */
export function readFailureMessage(kind: RequestFailure["kind"]): string {
  switch (kind) {
    case "not_configured":
      return "This page is not connected to a local test server.";
    case "access_disabled":
      return "Viewing saved sessions is switched off on the test server.";
    case "unavailable":
      return "The test server could not be reached. Check that it is running.";
    case "timeout":
      return "The test server did not answer in time.";
    case "server_error":
      return "The test server reported an error.";
    case "rejected":
      return "The test server refused the request.";
    case "cancelled":
      return "The request was stopped.";
    case "unexpected":
      return "The test server's answer could not be used.";
  }
}

/**
 * Why a deletion did not succeed. Only outcomes where the server certainly
 * did not delete anything say so; for the others the result is unknown, and
 * the page checks with the server again rather than guessing.
 */
export function deleteFailureMessage(kind: RequestFailure["kind"]): {
  message: string;
  outcomeUnknown: boolean;
} {
  switch (kind) {
    case "not_configured":
      return {
        message:
          "This page is not connected to a local test server. Nothing was deleted.",
        outcomeUnknown: false,
      };
    case "access_disabled":
      return {
        message:
          "Deleting is switched off on the test server. Nothing was deleted.",
        outcomeUnknown: false,
      };
    case "rejected":
      return {
        message: "The test server refused the request. Nothing was deleted.",
        outcomeUnknown: false,
      };
    case "unavailable":
      return {
        message:
          "The test server could not be reached, so it is not known whether anything was deleted. The list will be checked again.",
        outcomeUnknown: true,
      };
    case "timeout":
      return {
        message:
          "The test server did not answer in time, so it is not known whether anything was deleted. The list will be checked again.",
        outcomeUnknown: true,
      };
    case "cancelled":
      return {
        message:
          "The request was stopped, so it is not known whether anything was deleted. The list will be checked again.",
        outcomeUnknown: true,
      };
    case "server_error":
    case "unexpected":
      return {
        message:
          "The test server's answer could not be confirmed, so it is not known whether anything was deleted. The list will be checked again.",
        outcomeUnknown: true,
      };
  }
}

import type { ReactNode } from "react";
import "./Feedback.css";

type FeedbackTone = "success" | "warning" | "error" | "info";

interface FeedbackProps {
  tone: FeedbackTone;
  title: string;
  children?: ReactNode;
}

export function Feedback({ tone, title, children }: FeedbackProps) {
  return (
    <div
      className={`feedback feedback--${tone}`}
      role={tone === "error" ? "alert" : "status"}
    >
      <strong>{title}</strong>
      {children ? <div className="feedback__body">{children}</div> : null}
    </div>
  );
}

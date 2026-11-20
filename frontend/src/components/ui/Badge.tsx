import type { HTMLAttributes, ReactNode } from "react";
import "./Badge.css";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: "neutral" | "success" | "warning" | "error" | "info";
  children: ReactNode;
}

export function Badge({ tone = "neutral", children, ...props }: BadgeProps) {
  return (
    <span className={`badge badge--${tone}`} {...props}>
      {children}
    </span>
  );
}

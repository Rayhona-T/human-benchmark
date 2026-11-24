import type { HTMLAttributes, ReactNode } from "react";
import "./Card.css";

interface CardProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  /** "div" for cards that carry their own role (status, alertdialog). */
  as?: "article" | "section" | "div";
  elevated?: boolean;
}

export function Card({
  children,
  as: Element = "article",
  elevated = false,
  className = "",
  ...props
}: CardProps) {
  return (
    <Element
      className={`card${elevated ? " card--elevated" : ""}${className ? ` ${className}` : ""}`}
      {...props}
    >
      {children}
    </Element>
  );
}

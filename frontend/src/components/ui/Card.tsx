import type { HTMLAttributes, ReactNode } from "react";
import "./Card.css";

interface CardProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  as?: "article" | "section";
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

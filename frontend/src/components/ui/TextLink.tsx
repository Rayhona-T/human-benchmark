import type { AnchorHTMLAttributes, ReactNode } from "react";
import "./TextLink.css";

interface TextLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  children: ReactNode;
}

export function TextLink({ children, ...props }: TextLinkProps) {
  return (
    <a className="text-link" {...props}>
      {children}
    </a>
  );
}

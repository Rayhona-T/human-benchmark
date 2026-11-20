import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from "react";
import "./FormControls.css";

interface LabelProps {
  htmlFor: string;
  children: ReactNode;
  required?: boolean;
}

export function Label({ htmlFor, children, required }: LabelProps) {
  return (
    <label className="field-label" htmlFor={htmlFor}>
      {children}
      {required ? <span aria-hidden="true"> *</span> : null}
    </label>
  );
}

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean;
}

export function TextInput({ hasError = false, ...props }: TextInputProps) {
  return (
    <input
      className={`text-input${hasError ? " text-input--error" : ""}`}
      aria-invalid={hasError || undefined}
      {...props}
    />
  );
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  hasError?: boolean;
}

export function Select({ hasError = false, children, ...props }: SelectProps) {
  return (
    <select
      className={`select-input${hasError ? " select-input--error" : ""}`}
      aria-invalid={hasError || undefined}
      {...props}
    >
      {children}
    </select>
  );
}

export function Checkbox(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className="checkbox" type="checkbox" {...props} />;
}

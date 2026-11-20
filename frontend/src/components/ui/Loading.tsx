import "./Loading.css";

interface LoadingProps {
  label?: string;
}

export function Loading({ label = "Loading" }: LoadingProps) {
  return (
    <div className="loading" role="status" aria-live="polite">
      <span className="loading__indicator" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

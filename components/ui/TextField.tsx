import { useId, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";

interface FieldFrameProps {
  label: string;
  hint?: string;
  error?: string;
}

const CONTROL_CLASSES =
  "w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-base text-text placeholder:text-muted focus:border-accent focus:outline-none aria-[invalid=true]:border-danger";

function FieldMessage({ id, hint, error }: { id: string; hint?: string; error?: string }) {
  if (error) {
    return (
      <p id={id} className="text-sm text-danger">
        {error}
      </p>
    );
  }
  return hint ? (
    <p id={id} className="text-sm text-muted">
      {hint}
    </p>
  ) : null;
}

export function TextField({ label, hint, error, ...rest }: FieldFrameProps & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  const messageId = `${id}-message`;
  return (
    <label htmlFor={id} className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      <input id={id} aria-invalid={Boolean(error)} aria-describedby={messageId} className={CONTROL_CLASSES} {...rest} />
      <FieldMessage id={messageId} hint={hint} error={error} />
    </label>
  );
}

export function TextAreaField({
  label,
  hint,
  error,
  ...rest
}: FieldFrameProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  const messageId = `${id}-message`;
  return (
    <label htmlFor={id} className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      <textarea
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={messageId}
        className={`${CONTROL_CLASSES} resize-none`}
        {...rest}
      />
      <FieldMessage id={messageId} hint={hint} error={error} />
    </label>
  );
}

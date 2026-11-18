import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  isLoading?: boolean;
  isFullWidth?: boolean;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-accent text-on-accent hover:bg-accent-strong",
  secondary: "border border-line bg-surface-raised text-text hover:bg-surface-sunken",
  danger: "bg-danger text-white hover:opacity-90",
  ghost: "text-muted hover:bg-surface-sunken hover:text-text",
};

export function Button({
  variant = "primary",
  isLoading = false,
  isFullWidth = false,
  disabled,
  className = "",
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      aria-busy={isLoading}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_CLASSES[variant]} ${isFullWidth ? "w-full" : ""} ${className}`}
      {...rest}
    >
      {isLoading ? "Please wait…" : children}
    </button>
  );
}

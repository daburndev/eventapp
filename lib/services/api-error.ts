export const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }

  get isAuthError(): boolean {
    return this.status === 401 || this.code === "not_authenticated";
  }
}

export function isAuthError(error: unknown): boolean {
  return error instanceof ApiError && error.isAuthError;
}

export function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return GENERIC_ERROR_MESSAGE;
}

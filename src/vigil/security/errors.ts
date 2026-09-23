export type VigilErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "LLM_NOT_CONFIGURED"
  | "BITGET_PAPER_NOT_CONFIGURED"
  | "NEWS_PROVIDER_UNAVAILABLE"
  | "WINDOW_CLOSED_GATE"
  | "PAPER_LOCK_VIOLATION"
  | "INTERNAL";

export class VigilError extends Error {
  readonly code: VigilErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: VigilErrorCode, message: string, status = 400, details?: unknown) {
    super(message);
    this.name = "VigilError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function isVigilError(error: unknown): error is VigilError {
  return error instanceof VigilError;
}

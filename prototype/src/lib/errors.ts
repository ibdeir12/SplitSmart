// Errors thrown by the service layer. Messages are safe to show to users.

export class ValidationError extends Error {
  readonly kind = "validation" as const;
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class NotFoundError extends Error {
  readonly kind = "not_found" as const;
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export function isUserError(e: unknown): e is ValidationError | NotFoundError {
  return e instanceof ValidationError || e instanceof NotFoundError;
}

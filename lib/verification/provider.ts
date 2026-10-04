export class InvalidIdentifierError extends Error {
  constructor() {
    super("Invalid identifier");
    this.name = "InvalidIdentifierError";
  }
}

export class RateLimitedError extends Error {
  readonly code: string;
  readonly retryAfterSeconds: number;

  constructor(code: string, retryAfterSeconds: number) {
    super("Rate limited");
    this.name = "RateLimitedError";
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export interface VerificationProvider {
  readonly channel: string;
  send(identifier: string): Promise<void>;
  verify(identifier: string, code: string): Promise<string | null>;
}

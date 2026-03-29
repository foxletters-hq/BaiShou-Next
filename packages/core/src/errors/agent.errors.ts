export class SessionNotFoundError extends Error {
  constructor(public readonly sessionId: string) {
    super(`Agent session '${sessionId}' not found`);
    this.name = 'SessionNotFoundError';
  }
}

export class ContextWindowExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ContextWindowExceededError';
  }
}

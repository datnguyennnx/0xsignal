export class AnalysisError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnalysisError";
  }
}

export class InvalidConfigError extends AnalysisError {
  constructor(
    message: string,
    public readonly field?: string,
    public readonly value?: unknown
  ) {
    super(message);
    this.name = "InvalidConfigError";
  }
}

export class InsufficientDataError extends AnalysisError {
  constructor(
    message: string,
    public readonly required: number,
    public readonly actual: number
  ) {
    super(message);
    this.name = "InsufficientDataError";
  }
}

export class ValidationError extends AnalysisError {
  constructor(
    message: string,
    public readonly context?: string
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

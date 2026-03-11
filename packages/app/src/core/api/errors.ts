export class ApiError extends Error {
  readonly status?: number;
  readonly statusText?: string;

  constructor(message: string, status?: number, statusText?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.statusText = statusText;
  }
}

export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NetworkError";
  }
}

/** Error code taxonomy — maps machine codes to HTTP status. */
export const ERROR_STATUS: Record<string, number> = {
  VALIDATION_ERROR: 400,
  INVALID_CREDENTIALS: 401,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
};

export type ApiErrorCode = keyof typeof ERROR_STATUS;

export class ApiError extends Error {
  code: ApiErrorCode;
  status: number;
  details?: unknown[];

  constructor(code: ApiErrorCode, message: string, details?: unknown[]) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = ERROR_STATUS[code] ?? 500;
    this.details = details;
  }
}

export const Errors = {
  validation: (message = 'Validation failed', details?: unknown[]) =>
    new ApiError('VALIDATION_ERROR', message, details),
  invalidCredentials: (message = 'Invalid email or password') =>
    new ApiError('INVALID_CREDENTIALS', message),
  unauthorized: (message = 'Authentication required') => new ApiError('UNAUTHORIZED', message),
  forbidden: (message = 'Insufficient permissions') => new ApiError('FORBIDDEN', message),
  notFound: (message = 'Resource not found') => new ApiError('NOT_FOUND', message),
  conflict: (message = 'Resource already exists') => new ApiError('CONFLICT', message),
  rateLimited: (message = 'Too many requests') => new ApiError('RATE_LIMITED', message),
  internal: (message = 'An unexpected error occurred') => new ApiError('INTERNAL_ERROR', message),
  unavailable: (message = 'Service temporarily unavailable') =>
    new ApiError('SERVICE_UNAVAILABLE', message),
};

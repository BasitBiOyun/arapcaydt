/**
 * What the API handlers use of a request and a response. Vercel's functions and the local Express
 * server both fit, and tests can pass small fakes.
 */
export interface ApiRequest {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  query?: Record<string, unknown>;
  /** Parsed JSON body: every field is checked where it is read. */
  body?: Record<string, unknown> | null;
}

export interface ApiResponse {
  status(code: number): ApiResponse;
  json(body: unknown): unknown;
  send(body: unknown): unknown;
  setHeader(name: string, value: string | number | readonly string[]): unknown;
}

/** The text of a thrown error ('' when there is none), for logs and answers. */
export function messageOf(error: unknown): string {
  if (typeof error === 'string') return error;
  const message = (error as { message?: unknown } | null)?.message;
  return typeof message === 'string' ? message : '';
}

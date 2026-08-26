export type HostResponseType = 'json' | 'text' | 'blob' | 'empty';

export interface HostRequest {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  headers?: Readonly<Record<string, string>>;
  body?: BodyInit | Record<string, unknown>;
  responseType?: HostResponseType;
}

export interface HostResponse<T> {
  status: number;
  headers: Headers;
  body: T;
}

export interface HostTransport {
  request<T>(request: HostRequest): Promise<HostResponse<T>>;
}

export class HostRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly payload: unknown
  ) {
    super(message);
    this.name = 'HostRequestError';
  }
}

export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export class FetchHostTransport implements HostTransport {
  constructor(
    private readonly baseUrl: string,
    private readonly fetcher: FetchLike,
    private readonly headers: () => Readonly<Record<string, string>> = () => ({})
  ) {}

  async request<T>(request: HostRequest): Promise<HostResponse<T>> {
    const customHeaders = { ...this.headers(), ...(request.headers || {}) };
    let body = request.body as BodyInit | null | undefined;
    if (body && typeof body === 'object' && !(body instanceof Blob) && !(body instanceof FormData)
      && !(body instanceof URLSearchParams) && !(body instanceof ArrayBuffer)) {
      customHeaders['content-type'] ||= 'application/json';
      body = JSON.stringify(body);
    }
    const response = await this.fetcher(this.baseUrl + request.path, {
      method: request.method, headers: customHeaders, body
    });
    const type = request.responseType || 'json';
    let parsed: unknown;
    if (type === 'empty' || response.status === 204) parsed = undefined;
    else if (type === 'blob') parsed = await response.blob();
    else if (type === 'text') parsed = await response.text();
    else parsed = await response.json().catch(() => null);
    if (!response.ok) {
      const detail = parsed && typeof parsed === 'object'
        ? String((parsed as Record<string, unknown>).detail || (parsed as Record<string, unknown>).error || '')
        : '';
      throw new HostRequestError(detail || `Host request failed (${response.status})`, response.status, parsed);
    }
    return { status: response.status, headers: response.headers, body: parsed as T };
  }
}

export const encodePath = (value: string | number) => encodeURIComponent(String(value));

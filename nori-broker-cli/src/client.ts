import { formatError } from './errors.js';

export interface BinaryResponse {
  data: ArrayBuffer;
  headers: Record<string, string>;
}

export interface HttpError {
  type: 'http';
  status: number;
  body: string;
}

export interface NetworkError {
  type: 'network';
  message: string;
}

export type ClientError = HttpError | NetworkError;

export interface BrokerClientOptions {
  baseUrl: string;
  token?: string | null;
}

interface RequestArgs {
  method: string;
  path: string;
  body?: Record<string, unknown> | null;
  query?: Record<string, string> | null;
}

const parseErrorBody = async (args: { response: Response }): Promise<never> => {
  const { response } = args;
  const raw = await response.text();
  let body = raw;
  try {
    const json = JSON.parse(raw) as { error?: unknown };
    if (typeof json.error === 'string') body = json.error;
  } catch {
    // Non-JSON body — fall through to raw text.
  }
  const err: HttpError = { type: 'http', status: response.status, body };
  throw err;
};

export class BrokerClient {
  private readonly baseUrl: string;
  private readonly token: string | null;

  constructor(options: BrokerClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.token = options.token ?? null;
  }

  private buildHeaders(args: { includeJson: boolean }): Record<string, string> {
    const { includeJson } = args;
    const headers: Record<string, string> = {};
    if (this.token != null) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    if (includeJson) {
      headers['Content-Type'] = 'application/json';
    }
    return headers;
  }

  private async request(args: RequestArgs): Promise<Response> {
    const { method, path, body, query } = args;
    let url = `${this.baseUrl}${path}`;
    if (query != null) {
      const params = new URLSearchParams(query);
      url += `?${params.toString()}`;
    }

    const hasBody = body != null;
    const fetchOptions: RequestInit = {
      method,
      headers: this.buildHeaders({ includeJson: hasBody }),
    };
    if (hasBody) {
      fetchOptions.body = JSON.stringify(body);
    }

    let response: Response;
    try {
      response = await fetch(url, fetchOptions);
    } catch (err) {
      const message = formatError({ err });
      const netErr: NetworkError = { type: 'network', message };
      throw netErr;
    }

    if (!response.ok) {
      await parseErrorBody({ response });
    }

    return response;
  }

  async get(args: {
    path: string;
    query?: Record<string, string> | null;
  }): Promise<unknown> {
    const response = await this.request({
      method: 'GET',
      path: args.path,
      query: args.query ?? null,
    });
    return response.json();
  }

  async post(args: {
    path: string;
    body?: Record<string, unknown> | null;
  }): Promise<unknown> {
    const response = await this.request({
      method: 'POST',
      path: args.path,
      body: args.body ?? null,
    });
    return response.json();
  }

  async put(args: {
    path: string;
    body?: Record<string, unknown> | null;
  }): Promise<unknown> {
    const response = await this.request({
      method: 'PUT',
      path: args.path,
      body: args.body ?? null,
    });
    return response.json();
  }

  async delete(args: { path: string }): Promise<unknown> {
    const response = await this.request({ method: 'DELETE', path: args.path });
    return response.json();
  }

  async postMultipart(args: {
    path: string;
    parts: {
      metadata: Record<string, unknown>;
      bundle: { bytes: Uint8Array; filename: string };
    };
    signal?: AbortSignal | null;
  }): Promise<unknown> {
    const url = `${this.baseUrl}${args.path}`;
    const headers: Record<string, string> = {};
    if (this.token != null) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    const formData = new FormData();
    formData.append('metadata', JSON.stringify(args.parts.metadata));
    formData.append(
      'bundle',
      new Blob([args.parts.bundle.bytes as BlobPart], {
        type: 'application/x-git-bundle',
      }),
      args.parts.bundle.filename,
    );

    const fetchOptions: RequestInit = {
      method: 'POST',
      headers,
      body: formData,
    };
    if (args.signal != null) fetchOptions.signal = args.signal;

    let response: Response;
    try {
      response = await fetch(url, fetchOptions);
    } catch (err) {
      const message = formatError({ err });
      const netErr: NetworkError = { type: 'network', message };
      throw netErr;
    }

    if (!response.ok) {
      await parseErrorBody({ response });
    }

    return response.json();
  }

  async downloadBinary(args: { path: string }): Promise<BinaryResponse> {
    const { path } = args;
    const url = `${this.baseUrl}${path}`;
    const fetchOptions: RequestInit = {
      method: 'POST',
      headers: this.buildHeaders({ includeJson: false }),
    };

    let response: Response;
    try {
      response = await fetch(url, fetchOptions);
    } catch (err) {
      const message = formatError({ err });
      const netErr: NetworkError = { type: 'network', message };
      throw netErr;
    }

    if (!response.ok) {
      await parseErrorBody({ response });
    }

    const data = await response.arrayBuffer();
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    return { data, headers };
  }
}

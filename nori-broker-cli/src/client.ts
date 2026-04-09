export class BrokerClient {
  private baseUrl: string;
  private token: string | undefined;

  constructor(baseUrl: string, token: string | undefined) {
    this.baseUrl = baseUrl;
    this.token = token;
  }

  private buildHeaders(includeJson: boolean): Record<string, string> {
    const headers: Record<string, string> = {};
    if (this.token !== undefined) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    if (includeJson) {
      headers['Content-Type'] = 'application/json';
    }
    return headers;
  }

  private async parseErrorBody(response: Response): Promise<never> {
    const raw = await response.text();
    let body = raw;
    try {
      const json = JSON.parse(raw);
      if (typeof json.error === 'string') body = json.error;
    } catch {}
    throw { type: 'http', status: response.status, body };
  }

  private async request(method: string, path: string, options?: { body?: Record<string, unknown>; query?: Record<string, string> }): Promise<Response> {
    let url = `${this.baseUrl}${path}`;
    if (options?.query) {
      const params = new URLSearchParams(options.query);
      url += `?${params.toString()}`;
    }

    const hasBody = options?.body !== undefined;
    const fetchOptions: RequestInit = {
      method,
      headers: this.buildHeaders(hasBody),
    };
    if (hasBody) {
      fetchOptions.body = JSON.stringify(options!.body);
    }

    let response: Response;
    try {
      response = await fetch(url, fetchOptions);
    } catch (err: any) {
      throw { type: 'network', message: err.message };
    }

    if (!response.ok) {
      await this.parseErrorBody(response);
    }

    return response;
  }

  async get(path: string, query?: Record<string, string>): Promise<any> {
    const response = await this.request('GET', path, { query });
    return response.json();
  }

  async post(path: string, body?: Record<string, unknown>): Promise<any> {
    const response = await this.request('POST', path, { body });
    return response.json();
  }

  async put(path: string, body?: Record<string, unknown>): Promise<any> {
    const response = await this.request('PUT', path, { body });
    return response.json();
  }

  async delete(path: string): Promise<any> {
    const response = await this.request('DELETE', path);
    return response.json();
  }

  async downloadBinary(path: string): Promise<{ data: ArrayBuffer; headers: Record<string, string> }> {
    let url = `${this.baseUrl}${path}`;
    const fetchOptions: RequestInit = {
      method: 'POST',
      headers: this.buildHeaders(false),
    };

    let response: Response;
    try {
      response = await fetch(url, fetchOptions);
    } catch (err: any) {
      throw { type: 'network', message: err.message };
    }

    if (!response.ok) {
      await this.parseErrorBody(response);
    }

    const data = await response.arrayBuffer();
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    return { data, headers };
  }
}

export const API_BASE_URL = 'http://localhost:4000';

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
    readonly requestId?: string
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

export async function requestJson<T>(path: string, init: RequestInit, operation: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, init);
  } catch (error) {
    console.error('[El Faraón API]', { operation, code: 'API_UNAVAILABLE', error });
    throw new ApiRequestError(
      'No se pudo conectar con la API. Confirma que esté encendida en el puerto 4000.',
      'API_UNAVAILABLE',
      0
    );
  }

  const rawBody = await response.text();
  let body: T & { message?: string; code?: string; requestId?: string } = {} as T & { message?: string; code?: string; requestId?: string };
  try {
    body = rawBody ? JSON.parse(rawBody) as typeof body : {} as typeof body;
  } catch (error) {
    console.error('[El Faraón API]', { operation, status: response.status, code: 'INVALID_RESPONSE', error });
  }

  if (!response.ok) {
    const code = body.code ?? `HTTP_${response.status}`;
    const message = body.message ?? `La API respondió con el estado ${response.status}.`;
    console.error('[El Faraón API]', {
      operation,
      status: response.status,
      code,
      requestId: body.requestId ?? response.headers.get('x-request-id'),
      message
    });
    throw new ApiRequestError(message, code, response.status, body.requestId ?? response.headers.get('x-request-id') ?? undefined);
  }

  return body as T;
}

export const API_BASE_URL = (import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:4000').replace(/\/$/, '')

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    })
  } catch {
    throw new ApiError('No se pudo conectar con la API. Comprueba que el backend esta arrancado.', 0)
  }

  if (!response.ok) {
    let message = 'Error al cargar datos'
    try {
      const payload = await response.json()
      message = String(payload?.message ?? payload?.error ?? message)
    } catch {
      // Keep default message when API does not return JSON.
    }
    throw new ApiError(message, response.status)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

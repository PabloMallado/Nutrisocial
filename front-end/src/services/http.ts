const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000'

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })

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

  return (await response.json()) as T
}


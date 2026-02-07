const API_BASE = '';

class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Ett fel uppstod' }));
    throw new ApiError(error.error || 'Ett fel uppstod', response.status);
  }

  const contentType = response.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    return response.json();
  }

  return response.blob() as unknown as T;
}

export const api = {
  async get<T = any>(url: string): Promise<T> {
    const response = await fetch(`${API_BASE}${url}`, {
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
      },
    });
    return handleResponse<T>(response);
  },

  async post<T = any>(url: string, data?: unknown): Promise<T> {
    const response = await fetch(`${API_BASE}${url}`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: data ? JSON.stringify(data) : undefined,
    });
    return handleResponse<T>(response);
  },

  async patch<T = any>(url: string, data: unknown): Promise<T> {
    const response = await fetch(`${API_BASE}${url}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(data),
    });
    return handleResponse<T>(response);
  },

  async delete<T = any>(url: string): Promise<T> {
    const response = await fetch(`${API_BASE}${url}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
      },
    });
    return handleResponse<T>(response);
  },

  async upload<T = any>(url: string, formData: FormData): Promise<T> {
    const response = await fetch(`${API_BASE}${url}`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });
    return handleResponse<T>(response);
  },

  async download(url: string, filename: string): Promise<void> {
    const response = await fetch(`${API_BASE}${url}`, {
      credentials: 'include',
    });

    if (!response.ok) {
      throw new ApiError('Nedladdningen misslyckades', response.status);
    }

    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(downloadUrl);
    document.body.removeChild(a);
  },
};

export { ApiError };

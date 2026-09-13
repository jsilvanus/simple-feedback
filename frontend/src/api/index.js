const rawApiBase = import.meta.env.VITE_API_BASE;
const rawApiTarget = import.meta.env.VITE_API_TARGET;

const normalizeApiBase = (value) => {
  if (!value) return null;
  const trimmed = value.trim().replace(/\/+$/, '');
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
};

const getDefaultApiBase = () => {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    const port = window.location.port;
    const isLocalhost = host === 'localhost' || host === '127.0.0.1';

    if (isLocalhost && port !== '3000') {
      return 'http://localhost:3000/api';
    }
  }

  return '/api';
};

const API_BASE =
  normalizeApiBase(rawApiBase) ||
  (rawApiTarget ? `${rawApiTarget.replace(/\/+$/, '')}/api` : getDefaultApiBase());

if (typeof window !== 'undefined') {
  console.debug('[api] Base URL resolved to:', API_BASE);
}

const buildApiUrl = (path) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${normalizedPath}`;
};

// Read the CSRF token from the csrfToken cookie (set by the server on login)
const getCsrfToken = () => {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)csrfToken=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
};

export const api = {
  // Get questionnaire for a location
  async getQuestionnaire(slug) {
    const response = await fetch(buildApiUrl(`/locations/${slug}/questionnaire`));
    if (!response.ok) {
      throw new Error('Failed to load questionnaire');
    }
    return response.json();
  },

  // Submit feedback
  async submitFeedback(locationId, questionnaireId, answers, locationToken, entryMethod = 'kiosk') {
    const headers = { 'Content-Type': 'application/json' };
    if (locationToken) {
      headers['X-Location-Token'] = locationToken;
    }
    const response = await fetch(buildApiUrl('/feedback'), {
      method: 'POST',
      headers,
      body: JSON.stringify({
        locationId,
        questionnaireId,
        answers,
        entryMethod,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to submit feedback');
    }

    return response.json();
  },

  // Authenticate location with password
  async authenticateLocation(slug, password) {
    const response = await fetch(buildApiUrl(`/locations/${slug}/login`), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password }),
    });
    
    if (!response.ok) {
      throw new Error('Authentication failed');
    }
    
    return response.json();
  },

  // Admin login — credentials are set as an httpOnly cookie by the server
  async adminLogin(username, password) {
    const response = await fetch(buildApiUrl('/admin/login'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      throw new Error('Login failed');
    }

    return response.json();
  },

  // Check whether the current admin cookie is still valid
  async adminMe() {
    const response = await fetch(buildApiUrl('/admin/me'), {
      credentials: 'include',
    });
    if (!response.ok) throw new Error('Unauthorized');
    return response.json();
  },

  // Clear the admin session cookie server-side
  async adminLogout() {
    await fetch(buildApiUrl('/admin/logout'), {
      method: 'POST',
      credentials: 'include',
    });
  },

  // Get admin data with authentication — cookie is sent automatically
  async adminRequest(endpoint, options = {}) {
    const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const csrfToken = getCsrfToken();

    const response = await fetch(buildApiUrl(`/admin${normalizedEndpoint}`), {
      ...options,
      credentials: 'include',
      headers: {
        ...options.headers,
        'Content-Type': 'application/json',
        ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Unauthorized');
      }
      throw new Error('Request failed');
    }

    return response.json();
  },
};

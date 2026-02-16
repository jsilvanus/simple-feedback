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

const buildApiUrl = (path) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${normalizedPath}`;
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
  async submitFeedback(locationId, questionnaireId, answers) {
    const response = await fetch(buildApiUrl('/feedback'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        locationId,
        questionnaireId,
        answers,
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

  // Admin login
  async adminLogin(username, password) {
    const response = await fetch(buildApiUrl('/admin/login'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });
    
    if (!response.ok) {
      throw new Error('Login failed');
    }
    
    return response.json();
  },

  // Get admin data with authentication
  async adminRequest(endpoint, options = {}) {
    const token = localStorage.getItem('adminToken');
    const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    
    const response = await fetch(buildApiUrl(`/admin${normalizedEndpoint}`), {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': token ? `Bearer ${token}` : '',
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('adminToken');
        throw new Error('Unauthorized');
      }
      throw new Error('Request failed');
    }
    
    return response.json();
  },

  // Admin CRUD operations
  async getLocations() {
    return this.adminRequest('/locations');
  },

  async createLocation(data) {
    return this.adminRequest('/locations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateLocation(id, data) {
    return this.adminRequest(`/locations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteLocation(id) {
    return this.adminRequest(`/locations/${id}`, {
      method: 'DELETE',
    });
  },

  async getQuestionnaires(includeArchived = false) {
    const query = includeArchived ? '?includeArchived=true' : '';
    return this.adminRequest(`/questionnaires${query}`);
  },

  async createQuestionnaire(data) {
    return this.adminRequest('/questionnaires', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateQuestionnaire(id, data) {
    return this.adminRequest(`/questionnaires/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async getSchedules() {
    return this.adminRequest('/schedules');
  },

  async createSchedule(data) {
    return this.adminRequest('/schedules', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateSchedule(id, data) {
    return this.adminRequest(`/schedules/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteSchedule(id) {
    return this.adminRequest(`/schedules/${id}`, {
      method: 'DELETE',
    });
  },
};

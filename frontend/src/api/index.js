const API_BASE = '/api';

export const api = {
  // Get questionnaire for a location
  async getQuestionnaire(slug) {
    const response = await fetch(`${API_BASE}/locations/${slug}/questionnaire`);
    if (!response.ok) {
      throw new Error('Failed to load questionnaire');
    }
    return response.json();
  },

  // Submit feedback
  async submitFeedback(locationId, questionnaireId, answers) {
    const response = await fetch(`${API_BASE}/feedback`, {
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
    const response = await fetch(`${API_BASE}/locations/${slug}/login`, {
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
    const response = await fetch(`${API_BASE}/admin/login`, {
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
    
    const response = await fetch(`${API_BASE}/admin${endpoint}`, {
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
};

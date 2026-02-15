import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import './AdminPage.css';

export default function AdminPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [loggedIn, setLoggedIn] = useState(!!localStorage.getItem('adminToken'));
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    
    try {
      const result = await api.adminLogin(loginForm.username, loginForm.password);
      localStorage.setItem('adminToken', result.token);
      setLoggedIn(true);
    } catch (err) {
      setLoginError('Invalid credentials');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    setLoggedIn(false);
    setActiveTab('overview');
  };

  if (!loggedIn) {
    return (
      <div className="admin-page">
        <div className="login-container">
          <h1>Admin Login</h1>
          <form onSubmit={handleLogin}>
            {loginError && <div className="error-message">{loginError}</div>}
            <input
              type="text"
              placeholder="Username"
              value={loginForm.username}
              onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={loginForm.password}
              onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
              required
            />
            <button type="submit" className="btn btn-primary">Login</button>
          </form>
          <div className="back-link">
            <button onClick={() => navigate('/')}>← Back to Home</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-container">
        <header className="admin-header">
          <h1>Admin Dashboard</h1>
          <button onClick={handleLogout} className="btn btn-secondary">Logout</button>
        </header>

        <nav className="admin-nav">
          <button 
            className={activeTab === 'overview' ? 'active' : ''} 
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button 
            className={activeTab === 'locations' ? 'active' : ''} 
            onClick={() => setActiveTab('locations')}
          >
            Locations
          </button>
          <button 
            className={activeTab === 'questions' ? 'active' : ''} 
            onClick={() => setActiveTab('questions')}
          >
            Questions
          </button>
          <button 
            className={activeTab === 'questionnaires' ? 'active' : ''} 
            onClick={() => setActiveTab('questionnaires')}
          >
            Questionnaires
          </button>
          <button 
            className={activeTab === 'schedules' ? 'active' : ''} 
            onClick={() => setActiveTab('schedules')}
          >
            Schedules
          </button>
          <button 
            className={activeTab === 'results' ? 'active' : ''} 
            onClick={() => setActiveTab('results')}
          >
            Results
          </button>
        </nav>

        <div className="admin-content">
          {activeTab === 'overview' && (
            <div className="admin-section">
              <h2>Welcome to Simple Feedback Admin</h2>
              <p>Use the navigation above to manage your feedback system.</p>
              <div className="feature-grid">
                <div className="feature-card">
                  <h3>Locations</h3>
                  <p>Manage physical or logical places where feedback is collected</p>
                </div>
                <div className="feature-card">
                  <h3>Questions</h3>
                  <p>Create and manage feedback questions</p>
                </div>
                <div className="feature-card">
                  <h3>Questionnaires</h3>
                  <p>Build questionnaires by grouping questions</p>
                </div>
                <div className="feature-card">
                  <h3>Schedules</h3>
                  <p>Schedule questionnaires at specific locations</p>
                </div>
                <div className="feature-card">
                  <h3>Results</h3>
                  <p>View and export feedback data</p>
                </div>
              </div>
            </div>
          )}

          {activeTab !== 'overview' && (
            <div className="admin-section">
              <h2>{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</h2>
              <p className="placeholder-text">
                This section is under development. Full CRUD functionality will be implemented soon.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

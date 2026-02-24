import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import LanguageSelector from '../components/LanguageSelector';
import AdminLocations from '../components/AdminLocations';
import AdminLocationGroups from '../components/AdminLocationGroups';
import AdminQuestions from '../components/AdminQuestions';
import AdminAnswerScales from '../components/AdminAnswerScales';
import AdminWordSets from '../components/AdminWordSets';
import AdminQuestionnaires from '../components/AdminQuestionnaires';
import AdminSchedules from '../components/AdminSchedules';
import AdminResults from '../components/AdminResults';
import './AdminPage.css';

export default function AdminPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
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
          <h1>{t('admin.login')}</h1>
          <form onSubmit={handleLogin}>
            {loginError && <div className="error-message">{loginError}</div>}
            <input
              type="text"
              placeholder={t('auth.username')}
              value={loginForm.username}
              onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
              required
            />
            <input
              type="password"
              placeholder={t('auth.password')}
              value={loginForm.password}
              onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
              required
            />
            <button type="submit" className="btn btn-primary">{t('auth.login')}</button>
          </form>
          <div className="back-link">
            <button onClick={() => navigate('/')}>← {t('admin.backToHome')}</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-container">
        <header className="admin-header">
          <h1>{t('admin.dashboard')}</h1>
          <div className="admin-header-actions">
            <LanguageSelector inline />
            <button onClick={handleLogout} className="btn btn-secondary">{t('auth.logout')}</button>
          </div>
        </header>

        <nav className="admin-nav">
          <button 
            className={activeTab === 'overview' ? 'active' : ''} 
            onClick={() => setActiveTab('overview')}
          >
            {t('admin.overview')}
          </button>
          <button 
            className={activeTab === 'questions' ? 'active' : ''} 
            onClick={() => setActiveTab('questions')}
          >
            {t('admin.questions')}
          </button>
          <button 
            className={activeTab === 'locations' ? 'active' : ''} 
            onClick={() => setActiveTab('locations')}
          >
            {t('admin.locations')}
          </button>
          <button 
            className={activeTab === 'schedules' ? 'active' : ''} 
            onClick={() => setActiveTab('schedules')}
          >
            {t('admin.schedules')}
          </button>
          <button
            className={activeTab === 'results' ? 'active' : ''}
            onClick={() => setActiveTab('results')}
          >
            {t('admin.results')}
          </button>
          <button onClick={() => navigate('/admin/map')}>
            {t('admin.map')}
          </button>
        </nav>

        <div className="admin-content">
          {activeTab === 'overview' && (
            <div className="admin-section">
              <h2>{t('admin.welcomeTitle')}</h2>
              <p>{t('admin.welcomeDesc')}</p>
              <div className="admin-help" style={{ border: '1px solid #e5e7eb', padding: 12, borderRadius: 6, marginTop: 12, background: '#fafafa' }}>
                <h3 style={{ marginTop: 0 }}>{t('admin.helpTitle')}</h3>
                <p style={{ marginBottom: 8 }}>{t('admin.helpIntro')}</p>
                <ol style={{ margin: 0, paddingLeft: 18 }}>
                  <li>{t('admin.helpStep1')}</li>
                  <li>{t('admin.helpStep2')}</li>
                  <li>{t('admin.helpStep3')}</li>
                </ol>
              </div>
              <div className="feature-grid">
                <div className="feature-card">
                  <h3>{t('admin.locations')}</h3>
                  <p>{t('admin.locationsDesc')}</p>
                </div>
                <div className="feature-card">
                  <h3>{t('admin.questions')}</h3>
                  <p>{t('admin.questionsDesc')}</p>
                </div>
                <div className="feature-card">
                  <h3>{t('admin.questionnaires')}</h3>
                  <p>{t('admin.questionnairesDesc')}</p>
                </div>
                <div className="feature-card">
                  <h3>{t('admin.schedules')}</h3>
                  <p>{t('admin.schedulesDesc')}</p>
                </div>
                <div className="feature-card">
                  <h3>{t('admin.results')}</h3>
                  <p>{t('admin.resultsDesc')}</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'questions' && (
            <div className="admin-grouped-sections">
              <section className="admin-group-section">
                <AdminQuestions />
              </section>
              <section className="admin-group-section">
                <AdminAnswerScales />
              </section>
              <section className="admin-group-section">
                <AdminWordSets />
              </section>
            </div>
          )}

          {activeTab === 'locations' && (
            <div className="admin-grouped-sections">
              <section className="admin-group-section">
                <AdminLocations />
              </section>
              <section className="admin-group-section">
                <AdminLocationGroups />
              </section>
            </div>
          )}

          {activeTab === 'schedules' && (
            <div className="admin-grouped-sections">
              <section className="admin-group-section">
                <AdminQuestionnaires />
              </section>
              <section className="admin-group-section">
                <AdminSchedules />
              </section>
            </div>
          )}

          {activeTab === 'results' && <AdminResults />}
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
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
import AdminAnswerViews from '../components/AdminAnswerViews';
import AdminEmailRecipients from '../components/AdminEmailRecipients';
import AdminSmsRecipients from '../components/AdminSmsRecipients';
import AdminNtfySubscriptions from '../components/AdminNtfySubscriptions';
import './AdminPage.css';

export default function AdminPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('overview');
  const [loggedIn, setLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [authConfig, setAuthConfig] = useState({ oidc: { enabled: false }, local: { enabled: true } });
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');

  // On mount, check URL error, fetch auth configuration, and verify current session
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const errorParam = searchParams.get('error');
    if (errorParam === 'no_role') {
      setLoginError(t('auth.noRoleError', 'Käyttäjälläsi ei ole oikeuksia hallintapaneeliin.'));
    } else if (errorParam === 'invalid_state') {
      setLoginError(t('auth.invalidStateError', 'Kirjautumisistunto vanhentui tai on virheellinen. Yritä uudelleen.'));
    } else if (errorParam) {
      setLoginError(errorParam);
    }

    api.getAuthConfig().then((cfg) => {
      if (cfg) setAuthConfig(cfg);
    }).catch(() => {});

    api.adminMe()
      .then((userData) => {
        setLoggedIn(true);
        setCurrentUser(userData);
        sessionStorage.setItem('adminLoggedIn', 'true');
      })
      .catch(() => {
        sessionStorage.removeItem('adminLoggedIn');
        setLoggedIn(false);
        setCurrentUser(null);
      })
      .finally(() => setAuthChecked(true));
  }, [t]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');

    try {
      await api.adminLogin(loginForm.username, loginForm.password);
      sessionStorage.setItem('adminLoggedIn', 'true');
      const user = await api.adminMe().catch(() => null);
      if (user) setCurrentUser(user);
      setLoggedIn(true);
    } catch (err) {
      setLoginError(t('auth.invalidCredentials', 'Invalid credentials'));
    }
  };

  const handleLogout = async () => {
    try {
      await api.adminLogout();
    } catch {
      // ignore
    }
    sessionStorage.removeItem('adminLoggedIn');
    setLoggedIn(false);
    setCurrentUser(null);
    setActiveTab('overview');
    if (authConfig.oidc?.enabled) {
      window.location.href = api.getOidcLogoutUrl();
    }
  };

  // Show nothing while we verify the cookie to avoid flashing the login form
  if (!authChecked) return null;

  if (!loggedIn) {
    const oidcEnabled = authConfig.oidc?.enabled;
    const localEnabled = authConfig.local?.enabled !== false;

    return (
      <div className="admin-page">
        <div className="login-container">
          <div className="login-card">
            <h1>{t('admin.login')}</h1>
            {loginError && <div className="error-message">{loginError}</div>}

            {oidcEnabled && (
              <div className="oidc-login-section">
                <a href={api.getOidcLoginUrl()} className="btn btn-oidc">
                  <svg className="oidc-icon" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
                  </svg>
                  {authConfig.oidc.buttonLabel || t('auth.signInWithTunnus', 'Kirjaudu Tunnuksella')}
                </a>
              </div>
            )}

            {oidcEnabled && localEnabled && (
              <div className="login-divider">
                <span>{t('auth.or', 'tai')}</span>
              </div>
            )}

            {localEnabled && (
              <form onSubmit={handleLogin}>
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
            )}

            <div className="back-link">
              <button onClick={() => navigate('/')}>← {t('admin.backToHome')}</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-container">
        <header className="admin-header">
          <div className="admin-header-title">
            <h1>{t('admin.dashboard')}</h1>
            {currentUser && (
              <div className="admin-user-info">
                <span className="user-name">{currentUser.name || currentUser.username}</span>
                {currentUser.role && <span className="user-role-badge">{currentUser.role}</span>}
              </div>
            )}
          </div>
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
          <button
            className={activeTab === 'answerViews' ? 'active' : ''}
            onClick={() => setActiveTab('answerViews')}
          >
            {t('admin.answerViews')}
          </button>
          <button
            className={activeTab === 'notifications' ? 'active' : ''}
            onClick={() => setActiveTab('notifications')}
          >
            {t('admin.notifications')}
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

          {activeTab === 'answerViews' && (
            <div className="admin-grouped-sections">
              <section className="admin-group-section">
                <AdminAnswerViews />
              </section>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="admin-grouped-sections">
              <section className="admin-group-section">
                <h2>Email Notifications</h2>
                <AdminEmailRecipients />
              </section>
              <section className="admin-group-section">
                <h2>SMS Notifications</h2>
                <AdminSmsRecipients />
              </section>
              <section className="admin-group-section">
                <h2>Push Notifications (ntfy.sh)</h2>
                <AdminNtfySubscriptions />
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

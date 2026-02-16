import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import LanguageSelector from '../components/LanguageSelector';
import SettingsButton from '../components/SettingsButton';
import SettingsModal from '../components/SettingsModal';
import RadarChart from '../components/RadarChart';
import './FeedbackPage.css';

export default function FeedbackPage() {
  const { locationSlug } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [contrastMode, setContrastMode] = useState(false);
  const [uiSize, setUISize] = useState(100);

  useEffect(() => {
    // Check for contrast mode from URL param or localStorage
    const contrastParam = searchParams.get('contrast');
    const storedContrast = localStorage.getItem('contrastMode');
    
    if (contrastParam === 'true' || contrastParam === '1') {
      setContrastMode(true);
      localStorage.setItem('contrastMode', 'true');
    } else if (storedContrast === 'true') {
      setContrastMode(true);
    }

    // Load UI size from localStorage
    const storedSize = localStorage.getItem('uiSize');
    if (storedSize) {
      setUISize(parseInt(storedSize, 10));
    }

    checkAuthAndLoad();
  }, [locationSlug]);

  useEffect(() => {
    // Apply contrast mode to body
    if (contrastMode) {
      document.body.classList.add('contrast-mode');
    } else {
      document.body.classList.remove('contrast-mode');
    }

    // Apply UI size as CSS variable
    document.documentElement.style.setProperty('--ui-scale', uiSize / 100);
  }, [contrastMode, uiSize]);

  const checkAuthAndLoad = async () => {
    // Check URL param for password
    const passParam = searchParams.get('pass');
    if (passParam) {
      await authenticateLocation(passParam);
      // Clear password from URL
      searchParams.delete('pass');
      setSearchParams(searchParams, { replace: true });
      return;
    }

    // Check if already authenticated
    const storedAuth = sessionStorage.getItem(`location_auth_${locationSlug}`);
    if (storedAuth) {
      loadQuestionnaire();
      return;
    }

    // Try loading without auth (in case password is not required)
    try {
      await loadQuestionnaire();
    } catch (err) {
      if (err.message.includes('authentication required')) {
        setAuthRequired(true);
        setLoading(false);
      }
    }
  };

  const authenticateLocation = async (pass) => {
    try {
      setLoading(true);
      setAuthError('');
      await api.authenticateLocation(locationSlug, pass);
      sessionStorage.setItem(`location_auth_${locationSlug}`, 'true');
      setAuthRequired(false);
      await loadQuestionnaire();
    } catch (err) {
      setAuthError(t('auth.invalidCredentials'));
      setAuthRequired(true);
      setLoading(false);
    }
  };

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    authenticateLocation(password);
  };

  const handleLogout = () => {
    sessionStorage.removeItem(`location_auth_${locationSlug}`);
    setData(null);
    setAnswers({});
    setCurrentPage(0);
    setAuthRequired(true);
    setShowSettings(false);
  };

  const handleToggleContrast = () => {
    const newMode = !contrastMode;
    setContrastMode(newMode);
    localStorage.setItem('contrastMode', newMode.toString());
  };

  const handleChangeUISize = (newSize) => {
    setUISize(newSize);
    localStorage.setItem('uiSize', newSize.toString());
  };

  const handleSettingsClick = () => {
    setShowSettings(true);
  };

  const handleSettingsLongPress = () => {
    handleToggleContrast();
  };

  const loadQuestionnaire = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await api.getQuestionnaire(locationSlug);
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = (questionId, value, textValue = null) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: { value, textValue },
    }));
  };

  const handleNext = () => {
    if (currentPage < data.questionnaire.pages.length - 1) {
      setCurrentPage(prev => prev + 1);
    } else {
      handleSubmit();
    }
  };

  const handlePrevious = () => {
    if (currentPage > 0) {
      setCurrentPage(prev => prev - 1);
    }
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      
      const formattedAnswers = Object.entries(answers).map(([questionId, answer]) => {
        // For continuous_scale, the value is an object, so we store it as JSON in textValue
        if (typeof answer.value === 'object' && answer.value !== null) {
          return {
            questionId: parseInt(questionId),
            value: null,
            textValue: JSON.stringify(answer.value),
          };
        }
        return {
          questionId: parseInt(questionId),
          value: answer.value,
          textValue: answer.textValue,
        };
      });

      await api.submitFeedback(
        data.location.id,
        data.questionnaire.id,
        formattedAnswers
      );

      setSuccess(true);
      
      // Auto-reset after 3 seconds
      setTimeout(() => {
        setSuccess(false);
        setAnswers({});
        setCurrentPage(0);
      }, 3000);
    } catch (err) {
      setError(t('feedback.failedToSubmit'));
    } finally {
      setSubmitting(false);
    }
  };

  // Auth required view
  if (authRequired) {
    return (
      <div className="feedback-page">
        <LanguageSelector />
        <div className="feedback-container auth-container">
          <h1>{t('auth.loginRequired')}</h1>
          <form onSubmit={handlePasswordSubmit}>
            <div className="form-group">
              <label htmlFor="password">{t('auth.enterPassword')}</label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('auth.password')}
                autoFocus
              />
            </div>
            {authError && <p className="error-message">{authError}</p>}
            <button type="submit" className="btn btn-primary">
              {t('auth.login')}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="feedback-page loading">
        <LanguageSelector />
        <div className="spinner"></div>
        <p>{t('common.loading')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="feedback-page error">
        <LanguageSelector />
        <h1>{t('common.error')}</h1>
        <p>{error}</p>
        <button onClick={loadQuestionnaire}>{t('common.retry')}</button>
      </div>
    );
  }

  if (success) {
    return (
      <div className="feedback-page success">
        <LanguageSelector />
        <div className="success-icon">✓</div>
        <h1>{t('feedback.thankYou')}</h1>
        <p>{t('feedback.feedbackSubmitted')}</p>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const currentPageData = data.questionnaire.pages[currentPage];
  const isLastPage = currentPage === data.questionnaire.pages.length - 1;

  return (
    <div className="feedback-page">
      <LanguageSelector />
      <SettingsButton 
        onClick={handleSettingsClick}
        onLongPress={handleSettingsLongPress}
      />
      <SettingsModal 
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        onLogout={handleLogout}
        showLogout={data?.location?.passwordRequired || false}
        contrastMode={contrastMode}
        onToggleContrast={handleToggleContrast}
        uiSize={uiSize}
        onChangeUISize={handleChangeUISize}
      />
      <div className="feedback-container">
        <header className="feedback-header">
          <h1>{data.location.name}</h1>
          <h2>{data.questionnaire.name}</h2>
          {data.questionnaire.description && (
            <p className="description">{data.questionnaire.description}</p>
          )}
        </header>

        <div className="feedback-content">
          <div className="page-indicator">
            {t('feedback.pageOf', { 
              current: currentPage + 1, 
              total: data.questionnaire.pages.length 
            })}
          </div>

          {currentPageData.questions.map(question => (
            <div key={question.id} className="question">
              <h3>{question.text}</h3>

              {question.type === 'scale' && question.answerScale && (
                <div className="answer-buttons">
                  {question.answerScale.buttons.map(button => (
                    <button
                      key={button.value}
                      className={`answer-btn ${answers[question.id]?.value === button.value ? 'selected' : ''}`}
                      style={{
                        backgroundColor: answers[question.id]?.value === button.value 
                          ? button.color 
                          : '#f0f0f0',
                        color: answers[question.id]?.value === button.value ? 'white' : '#333',
                      }}
                      onClick={() => handleAnswer(question.id, button.value)}
                    >
                      {button.label}
                    </button>
                  ))}
                </div>
              )}

              {question.type === 'text' && (
                <textarea
                  className="text-input"
                  value={answers[question.id]?.textValue || ''}
                  onChange={(e) => handleAnswer(question.id, null, e.target.value)}
                  placeholder={t('feedback.enterFeedback')}
                  rows={4}
                />
              )}

              {question.type === 'wordcloud' && (
                <div className="wordcloud-placeholder">
                  <p>Word cloud input (to be implemented)</p>
                </div>
              )}

              {question.type === 'continuous_scale' && question.answerScale && (
                <RadarChart
                  question={question}
                  value={answers[question.id]?.value}
                  onChange={(value) => handleAnswer(question.id, value)}
                />
              )}
            </div>
          ))}
        </div>

        <div className="feedback-actions">
          {currentPage > 0 && (
            <button 
              className="btn btn-secondary" 
              onClick={handlePrevious}
              disabled={submitting}
            >
              {t('common.previous')}
            </button>
          )}
          
          <button 
            className="btn btn-primary" 
            onClick={handleNext}
            disabled={submitting}
          >
            {submitting ? t('common.submitting') : (isLastPage ? t('common.submit') : t('common.next'))}
          </button>
        </div>
      </div>
    </div>
  );
}

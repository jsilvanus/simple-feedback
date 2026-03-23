import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import { api } from '../api';
import LanguageSelector from '../components/LanguageSelector';
import SettingsButton from '../components/SettingsButton';
import SettingsModal from '../components/SettingsModal';
import MultiScaleQuestion from '../components/MultiScaleQuestion';
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
  const [showLocationName, setShowLocationName] = useState(true);
  const uiScaleStyle = { '--ui-scale': uiSize / 100 };
  const uiSizeStorageKey = locationSlug ? `uiSize_${locationSlug}` : 'uiSize';
  const showLocationNameStorageKey = locationSlug ? `showLocationName_${locationSlug}` : 'showLocationName';

  const loadQuestionnaire = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await api.getQuestionnaire(locationSlug);
      setData(result);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const checkAuthAndLoad = async () => {
    try {
      const result = await loadQuestionnaire();
      const isAuthenticated = !!sessionStorage.getItem(`location_token_${locationSlug}`);

      if (result?.location?.passwordRequired && !isAuthenticated) {
        setAuthRequired(true);
      } else {
        setAuthRequired(false);
      }
    } catch {
      // Error state is handled in loadQuestionnaire
    }
  };

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

    // Load UI size from localStorage (location-specific, with fallback)
    const storedSize = localStorage.getItem(uiSizeStorageKey) || localStorage.getItem('uiSize');
    if (storedSize) {
      setUISize(parseInt(storedSize, 10));
    }

    const storedShowLocationName = localStorage.getItem(showLocationNameStorageKey);
    if (storedShowLocationName !== null) {
      setShowLocationName(storedShowLocationName === 'true');
    } else {
      setShowLocationName(true);
    }

    const initializePage = async () => {
      await checkAuthAndLoad();
    };

    initializePage();
  }, [locationSlug, searchParams, uiSizeStorageKey, showLocationNameStorageKey]);

  useEffect(() => {
    // Apply contrast mode to body
    if (contrastMode) {
      document.body.classList.add('contrast-mode');
    } else {
      document.body.classList.remove('contrast-mode');
    }

    return () => {
      document.body.classList.remove('contrast-mode');
    };
  }, [contrastMode]);

  const getWordText = (wordText) => {
    if (typeof wordText === 'string') {
      return wordText;
    }

    if (wordText && typeof wordText === 'object') {
      return wordText[i18n.language] || wordText.en || Object.values(wordText)[0] || '';
    }

    return '';
  };

  const authenticateLocation = async (pass) => {
    try {
      setLoading(true);
      setAuthError('');
      const result = await api.authenticateLocation(locationSlug, pass);
      if (result.locationToken) {
        sessionStorage.setItem(`location_token_${locationSlug}`, result.locationToken);
      }
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
    sessionStorage.removeItem(`location_token_${locationSlug}`);
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
    localStorage.setItem(uiSizeStorageKey, newSize.toString());
  };

  const handleToggleLocationName = () => {
    const nextValue = !showLocationName;
    setShowLocationName(nextValue);
    localStorage.setItem(showLocationNameStorageKey, nextValue.toString());
  };

  const handleSettingsClick = () => {
    setShowSettings(true);
  };

  const handleSettingsLongPress = () => {
    handleToggleContrast();
  };

  const handleAnswer = (questionId, value, textValue = null, wordArray = null) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: { value, textValue, wordArray },
    }));
  };

  const handleScaleItemAnswer = (questionId, itemId, value) => {
    setAnswers(prev => {
      const existing = prev[questionId] || {};
      return {
        ...prev,
        [questionId]: {
          ...existing,
          scaleItems: { ...(existing.scaleItems || {}), [itemId]: value },
        },
      };
    });
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

      const formattedAnswers = [];

      Object.entries(answers).forEach(([questionId, answer]) => {
        // Multi-scale question: emit one answer per scale item
        if (answer.scaleItems && Object.keys(answer.scaleItems).length > 0) {
          Object.entries(answer.scaleItems).forEach(([itemId, value]) => {
            formattedAnswers.push({
              questionId: parseInt(questionId),
              scaleItemId: parseInt(itemId),
              value: typeof value === 'number' ? value : null,
              textValue: null,
            });
          });
          return;
        }

        // Legacy single-scale / text / wordcloud answers
        const normalizedValue = typeof answer.value === 'number' ? answer.value : null;
        const normalizedTextValue = Array.isArray(answer.wordArray)
          ? (answer.wordArray.length > 0 ? answer.wordArray.join(', ') : null)
          : (answer.value && typeof answer.value === 'object'
              ? JSON.stringify(answer.value)
              : (answer.textValue || null));

        formattedAnswers.push({
          questionId: parseInt(questionId),
          value: normalizedValue,
          textValue: normalizedTextValue,
        });
      });

      const locationToken = sessionStorage.getItem(`location_token_${locationSlug}`);
      await api.submitFeedback(
        data.location.id,
        data.questionnaire.id,
        formattedAnswers,
        locationToken
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
      <div className="feedback-page" style={uiScaleStyle}>
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
      <div className="feedback-page loading" style={uiScaleStyle}>
        <LanguageSelector />
        <div className="spinner"></div>
        <p>{t('common.loading')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="feedback-page error" style={uiScaleStyle}>
        <LanguageSelector />
        <h1>{t('common.error')}</h1>
        <p>{error}</p>
        <button onClick={loadQuestionnaire}>{t('common.retry')}</button>
      </div>
    );
  }

  if (success) {
    return (
      <div className="feedback-page success" style={uiScaleStyle}>
        <LanguageSelector />
        <div className="success-icon">✓</div>
        <h1>{t('feedback.thankYou')}</h1>
        <p>{t('feedback.feedbackSubmitted')}</p>
        <p className="privacy-note">{t('feedback.privacyNoteSuccess')}</p>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const currentPageData = data.questionnaire.pages[currentPage];
  const isLastPage = currentPage === data.questionnaire.pages.length - 1;

  return (
    <div className="feedback-page" style={uiScaleStyle}>
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
        showLocationName={showLocationName}
        onToggleLocationName={handleToggleLocationName}
      />
      <div className="feedback-container">
        <header className="feedback-header">
          {showLocationName && <h1>{data.location.name}</h1>}
          <h2>{data.questionnaire.name}</h2>
          {data.questionnaire.description && (
            <p className="description">{data.questionnaire.description}</p>
          )}
        </header>

        <div className="feedback-content">
          {currentPageData.questions.map(question => {
            // Defense-in-depth: continuous_scale is not shown in kiosk mode
            if (question.type === 'continuous_scale') return null;

            return (
            <div key={question.id} className="question">
              <h3>{question.text}</h3>

              {question.type === 'scale' && Array.isArray(question.scaleItems) && question.scaleItems.length > 0 && (
                <MultiScaleQuestion
                  question={question}
                  itemAnswers={answers[question.id]?.scaleItems || {}}
                  onItemAnswer={(itemId, value) => handleScaleItemAnswer(question.id, itemId, value)}
                />
              )}

              {question.type === 'scale' && question.answerScale &&
                (!Array.isArray(question.scaleItems) || question.scaleItems.length === 0) && (
                question.answerScale.step < 1 ? (() => {
                  const scale = question.answerScale;
                  const buttons = scale.buttons || [];
                  const inferredMin = buttons.length > 0 ? Math.min(...buttons.map(b => Number(b.value))) : 1;
                  const inferredMax = buttons.length > 0 ? Math.max(...buttons.map(b => Number(b.value))) : 5;
                  const sliderMin = scale.minValue !== null && scale.minValue !== undefined
                    ? scale.minValue
                    : (scale.scaleMode === 'bipolar' ? -inferredMax : inferredMin);
                  const sliderMax = scale.maxValue !== null && scale.maxValue !== undefined
                    ? scale.maxValue
                    : inferredMax;
                  const defaultVal = scale.scaleMode === 'bipolar' ? 0 : sliderMin;
                  const currentValue = answers[question.id]?.value !== undefined && answers[question.id]?.value !== null
                    ? answers[question.id].value
                    : null;
                  const getLabelText = (label) => {
                    if (!label) return '';
                    return label[i18n.language] || label.en || Object.values(label).find(v => v) || '';
                  };
                  return (
                    <div className="scale-slider-wrapper">
                      <div className="scale-slider-labels">
                        <span className="scale-endpoint-label">{getLabelText(scale.minLabel)}</span>
                        <span className="scale-endpoint-label">{getLabelText(scale.maxLabel)}</span>
                      </div>
                      <input
                        type="range"
                        className="scale-slider"
                        min={sliderMin}
                        max={sliderMax}
                        step={scale.step}
                        value={currentValue !== null ? currentValue : defaultVal}
                        onChange={(e) => handleAnswer(question.id, parseFloat(e.target.value))}
                      />
                      <div className="scale-slider-value">
                        {currentValue !== null ? currentValue : <span className="no-selection">—</span>}
                      </div>
                    </div>
                  );
                })() : (
                  <div className="answer-buttons">
                    {question.answerScale.buttons.map(button => (
                      <button
                        key={button.value}
                        className={`answer-btn ${answers[question.id]?.value === button.value ? 'selected' : ''}`}
                        style={{
                          backgroundColor: button.color,
                          color: answers[question.id]?.value === button.value ? 'white' : '#333',
                        }}
                        onClick={() => handleAnswer(question.id, button.value)}
                      >
                        {button.label}
                      </button>
                    ))}
                  </div>
                )
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

              {question.type === 'wordcloud' && question.wordCloudOptions && (
                <div className="word-cloud-input">
                  <div className="word-chips">
                    {question.wordCloudOptions.words.map((word, index) => {
                      const wordText = getWordText(word.text);
                      const selectedWords = answers[question.id]?.wordArray || [];
                      const isSelected = selectedWords.includes(wordText);
                      const maxReached = selectedWords.length >= question.maxSelections && !isSelected;
                      
                      return (
                        <button
                          key={index}
                          className={`word-chip ${isSelected ? 'selected' : ''} ${maxReached ? 'disabled' : ''}`}
                          style={{
                            backgroundColor: isSelected ? word.color : '#f0f0f0',
                            color: isSelected ? 'white' : '#333',
                            opacity: maxReached ? 0.5 : 1,
                          }}
                          onClick={() => {
                            const currentWords = answers[question.id]?.wordArray || [];
                            let newWords;
                            
                            if (isSelected) {
                              // Deselect word
                              newWords = currentWords.filter(w => w !== wordText);
                            } else if (currentWords.length < question.maxSelections) {
                              // Select word
                              newWords = [...currentWords, wordText];
                            } else {
                              // Max reached, don't add
                              return;
                            }
                            
                            handleAnswer(question.id, null, null, newWords);
                          }}
                          disabled={maxReached}
                        >
                          {wordText}
                        </button>
                      );
                    })}
                  </div>
                  <div className="word-cloud-info">
                    <small>
                      {t('feedback.selectUpTo', { max: question.maxSelections })} 
                      {' '}({t('feedback.selectedCount', { 
                        current: (answers[question.id]?.wordArray || []).length, 
                        max: question.maxSelections 
                      })})
                    </small>
                  </div>
                </div>
              )}

            </div>
            );
          })}
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
            className="btn btn-primary submit-btn" 
            onClick={handleNext}
            disabled={submitting}
          >
            {submitting ? t('common.submitting') : (isLastPage ? t('common.submit') : t('common.next'))}
          </button>
        </div>

        {data.questionnaire.pages.length > 1 && (
          <div className="page-indicator page-indicator-bottom">
            {t('feedback.pageOf', {
              current: currentPage + 1,
              total: data.questionnaire.pages.length
            })}
          </div>
        )}

        <p className="privacy-note">{t('feedback.privacyNote')}</p>
      </div>
    </div>
  );
}

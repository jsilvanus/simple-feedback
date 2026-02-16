import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import './SettingsModal.css';

export default function SettingsModal({ 
  isOpen, 
  onClose, 
  onLogout, 
  showLogout,
  contrastMode,
  onToggleContrast,
  uiSize,
  onChangeUISize,
  showLocationName,
  onToggleLocationName
}) {
  const { t } = useTranslation();
  const [logoutPressTime, setLogoutPressTime] = useState(0);
  const [isLongPressing, setIsLongPressing] = useState(false);
  const logoutTimerRef = useRef(null);
  const pressStartRef = useRef(null);

  const LONG_PRESS_DURATION = 2000; // 2 seconds

  useEffect(() => {
    return () => {
      if (logoutTimerRef.current) {
        clearInterval(logoutTimerRef.current);
      }
    };
  }, []);

  const handleLogoutStart = () => {
    setIsLongPressing(true);
    pressStartRef.current = Date.now();
    
    logoutTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - pressStartRef.current;
      setLogoutPressTime(Math.min(elapsed, LONG_PRESS_DURATION));
      
      if (elapsed >= LONG_PRESS_DURATION) {
        clearInterval(logoutTimerRef.current);
        handleLogoutComplete();
      }
    }, 50);
  };

  const handleLogoutEnd = () => {
    if (logoutTimerRef.current) {
      clearInterval(logoutTimerRef.current);
    }
    setIsLongPressing(false);
    setLogoutPressTime(0);
    pressStartRef.current = null;
  };

  const handleLogoutComplete = () => {
    handleLogoutEnd();
    onLogout();
  };

  const handleIncrease = () => {
    const newSize = Math.min(uiSize + 10, 150);
    onChangeUISize(newSize);
  };

  const handleDecrease = () => {
    const newSize = Math.max(uiSize - 10, 70);
    onChangeUISize(newSize);
  };

  const handleReset = () => {
    onChangeUISize(100);
  };

  if (!isOpen) return null;

  const progressPercent = (logoutPressTime / LONG_PRESS_DURATION) * 100;

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-content" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>{t('settings.title')}</h2>
          <button className="settings-close" onClick={onClose}>×</button>
        </div>

        <div className="settings-body">
          {/* UI Size Controls */}
          <div className="settings-section">
            <h3>{t('settings.uiSize')}</h3>
            <div className="size-controls">
              <button 
                className="btn btn-secondary size-btn" 
                onClick={handleDecrease}
                disabled={uiSize <= 70}
              >
                <span className="size-icon">−</span>
                <span>{t('settings.decrease')}</span>
              </button>
              <div className="size-display">
                <span className="size-value">{uiSize}%</span>
                <button className="btn-link" onClick={handleReset}>
                  {t('settings.reset')}
                </button>
              </div>
              <button 
                className="btn btn-secondary size-btn" 
                onClick={handleIncrease}
                disabled={uiSize >= 150}
              >
                <span className="size-icon">+</span>
                <span>{t('settings.increase')}</span>
              </button>
            </div>
          </div>

          {/* Contrast Mode */}
          <div className="settings-section">
            <h3>{t('settings.contrastMode')}</h3>
            <p className="settings-description">{t('settings.contrastModeDesc')}</p>
            <button 
              className={`btn ${contrastMode ? 'btn-primary' : 'btn-secondary'} contrast-toggle`}
              onClick={onToggleContrast}
            >
              {contrastMode ? t('settings.contrastOn') : t('settings.contrastOff')}
            </button>
          </div>

          {/* Location Name Visibility */}
          <div className="settings-section">
            <h3>{t('settings.locationName')}</h3>
            <p className="settings-description">{t('settings.locationNameDesc')}</p>
            <button
              className={`btn ${showLocationName ? 'btn-primary' : 'btn-secondary'} contrast-toggle`}
              onClick={onToggleLocationName}
            >
              {showLocationName ? t('settings.locationNameOn') : t('settings.locationNameOff')}
            </button>
          </div>

          {/* Logout Section - Only shown if password required */}
          {showLogout && (
            <div className="settings-section logout-section">
              <h3>{t('auth.logout')}</h3>
              <p className="settings-description">{t('settings.logoutDesc')}</p>
              <button 
                className="btn btn-danger logout-btn"
                onMouseDown={handleLogoutStart}
                onMouseUp={handleLogoutEnd}
                onMouseLeave={handleLogoutEnd}
                onTouchStart={handleLogoutStart}
                onTouchEnd={handleLogoutEnd}
                onTouchCancel={handleLogoutEnd}
              >
                <span className="logout-text">
                  {isLongPressing ? t('settings.logoutHold') : t('auth.logout')}
                </span>
                {isLongPressing && (
                  <div className="logout-progress">
                    <div 
                      className="logout-progress-bar" 
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

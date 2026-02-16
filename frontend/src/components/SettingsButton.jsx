import React, { useRef, useEffect, useState } from 'react';
import './SettingsButton.css';

export default function SettingsButton({ onClick, onLongPress }) {
  const [isLongPressing, setIsLongPressing] = useState(false);
  const pressTimerRef = useRef(null);
  const pressStartRef = useRef(null);

  const LONG_PRESS_DURATION = 1500; // 1.5 seconds

  useEffect(() => {
    return () => {
      if (pressTimerRef.current) {
        clearTimeout(pressTimerRef.current);
      }
    };
  }, []);

  const handlePressStart = (e) => {
    e.preventDefault();
    setIsLongPressing(true);
    pressStartRef.current = Date.now();

    pressTimerRef.current = setTimeout(() => {
      handleLongPressComplete();
    }, LONG_PRESS_DURATION);
  };

  const handlePressEnd = (e) => {
    e.preventDefault();
    
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
    }

    const pressDuration = Date.now() - (pressStartRef.current || 0);
    setIsLongPressing(false);
    pressStartRef.current = null;

    // If it was a short press, trigger onClick
    if (pressDuration < LONG_PRESS_DURATION) {
      onClick();
    }
  };

  const handleLongPressComplete = () => {
    setIsLongPressing(false);
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
    }
    onLongPress();
  };

  return (
    <button 
      className={`settings-button ${isLongPressing ? 'long-pressing' : ''}`}
      onMouseDown={handlePressStart}
      onMouseUp={handlePressEnd}
      onMouseLeave={handlePressEnd}
      onTouchStart={handlePressStart}
      onTouchEnd={handlePressEnd}
      onTouchCancel={handlePressEnd}
      aria-label="Settings"
    >
      <svg 
        className="settings-icon" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2"
      >
        <circle cx="12" cy="12" r="3"/>
        <path d="M12 1v6m0 6v6m5.2-13.2l-4.2 4.2m-2.8 2.8L5.8 17.2m12.4 0l-4.2-4.2m-2.8-2.8L6 5.8"/>
        <circle cx="12" cy="12" r="10"/>
      </svg>
      {isLongPressing && (
        <div className="settings-button-pulse" />
      )}
    </button>
  );
}

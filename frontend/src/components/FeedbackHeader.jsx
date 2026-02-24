import React from 'react';

export default function FeedbackHeader({ showLocationName, location, questionnaire }) {
  return (
    <header className="feedback-header">
      {showLocationName && <h1>{location?.name}</h1>}
      <h2>{questionnaire?.name}</h2>
      {questionnaire?.description && (
        <p className="description">{questionnaire.description}</p>
      )}
    </header>
  );
}

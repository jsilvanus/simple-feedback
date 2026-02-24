import React from 'react';

export default function AnswerButtons({ question, value, onAnswer }) {
  if (!question?.answerScale) return null;

  return (
    <div className="answer-buttons">
      {question.answerScale.buttons.map(button => (
        <button
          key={button.value}
          className={`answer-btn ${value === button.value ? 'selected' : ''}`}
          style={{
            backgroundColor: button.color,
            color: value === button.value ? 'white' : '#333',
          }}
          onClick={() => onAnswer(question.id, button.value)}
        >
          {button.label}
        </button>
      ))}
    </div>
  );
}

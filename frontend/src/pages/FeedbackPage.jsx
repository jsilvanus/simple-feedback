import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import './FeedbackPage.css';

export default function FeedbackPage() {
  const { locationSlug } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    loadQuestionnaire();
  }, [locationSlug]);

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
      
      const formattedAnswers = Object.entries(answers).map(([questionId, answer]) => ({
        questionId: parseInt(questionId),
        value: answer.value,
        textValue: answer.textValue,
      }));

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
      setError('Failed to submit feedback');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="feedback-page loading">
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="feedback-page error">
        <h1>Error</h1>
        <p>{error}</p>
        <button onClick={loadQuestionnaire}>Retry</button>
      </div>
    );
  }

  if (success) {
    return (
      <div className="feedback-page success">
        <div className="success-icon">✓</div>
        <h1>Thank you!</h1>
        <p>Your feedback has been submitted.</p>
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
            Page {currentPage + 1} of {data.questionnaire.pages.length}
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
                  placeholder="Enter your feedback here..."
                  rows={4}
                />
              )}

              {question.type === 'wordcloud' && (
                <div className="wordcloud-placeholder">
                  <p>Word cloud input (to be implemented)</p>
                </div>
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
              Previous
            </button>
          )}
          
          <button 
            className="btn btn-primary" 
            onClick={handleNext}
            disabled={submitting}
          >
            {submitting ? 'Submitting...' : (isLastPage ? 'Submit' : 'Next')}
          </button>
        </div>
      </div>
    </div>
  );
}

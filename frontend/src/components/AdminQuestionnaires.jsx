import React, { useState, useEffect } from 'react';
import { api } from '../api';
import './AdminCrud.css';

export default function AdminQuestionnaires() {
  const [questionnaires, setQuestionnaires] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [answerScales, setAnswerScales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    questions: [],
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [questionnairesData, questionsData, scalesData] = await Promise.all([
        api.adminRequest('/questionnaires'),
        api.adminRequest('/questions'),
        api.adminRequest('/answer-scales'),
      ]);
      setQuestionnaires(questionnairesData);
      setQuestions(questionsData);
      setAnswerScales(scalesData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.adminRequest('/questionnaires', {
        method: 'POST',
        body: JSON.stringify(formData),
      });
      setShowForm(false);
      setFormData({ name: '', description: '', questions: [] });
      loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setFormData({ name: '', description: '', questions: [] });
  };

  const addQuestion = () => {
    setFormData({
      ...formData,
      questions: [
        ...formData.questions,
        {
          questionId: '',
          pageNumber: 1,
          answerScaleId: '',
          orderIndex: formData.questions.length,
        },
      ],
    });
  };

  const updateQuestion = (index, field, value) => {
    const newQuestions = [...formData.questions];
    newQuestions[index][field] = value;
    setFormData({ ...formData, questions: newQuestions });
  };

  const removeQuestion = (index) => {
    const newQuestions = formData.questions.filter((_, i) => i !== index);
    setFormData({ ...formData, questions: newQuestions });
  };

  if (loading) return <div className="loading">Loading questionnaires...</div>;
  if (error) return <div className="error">Error: {error}</div>;

  return (
    <div className="admin-crud-section">
      <div className="section-header">
        <h2>Questionnaires</h2>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          + Add Questionnaire
        </button>
      </div>

      {showForm && (
        <div className="form-modal">
          <div className="form-container large">
            <h3>Add New Questionnaire</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Customer Satisfaction Survey"
                  required
                />
              </div>
              
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description"
                  rows={2}
                />
              </div>

              <div className="form-group">
                <label>Questions</label>
                {formData.questions.map((q, index) => (
                  <div key={index} className="question-editor">
                    <select
                      value={q.questionId}
                      onChange={(e) => updateQuestion(index, 'questionId', parseInt(e.target.value))}
                      required
                    >
                      <option value="">Select question...</option>
                      {questions.map((question) => (
                        <option key={question.id} value={question.id}>
                          {question.text.substring(0, 50)}...
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      value={q.pageNumber}
                      onChange={(e) => updateQuestion(index, 'pageNumber', parseInt(e.target.value))}
                      placeholder="Page #"
                      min="1"
                      required
                    />
                    <select
                      value={q.answerScaleId}
                      onChange={(e) => updateQuestion(index, 'answerScaleId', e.target.value ? parseInt(e.target.value) : null)}
                    >
                      <option value="">No scale (text/wordcloud)</option>
                      {answerScales.map((scale) => (
                        <option key={scale.id} value={scale.id}>
                          {scale.name}
                        </option>
                      ))}
                    </select>
                    <button type="button" onClick={() => removeQuestion(index)} className="btn-icon">
                      ❌
                    </button>
                  </div>
                ))}
                <button type="button" onClick={addQuestion} className="btn btn-secondary btn-sm">
                  + Add Question
                </button>
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={handleCancel}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="data-list">
        {questionnaires.length === 0 ? (
          <div className="empty-state">
            <p>No questionnaires yet. Add your first questionnaire to get started.</p>
          </div>
        ) : (
          <div className="questionnaires-grid">
            {questionnaires.map((questionnaire) => (
              <div key={questionnaire.id} className="questionnaire-card">
                <h4>{questionnaire.name}</h4>
                {questionnaire.description && <p>{questionnaire.description}</p>}
                <small>Created {new Date(questionnaire.created_at).toLocaleDateString()}</small>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

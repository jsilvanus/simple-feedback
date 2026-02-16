import React, { useState, useEffect } from 'react';
import { api } from '../api';
import './AdminCrud.css';

export default function AdminQuestions() {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [formData, setFormData] = useState({
    text: '',
    type: 'scale',
  });

  useEffect(() => {
    loadQuestions();
  }, [showArchived]);

  const loadQuestions = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.adminRequest(`/questions?includeArchived=${showArchived}`);
      setQuestions(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleArchiveToggle = async (questionId, currentArchived) => {
    try {
      await api.adminRequest(`/questions/${questionId}/archive`, {
        method: 'PATCH',
        body: JSON.stringify({ archived: !currentArchived }),
      });
      loadQuestions();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.adminRequest('/questions', {
        method: 'POST',
        body: JSON.stringify(formData),
      });
      setShowForm(false);
      setFormData({ text: '', type: 'scale' });
      loadQuestions();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setFormData({ text: '', type: 'scale' });
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'scale': return '📊';
      case 'text': return '📝';
      case 'wordcloud': return '☁️';
      case 'continuous_scale': return '📡';
      default: return '❓';
    }
  };

  if (loading) return <div className="loading">Loading questions...</div>;
  if (error) return <div className="error">Error: {error}</div>;

  return (
    <div className="admin-crud-section">
      <div className="section-header">
        <h2>Questions</h2>
        <div>
          <label style={{ marginRight: '20px' }}>
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            {' '}Show Archived
          </label>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            + Add Question
          </button>
        </div>
      </div>

      {showForm && (
        <div className="form-modal">
          <div className="form-container">
            <h3>Add New Question</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Question Text *</label>
                <textarea
                  value={formData.text}
                  onChange={(e) => setFormData({ ...formData, text: e.target.value })}
                  placeholder="e.g., How satisfied are you with our service?"
                  required
                  rows={3}
                />
              </div>
              
              <div className="form-group">
                <label>Question Type *</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  required
                >
                  <option value="scale">Scale (buttons)</option>
                  <option value="text">Text input</option>
                  <option value="wordcloud">Word cloud</option>
                  <option value="continuous_scale">Continuous Scale (Radar)</option>
                </select>
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
        {questions.length === 0 ? (
          <div className="empty-state">
            <p>No questions yet. Add your first question to get started.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Question</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {questions.map((question) => (
                <tr key={question.id} className={question.archived ? 'archived-row' : ''}>
                  <td>
                    <span className="type-badge" title={question.type}>
                      {getTypeIcon(question.type)} {question.type}
                    </span>
                  </td>
                  <td>{question.text}</td>
                  <td>
                    {question.archived ? (
                      <span className="status inactive">📦 Archived</span>
                    ) : (
                      <span className="status active">✓ Active</span>
                    )}
                  </td>
                  <td>{new Date(question.created_at).toLocaleDateString()}</td>
                  <td>
                    <button
                      className="btn-icon"
                      onClick={() => handleArchiveToggle(question.id, question.archived)}
                      title={question.archived ? 'Unarchive' : 'Archive'}
                    >
                      {question.archived ? '📤' : '📦'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

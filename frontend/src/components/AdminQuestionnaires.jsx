import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import './AdminCrud.css';

export default function AdminQuestionnaires() {
  const { t } = useTranslation();
  const [questionnaires, setQuestionnaires] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    questions: [],
  });

  useEffect(() => {
    loadData();
  }, [showArchived]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [questionnairesData, questionsData] = await Promise.all([
        api.adminRequest(`/questionnaires?includeArchived=${showArchived}`),
        api.adminRequest('/questions'),
      ]);
      setQuestionnaires(questionnairesData);
      setQuestions(questionsData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleArchiveToggle = async (questionnaireId, currentArchived) => {
    try {
      await api.adminRequest(`/questionnaires/${questionnaireId}/archive`, {
        method: 'PATCH',
        body: JSON.stringify({ archived: !currentArchived }),
      });
      loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.adminRequest(`/questionnaires/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(formData),
        });
      } else {
        await api.adminRequest('/questionnaires', {
          method: 'POST',
          body: JSON.stringify(formData),
        });
      }
      setShowForm(false);
      setEditingId(null);
      setFormData({ name: '', description: '', questions: [] });
      loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEdit = async (questionnaire) => {
    try {
      const details = await api.adminRequest(`/questionnaires/${questionnaire.id}`);

      setEditingId(questionnaire.id);
      setFormData({
        name: details.name,
        description: details.description || '',
        questions: (details.questions || []).map((q, index) => ({
          questionId: q.question_id,
          pageNumber: q.page_number || 1,
          orderIndex: q.order_index ?? index,
        })),
      });
      setShowForm(true);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
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

  if (loading) return <div className="loading">{t('admin.loadingQuestionnaires')}</div>;
  if (error) return <div className="error">{t('common.error')}: {error}</div>;

  return (
    <div className="admin-crud-section">
      <div className="section-header">
        <h2>{t('admin.questionnaires')}</h2>
        <div className="section-controls">
          <label style={{ marginRight: '20px' }}>
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            {' '}{t('admin.showArchived')}
          </label>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            + {t('admin.addQuestionnaire')}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="form-modal">
          <div className="form-container large">
            <h3>{editingId ? t('admin.editQuestionnaire') : t('admin.addNewQuestionnaire')}</h3>
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
                {formData.questions.map((q, index) => {
                  return (
                    <div key={index} className="question-editor">
                      <select
                        value={q.questionId ?? ''}
                        onChange={(e) => updateQuestion(index, 'questionId', parseInt(e.target.value))}
                        required
                      >
                        <option value="">Select question...</option>
                        {questions.map((question) => (
                          <option key={question.id} value={question.id}>
                            {question.text.length > 50 ? question.text.substring(0, 50) + '...' : question.text}
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
                      
                      <button type="button" onClick={() => removeQuestion(index)} className="btn-icon">
                        ❌
                      </button>
                    </div>
                  );
                })}
                <button type="button" onClick={addQuestion} className="btn btn-secondary btn-sm">
                  + Add Question
                </button>
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={handleCancel}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingId ? 'Update' : 'Create'}
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
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Description</th>
                <th>Created</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {questionnaires.map((questionnaire) => (
                <tr key={questionnaire.id} className={questionnaire.archived ? 'archived-row' : ''}>
                  <td>{questionnaire.name}</td>
                  <td>{questionnaire.description || '-'}</td>
                  <td>{new Date(questionnaire.created_at).toLocaleDateString()}</td>
                  <td>
                    {questionnaire.archived ? (
                      <span className="status inactive">📦 Archived</span>
                    ) : (
                      <span className="status active">✓ Active</span>
                    )}
                  </td>
                  <td>
                    <button
                      className="btn-icon"
                      onClick={() => handleEdit(questionnaire)}
                      title="Edit"
                    >
                      ✏️
                    </button>
                    <button
                      className="btn-icon"
                      onClick={() => handleArchiveToggle(questionnaire.id, questionnaire.archived)}
                      title={questionnaire.archived ? 'Unarchive' : 'Archive'}
                    >
                      {questionnaire.archived ? '📤' : '📦'}
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

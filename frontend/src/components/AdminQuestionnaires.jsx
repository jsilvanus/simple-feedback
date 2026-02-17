import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import './AdminCrud.css';

export function QuestionnaireForm({ entity, questions, onSave, onCancel }) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({ name: '', description: '', questions: [] });
  const [loading, setLoading] = useState(!!entity);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (entity) {
      // Fetch full details (includes questions array)
      api.adminRequest(`/questionnaires/${entity.id}`)
        .then((details) => {
          setFormData({
            name: details.name,
            description: details.description || '',
            questions: (details.questions || []).map((q, index) => ({
              questionId: q.question_id,
              pageNumber: q.page_number || 1,
              orderIndex: q.order_index ?? index,
            })),
          });
          setLoading(false);
        })
        .catch((err) => {
          setError(err.message);
          setLoading(false);
        });
    }
  }, [entity?.id]);

  const addQuestion = () => {
    setFormData({
      ...formData,
      questions: [
        ...formData.questions,
        { questionId: '', pageNumber: 1, orderIndex: formData.questions.length },
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      if (entity) {
        await api.adminRequest(`/questionnaires/${entity.id}`, {
          method: 'PUT',
          body: JSON.stringify(formData),
        });
      } else {
        await api.adminRequest('/questionnaires', {
          method: 'POST',
          body: JSON.stringify(formData),
        });
      }
      onSave();
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <>
      <h3>{entity ? t('admin.editQuestionnaire') : t('admin.addNewQuestionnaire')}</h3>
      {error && <div className="error">{error}</div>}
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
                value={q.questionId ?? ''}
                onChange={(e) => updateQuestion(index, 'questionId', parseInt(e.target.value))}
                required
              >
                <option value="">Select question...</option>
                {(questions || []).map((question) => (
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
          ))}
          <button type="button" onClick={addQuestion} className="btn btn-secondary btn-sm">
            + Add Question
          </button>
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            {entity ? 'Update' : 'Create'}
          </button>
        </div>
      </form>
    </>
  );
}

export default function AdminQuestionnaires() {
  const { t } = useTranslation();
  const [questionnaires, setQuestionnaires] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [editingEntity, setEditingEntity] = useState(null);

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

  const handleEdit = (questionnaire) => {
    setEditingEntity(questionnaire);
    setShowForm(true);
  };

  const handleFormSave = () => {
    setShowForm(false);
    setEditingEntity(null);
    loadData();
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingEntity(null);
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
            <QuestionnaireForm
              entity={editingEntity}
              questions={questions}
              onSave={handleFormSave}
              onCancel={handleFormCancel}
            />
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

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import './AdminCrud.css';

function AnswerViewForm({ entity, onSave, onCancel }) {
  const { t } = useTranslation();
  const [questionnaires, setQuestionnaires] = useState([]);
  const [availableQuestions, setAvailableQuestions] = useState([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [formData, setFormData] = useState(
    entity
      ? {
          name: entity.name,
          viewType: entity.view_type,
          questionnaireId: entity.questionnaire_id,
          questions: Array.isArray(entity.questions)
            ? entity.questions.map(q => ({
                questionId: q.question_id,
                axisLabel: q.axis_label || '',
                displayOrder: q.display_order || 0,
              }))
            : [],
        }
      : {
          name: '',
          viewType: 'radar',
          questionnaireId: '',
          questions: [],
        }
  );
  const [error, setError] = useState(null);

  useEffect(() => {
    api.adminRequest('/questionnaires').then(setQuestionnaires).catch(() => {});
  }, []);

  useEffect(() => {
    if (!formData.questionnaireId) {
      setAvailableQuestions([]);
      return;
    }
    setLoadingQuestions(true);
    api.adminRequest(`/questionnaires/${formData.questionnaireId}`)
      .then(data => {
        const scaleQuestions = (data.questions || []).filter(q => q.type === 'scale');
        setAvailableQuestions(scaleQuestions);
      })
      .catch(() => setAvailableQuestions([]))
      .finally(() => setLoadingQuestions(false));
  }, [formData.questionnaireId]);

  const isQuestionSelected = (questionId) =>
    formData.questions.some(q => q.questionId === questionId);

  const toggleQuestion = (question) => {
    if (isQuestionSelected(question.id)) {
      setFormData({
        ...formData,
        questions: formData.questions.filter(q => q.questionId !== question.id),
      });
    } else {
      setFormData({
        ...formData,
        questions: [
          ...formData.questions,
          {
            questionId: question.id,
            axisLabel: question.text || '',
            displayOrder: formData.questions.length,
          },
        ],
      });
    }
  };

  const updateAxisLabel = (questionId, label) => {
    setFormData({
      ...formData,
      questions: formData.questions.map(q =>
        q.questionId === questionId ? { ...q, axisLabel: label } : q
      ),
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (formData.questions.length < 2) {
      setError('Select at least 2 questions for a radar view.');
      return;
    }
    try {
      const payload = {
        name: formData.name,
        viewType: formData.viewType,
        questionnaireId: parseInt(formData.questionnaireId, 10),
        questions: formData.questions.map((q, i) => ({
          questionId: q.questionId,
          axisLabel: q.axisLabel,
          displayOrder: i,
        })),
      };
      if (entity) {
        await api.adminRequest(`/answer-views/${entity.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await api.adminRequest('/answer-views', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      onSave();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <>
      <h3>{entity ? t('admin.editAnswerView') : t('admin.addNewAnswerView')}</h3>
      {error && <div className="error">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Name *</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., Service Quality Radar"
            required
          />
        </div>

        <div className="form-group">
          <label>View Type *</label>
          <select
            value={formData.viewType}
            onChange={(e) => setFormData({ ...formData, viewType: e.target.value })}
            required
          >
            <option value="radar">Radar Chart</option>
          </select>
        </div>

        <div className="form-group">
          <label>Questionnaire *</label>
          <select
            value={formData.questionnaireId}
            onChange={(e) => setFormData({ ...formData, questionnaireId: e.target.value, questions: [] })}
            required
          >
            <option value="">Select questionnaire...</option>
            {questionnaires.map(q => (
              <option key={q.id} value={q.id}>{q.name}</option>
            ))}
          </select>
        </div>

        {formData.questionnaireId && (
          <div className="form-group">
            <label>Scale Questions (select 2 or more as radar axes)</label>
            {loadingQuestions ? (
              <div>{t('common.loading')}</div>
            ) : availableQuestions.length === 0 ? (
              <div className="empty-state" style={{ padding: '8px' }}>
                <small>No scale questions in this questionnaire.</small>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {availableQuestions.map(question => {
                  const selected = isQuestionSelected(question.id);
                  const selectedQ = formData.questions.find(q => q.questionId === question.id);
                  return (
                    <div
                      key={question.id}
                      style={{
                        border: `1px solid ${selected ? '#3b82f6' : '#e0e0e0'}`,
                        borderRadius: '6px',
                        padding: '10px',
                        background: selected ? '#eff6ff' : 'white',
                      }}
                    >
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleQuestion(question)}
                        />
                        <span>{question.text}</span>
                      </label>
                      {selected && (
                        <div style={{ marginTop: '8px', paddingLeft: '24px' }}>
                          <label style={{ fontSize: '12px', color: '#666' }}>Axis label (overrides question text)</label>
                          <input
                            type="text"
                            value={selectedQ?.axisLabel || ''}
                            onChange={(e) => updateAxisLabel(question.id, e.target.value)}
                            placeholder={question.text}
                            style={{ display: 'block', width: '100%', marginTop: '4px' }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn btn-primary">
            {entity ? t('common.update') : t('common.create')}
          </button>
        </div>
      </form>
    </>
  );
}

export default function AdminAnswerViews() {
  const { t } = useTranslation();
  const [views, setViews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingEntity, setEditingEntity] = useState(null);

  useEffect(() => {
    loadViews();
  }, []);

  const loadViews = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.adminRequest('/answer-views');
      setViews(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async (view) => {
    try {
      const full = await api.adminRequest(`/answer-views/${view.id}`);
      setEditingEntity(full);
      setShowForm(true);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this answer view?')) return;
    try {
      await api.adminRequest(`/answer-views/${id}`, { method: 'DELETE' });
      loadViews();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleFormSave = () => {
    setShowForm(false);
    setEditingEntity(null);
    loadViews();
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingEntity(null);
  };

  if (loading) return <div className="loading">{t('admin.loadingAnswerViews')}</div>;
  if (error) return <div className="error">{t('common.error')}: {error}</div>;

  return (
    <div className="admin-crud-section">
      <div className="section-header">
        <h2>{t('admin.answerViews')}</h2>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          + {t('admin.addAnswerView')}
        </button>
      </div>

      {showForm && (
        <div className="form-modal">
          <div className="form-container">
            <AnswerViewForm
              entity={editingEntity}
              onSave={handleFormSave}
              onCancel={handleFormCancel}
            />
          </div>
        </div>
      )}

      <div className="data-list">
        {views.length === 0 ? (
          <div className="empty-state">
            <p>{t('admin.noAnswerViewsYet')}</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Questionnaire</th>
                <th>{t('admin.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {views.map(view => (
                <tr key={view.id}>
                  <td>{view.name}</td>
                  <td>
                    <span className="badge">
                      {view.view_type === 'radar' ? 'Radar' : view.view_type}
                    </span>
                  </td>
                  <td>{view.questionnaire_name}</td>
                  <td className="table-actions">
                    <button
                      className="btn-icon"
                      onClick={() => handleEdit(view)}
                      title={t('common.edit')}
                    >
                      ✏️
                    </button>
                    <button
                      className="btn-icon btn-icon-danger"
                      onClick={() => handleDelete(view.id)}
                      title={t('common.delete')}
                    >
                      🗑️
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

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import './AdminCrud.css';

export function QuestionForm({ entity, scales, wordClouds, onSave, onCancel }) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState(
    entity
      ? {
          text: entity.text,
          type: entity.type,
          answerScaleId: entity.answer_scale_id || '',
          wordCloudOptionsId: entity.word_cloud_options_id || '',
          maxSelections: entity.max_selections || 3,
          continuousAxes: Array.isArray(entity.continuous_axes) && entity.continuous_axes.length > 0
            ? entity.continuous_axes
            : [{ id: 'axis_1', label: '' }],
        }
      : {
          text: '',
          type: 'scale',
          answerScaleId: '',
          wordCloudOptionsId: '',
          maxSelections: 3,
          continuousAxes: [{ id: 'axis_1', label: '' }],
        }
  );
  const [error, setError] = useState(null);

  const addAxis = () => {
    const nextIndex = formData.continuousAxes.length + 1;
    setFormData({
      ...formData,
      continuousAxes: [...formData.continuousAxes, { id: `axis_${nextIndex}`, label: '' }],
    });
  };

  const updateAxis = (index, field, value) => {
    const updatedAxes = [...formData.continuousAxes];
    updatedAxes[index][field] = value;
    setFormData({ ...formData, continuousAxes: updatedAxes });
  };

  const removeAxis = (index) => {
    const updatedAxes = formData.continuousAxes.filter((_, axisIndex) => axisIndex !== index);
    setFormData({
      ...formData,
      continuousAxes: updatedAxes.length > 0 ? updatedAxes : [{ id: 'axis_1', label: '' }],
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const payload = {
        ...formData,
        answerScaleId: formData.answerScaleId || null,
        wordCloudOptionsId: formData.wordCloudOptionsId || null,
        continuousAxes: formData.type === 'continuous_scale'
          ? formData.continuousAxes
              .map((axis, index) => ({
                id: axis.id || `axis_${index + 1}`,
                label: (axis.label || '').trim(),
              }))
              .filter(axis => axis.label.length > 0)
          : [],
      };

      if (entity) {
        await api.adminRequest(`/questions/${entity.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await api.adminRequest('/questions', {
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
      <h3>{entity ? t('admin.editQuestion') : t('admin.addNewQuestion')}</h3>
      {error && <div className="error">{error}</div>}
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
            onChange={(e) => {
              const nextType = e.target.value;
              setFormData({
                ...formData,
                type: nextType,
                answerScaleId: ['scale', 'continuous_scale'].includes(nextType) ? formData.answerScaleId : '',
                wordCloudOptionsId: nextType === 'wordcloud' ? formData.wordCloudOptionsId : '',
                maxSelections: nextType === 'wordcloud' ? formData.maxSelections : 3,
                continuousAxes: nextType === 'continuous_scale'
                  ? (formData.continuousAxes.length > 0 ? formData.continuousAxes : [{ id: 'axis_1', label: '' }])
                  : [],
              });
            }}
            required
          >
            <option value="scale">Scale (buttons)</option>
            <option value="text">Text input</option>
            <option value="wordcloud">Word set</option>
            <option value="continuous_scale">Continuous Scale (Radar)</option>
          </select>
        </div>

        {['scale', 'continuous_scale'].includes(formData.type) && (
          <div className="form-group">
            <label>Answer Scale</label>
            <select
              value={formData.answerScaleId}
              onChange={(e) => setFormData({ ...formData, answerScaleId: e.target.value ? parseInt(e.target.value, 10) : '' })}
            >
              <option value="">No scale</option>
              {(scales || []).map((scale) => (
                <option key={scale.id} value={scale.id}>
                  {scale.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {formData.type === 'continuous_scale' && (
          <div className="form-group">
            <label>Axes</label>
            {(formData.continuousAxes || []).map((axis, index) => (
              <div key={axis.id || index} className="button-editor">
                <input
                  type="text"
                  value={axis.label || ''}
                  onChange={(e) => updateAxis(index, 'label', e.target.value)}
                  placeholder={`Axis ${index + 1} label`}
                  required
                />
                {(formData.continuousAxes || []).length > 1 && (
                  <button type="button" onClick={() => removeAxis(index)} className="btn-icon">
                    ❌
                  </button>
                )}
              </div>
            ))}
            <button type="button" onClick={addAxis} className="btn btn-secondary btn-sm">
              + Add Axis
            </button>
          </div>
        )}

        {formData.type === 'wordcloud' && (
          <>
            <div className="form-group">
              <label>Word Set Options</label>
              <select
                value={formData.wordCloudOptionsId}
                onChange={(e) => setFormData({ ...formData, wordCloudOptionsId: e.target.value ? parseInt(e.target.value, 10) : '' })}
              >
                <option value="">No word set options</option>
                {(wordClouds || []).map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Max Selections</label>
              <input
                type="number"
                min="1"
                max="20"
                value={formData.maxSelections}
                onChange={(e) => setFormData({ ...formData, maxSelections: parseInt(e.target.value, 10) || 1 })}
              />
            </div>
          </>
        )}

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

export default function AdminQuestions() {
  const { t } = useTranslation();
  const [questions, setQuestions] = useState([]);
  const [answerScales, setAnswerScales] = useState([]);
  const [wordCloudOptions, setWordCloudOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [editingEntity, setEditingEntity] = useState(null);

  useEffect(() => {
    loadQuestions();
  }, [showArchived]);

  const loadQuestions = async () => {
    try {
      setLoading(true);
      setError(null);
      const [questionsData, scalesData, wordCloudData] = await Promise.all([
        api.adminRequest(`/questions?includeArchived=${showArchived}`),
        api.adminRequest('/answer-scales'),
        api.adminRequest('/word-cloud-options'),
      ]);
      setQuestions(questionsData);
      setAnswerScales(scalesData);
      setWordCloudOptions(wordCloudData);
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

  const handleEdit = (question) => {
    setEditingEntity(question);
    setShowForm(true);
  };

  const handleFormSave = () => {
    setShowForm(false);
    setEditingEntity(null);
    loadQuestions();
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingEntity(null);
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

  const getTypeLabel = (type) => {
    switch (type) {
      case 'scale': return 'scale';
      case 'text': return 'text';
      case 'wordcloud': return 'word set';
      case 'continuous_scale': return 'continuous_scale';
      default: return type;
    }
  };

  if (loading) return <div className="loading">{t('admin.loadingQuestions')}</div>;
  if (error) return <div className="error">{t('common.error')}: {error}</div>;

  return (
    <div className="admin-crud-section">
      <div className="section-header">
        <h2>{t('admin.questions')}</h2>
        <div>
          <label style={{ marginRight: '20px' }}>
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            {' '}{t('admin.showArchived')}
          </label>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            + {t('admin.addQuestion')}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="form-modal">
          <div className="form-container">
            <QuestionForm
              entity={editingEntity}
              scales={answerScales}
              wordClouds={wordCloudOptions}
              onSave={handleFormSave}
              onCancel={handleFormCancel}
            />
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
                      {getTypeIcon(question.type)} {getTypeLabel(question.type)}
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
                      onClick={() => handleEdit(question)}
                      title="Edit"
                    >
                      ✏️
                    </button>
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

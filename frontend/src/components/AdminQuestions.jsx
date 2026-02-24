import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import './AdminCrud.css';

const DISPLAY_MODES = [
  { value: '', label: 'Auto (from scale)' },
  { value: 'buttons', label: 'Buttons' },
  { value: 'slider', label: 'Slider' },
  { value: 'labeled-line', label: 'Labeled line' },
  { value: 'stars', label: 'Stars' },
  { value: 'thumbs', label: 'Thumbs' },
];

const EMPTY_LANG = { fi: '', en: '', sv: '' };

function LangInput({ label, value, onChange }) {
  const val = value && typeof value === 'object' ? value : EMPTY_LANG;
  return (
    <div className="lang-input-group">
      {label && <span className="lang-input-label">{label}</span>}
      {['fi', 'en', 'sv'].map(lang => (
        <label key={lang} className="lang-input-item">
          <span className="lang-badge">{lang}</span>
          <input
            type="text"
            value={val[lang] || ''}
            onChange={e => onChange({ ...val, [lang]: e.target.value })}
          />
        </label>
      ))}
    </div>
  );
}

function ScaleItemEditor({ item, index, scales, onUpdate, onRemove, canRemove }) {
  return (
    <div className="scale-item-editor">
      <div className="scale-item-header">
        <span className="scale-item-index">#{index + 1}</span>
        {canRemove && (
          <button type="button" className="btn-icon" onClick={onRemove} title="Remove item">
            ✕
          </button>
        )}
      </div>

      <div className="form-group">
        <label>Item Label (i18n)</label>
        <LangInput
          value={item.label}
          onChange={val => onUpdate({ ...item, label: val })}
        />
      </div>

      <div className="form-row">
        <div className="form-group flex-1">
          <label>Answer Scale *</label>
          <select
            value={item.answerScaleId || ''}
            onChange={e => onUpdate({ ...item, answerScaleId: e.target.value ? parseInt(e.target.value, 10) : '' })}
            required
          >
            <option value="">— select scale —</option>
            {(scales || []).map(scale => (
              <option key={scale.id} value={scale.id}>{scale.name}</option>
            ))}
          </select>
        </div>

        <div className="form-group flex-1">
          <label>Display Mode</label>
          <select
            value={item.displayMode || ''}
            onChange={e => onUpdate({ ...item, displayMode: e.target.value || null })}
          >
            {DISPLAY_MODES.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-row toggles-row">
        <label className="toggle-label">
          <input
            type="checkbox"
            checked={item.showEndLabels !== false}
            onChange={e => onUpdate({ ...item, showEndLabels: e.target.checked })}
          />
          Show end labels
        </label>
        <label className="toggle-label">
          <input
            type="checkbox"
            checked={item.showValueLabels !== false}
            onChange={e => onUpdate({ ...item, showValueLabels: e.target.checked })}
          />
          Show value labels
        </label>
        <label className="toggle-label">
          <input
            type="checkbox"
            checked={item.showItemLabel !== false}
            onChange={e => onUpdate({ ...item, showItemLabel: e.target.checked })}
          />
          Show item label
        </label>
        <label className="toggle-label">
          <input
            type="checkbox"
            checked={item.required !== false}
            onChange={e => onUpdate({ ...item, required: e.target.checked })}
          />
          Required
        </label>
      </div>
    </div>
  );
}

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
          scaleItems: Array.isArray(entity.scaleItems) ? entity.scaleItems : [],
          multiScaleLayout: entity.multi_scale_layout || 'stacked',
          multiScaleDefaults: entity.multi_scale_defaults || {},
        }
      : {
          text: '',
          type: 'scale',
          answerScaleId: '',
          wordCloudOptionsId: '',
          maxSelections: 3,
          continuousAxes: [{ id: 'axis_1', label: '' }],
          scaleItems: [],
          multiScaleLayout: 'stacked',
          multiScaleDefaults: {},
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

  const addScaleItem = () => {
    const newItem = {
      answerScaleId: '',
      label: { fi: '', en: '', sv: '' },
      orderIndex: formData.scaleItems.length,
      displayMode: null,
      showEndLabels: true,
      showValueLabels: true,
      showItemLabel: true,
      required: true,
    };
    setFormData({ ...formData, scaleItems: [...formData.scaleItems, newItem] });
  };

  const updateScaleItem = (index, updatedItem) => {
    const items = [...formData.scaleItems];
    items[index] = { ...updatedItem, orderIndex: index };
    setFormData({ ...formData, scaleItems: items });
  };

  const removeScaleItem = (index) => {
    const items = formData.scaleItems
      .filter((_, i) => i !== index)
      .map((item, i) => ({ ...item, orderIndex: i }));
    setFormData({ ...formData, scaleItems: items });
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
        scaleItems: formData.type === 'scale'
          ? formData.scaleItems.map((item, index) => ({
              ...item,
              orderIndex: index,
              answerScaleId: item.answerScaleId || null,
            })).filter(item => item.answerScaleId)
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
            {/* continuous_scale is legacy — hidden from new question creation; existing questions still display */}
            {entity && entity.type === 'continuous_scale' && (
              <option value="continuous_scale">Continuous Scale (Radar) — legacy</option>
            )}
          </select>
        </div>

        {formData.type === 'scale' && (
          <>
            {/* Multi-scale layout & defaults */}
            <div className="form-row">
              <div className="form-group flex-1">
                <label>Layout</label>
                <select
                  value={formData.multiScaleLayout}
                  onChange={e => setFormData({ ...formData, multiScaleLayout: e.target.value })}
                >
                  <option value="stacked">Stacked (each item full width)</option>
                  <option value="matrix">Matrix (compact grid, same scale only)</option>
                  <option value="compact">Compact (tighter spacing)</option>
                </select>
              </div>
              <div className="form-group flex-1">
                <label>Default Display Mode</label>
                <select
                  value={formData.multiScaleDefaults?.displayMode || ''}
                  onChange={e => setFormData({
                    ...formData,
                    multiScaleDefaults: { ...formData.multiScaleDefaults, displayMode: e.target.value || undefined },
                  })}
                >
                  {DISPLAY_MODES.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Legacy single scale (for backward compat when no scaleItems) */}
            {formData.scaleItems.length === 0 && (
              <div className="form-group">
                <label>Answer Scale (single scale — legacy)</label>
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

            {/* Scale items editor */}
            <div className="form-group">
              <label>
                Scale Items
                <span className="hint"> — add items to create a multi-scale question</span>
              </label>

              {formData.scaleItems.length === 0 ? (
                <p className="empty-hint">No scale items yet. Click "Add Scale Item" to create a multi-scale question.</p>
              ) : (
                <div className="scale-items-list">
                  {formData.scaleItems.map((item, index) => (
                    <ScaleItemEditor
                      key={index}
                      item={item}
                      index={index}
                      scales={scales}
                      onUpdate={(updated) => updateScaleItem(index, updated)}
                      onRemove={() => removeScaleItem(index)}
                      canRemove={formData.scaleItems.length > 1}
                    />
                  ))}
                </div>
              )}

              <button type="button" className="btn btn-secondary btn-sm" onClick={addScaleItem}>
                + Add Scale Item
              </button>
            </div>
          </>
        )}

        {['continuous_scale'].includes(formData.type) && (
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
                <th>Scale Items</th>
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
                    {question.type === 'scale' && Array.isArray(question.scaleItems) && question.scaleItems.length > 0
                      ? `${question.scaleItems.length} item${question.scaleItems.length !== 1 ? 's' : ''}`
                      : '—'}
                  </td>
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

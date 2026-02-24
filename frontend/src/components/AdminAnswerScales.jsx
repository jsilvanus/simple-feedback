import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import './AdminCrud.css';

const DEFAULT_BUTTONS = [
  { label: '😞', value: 1, color: '#e74c3c' },
  { label: '😐', value: 2, color: '#f39c12' },
  { label: '🙂', value: 3, color: '#3498db' },
  { label: '😀', value: 4, color: '#2ecc71' },
];

const DEFAULT_LABEL = { fi: '', en: '', sv: '' };

export function AnswerScaleForm({ entity, onSave, onCancel }) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState(
    entity
      ? {
          name: entity.name,
          buttons: entity.buttons,
          scaleMode: entity.scale_mode || 'normal',
          step: entity.step !== null && entity.step !== undefined ? Number(entity.step) : 1,
          minLabel: entity.min_label || { ...DEFAULT_LABEL },
          maxLabel: entity.max_label || { ...DEFAULT_LABEL },
          minValue: entity.min_value !== null && entity.min_value !== undefined ? String(entity.min_value) : '',
          maxValue: entity.max_value !== null && entity.max_value !== undefined ? String(entity.max_value) : '',
        }
      : {
          name: '',
          buttons: DEFAULT_BUTTONS,
          scaleMode: 'normal',
          step: 1,
          minLabel: { ...DEFAULT_LABEL },
          maxLabel: { ...DEFAULT_LABEL },
          minValue: '',
          maxValue: '',
        }
  );
  const [error, setError] = useState(null);

  const updateButton = (index, field, value) => {
    const newButtons = [...formData.buttons];
    newButtons[index][field] = value;
    setFormData({ ...formData, buttons: newButtons });
  };

  const addButton = () => {
    const maxValue = Math.max(0, ...formData.buttons.map(b => b.value));
    setFormData({
      ...formData,
      buttons: [...formData.buttons, { label: '', value: maxValue + 1, color: '#333333' }],
    });
  };

  const removeButton = (index) => {
    const newButtons = formData.buttons.filter((_, i) => i !== index);
    setFormData({ ...formData, buttons: newButtons });
  };

  const updateLabel = (field, lang, value) => {
    setFormData({ ...formData, [field]: { ...formData[field], [lang]: value } });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const stepFloat = parseFloat(formData.step);
    if (isNaN(stepFloat) || stepFloat < 0.01 || stepFloat > 1) {
      setError('Step must be between 0.01 and 1');
      return;
    }

    const hasMinLabel = formData.minLabel.fi || formData.minLabel.en || formData.minLabel.sv;
    const hasMaxLabel = formData.maxLabel.fi || formData.maxLabel.en || formData.maxLabel.sv;

    const submitData = {
      name: formData.name,
      buttons: formData.buttons,
      scaleMode: formData.scaleMode,
      step: stepFloat,
      minLabel: hasMinLabel ? formData.minLabel : null,
      maxLabel: hasMaxLabel ? formData.maxLabel : null,
      minValue: formData.minValue !== '' ? parseFloat(formData.minValue) : null,
      maxValue: formData.maxValue !== '' ? parseFloat(formData.maxValue) : null,
    };

    try {
      if (entity) {
        await api.adminRequest(`/answer-scales/${entity.id}`, {
          method: 'PUT',
          body: JSON.stringify(submitData),
        });
      } else {
        await api.adminRequest('/answer-scales', {
          method: 'POST',
          body: JSON.stringify(submitData),
        });
      }
      onSave();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <>
      <h3>{entity ? t('admin.editAnswerScale') : t('admin.addNewAnswerScale')}</h3>
      {error && <div className="error">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Scale Name *</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., Satisfaction Scale"
            required
          />
        </div>

        <div className="form-group">
          <label>Buttons</label>
          {formData.buttons.map((button, index) => (
            <div key={index} className="button-editor">
              <input
                type="text"
                value={button.label}
                onChange={(e) => updateButton(index, 'label', e.target.value)}
                placeholder="Label (e.g., 😀)"
                required
              />
              <input
                type="number"
                value={button.value}
                onChange={(e) => updateButton(index, 'value', parseInt(e.target.value))}
                placeholder="Value"
                required
              />
              <input
                type="color"
                value={button.color}
                onChange={(e) => updateButton(index, 'color', e.target.value)}
              />
              {formData.buttons.length > 2 && (
                <button type="button" onClick={() => removeButton(index)} className="btn-icon">
                  ❌
                </button>
              )}
            </div>
          ))}
          <button type="button" onClick={addButton} className="btn btn-secondary btn-sm">
            + Add Button
          </button>
        </div>

        <div className="form-group">
          <label>Scale Mode</label>
          <select
            value={formData.scaleMode}
            onChange={(e) => setFormData({ ...formData, scaleMode: e.target.value })}
          >
            <option value="normal">Normal (1 to N)</option>
            <option value="bipolar">Bipolar (-N to N)</option>
          </select>
          {formData.scaleMode === 'bipolar' && (
            <small className="form-hint">Bipolar scale: values range symmetrically around 0 (e.g. -5 to 5)</small>
          )}
        </div>

        <div className="form-group">
          <label>Step</label>
          <input
            type="number"
            value={formData.step}
            onChange={(e) => setFormData({ ...formData, step: e.target.value })}
            min="0.01"
            max="1"
            step="0.01"
          />
          <small className="form-hint">Step size (0.01–1). Values less than 1 render a slider instead of buttons.</small>
        </div>

        <div className="form-group">
          <label>Min Label (low-end endpoint label)</label>
          <div className="label-inputs">
            <input
              type="text"
              value={formData.minLabel.fi}
              onChange={(e) => updateLabel('minLabel', 'fi', e.target.value)}
              placeholder="Finnish (fi)"
            />
            <input
              type="text"
              value={formData.minLabel.en}
              onChange={(e) => updateLabel('minLabel', 'en', e.target.value)}
              placeholder="English (en)"
            />
            <input
              type="text"
              value={formData.minLabel.sv}
              onChange={(e) => updateLabel('minLabel', 'sv', e.target.value)}
              placeholder="Swedish (sv)"
            />
          </div>
        </div>

        <div className="form-group">
          <label>Max Label (high-end endpoint label)</label>
          <div className="label-inputs">
            <input
              type="text"
              value={formData.maxLabel.fi}
              onChange={(e) => updateLabel('maxLabel', 'fi', e.target.value)}
              placeholder="Finnish (fi)"
            />
            <input
              type="text"
              value={formData.maxLabel.en}
              onChange={(e) => updateLabel('maxLabel', 'en', e.target.value)}
              placeholder="English (en)"
            />
            <input
              type="text"
              value={formData.maxLabel.sv}
              onChange={(e) => updateLabel('maxLabel', 'sv', e.target.value)}
              placeholder="Swedish (sv)"
            />
          </div>
        </div>

        <div className="form-group">
          <label>Min Value</label>
          <input
            type="number"
            value={formData.minValue}
            onChange={(e) => setFormData({ ...formData, minValue: e.target.value })}
            placeholder="Leave blank to infer from buttons"
            step="any"
          />
        </div>

        <div className="form-group">
          <label>Max Value</label>
          <input
            type="number"
            value={formData.maxValue}
            onChange={(e) => setFormData({ ...formData, maxValue: e.target.value })}
            placeholder="Leave blank to infer from buttons"
            step="any"
          />
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

export default function AdminAnswerScales() {
  const { t } = useTranslation();
  const [scales, setScales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingEntity, setEditingEntity] = useState(null);

  useEffect(() => {
    loadScales();
  }, []);

  const loadScales = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.adminRequest('/answer-scales');
      setScales(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (scale) => {
    setEditingEntity(scale);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this answer scale?')) {
      return;
    }
    try {
      await api.adminRequest(`/answer-scales/${id}`, {
        method: 'DELETE',
      });
      loadScales();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleFormSave = () => {
    setShowForm(false);
    setEditingEntity(null);
    loadScales();
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingEntity(null);
  };

  if (loading) return <div className="loading">{t('admin.loadingAnswerScales')}</div>;
  if (error) return <div className="error">{t('common.error')}: {error}</div>;

  return (
    <div className="admin-crud-section">
      <div className="section-header">
        <h2>{t('admin.answerScales')}</h2>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          + {t('admin.addAnswerScale')}
        </button>
      </div>

      {showForm && (
        <div className="form-modal">
          <div className="form-container">
            <AnswerScaleForm
              entity={editingEntity}
              onSave={handleFormSave}
              onCancel={handleFormCancel}
            />
          </div>
        </div>
      )}

      <div className="data-list">
        {scales.length === 0 ? (
          <div className="empty-state">
            <p>No answer scales yet. Add your first scale to get started.</p>
          </div>
        ) : (
          <div className="scales-grid">
            {scales.map((scale) => (
              <div key={scale.id} className="scale-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '10px' }}>
                  <h4>{scale.name}</h4>
                  <div>
                    <button className="btn-icon" onClick={() => handleEdit(scale)} title="Edit">
                      ✏️
                    </button>
                    <button className="btn-icon" onClick={() => handleDelete(scale.id)} title="Delete">
                      🗑️
                    </button>
                  </div>
                </div>
                <div className="scale-buttons-preview">
                  {scale.buttons.map((button, index) => (
                    <div
                      key={index}
                      className="scale-button-preview"
                      style={{ backgroundColor: button.color }}
                    >
                      {button.label}
                    </div>
                  ))}
                </div>
                <small>
                  {scale.buttons.length} buttons
                  {scale.scale_mode === 'bipolar' && ' · bipolar'}
                  {Number(scale.step) < 1 && ` · step ${scale.step}`}
                </small>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

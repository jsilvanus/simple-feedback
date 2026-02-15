import React, { useState, useEffect } from 'react';
import { api } from '../api';
import './AdminCrud.css';

export default function AdminAnswerScales() {
  const [scales, setScales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    buttons: [
      { label: '😞', value: 1, color: '#e74c3c' },
      { label: '😐', value: 2, color: '#f39c12' },
      { label: '🙂', value: 3, color: '#3498db' },
      { label: '😀', value: 4, color: '#2ecc71' },
    ],
  });

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.adminRequest('/answer-scales', {
        method: 'POST',
        body: JSON.stringify(formData),
      });
      setShowForm(false);
      setFormData({
        name: '',
        buttons: [
          { label: '😞', value: 1, color: '#e74c3c' },
          { label: '😐', value: 2, color: '#f39c12' },
          { label: '🙂', value: 3, color: '#3498db' },
          { label: '😀', value: 4, color: '#2ecc71' },
        ],
      });
      loadScales();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
  };

  const updateButton = (index, field, value) => {
    const newButtons = [...formData.buttons];
    newButtons[index][field] = value;
    setFormData({ ...formData, buttons: newButtons });
  };

  const addButton = () => {
    setFormData({
      ...formData,
      buttons: [...formData.buttons, { label: '', value: formData.buttons.length + 1, color: '#333333' }],
    });
  };

  const removeButton = (index) => {
    const newButtons = formData.buttons.filter((_, i) => i !== index);
    setFormData({ ...formData, buttons: newButtons });
  };

  if (loading) return <div className="loading">Loading answer scales...</div>;
  if (error) return <div className="error">Error: {error}</div>;

  return (
    <div className="admin-crud-section">
      <div className="section-header">
        <h2>Answer Scales</h2>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          + Add Answer Scale
        </button>
      </div>

      {showForm && (
        <div className="form-modal">
          <div className="form-container">
            <h3>Add New Answer Scale</h3>
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
        {scales.length === 0 ? (
          <div className="empty-state">
            <p>No answer scales yet. Add your first scale to get started.</p>
          </div>
        ) : (
          <div className="scales-grid">
            {scales.map((scale) => (
              <div key={scale.id} className="scale-card">
                <h4>{scale.name}</h4>
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
                <small>{scale.buttons.length} buttons</small>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

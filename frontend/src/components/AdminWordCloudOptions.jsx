import React, { useState, useEffect } from 'react';
import { api } from '../api';
import './AdminCrud.css';

export default function AdminWordCloudOptions() {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    words: [
      { text: 'Excellent', color: '#2ecc71' },
      { text: 'Good', color: '#3498db' },
      { text: 'Average', color: '#f39c12' },
      { text: 'Poor', color: '#e74c3c' },
    ],
  });

  useEffect(() => {
    loadOptions();
  }, []);

  const loadOptions = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.adminRequest('/word-cloud-options');
      setOptions(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.adminRequest('/word-cloud-options', {
        method: 'POST',
        body: JSON.stringify(formData),
      });
      setShowForm(false);
      setFormData({
        name: '',
        words: [
          { text: 'Excellent', color: '#2ecc71' },
          { text: 'Good', color: '#3498db' },
          { text: 'Average', color: '#f39c12' },
          { text: 'Poor', color: '#e74c3c' },
        ],
      });
      loadOptions();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
  };

  const updateWord = (index, field, value) => {
    const newWords = [...formData.words];
    newWords[index][field] = value;
    setFormData({ ...formData, words: newWords });
  };

  const addWord = () => {
    setFormData({
      ...formData,
      words: [...formData.words, { text: '', color: '#333333' }],
    });
  };

  const removeWord = (index) => {
    const newWords = formData.words.filter((_, i) => i !== index);
    setFormData({ ...formData, words: newWords });
  };

  if (loading) return <div className="loading">Loading word cloud options...</div>;
  if (error) return <div className="error">Error: {error}</div>;

  return (
    <div className="admin-crud-section">
      <div className="section-header">
        <h2>Word Cloud Options</h2>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          + Add Word Cloud Option Set
        </button>
      </div>

      {showForm && (
        <div className="form-modal">
          <div className="form-container">
            <h3>Add New Word Cloud Option Set</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Option Set Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Service Quality Words"
                  required
                />
              </div>
              
              <div className="form-group">
                <label>Words</label>
                {formData.words.map((word, index) => (
                  <div key={index} className="button-editor">
                    <input
                      type="text"
                      value={word.text}
                      onChange={(e) => updateWord(index, 'text', e.target.value)}
                      placeholder="Word text (e.g., Excellent)"
                      required
                      style={{ flex: 2 }}
                    />
                    <input
                      type="color"
                      value={word.color}
                      onChange={(e) => updateWord(index, 'color', e.target.value)}
                    />
                    {formData.words.length > 2 && (
                      <button type="button" onClick={() => removeWord(index)} className="btn-icon">
                        ❌
                      </button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={addWord} className="btn btn-secondary btn-sm">
                  + Add Word
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
        {options.length === 0 ? (
          <div className="empty-state">
            <p>No word cloud options yet. Add your first option set to get started.</p>
          </div>
        ) : (
          <div className="scales-grid">
            {options.map((option) => (
              <div key={option.id} className="scale-card">
                <h4>{option.name}</h4>
                <div className="wordcloud-preview">
                  {option.words.map((word, index) => (
                    <span
                      key={index}
                      className="word-chip-preview"
                      style={{ 
                        backgroundColor: word.color,
                        color: 'white',
                        padding: '8px 16px',
                        margin: '4px',
                        borderRadius: '20px',
                        display: 'inline-block',
                        fontSize: '14px',
                      }}
                    >
                      {word.text}
                    </span>
                  ))}
                </div>
                <small>{option.words.length} words</small>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

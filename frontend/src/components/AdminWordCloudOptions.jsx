import React, { useState, useEffect } from 'react';
import { api } from '../api';
import './AdminCrud.css';

const DEFAULT_WORDS = [
  { text: { fi: 'Erinomainen', en: 'Excellent', sv: 'Utmärkt' }, color: '#2ecc71' },
  { text: { fi: 'Hyvä', en: 'Good', sv: 'Bra' }, color: '#3498db' },
  { text: { fi: 'Keskinkertainen', en: 'Average', sv: 'Genomsnittlig' }, color: '#f39c12' },
  { text: { fi: 'Huono', en: 'Poor', sv: 'Dålig' }, color: '#e74c3c' },
];

export default function AdminWordCloudOptions() {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    words: DEFAULT_WORDS,
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
        words: DEFAULT_WORDS,
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
    if (field === 'text') {
      // Handle text translations
      if (typeof newWords[index].text === 'string') {
        // Convert old format to new format
        newWords[index].text = { fi: value, en: '', sv: '' };
      } else {
        newWords[index].text = value;
      }
    } else {
      newWords[index][field] = value;
    }
    setFormData({ ...formData, words: newWords });
  };

  const updateWordTranslation = (index, lang, value) => {
    const newWords = [...formData.words];
    if (typeof newWords[index].text === 'string') {
      // Convert to object format
      newWords[index].text = { fi: '', en: '', sv: '' };
    }
    newWords[index].text[lang] = value;
    setFormData({ ...formData, words: newWords });
  };

  const addWord = () => {
    setFormData({
      ...formData,
      words: [...formData.words, { text: { fi: '', en: '', sv: '' }, color: '#333333' }],
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
                <label>Words (Finnish is required, other languages optional)</label>
                {formData.words.map((word, index) => (
                  <div key={index} style={{ marginBottom: '20px', padding: '15px', border: '1px solid #e0e0e0', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '10px', alignItems: 'center' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '12px', color: '#666' }}>Finnish (fi) *</label>
                        <input
                          type="text"
                          value={typeof word.text === 'string' ? word.text : word.text.fi || ''}
                          onChange={(e) => updateWordTranslation(index, 'fi', e.target.value)}
                          placeholder="e.g., Erinomainen"
                          required
                          style={{ width: '100%' }}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '12px', color: '#666' }}>English (en)</label>
                        <input
                          type="text"
                          value={typeof word.text === 'string' ? '' : word.text.en || ''}
                          onChange={(e) => updateWordTranslation(index, 'en', e.target.value)}
                          placeholder="e.g., Excellent"
                          style={{ width: '100%' }}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '12px', color: '#666' }}>Swedish (sv)</label>
                        <input
                          type="text"
                          value={typeof word.text === 'string' ? '' : word.text.sv || ''}
                          onChange={(e) => updateWordTranslation(index, 'sv', e.target.value)}
                          placeholder="e.g., Utmärkt"
                          style={{ width: '100%' }}
                        />
                      </div>
                      <div style={{ width: '60px' }}>
                        <label style={{ fontSize: '12px', color: '#666' }}>Color</label>
                        <input
                          type="color"
                          value={word.color}
                          onChange={(e) => updateWord(index, 'color', e.target.value)}
                          style={{ width: '100%', height: '36px' }}
                        />
                      </div>
                      {formData.words.length > 2 && (
                        <button 
                          type="button" 
                          onClick={() => removeWord(index)} 
                          className="btn-icon"
                          style={{ marginTop: '20px' }}
                        >
                          ❌
                        </button>
                      )}
                    </div>
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
                  {option.words.map((word, index) => {
                    // Display Finnish by default, or the first available translation
                    const displayText = typeof word.text === 'string' 
                      ? word.text 
                      : word.text.fi || word.text.en || word.text.sv || '';
                    
                    return (
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
                        title={typeof word.text === 'object' ? `FI: ${word.text.fi || '-'} | EN: ${word.text.en || '-'} | SV: ${word.text.sv || '-'}` : word.text}
                      >
                        {displayText}
                      </span>
                    );
                  })}
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

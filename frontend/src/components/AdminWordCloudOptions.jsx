import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import './AdminCrud.css';

const DEFAULT_WORDS = [
  { text: { fi: 'Erinomainen', en: 'Excellent', sv: 'Utmärkt' }, color: '#2ecc71' },
  { text: { fi: 'Hyvä', en: 'Good', sv: 'Bra' }, color: '#3498db' },
  { text: { fi: 'Keskinkertainen', en: 'Average', sv: 'Genomsnittlig' }, color: '#f39c12' },
  { text: { fi: 'Huono', en: 'Poor', sv: 'Dålig' }, color: '#e74c3c' },
];

export default function AdminWordCloudOptions() {
  const { t } = useTranslation();
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
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
      if (editingId) {
        await api.adminRequest(`/word-cloud-options/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(formData),
        });
      } else {
        await api.adminRequest('/word-cloud-options', {
          method: 'POST',
          body: JSON.stringify(formData),
        });
      }
      setShowForm(false);
      setEditingId(null);
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
    setEditingId(null);
    setFormData({
      name: '',
      words: DEFAULT_WORDS,
    });
  };

  const handleEdit = (option) => {
    setEditingId(option.id);
    setFormData({
      name: option.name,
      words: option.words,
    });
    setShowForm(true);
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

  if (loading) return <div className="loading">{t('admin.loadingWordCloudOptions')}</div>;
  if (error) return <div className="error">{t('common.error')}: {error}</div>;

  return (
    <div className="admin-crud-section">
      <div className="section-header">
        <h2>{t('admin.wordCloudOptions')}</h2>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          + {t('admin.addWordCloudOptionSet')}
        </button>
      </div>

      {showForm && (
        <div className="form-modal">
          <div className="form-container">
            <h3>{editingId ? t('admin.editWordCloudOptionSet') : t('admin.addNewWordCloudOptionSet')}</h3>
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
                  + {t('admin.addWord')}
                </button>
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={handleCancel}>
                  {t('common.cancel')}
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingId ? t('common.update') : t('common.create')}
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
                <div className="table-actions" style={{ justifyContent: 'space-between', marginBottom: '10px' }}>
                  <h4 style={{ margin: 0 }}>{option.name}</h4>
                  <button className="btn-icon" onClick={() => handleEdit(option)} title={t('common.edit')}>
                    ✏️
                  </button>
                </div>
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

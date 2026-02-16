import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import './AdminCrud.css';

const DEFAULT_MAX_SELECTIONS = 3;

export default function AdminQuestionnaires() {
  const { t } = useTranslation();
  const [questionnaires, setQuestionnaires] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [answerScales, setAnswerScales] = useState([]);
  const [wordCloudOptions, setWordCloudOptions] = useState([]);
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
      const [questionnairesData, questionsData, scalesData, wordCloudData] = await Promise.all([
        api.adminRequest(`/questionnaires?includeArchived=${showArchived}`),
        api.adminRequest('/questions'),
        api.adminRequest('/answer-scales'),
        api.adminRequest('/word-cloud-options'),
      ]);
      setQuestionnaires(questionnairesData);
      setQuestions(questionsData);
      setAnswerScales(scalesData);
      setWordCloudOptions(wordCloudData);
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
          answerScaleId: q.answer_scale_id || null,
          wordCloudOptionsId: q.word_cloud_options_id || null,
          maxSelections: q.max_selections || DEFAULT_MAX_SELECTIONS,
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
          answerScaleId: '',
          wordCloudOptionsId: '',
          maxSelections: DEFAULT_MAX_SELECTIONS,
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
                  const selectedQuestion = questions.find(question => question.id === q.questionId);
                  const questionType = selectedQuestion?.type;
                  
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
                      
                      {questionType === 'scale' && (
                        <select
                          value={q.answerScaleId ?? ''}
                          onChange={(e) => updateQuestion(index, 'answerScaleId', e.target.value ? parseInt(e.target.value) : null)}
                        >
                          <option value="">No scale</option>
                          {answerScales.map((scale) => (
                            <option key={scale.id} value={scale.id}>
                              {scale.name}
                            </option>
                          ))}
                        </select>
                      )}
                      
                      {questionType === 'wordcloud' && (
                        <>
                          <select
                            value={q.wordCloudOptionsId ?? ''}
                            onChange={(e) => updateQuestion(index, 'wordCloudOptionsId', e.target.value ? parseInt(e.target.value) : null)}
                          >
                            <option value="">No word cloud options</option>
                            {wordCloudOptions.map((option) => (
                              <option key={option.id} value={option.id}>
                                {option.name}
                              </option>
                            ))}
                          </select>
                          <input
                            type="number"
                            value={q.maxSelections}
                            onChange={(e) => updateQuestion(index, 'maxSelections', parseInt(e.target.value))}
                            placeholder="Max selections"
                            min="1"
                            max="20"
                            title="Maximum number of words users can select"
                          />
                        </>
                      )}
                      
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

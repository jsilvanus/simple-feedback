import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import RadarChart from './RadarChart';
import './AdminResults.css';

export default function AdminResults() {
  const { t } = useTranslation();
  const [results, setResults] = useState([]);
  const [answerViews, setAnswerViews] = useState([]);
  const [locations, setLocations] = useState([]);
  const [questionnaires, setQuestionnaires] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    locationId: '',
    questionnaireId: '',
    startDate: '',
    endDate: '',
  });
  const [stats, setStats] = useState({
    totalSessions: 0,
    totalQuestionsAnswered: 0,
    totalQuestionnairesAnswered: 0,
    byLocation: {},
    byQuestion: {},
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    calculateStats();
  }, [results]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [locationsData, questionnairesData] = await Promise.all([
        api.adminRequest('/locations'),
        api.adminRequest('/questionnaires'),
      ]);
      setLocations(locationsData);
      setQuestionnaires(questionnairesData);
      await loadResults();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadResults = async () => {
    try {
      const queryParams = new URLSearchParams();
      if (filters.locationId) queryParams.append('locationId', filters.locationId);
      if (filters.questionnaireId) queryParams.append('questionnaireId', filters.questionnaireId);
      if (filters.startDate) queryParams.append('startDate', filters.startDate);
      if (filters.endDate) queryParams.append('endDate', filters.endDate);
      
      const data = await api.adminRequest(`/results?${queryParams.toString()}`);
      // Results endpoint returns { rows, answerViews } when questionnaireId is set,
      // or just an array (legacy). Handle both.
      if (Array.isArray(data)) {
        setResults(data);
        setAnswerViews([]);
      } else {
        setResults(data.rows || []);
        setAnswerViews(data.answerViews || []);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const calculateStats = () => {
    const sessions = new Set(results.map(r => r.session_id));
    const byLocationAccumulator = {};
    const byQuestion = {};

    results.forEach(result => {
      // Count by location
      if (!byLocationAccumulator[result.location_name]) {
        byLocationAccumulator[result.location_name] = {
          questionsAnswered: 0,
          sessionIds: new Set(),
        };
      }
      byLocationAccumulator[result.location_name].questionsAnswered++;
      byLocationAccumulator[result.location_name].sessionIds.add(result.session_id);

      // Aggregate by question
      if (!byQuestion[result.question_text]) {
        byQuestion[result.question_text] = {
          type: result.question_type,
          values: [],
          texts: [],
          continuousAnswers: [],
          answerScaleButtons: result.answer_scale_buttons || [],
          scaleMode: result.scale_mode || 'normal',
          scaleStep: result.scale_step ? parseFloat(result.scale_step) : 1,
          minLabel: result.min_label || null,
          maxLabel: result.max_label || null,
          minValue: result.min_value !== null && result.min_value !== undefined ? parseFloat(result.min_value) : null,
          maxValue: result.max_value !== null && result.max_value !== undefined ? parseFloat(result.max_value) : null,
          continuousAxes: result.continuous_axes || [],
          wordCloudWords: result.word_cloud_words || null,
          // Multi-scale: keyed by scale_item_id
          scaleItemsData: {},
        };
      }

      // Handle multi-scale item answers
      if (result.scale_item_id) {
        const itemId = result.scale_item_id;
        const qData = byQuestion[result.question_text];
        if (!qData.scaleItemsData[itemId]) {
          qData.scaleItemsData[itemId] = {
            id: itemId,
            label: result.scale_item_label,
            orderIndex: result.scale_item_order ?? 0,
            values: [],
            scaleStep: result.scale_step ? parseFloat(result.scale_step) : 1,
          };
        }
        if (result.value !== null) {
          const numValue = parseFloat(result.value);
          if (!isNaN(numValue)) {
            qData.scaleItemsData[itemId].values.push(numValue);
          }
        }
        return;
      }

      if (result.value !== null) {
        // Parse to float — feedback_answers.value is NUMERIC (may come as string from pg)
        const numValue = parseFloat(result.value);
        if (!isNaN(numValue)) {
          byQuestion[result.question_text].values.push(numValue);
        }
      }
      if (result.text_value) {
        if (result.question_type === 'continuous_scale') {
          try {
            const parsed = typeof result.text_value === 'string'
              ? JSON.parse(result.text_value)
              : result.text_value;

            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
              byQuestion[result.question_text].continuousAnswers.push(parsed);
            }
          } catch (parseError) {
            console.error('Error parsing continuous scale answer:', result.text_value, parseError);
          }
          return;
        }

        // For word cloud, normalize words to Finnish for analytics
        if (result.question_type === 'wordcloud' && result.word_cloud_words) {
          const normalizedText = normalizeToFinnish(result.text_value, result.word_cloud_words);
          byQuestion[result.question_text].texts.push(normalizedText);
        } else {
          byQuestion[result.question_text].texts.push(result.text_value);
        }
      }
    });

    const byLocation = Object.fromEntries(
      Object.entries(byLocationAccumulator).map(([location, data]) => [
        location,
        {
          questionsAnswered: data.questionsAnswered,
          questionnairesAnswered: data.sessionIds.size,
        },
      ])
    );

    setStats({
      totalSessions: sessions.size,
      totalQuestionsAnswered: results.length,
      totalQuestionnairesAnswered: sessions.size,
      byLocation,
      byQuestion,
    });
  };

  // Helper function to normalize word cloud answers to Finnish for consistent admin analytics
  const normalizeToFinnish = (textValue, wordCloudWords) => {
    if (!textValue || !wordCloudWords) return textValue;
    
    try {
      // Parse word cloud words if it's a JSON string
      const words = typeof wordCloudWords === 'string' ? JSON.parse(wordCloudWords) : wordCloudWords;
      
      // Create a mapping from all language versions to Finnish
      const translationMap = {};
      words.forEach(word => {
        if (typeof word.text === 'object') {
          const fi = word.text.fi || '';
          const en = word.text.en || '';
          const sv = word.text.sv || '';
          
          // Map all translations to Finnish
          if (fi) {
            translationMap[fi] = fi; // FI -> FI
            if (en) translationMap[en] = fi; // EN -> FI
            if (sv) translationMap[sv] = fi; // SV -> FI
          }
        }
      });
      
      // Split the stored text and translate each word
      const selectedWords = textValue.split(',').map(w => w.trim());
      const normalizedWords = selectedWords.map(word => translationMap[word] || word);
      
      return normalizedWords.join(', ');
    } catch (e) {
      console.error('Error normalizing word cloud text to Finnish:', textValue, e);
      return textValue;
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters({ ...filters, [field]: value });
  };

  const applyFilters = () => {
    loadResults();
  };

  const resetFilters = () => {
    const newFilters = {
      locationId: '',
      questionnaireId: '',
      startDate: '',
      endDate: '',
    };
    setFilters(newFilters);
    // Trigger reload after state is updated by using useEffect dependency or direct call
    loadResults();
  };

  const exportCSV = async () => {
    try {
      const queryParams = new URLSearchParams();
      if (filters.locationId) queryParams.append('locationId', filters.locationId);
      if (filters.questionnaireId) queryParams.append('questionnaireId', filters.questionnaireId);
      if (filters.startDate) queryParams.append('startDate', filters.startDate);
      if (filters.endDate) queryParams.append('endDate', filters.endDate);
      
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`/api/admin/export?${queryParams.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `feedback-export-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      setError(t('admin.failedToExportData'));
    }
  };

  const getAverage = (values) => {
    if (values.length === 0) return 0;
    return (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2);
  };

  const getDistribution = (values, step = 1) => {
    const dist = {};
    const decimals = step < 1 ? Math.ceil(-Math.log10(step)) : 0;
    values.forEach(v => {
      const key = parseFloat((Math.round(v / step) * step).toFixed(decimals));
      dist[key] = (dist[key] || 0) + 1;
    });
    return dist;
  };

  const getLabelText = (label) => {
    if (!label) return null;
    if (typeof label === 'string') {
      try { label = JSON.parse(label); } catch { return label; }
    }
    return label.fi || label.en || label.sv || Object.values(label).find(v => v) || null;
  };

  const getWordFrequency = (texts) => {
    const frequency = texts
      .flatMap((text) => text.split(',').map((word) => word.trim()))
      .filter(Boolean)
      .reduce((acc, word) => {
        acc[word] = (acc[word] || 0) + 1;
        return acc;
      }, {});

    return Object.entries(frequency)
      .map(([word, count]) => ({ word, count }))
      .sort((a, b) => b.count - a.count);
  };

  const getWordCloudFontSize = (count, maxCount) => {
    const minSize = 14;
    const maxSize = 40;

    if (!maxCount || maxCount <= 1) return minSize;

    const ratio = (count - 1) / (maxCount - 1);
    return Math.round(minSize + ratio * (maxSize - minSize));
  };

  const getContinuousAverages = (answers) => {
    const axisTotals = {};
    const axisCounts = {};

    answers.forEach((answer) => {
      Object.entries(answer).forEach(([axisId, rawValue]) => {
        const numericValue = Number(rawValue);
        if (Number.isNaN(numericValue)) return;

        axisTotals[axisId] = (axisTotals[axisId] || 0) + numericValue;
        axisCounts[axisId] = (axisCounts[axisId] || 0) + 1;
      });
    });

    const averages = {};
    Object.keys(axisTotals).forEach((axisId) => {
      averages[axisId] = axisTotals[axisId] / axisCounts[axisId];
    });

    return {
      averages,
      counts: axisCounts,
    };
  };

  if (loading) return <div className="loading">{t('admin.loadingResults')}</div>;
  if (error) return <div className="error">{t('common.error')}: {error}</div>;

  return (
    <div className="admin-results">
      <h2>{t('admin.feedbackResultsAnalytics')}</h2>

      <div className="filters-section">
        <h3>{t('admin.filters')}</h3>
        <div className="filters-grid">
          <div className="form-group">
            <label>{t('admin.locations')}</label>
            <select
              value={filters.locationId}
              onChange={(e) => handleFilterChange('locationId', e.target.value)}
            >
              <option value="">{t('admin.allLocations')}</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>{t('admin.questionnaire')}</label>
            <select
              value={filters.questionnaireId}
              onChange={(e) => handleFilterChange('questionnaireId', e.target.value)}
            >
              <option value="">{t('admin.allQuestionnaires')}</option>
              {questionnaires.map((questionnaire) => (
                <option key={questionnaire.id} value={questionnaire.id}>
                  {questionnaire.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>{t('admin.startDate')}</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>{t('admin.endDate')}</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
            />
          </div>
        </div>

        <div className="filter-actions">
          <button className="btn btn-primary" onClick={applyFilters}>
            {t('admin.applyFilters')}
          </button>
          <button className="btn btn-secondary" onClick={resetFilters}>
            {t('common.reset')}
          </button>
          <button className="btn btn-success" onClick={exportCSV}>
            📥 {t('admin.exportCsv')}
          </button>
        </div>
      </div>

      <div className="stats-section">
        <div className="stat-card">
          <h4>Total Questions Answered</h4>
          <div className="stat-value">{stats.totalQuestionsAnswered}</div>
        </div>

        <div className="stat-card">
          <h4>Total Questionnaires Answered</h4>
          <div className="stat-value">{stats.totalQuestionnairesAnswered}</div>
        </div>

        <div className="stat-card">
          <h4>{t('admin.byLocation')}</h4>
          <div className="stat-list">
            {Object.entries(stats.byLocation).map(([location, counts]) => (
              <div key={location} className="stat-item">
                <span>{location}</span>
                <span>
                  <span className="stat-badge" title="Questions Answered" style={{ marginRight: '6px' }}>
                    Q: {counts.questionsAnswered}
                  </span>
                  <span className="stat-badge" title="Questionnaires Answered">
                    QQ: {counts.questionnairesAnswered}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="analytics-section">
        <h3>{t('admin.questionAnalytics')}</h3>
        {Object.entries(stats.byQuestion).map(([question, data]) => (
          <div key={question} className="question-analytics">
            <h4>{question}</h4>
            
            {data.type === 'scale' && Object.keys(data.scaleItemsData || {}).length > 0 && (
              <div className="scale-analytics">
                <div className="stat-row">
                  <span>Multi-scale question — {Object.keys(data.scaleItemsData).length} items</span>
                </div>
                <div className="multi-scale-breakdown">
                  {Object.values(data.scaleItemsData)
                    .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
                    .map(item => {
                      const itemLabelText = getLabelText(item.label) || `Item ${item.id}`;
                      const avg = item.values.length > 0 ? getAverage(item.values) : null;
                      const totalWidth = item.values.length > 0 ? Math.max(...item.values) : 1;
                      return (
                        <div key={item.id} className="scale-item-breakdown">
                          <div className="scale-item-breakdown-label">
                            <span>{itemLabelText}</span>
                            <span className="scale-item-breakdown-stats">
                              {avg !== null && <strong>{avg}</strong>}
                              <span className="response-count">({item.values.length})</span>
                            </span>
                          </div>
                          {item.values.length > 0 && (
                            <div className="distribution">
                              <div className="chart">
                                {Object.entries(getDistribution(item.values, item.scaleStep))
                                  .sort(([a], [b]) => parseFloat(a) - parseFloat(b))
                                  .map(([value, count]) => (
                                    <div key={value} className="bar-container">
                                      <span className="bar-label">{value}</span>
                                      <div className="bar-wrapper">
                                        <div className="bar" style={{ width: `${(count / item.values.length) * 100}%` }} />
                                        <span className="bar-count">{count}</span>
                                      </div>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {data.type === 'scale' && data.values.length > 0 && Object.keys(data.scaleItemsData || {}).length === 0 && (
              <div className="scale-analytics">
                <div className="stat-row">
                  <span>Average Score:</span>
                  <strong>{getAverage(data.values)}</strong>
                  {data.scaleMode === 'bipolar' && (
                    <span style={{ marginLeft: '8px', color: '#888', fontSize: '0.85em' }}>(bipolar)</span>
                  )}
                </div>
                {(getLabelText(data.minLabel) || getLabelText(data.maxLabel)) && (
                  <div className="stat-row">
                    {getLabelText(data.minLabel) && (
                      <span style={{ marginRight: '12px' }}>Min: <em>{getLabelText(data.minLabel)}</em></span>
                    )}
                    {getLabelText(data.maxLabel) && (
                      <span>Max: <em>{getLabelText(data.maxLabel)}</em></span>
                    )}
                  </div>
                )}
                <div className="stat-row">
                  <span>Total Responses:</span>
                  <strong>{data.values.length}</strong>
                </div>
                <div className="distribution">
                  <h5>Distribution:</h5>
                  <div className="chart">
                    {Object.entries(getDistribution(data.values, data.scaleStep))
                      .sort(([a], [b]) => parseFloat(a) - parseFloat(b))
                      .map(([value, count]) => (
                        <div key={value} className="bar-container">
                          <span className="bar-label">{value}</span>
                          <div className="bar-wrapper">
                            <div
                              className="bar"
                              style={{
                                width: `${(count / data.values.length) * 100}%`,
                              }}
                            />
                            <span className="bar-count">{count}</span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            )}

            {data.type === 'text' && data.texts.length > 0 && (
              <div className="text-analytics">
                <div className="stat-row">
                  <span>Total Responses:</span>
                  <strong>{data.texts.length}</strong>
                </div>
                <div className="text-responses">
                  <h5>Recent Responses:</h5>
                  {data.texts.slice(0, 5).map((text, index) => (
                    <div key={index} className="text-response">
                      "{text}"
                    </div>
                  ))}
                  {data.texts.length > 5 && (
                    <small>...and {data.texts.length - 5} more</small>
                  )}
                </div>
              </div>
            )}

            {data.type === 'wordcloud' && data.texts.length > 0 && (
              <div className="wordcloud-analytics">
                <div className="stat-row">
                  <span>Total Responses:</span>
                  <strong>{data.texts.length}</strong>
                </div>
                <div className="word-frequency">
                  <h5>Word Set Frequency (Finnish):</h5>
                  {(() => {
                    const wordFrequency = getWordFrequency(data.texts);
                    const maxCount = wordFrequency.length > 0 ? wordFrequency[0].count : 1;

                    return (
                  <div className="word-cloud-display">
                    {wordFrequency.map(({ word, count }) => (
                      <span
                        key={word}
                        className="word-cloud-word"
                        title={`${word}: ${count} responses`}
                        style={{ fontSize: `${getWordCloudFontSize(count, maxCount)}px` }}
                      >
                        {word}
                      </span>
                    ))}
                  </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {data.type === 'continuous_scale' && data.continuousAnswers.length > 0 && (
              <div className="continuous-analytics">
                <div className="stat-row">
                  <span>Total Responses:</span>
                  <strong>{data.continuousAnswers.length}</strong>
                </div>

                {(() => {
                  const { averages, counts } = getContinuousAverages(data.continuousAnswers);
                  const fallbackAxes = Object.keys(averages).map((axisId, index) => ({
                    id: axisId,
                    label: `Axis ${index + 1}`,
                  }));
                  const axes = Array.isArray(data.continuousAxes) && data.continuousAxes.length > 0
                    ? data.continuousAxes
                    : fallbackAxes;

                  return (
                    <>
                      <div className="continuous-chart-wrapper">
                        <RadarChart
                          question={{
                            answerScale: { buttons: data.answerScaleButtons || [] },
                            continuousAxes: axes,
                          }}
                          value={averages}
                          onChange={() => {}}
                          readOnly
                        />
                      </div>

                      <div className="continuous-axis-list">
                        {axes.map((axis) => (
                          <div key={axis.id} className="continuous-axis-item">
                            <span>{axis.label || axis.id}</span>
                            <strong>
                              {averages[axis.id] !== undefined ? averages[axis.id].toFixed(2) : '-'}
                              {counts[axis.id] ? ` (${counts[axis.id]})` : ''}
                            </strong>
                          </div>
                        ))}
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        ))}
      </div>

      {results.length === 0 && (
        <div className="empty-state">
          <p>{t('admin.noFeedbackDataForFilters')}</p>
        </div>
      )}

      {answerViews.length > 0 && (
        <div className="analytics-section">
          <h3>{t('admin.answerViews')}</h3>
          {answerViews.map(view => (
            <div key={view.id} className="question-analytics">
              <h4>{view.name}</h4>
              <div className="continuous-analytics">
                {(() => {
                  const axes = view.axes || [];
                  const averages = {};
                  axes.forEach(axis => {
                    if (axis.avg !== null) {
                      averages[`axis_${axis.questionId}`] = axis.avg;
                    }
                  });
                  const radarAxes = axes.map(axis => ({
                    id: `axis_${axis.questionId}`,
                    label: axis.axisLabel,
                  }));
                  const totalResponses = axes.reduce((max, a) => Math.max(max, a.count || 0), 0);

                  return (
                    <>
                      <div className="stat-row">
                        <span>Total Responses:</span>
                        <strong>{totalResponses}</strong>
                      </div>
                      {radarAxes.length >= 2 && totalResponses > 0 && (
                        <div className="continuous-chart-wrapper">
                          <RadarChart
                            question={{
                              answerScale: { buttons: [] },
                              continuousAxes: radarAxes,
                            }}
                            value={averages}
                            onChange={() => {}}
                            readOnly
                          />
                        </div>
                      )}
                      <div className="continuous-axis-list">
                        {axes.map(axis => (
                          <div key={axis.questionId} className="continuous-axis-item">
                            <span>{axis.axisLabel}</span>
                            <strong>
                              {axis.avg !== null ? axis.avg.toFixed(2) : '-'}
                              {axis.count ? ` (${axis.count})` : ''}
                            </strong>
                          </div>
                        ))}
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

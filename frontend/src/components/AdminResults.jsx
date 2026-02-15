import React, { useState, useEffect } from 'react';
import { api } from '../api';
import './AdminResults.css';

export default function AdminResults() {
  const [results, setResults] = useState([]);
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
      setResults(data);
    } catch (err) {
      setError(err.message);
    }
  };

  const calculateStats = () => {
    const sessions = new Set(results.map(r => r.session_id));
    const byLocation = {};
    const byQuestion = {};

    results.forEach(result => {
      // Count by location
      if (!byLocation[result.location_name]) {
        byLocation[result.location_name] = 0;
      }
      byLocation[result.location_name]++;

      // Aggregate by question
      if (!byQuestion[result.question_text]) {
        byQuestion[result.question_text] = {
          type: result.question_type,
          values: [],
          texts: [],
        };
      }
      if (result.value !== null) {
        byQuestion[result.question_text].values.push(result.value);
      }
      if (result.text_value) {
        byQuestion[result.question_text].texts.push(result.text_value);
      }
    });

    setStats({
      totalSessions: sessions.size,
      byLocation,
      byQuestion,
    });
  };

  const handleFilterChange = (field, value) => {
    setFilters({ ...filters, [field]: value });
  };

  const applyFilters = () => {
    loadResults();
  };

  const resetFilters = () => {
    setFilters({
      locationId: '',
      questionnaireId: '',
      startDate: '',
      endDate: '',
    });
    setTimeout(() => loadResults(), 0);
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
      setError('Failed to export data');
    }
  };

  const getAverage = (values) => {
    if (values.length === 0) return 0;
    return (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2);
  };

  const getDistribution = (values) => {
    const dist = {};
    values.forEach(v => {
      dist[v] = (dist[v] || 0) + 1;
    });
    return dist;
  };

  if (loading) return <div className="loading">Loading results...</div>;
  if (error) return <div className="error">Error: {error}</div>;

  return (
    <div className="admin-results">
      <h2>Feedback Results & Analytics</h2>

      <div className="filters-section">
        <h3>Filters</h3>
        <div className="filters-grid">
          <div className="form-group">
            <label>Location</label>
            <select
              value={filters.locationId}
              onChange={(e) => handleFilterChange('locationId', e.target.value)}
            >
              <option value="">All Locations</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Questionnaire</label>
            <select
              value={filters.questionnaireId}
              onChange={(e) => handleFilterChange('questionnaireId', e.target.value)}
            >
              <option value="">All Questionnaires</option>
              {questionnaires.map((questionnaire) => (
                <option key={questionnaire.id} value={questionnaire.id}>
                  {questionnaire.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Start Date</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>End Date</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
            />
          </div>
        </div>

        <div className="filter-actions">
          <button className="btn btn-primary" onClick={applyFilters}>
            Apply Filters
          </button>
          <button className="btn btn-secondary" onClick={resetFilters}>
            Reset
          </button>
          <button className="btn btn-success" onClick={exportCSV}>
            📥 Export CSV
          </button>
        </div>
      </div>

      <div className="stats-section">
        <div className="stat-card">
          <h4>Total Responses</h4>
          <div className="stat-value">{stats.totalSessions}</div>
        </div>

        <div className="stat-card">
          <h4>By Location</h4>
          <div className="stat-list">
            {Object.entries(stats.byLocation).map(([location, count]) => (
              <div key={location} className="stat-item">
                <span>{location}</span>
                <span className="stat-badge">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="analytics-section">
        <h3>Question Analytics</h3>
        {Object.entries(stats.byQuestion).map(([question, data]) => (
          <div key={question} className="question-analytics">
            <h4>{question}</h4>
            
            {data.type === 'scale' && data.values.length > 0 && (
              <div className="scale-analytics">
                <div className="stat-row">
                  <span>Average Score:</span>
                  <strong>{getAverage(data.values)}</strong>
                </div>
                <div className="stat-row">
                  <span>Total Responses:</span>
                  <strong>{data.values.length}</strong>
                </div>
                <div className="distribution">
                  <h5>Distribution:</h5>
                  <div className="chart">
                    {Object.entries(getDistribution(data.values))
                      .sort(([a], [b]) => a - b)
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
          </div>
        ))}
      </div>

      {results.length === 0 && (
        <div className="empty-state">
          <p>No feedback data available for the selected filters.</p>
        </div>
      )}
    </div>
  );
}

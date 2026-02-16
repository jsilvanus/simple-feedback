import React, { useState, useEffect } from 'react';
import { api } from '../api';
import './AdminCrud.css';

export default function AdminSchedules() {
  const [schedules, setSchedules] = useState([]);
  const [locations, setLocations] = useState([]);
  const [questionnaires, setQuestionnaires] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    locationId: '',
    questionnaireId: '',
    startTime: '',
    endTime: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [schedulesData, locationsData, questionnairesData] = await Promise.all([
        api.adminRequest('/schedules'),
        api.adminRequest('/locations'),
        api.adminRequest('/questionnaires'),
      ]);
      setSchedules(schedulesData);
      setLocations(locationsData);
      setQuestionnaires(questionnairesData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.adminRequest('/schedules', {
        method: 'POST',
        body: JSON.stringify({
          ...formData,
          locationId: parseInt(formData.locationId),
          questionnaireId: parseInt(formData.questionnaireId),
        }),
      });
      setShowForm(false);
      setFormData({ locationId: '', questionnaireId: '', startTime: '', endTime: '' });
      loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setFormData({ locationId: '', questionnaireId: '', startTime: '', endTime: '' });
  };

  const isActive = (schedule) => {
    const now = new Date();
    const start = new Date(schedule.start_time);
    const end = new Date(schedule.end_time);
    return now >= start && now <= end;
  };

  if (loading) return <div className="loading">Loading schedules...</div>;
  if (error) return <div className="error">Error: {error}</div>;

  return (
    <div className="admin-crud-section">
      <div className="section-header">
        <h2>Schedules</h2>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          + Add Schedule
        </button>
      </div>

      {showForm && (
        <div className="form-modal">
          <div className="form-container">
            <h3>Add New Schedule</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Location *</label>
                <select
                  value={formData.locationId}
                  onChange={(e) => setFormData({ ...formData, locationId: e.target.value })}
                  required
                >
                  <option value="">Select location...</option>
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name} (/{location.slug})
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="form-group">
                <label>Questionnaire *</label>
                <select
                  value={formData.questionnaireId}
                  onChange={(e) => setFormData({ ...formData, questionnaireId: e.target.value })}
                  required
                >
                  <option value="">Select questionnaire...</option>
                  {questionnaires.map((questionnaire) => (
                    <option key={questionnaire.id} value={questionnaire.id}>
                      {questionnaire.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Start Time *</label>
                <input
                  type="datetime-local"
                  value={formData.startTime}
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>End Time *</label>
                <input
                  type="datetime-local"
                  value={formData.endTime}
                  onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                  required
                />
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
        {schedules.length === 0 ? (
          <div className="empty-state">
            <p>No schedules yet. Add your first schedule to get started.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Location</th>
                <th>Questionnaire</th>
                <th>Start Time</th>
                <th>End Time</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {schedules.map((schedule) => (
                <tr key={schedule.id}>
                  <td>{schedule.location_name}</td>
                  <td>{schedule.questionnaire_name}</td>
                  <td>{new Date(schedule.start_time).toLocaleString()}</td>
                  <td>{new Date(schedule.end_time).toLocaleString()}</td>
                  <td>
                    <span className={`status ${isActive(schedule) ? 'active' : 'inactive'}`}>
                      {isActive(schedule) ? 'Active' : 'Inactive'}
                    </span>
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

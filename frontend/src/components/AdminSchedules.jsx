import React, { useState, useEffect } from 'react';
import { api } from '../api';
import './AdminCrud.css';

export default function AdminSchedules() {
  const [schedules, setSchedules] = useState([]);
  const [locations, setLocations] = useState([]);
  const [locationGroups, setLocationGroups] = useState([]);
  const [questionnaires, setQuestionnaires] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    destinationType: 'location', // 'location' or 'group'
    locationId: '',
    locationGroupId: '',
    questionnaireIds: [],
    scheduleType: 'date_based',
    startTime: '',
    endTime: '',
    weekdayPattern: {
      days: [],
      start_hour: '09:00',
      end_hour: '17:00',
    },
    showOnlyOne: false,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [schedulesData, locationsData, locationGroupsData, questionnairesData] = await Promise.all([
        api.adminRequest('/schedules'),
        api.adminRequest('/locations'),
        api.adminRequest('/location-groups'),
        api.adminRequest('/questionnaires'),
      ]);
      setSchedules(schedulesData);
      setLocations(locationsData);
      setLocationGroups(locationGroupsData);
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
      const payload = {
        questionnaireIds: formData.questionnaireIds.map(id => parseInt(id)),
        scheduleType: formData.scheduleType,
        showOnlyOne: formData.showOnlyOne,
      };

      // Set either locationId or locationGroupId based on destinationType
      if (formData.destinationType === 'location') {
        payload.locationId = parseInt(formData.locationId);
      } else {
        payload.locationGroupId = parseInt(formData.locationGroupId);
      }

      if (formData.scheduleType === 'date_based') {
        payload.startTime = formData.startTime;
        payload.endTime = formData.endTime;
      } else if (formData.scheduleType === 'recurring_weekday') {
        payload.weekdayPattern = formData.weekdayPattern;
      }

      if (editingId) {
        await api.adminRequest(`/schedules/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await api.adminRequest('/schedules', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      setShowForm(false);
      setEditingId(null);
      resetFormData();
      loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEdit = (schedule) => {
    setEditingId(schedule.id);
    
    // Determine destination type based on which field has a value
    let destinationType = 'location'; // default
    if (schedule.location_group_id) {
      destinationType = 'group';
    } else if (!schedule.location_id) {
      // Neither is set - this shouldn't happen, but default to location
      destinationType = 'location';
    }
    
    setFormData({
      destinationType,
      locationId: schedule.location_id?.toString() || '',
      locationGroupId: schedule.location_group_id?.toString() || '',
      questionnaireIds: schedule.questionnaires?.map(q => q.id.toString()) || 
                       (schedule.questionnaire_id ? [schedule.questionnaire_id.toString()] : []),
      scheduleType: schedule.schedule_type || 'date_based',
      startTime: schedule.start_time ? new Date(schedule.start_time).toISOString().slice(0, 16) : '',
      endTime: schedule.end_time ? new Date(schedule.end_time).toISOString().slice(0, 16) : '',
      weekdayPattern: schedule.weekday_pattern || { days: [], start_hour: '09:00', end_hour: '17:00' },
      showOnlyOne: schedule.show_only_one || false,
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this schedule?')) {
      return;
    }
    try {
      await api.adminRequest(`/schedules/${id}`, {
        method: 'DELETE',
      });
      loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  const resetFormData = () => {
    setFormData({
      destinationType: 'location',
      locationId: '',
      locationGroupId: '',
      questionnaireIds: [],
      scheduleType: 'date_based',
      startTime: '',
      endTime: '',
      weekdayPattern: {
        days: [],
        start_hour: '09:00',
        end_hour: '17:00',
      },
      showOnlyOne: false,
    });
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    resetFormData();
  };

  const toggleWeekday = (day) => {
    const days = [...formData.weekdayPattern.days];
    const index = days.indexOf(day);
    if (index > -1) {
      days.splice(index, 1);
    } else {
      days.push(day);
    }
    setFormData({
      ...formData,
      weekdayPattern: { ...formData.weekdayPattern, days }
    });
  };

  const toggleQuestionnaire = (id) => {
    const ids = [...formData.questionnaireIds];
    const index = ids.indexOf(id);
    if (index > -1) {
      ids.splice(index, 1);
    } else {
      ids.push(id);
    }
    setFormData({ ...formData, questionnaireIds: ids });
  };

  const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const isActive = (schedule) => {
    if (schedule.schedule_type === 'recurring_weekday') {
      // For recurring schedules, check if today matches
      const now = new Date();
      const today = now.getDay();
      const currentTime = now.toTimeString().substring(0, 5);
      
      if (schedule.weekday_pattern) {
        const isDayActive = schedule.weekday_pattern.days?.includes(today);
        const isTimeActive = currentTime >= schedule.weekday_pattern.start_hour && 
                            currentTime <= schedule.weekday_pattern.end_hour;
        return isDayActive && isTimeActive;
      }
      return false;
    } else {
      // For date-based schedules
      const now = new Date();
      const start = new Date(schedule.start_time);
      const end = new Date(schedule.end_time);
      return now >= start && now <= end;
    }
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
          <div className="form-container large">
            <h3>{editingId ? 'Edit Schedule' : 'Add New Schedule'}</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Publish To *</label>
                <div className="radio-group">
                  <label>
                    <input
                      type="radio"
                      value="location"
                      checked={formData.destinationType === 'location'}
                      onChange={(e) => setFormData({ ...formData, destinationType: e.target.value })}
                    />
                    Specific Location
                  </label>
                  <label>
                    <input
                      type="radio"
                      value="group"
                      checked={formData.destinationType === 'group'}
                      onChange={(e) => setFormData({ ...formData, destinationType: e.target.value })}
                    />
                    Location Group
                  </label>
                </div>
              </div>

              {formData.destinationType === 'location' ? (
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
              ) : (
                <div className="form-group">
                  <label>Location Group *</label>
                  <select
                    value={formData.locationGroupId}
                    onChange={(e) => setFormData({ ...formData, locationGroupId: e.target.value })}
                    required
                    aria-describedby="group-help-text"
                  >
                    <option value="">Select location group...</option>
                    {locationGroups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name}
                      </option>
                    ))}
                  </select>
                  <small id="group-help-text">This schedule will apply to all locations in the selected group</small>
                </div>
              )}
              
              <div className="form-group">
                <label>Questionnaires *</label>
                <div style={{ border: '1px solid #ddd', padding: '10px', borderRadius: '4px', maxHeight: '200px', overflowY: 'auto' }}>
                  {questionnaires.map((questionnaire) => (
                    <label key={questionnaire.id} style={{ display: 'block', marginBottom: '5px' }}>
                      <input
                        type="checkbox"
                        checked={formData.questionnaireIds.includes(questionnaire.id.toString())}
                        onChange={() => toggleQuestionnaire(questionnaire.id.toString())}
                      />
                      {' '}{questionnaire.name}
                    </label>
                  ))}
                </div>
                {formData.questionnaireIds.length === 0 && (
                  <small style={{ color: 'red' }}>Select at least one questionnaire</small>
                )}
              </div>

              <div className="form-group">
                <label>Schedule Type *</label>
                <select
                  value={formData.scheduleType}
                  onChange={(e) => setFormData({ ...formData, scheduleType: e.target.value })}
                  required
                >
                  <option value="date_based">Date-based (specific dates/times)</option>
                  <option value="recurring_weekday">Recurring (weekdays/times)</option>
                </select>
              </div>

              {formData.scheduleType === 'date_based' && (
                <>
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
                </>
              )}

              {formData.scheduleType === 'recurring_weekday' && (
                <>
                  <div className="form-group">
                    <label>Active Days *</label>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      {weekdayNames.map((day, index) => (
                        <label key={index} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={formData.weekdayPattern.days.includes(index)}
                            onChange={() => toggleWeekday(index)}
                          />
                          {' '}{day}
                        </label>
                      ))}
                    </div>
                    {formData.weekdayPattern.days.length === 0 && (
                      <small style={{ color: 'red' }}>Select at least one day</small>
                    )}
                  </div>

                  <div className="form-group">
                    <label>Start Hour *</label>
                    <input
                      type="time"
                      value={formData.weekdayPattern.start_hour}
                      onChange={(e) => setFormData({
                        ...formData,
                        weekdayPattern: { ...formData.weekdayPattern, start_hour: e.target.value }
                      })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>End Hour *</label>
                    <input
                      type="time"
                      value={formData.weekdayPattern.end_hour}
                      onChange={(e) => setFormData({
                        ...formData,
                        weekdayPattern: { ...formData.weekdayPattern, end_hour: e.target.value }
                      })}
                      required
                    />
                  </div>
                </>
              )}

              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={formData.showOnlyOne}
                    onChange={(e) => setFormData({ ...formData, showOnlyOne: e.target.checked })}
                  />
                  {' '}Show only the first questionnaire (instead of all)
                </label>
                <small>When enabled, only the first questionnaire will be shown to users</small>
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={handleCancel}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={formData.questionnaireIds.length === 0}>
                  {editingId ? 'Update' : 'Create'}
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
                <th>Destination</th>
                <th>Questionnaires</th>
                <th>Type</th>
                <th>Schedule</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {schedules.map((schedule) => (
                <tr key={schedule.id}>
                  <td>
                    {schedule.location_name ? (
                      <div>
                        <div><strong>{schedule.location_name}</strong></div>
                        <small>/{schedule.location_slug}</small>
                      </div>
                    ) : schedule.location_group_name ? (
                      <div>
                        <div><strong>🏢 {schedule.location_group_name}</strong></div>
                        <small>(Location Group)</small>
                      </div>
                    ) : (
                      <span>N/A</span>
                    )}
                  </td>
                  <td>
                    {schedule.questionnaires && schedule.questionnaires.length > 0 ? (
                      <div>
                        {schedule.questionnaires.map((q, i) => (
                          <div key={i}>{q.name}</div>
                        ))}
                        {schedule.show_only_one && (
                          <small style={{ color: '#666' }}>(showing only first)</small>
                        )}
                      </div>
                    ) : (
                      schedule.questionnaire_name || 'N/A'
                    )}
                  </td>
                  <td>
                    {schedule.schedule_type === 'recurring_weekday' ? (
                      <span>🔄 Recurring</span>
                    ) : (
                      <span>📅 Date-based</span>
                    )}
                  </td>
                  <td>
                    {schedule.schedule_type === 'recurring_weekday' && schedule.weekday_pattern ? (
                      <div>
                        <div>
                          {schedule.weekday_pattern.days?.map(d => weekdayNames[d].substring(0, 3)).join(', ')}
                        </div>
                        <small>
                          {schedule.weekday_pattern.start_hour} - {schedule.weekday_pattern.end_hour}
                        </small>
                      </div>
                    ) : (
                      <div>
                        <div>{schedule.start_time ? new Date(schedule.start_time).toLocaleString() : 'N/A'}</div>
                        <small>to</small>
                        <div>{schedule.end_time ? new Date(schedule.end_time).toLocaleString() : 'N/A'}</div>
                      </div>
                    )}
                  </td>
                  <td>
                    <span className={`status ${isActive(schedule) ? 'active' : 'inactive'}`}>
                      {isActive(schedule) ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <button className="btn-icon" onClick={() => handleEdit(schedule)} title="Edit">
                      ✏️
                    </button>
                    <button className="btn-icon" onClick={() => handleDelete(schedule.id)} title="Delete">
                      🗑️
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

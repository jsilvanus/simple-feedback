import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import './AdminCrud.css';

export default function AdminSchedules() {
  const { t } = useTranslation();
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
    if (!confirm(t('admin.confirmDeleteSchedule'))) {
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

  const formatDateTimeLocal = (date) => {
    const pad = (value) => value.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const setStartNow = () => {
    setFormData({ ...formData, startTime: formatDateTimeLocal(new Date()) });
  };

  const setEndNever = () => {
    setFormData({ ...formData, endTime: '2099-12-31T23:59' });
  };

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

  if (loading) return <div className="loading">{t('admin.loadingSchedules')}</div>;
  if (error) return <div className="error">{t('common.error')}: {error}</div>;

  return (
    <div className="admin-crud-section">
      <div className="section-header">
        <h2>{t('admin.schedules')}</h2>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          + {t('admin.addSchedule')}
        </button>
      </div>

      {showForm && (
        <div className="form-modal">
          <div className="form-container large">
            <h3>{editingId ? t('admin.editSchedule') : t('admin.addNewSchedule')}</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>{t('admin.publishTo')} *</label>
                <div className="toggle-button-group">
                  <button
                    type="button"
                    className={`toggle-btn ${formData.destinationType === 'location' ? 'active' : ''}`}
                    onClick={() => setFormData({ ...formData, destinationType: 'location' })}
                  >
                    {t('admin.specificLocation')}
                  </button>
                  <button
                    type="button"
                    className={`toggle-btn ${formData.destinationType === 'group' ? 'active' : ''}`}
                    onClick={() => setFormData({ ...formData, destinationType: 'group' })}
                  >
                    {t('admin.locationGroup')}
                  </button>
                </div>
              </div>

              {formData.destinationType === 'location' && (
                <div className="form-group">
                  <label>{t('admin.locations')} *</label>
                  <select
                    value={formData.locationId}
                    onChange={(e) => setFormData({ ...formData, locationId: e.target.value })}
                    required
                  >
                    <option value="">{t('admin.selectLocation')}</option>
                    {locations.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.name} (/{location.slug})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {formData.destinationType === 'group' && (
                <div className="form-group">
                  <label>{t('admin.locationGroup')} *</label>
                  <select
                    value={formData.locationGroupId}
                    onChange={(e) => setFormData({ ...formData, locationGroupId: e.target.value })}
                    required
                    aria-describedby="group-help-text"
                  >
                    <option value="">{t('admin.selectLocationGroup')}</option>
                    {locationGroups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name}
                      </option>
                    ))}
                  </select>
                  <small id="group-help-text">{t('admin.scheduleAppliesToGroup')}</small>
                </div>
              )}
              
              <div className="form-group">
                <label>{t('admin.questionnaires')} *</label>
                <div className="questionnaire-cards-grid">
                  {questionnaires.map((questionnaire) => (
                    <label
                      key={questionnaire.id}
                      className={`questionnaire-checkbox-card ${formData.questionnaireIds.includes(questionnaire.id.toString()) ? 'selected' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={formData.questionnaireIds.includes(questionnaire.id.toString())}
                        onChange={() => toggleQuestionnaire(questionnaire.id.toString())}
                      />
                      <span>{questionnaire.name}</span>
                    </label>
                  ))}
                </div>
                {formData.questionnaireIds.length === 0 && (
                  <small style={{ color: 'red' }}>{t('admin.selectAtLeastOneQuestionnaire')}</small>
                )}
              </div>

              <div className="form-group">
                <button
                  type="button"
                  className={`toggle-btn ${formData.showOnlyOne ? 'active' : ''}`}
                  onClick={() => setFormData({ ...formData, showOnlyOne: !formData.showOnlyOne })}
                >
                  {t('admin.showOnlyFirstQuestionnaire')}: {formData.showOnlyOne ? t('common.yes') : t('common.no')}
                </button>
                <small>{t('admin.showOnlyFirstQuestionnaireDesc')}</small>
              </div>

              <div className="form-group">
                <label>{t('admin.scheduleType')} *</label>
                <div className="toggle-button-group">
                  <button
                    type="button"
                    className={`toggle-btn ${formData.scheduleType === 'date_based' ? 'active' : ''}`}
                    onClick={() => setFormData({ ...formData, scheduleType: 'date_based' })}
                  >
                    {t('admin.dateBasedScheduleType')}
                  </button>
                  <button
                    type="button"
                    className={`toggle-btn ${formData.scheduleType === 'recurring_weekday' ? 'active' : ''}`}
                    onClick={() => setFormData({ ...formData, scheduleType: 'recurring_weekday' })}
                  >
                    {t('admin.recurringScheduleType')}
                  </button>
                </div>
              </div>

              {formData.scheduleType === 'date_based' && (
                <div className="form-row two-columns">
                  <div className="form-group">
                    <label>{t('admin.startTime')} *</label>
                    <input
                      type="datetime-local"
                      value={formData.startTime}
                      onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                      required
                    />
                    <div className="quick-date-actions">
                      <button type="button" className="btn btn-secondary btn-sm" onClick={setStartNow}>
                        {t('admin.now')}
                      </button>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>{t('admin.endTime')} *</label>
                    <input
                      type="datetime-local"
                      value={formData.endTime}
                      onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                      required
                    />
                    <div className="quick-date-actions">
                      <button type="button" className="btn btn-secondary btn-sm" onClick={setEndNever}>
                        {t('admin.never')}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {formData.scheduleType === 'recurring_weekday' && (
                <>
                  <div className="form-group">
                    <label>{t('admin.activeDays')} *</label>
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
                      <small style={{ color: 'red' }}>{t('admin.selectAtLeastOneDay')}</small>
                    )}
                  </div>

                  <div className="form-group">
                    <label>{t('admin.startHour')} *</label>
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
                    <label>{t('admin.endHour')} *</label>
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

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={handleCancel}>
                  {t('common.cancel')}
                </button>
                <button type="submit" className="btn btn-primary" disabled={formData.questionnaireIds.length === 0}>
                  {editingId ? t('common.update') : t('common.create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="data-list">
        {schedules.length === 0 ? (
          <div className="empty-state">
            <p>{t('admin.noSchedulesYet')}</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('admin.destination')}</th>
                <th>{t('admin.questionnaires')}</th>
                <th>{t('admin.type')}</th>
                <th>{t('admin.schedule')}</th>
                <th>{t('admin.status')}</th>
                <th>{t('admin.actions')}</th>
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
                        <small>({t('admin.locationGroup')})</small>
                      </div>
                    ) : (
                      <span>{t('admin.notAvailable')}</span>
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
                      schedule.questionnaire_name || t('admin.notAvailable')
                    )}
                  </td>
                  <td>
                    {schedule.schedule_type === 'recurring_weekday' ? (
                      <span>🔄 {t('admin.recurring')}</span>
                    ) : (
                      <span>📅 {t('admin.dateBased')}</span>
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
                        <div>{schedule.start_time ? new Date(schedule.start_time).toLocaleString() : t('admin.notAvailable')}</div>
                        <small>{t('admin.to')}</small>
                        <div>{schedule.end_time ? new Date(schedule.end_time).toLocaleString() : t('admin.notAvailable')}</div>
                      </div>
                    )}
                  </td>
                  <td>
                    <span className={`status ${isActive(schedule) ? 'active' : 'inactive'}`}>
                      {isActive(schedule) ? t('admin.active') : t('admin.inactive')}
                    </span>
                  </td>
                  <td className="table-actions">
                    <button className="btn-icon" onClick={() => handleEdit(schedule)} title={t('common.edit')}>
                      ✏️
                    </button>
                    <button className="btn-icon" onClick={() => handleDelete(schedule.id)} title={t('common.delete')}>
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

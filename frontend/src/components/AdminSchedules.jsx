import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import './AdminCrud.css';

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const DEFAULT_FORM_DATA = {
  destinationType: 'location',
  locationId: '',
  locationGroupId: '',
  questionnaireIds: [],
  scheduleType: 'date_based',
  dateRanges: [{ startTime: '', endTime: '' }],
  weekdayRules: [{ days: [], start_hour: '09:00', end_hour: '17:00' }],
  showOnlyOne: false,
};

function entityToFormData(schedule) {
  const destinationType = schedule.location_group_id ? 'group' : 'location';
  return {
    destinationType,
    locationId: schedule.location_id?.toString() || '',
    locationGroupId: schedule.location_group_id?.toString() || '',
    questionnaireIds: schedule.questionnaires?.map(q => q.id.toString()) ||
                     (schedule.questionnaire_id ? [schedule.questionnaire_id.toString()] : []),
    scheduleType: schedule.schedule_type || 'date_based',
    dateRanges: [{
      startTime: schedule.start_time ? new Date(schedule.start_time).toISOString().slice(0, 16) : '',
      endTime: schedule.end_time ? new Date(schedule.end_time).toISOString().slice(0, 16) : '',
    }],
    weekdayRules: [schedule.weekday_pattern || { days: [], start_hour: '09:00', end_hour: '17:00' }],
    showOnlyOne: schedule.show_only_one || false,
  };
}

export function ScheduleForm({ entity, locations, locationGroups, questionnaires, onSave, onCancel }) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState(entity ? entityToFormData(entity) : { ...DEFAULT_FORM_DATA });
  const [error, setError] = useState(null);

  const formatDateTimeLocal = (date) => {
    const pad = (value) => value.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const toggleWeekday = (ruleIndex, day) => {
    const rules = [...formData.weekdayRules];
    const days = [...rules[ruleIndex].days];
    const index = days.indexOf(day);
    if (index > -1) {
      days.splice(index, 1);
    } else {
      days.push(day);
    }
    rules[ruleIndex] = { ...rules[ruleIndex], days };
    setFormData({ ...formData, weekdayRules: rules });
  };

  const updateDateRange = (rangeIndex, field, value) => {
    const ranges = [...formData.dateRanges];
    ranges[rangeIndex] = { ...ranges[rangeIndex], [field]: value };
    setFormData({ ...formData, dateRanges: ranges });
  };

  const addDateRange = () => {
    setFormData({
      ...formData,
      dateRanges: [...formData.dateRanges, { startTime: '', endTime: '' }],
    });
  };

  const removeDateRange = (rangeIndex) => {
    if (formData.dateRanges.length === 1) return;
    setFormData({
      ...formData,
      dateRanges: formData.dateRanges.filter((_, idx) => idx !== rangeIndex),
    });
  };

  const updateWeekdayRule = (ruleIndex, field, value) => {
    const rules = [...formData.weekdayRules];
    rules[ruleIndex] = { ...rules[ruleIndex], [field]: value };
    setFormData({ ...formData, weekdayRules: rules });
  };

  const addWeekdayRule = () => {
    setFormData({
      ...formData,
      weekdayRules: [...formData.weekdayRules, { days: [], start_hour: '09:00', end_hour: '17:00' }],
    });
  };

  const removeWeekdayRule = (ruleIndex) => {
    if (formData.weekdayRules.length === 1) return;
    setFormData({
      ...formData,
      weekdayRules: formData.weekdayRules.filter((_, idx) => idx !== ruleIndex),
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

  const setStartNow = (rangeIndex) => {
    updateDateRange(rangeIndex, 'startTime', formatDateTimeLocal(new Date()));
  };

  const setEndNever = (rangeIndex) => {
    updateDateRange(rangeIndex, 'endTime', '2099-12-31T23:59');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);

    try {
      const basePayload = {
        questionnaireIds: formData.questionnaireIds.map((id) => Number.parseInt(id, 10)),
        scheduleType: formData.scheduleType,
        showOnlyOne: formData.showOnlyOne,
      };

      if (formData.destinationType === 'location') {
        basePayload.locationId = Number.parseInt(formData.locationId, 10);
      } else {
        basePayload.locationGroupId = Number.parseInt(formData.locationGroupId, 10);
      }

      const scheduleEntries =
        formData.scheduleType === 'date_based'
          ? formData.dateRanges.filter((range) => range.startTime && range.endTime).map((range) => ({
              ...basePayload,
              startTime: range.startTime,
              endTime: range.endTime,
            }))
          : formData.weekdayRules
              .filter((rule) => rule.days && rule.days.length > 0 && rule.start_hour && rule.end_hour)
              .map((rule) => ({
                ...basePayload,
                weekdayPattern: rule,
              }));

      if (scheduleEntries.length === 0) {
        setError(t('admin.invalidScheduleEntries'));
        return;
      }

      if (entity) {
        await api.adminRequest(`/schedules/${entity.id}`, {
          method: 'PUT',
          body: JSON.stringify(scheduleEntries[0]),
        });

        if (scheduleEntries.length > 1) {
          await Promise.all(
            scheduleEntries.slice(1).map((entry) =>
              api.adminRequest('/schedules', {
                method: 'POST',
                body: JSON.stringify(entry),
              })
            )
          );
        }
      } else {
        await Promise.all(
          scheduleEntries.map((entry) =>
            api.adminRequest('/schedules', {
              method: 'POST',
              body: JSON.stringify(entry),
            })
          )
        );
      }

      onSave();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <>
      <h3>{entity ? t('admin.editSchedule') : t('admin.addNewSchedule')}</h3>
      {error && <div className="error">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="form-row schedule-destination-row">
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

          <div className="form-group">
            <label>{formData.destinationType === 'location' ? t('admin.locations') : t('admin.locationGroup')} *</label>
            {formData.destinationType === 'location' ? (
              <select
                value={formData.locationId}
                onChange={(e) => setFormData({ ...formData, locationId: e.target.value })}
                required
              >
                <option value="">{t('admin.selectLocation')}</option>
                {(locations || []).map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name} (/{location.slug})
                  </option>
                ))}
              </select>
            ) : (
              <>
                <select
                  value={formData.locationGroupId}
                  onChange={(e) => setFormData({ ...formData, locationGroupId: e.target.value })}
                  required
                  aria-describedby="group-help-text"
                >
                  <option value="">{t('admin.selectLocationGroup')}</option>
                  {(locationGroups || []).map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
                <small id="group-help-text">{t('admin.scheduleAppliesToGroup')}</small>
              </>
            )}
          </div>
        </div>

        <div className="form-group">
          <label>{t('admin.questionnaires')} *</label>
          <div className="questionnaire-cards-grid">
            {(questionnaires || []).map((questionnaire) => (
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
          <div className="multi-entry-wrapper">
            {formData.dateRanges.map((range, index) => (
              <div key={index} className="multi-entry-row">
                <div className="multi-entry-label">{t('admin.rangeLabel', { number: index + 1 })}</div>
                <div className="form-row two-columns">
                  <div className="form-group">
                    <label>{t('admin.startTime')} *</label>
                    <input
                      type="datetime-local"
                      value={range.startTime}
                      onChange={(e) => updateDateRange(index, 'startTime', e.target.value)}
                      required
                    />
                    <div className="quick-date-actions">
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setStartNow(index)}>
                        {t('admin.now')}
                      </button>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>{t('admin.endTime')} *</label>
                    <input
                      type="datetime-local"
                      value={range.endTime}
                      onChange={(e) => updateDateRange(index, 'endTime', e.target.value)}
                      required
                    />
                    <div className="quick-date-actions">
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEndNever(index)}>
                        {t('admin.never')}
                      </button>
                    </div>
                  </div>
                </div>
                {formData.dateRanges.length > 1 && (
                  <button type="button" className="btn-icon" onClick={() => removeDateRange(index)} title={t('common.delete')}>
                    🗑️
                  </button>
                )}
              </div>
            ))}
            <button type="button" className="btn btn-secondary btn-sm" onClick={addDateRange}>
              + {t('admin.addTimeRange')}
            </button>
          </div>
        )}

        {formData.scheduleType === 'recurring_weekday' && (
          <div className="multi-entry-wrapper">
            {formData.weekdayRules.map((rule, ruleIndex) => (
              <div key={ruleIndex} className="multi-entry-row">
                <div className="multi-entry-label">{t('admin.ruleLabel', { number: ruleIndex + 1 })}</div>
                <div className="form-group">
                  <label>{t('admin.activeDays')} *</label>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    {WEEKDAY_NAMES.map((day, dayIndex) => (
                      <label key={dayIndex} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={rule.days.includes(dayIndex)}
                          onChange={() => toggleWeekday(ruleIndex, dayIndex)}
                        />
                        {' '}{day}
                      </label>
                    ))}
                  </div>
                  {rule.days.length === 0 && (
                    <small style={{ color: 'red' }}>{t('admin.selectAtLeastOneDay')}</small>
                  )}
                </div>

                <div className="form-row two-columns">
                  <div className="form-group">
                    <label>{t('admin.startHour')} *</label>
                    <input
                      type="time"
                      value={rule.start_hour}
                      onChange={(e) => updateWeekdayRule(ruleIndex, 'start_hour', e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>{t('admin.endHour')} *</label>
                    <input
                      type="time"
                      value={rule.end_hour}
                      onChange={(e) => updateWeekdayRule(ruleIndex, 'end_hour', e.target.value)}
                      required
                    />
                  </div>
                </div>

                {formData.weekdayRules.length > 1 && (
                  <button type="button" className="btn-icon" onClick={() => removeWeekdayRule(ruleIndex)} title={t('common.delete')}>
                    🗑️
                  </button>
                )}
              </div>
            ))}
            <button type="button" className="btn btn-secondary btn-sm" onClick={addWeekdayRule}>
              + {t('admin.addWeekdayRule')}
            </button>
          </div>
        )}

        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn btn-primary" disabled={formData.questionnaireIds.length === 0}>
            {entity ? t('common.update') : t('common.create')}
          </button>
        </div>
      </form>
    </>
  );
}

export default function AdminSchedules() {
  const { t } = useTranslation();
  const [schedules, setSchedules] = useState([]);
  const [locations, setLocations] = useState([]);
  const [locationGroups, setLocationGroups] = useState([]);
  const [questionnaires, setQuestionnaires] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingEntity, setEditingEntity] = useState(null);

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
        api.adminRequest('/questionnaires?includeArchived=true'),
      ]);

      setSchedules(schedulesData || []);
      setLocations(locationsData || []);
      setLocationGroups(locationGroupsData || []);
      setQuestionnaires(questionnairesData || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (schedule) => {
    setEditingEntity(schedule);
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

  const handleFormSave = () => {
    setShowForm(false);
    setEditingEntity(null);
    loadData();
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingEntity(null);
  };

  const isActive = (schedule) => {
    if (schedule.schedule_type === 'recurring_weekday') {
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
            <ScheduleForm
              entity={editingEntity}
              locations={locations}
              locationGroups={locationGroups}
              questionnaires={questionnaires}
              onSave={handleFormSave}
              onCancel={handleFormCancel}
            />
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
                          {schedule.weekday_pattern.days?.map(d => WEEKDAY_NAMES[d].substring(0, 3)).join(', ')}
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

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import './ColumnView.css';

export default function ColumnView() {
  const { t, i18n } = useTranslation();
  const [locations, setLocations] = useState([]);
  const [questionnaires, setQuestionnaires] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [selectedQuestionnaire, setSelectedQuestionnaire] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [draggedItem, setDraggedItem] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [locationsData, questionnairesData, schedulesData] = await Promise.all([
        api.getLocations(),
        api.getQuestionnaires(),
        api.getSchedules()
      ]);
      setLocations(locationsData);
      setQuestionnaires(questionnairesData.filter(q => !q.archived));
      setSchedules(schedulesData);
    } catch (err) {
      setError('Failed to load data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDragStart = (e, item, type) => {
    setDraggedItem({ item, type });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDropOnLocation = async (e, targetLocation) => {
    e.preventDefault();
    if (!draggedItem || draggedItem.type !== 'questionnaire') return;

    try {
      // Create a new schedule linking questionnaire to location
      const newSchedule = {
        destinationType: 'location',
        locationId: targetLocation.id,
        questionnaireIds: [draggedItem.item.id],
        scheduleType: 'date_based',
        dateRanges: [{
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
        }],
        showOnlyOne: false
      };
      
      await api.createSchedule(newSchedule);
      await loadData();
      setDraggedItem(null);
    } catch (err) {
      console.error('Failed to create schedule:', err);
      alert('Failed to create schedule');
    }
  };

  const handleToggleLocationActive = async (location) => {
    try {
      await api.updateLocation(location.id, {
        ...location,
        active: !location.active
      });
      await loadData();
    } catch (err) {
      console.error('Failed to update location:', err);
    }
  };

  const getSchedulesForLocation = (locationId) => {
    return schedules.filter(s => 
      s.destination_type === 'location' && s.location_id === locationId
    );
  };

  const getSchedulesForQuestionnaire = (questionnaireId) => {
    return schedules.filter(s => 
      s.questionnaires && s.questionnaires.some(q => q.id === questionnaireId)
    );
  };

  const deleteSchedule = async (scheduleId) => {
    if (!confirm(t('admin.confirmDeleteSchedule'))) return;
    
    try {
      await api.deleteSchedule(scheduleId);
      await loadData();
    } catch (err) {
      console.error('Failed to delete schedule:', err);
      alert('Failed to delete schedule');
    }
  };

  if (loading) {
    return <div className="column-view-loading">Loading...</div>;
  }

  if (error) {
    return <div className="column-view-error">{error}</div>;
  }

  return (
    <div className="column-view">
      <div className="column-view-header">
        <h2>{t('admin.columnView')}</h2>
        <p className="column-view-subtitle">
          {t('admin.columnViewInstructions')}
        </p>
      </div>

      <div className="column-view-container">
        {/* Column 1: Locations */}
        <div className="column">
          <div className="column-header">
            <h3>{t('admin.locations')}</h3>
            <span className="column-count">{locations.length}</span>
          </div>
          <div className="column-content">
            {locations.map(location => (
              <div
                key={location.id}
                className={`column-item ${selectedLocation?.id === location.id ? 'selected' : ''} ${!location.active ? 'inactive' : ''}`}
                onClick={() => setSelectedLocation(location)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDropOnLocation(e, location)}
              >
                <div className="column-item-header">
                  <span className="column-item-title">{location.name}</span>
                  <button
                    className={`toggle-btn ${location.active ? 'active' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleLocationActive(location);
                    }}
                    title={location.active ? 'Active' : 'Inactive'}
                  >
                    {location.active ? '●' : '○'}
                  </button>
                </div>
                <div className="column-item-meta">
                  {location.slug}
                  {location.group_name && (
                    <span className="column-item-tag">{location.group_name}</span>
                  )}
                </div>
                {getSchedulesForLocation(location.id).length > 0 && (
                  <div className="column-item-badge">
                    {t('admin.schedulesCount', { count: getSchedulesForLocation(location.id).length })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Column 2: Questionnaires */}
        <div className="column">
          <div className="column-header">
            <h3>{t('admin.questionnaires')}</h3>
            <span className="column-count">{questionnaires.length}</span>
          </div>
          <div className="column-content">
            {questionnaires.map(questionnaire => (
              <div
                key={questionnaire.id}
                className={`column-item draggable ${selectedQuestionnaire?.id === questionnaire.id ? 'selected' : ''}`}
                draggable
                onDragStart={(e) => handleDragStart(e, questionnaire, 'questionnaire')}
                onDragEnd={() => setDraggedItem(null)}
                onClick={() => setSelectedQuestionnaire(questionnaire)}
              >
                <div className="column-item-header">
                  <span className="column-item-title">{questionnaire.name}</span>
                  <span className="drag-handle">⋮⋮</span>
                </div>
                {questionnaire.description && (
                  <div className="column-item-meta">{questionnaire.description}</div>
                )}
                {getSchedulesForQuestionnaire(questionnaire.id).length > 0 && (
                  <div className="column-item-badge">
                    {t('admin.schedulesCount', { count: getSchedulesForQuestionnaire(questionnaire.id).length })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Column 3: Schedules */}
        <div className="column">
          <div className="column-header">
            <h3>{t('admin.schedules')}</h3>
            <span className="column-count">{schedules.length}</span>
          </div>
          <div className="column-content">
            {selectedLocation && (
              <div className="column-filter-info">
                {t('admin.schedulesFor')}: <strong>{selectedLocation.name}</strong>
              </div>
            )}
            {selectedQuestionnaire && !selectedLocation && (
              <div className="column-filter-info">
                {t('admin.schedulesFor')}: <strong>{selectedQuestionnaire.name}</strong>
              </div>
            )}
            
            {(() => {
              let filteredSchedules = schedules;
              if (selectedLocation) {
                filteredSchedules = getSchedulesForLocation(selectedLocation.id);
              } else if (selectedQuestionnaire) {
                filteredSchedules = getSchedulesForQuestionnaire(selectedQuestionnaire.id);
              }

              if (filteredSchedules.length === 0) {
                return (
                  <div className="column-empty">
                    {selectedLocation || selectedQuestionnaire
                      ? t('admin.noSchedulesYetDrag')
                      : t('admin.selectToViewSchedules')}
                  </div>
                );
              }

              return filteredSchedules.map(schedule => (
                <div key={schedule.id} className="column-item schedule-item">
                  <div className="column-item-header">
                    <span className="column-item-title">
                      {schedule.destination_type === 'location' 
                        ? locations.find(l => l.id === schedule.location_id)?.name
                        : schedule.group_name}
                    </span>
                    <button
                      className="delete-btn"
                      onClick={() => deleteSchedule(schedule.id)}
                      title="Delete schedule"
                    >
                      ×
                    </button>
                  </div>
                  <div className="column-item-meta">
                    {schedule.schedule_type === 'date_based' && schedule.date_ranges?.[0] && (
                      <>
                        {new Date(schedule.date_ranges[0].start_date).toLocaleDateString(i18n.language)} - 
                        {new Date(schedule.date_ranges[0].end_date).toLocaleDateString(i18n.language)}
                      </>
                    )}
                    {schedule.schedule_type === 'recurring_weekday' && ` ${t('admin.recurring')}`}
                  </div>
                  {schedule.questionnaires && (
                    <div className="schedule-questionnaires">
                      {schedule.questionnaires.map(q => (
                        <span key={q.id} className="column-item-tag">{q.name}</span>
                      ))}
                    </div>
                  )}
                </div>
              ));
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}

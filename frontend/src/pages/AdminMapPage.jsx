import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { AnswerScaleForm } from '../components/AdminAnswerScales';
import { WordCloudOptionsForm } from '../components/AdminWordCloudOptions';
import { QuestionForm } from '../components/AdminQuestions';
import { QuestionnaireForm } from '../components/AdminQuestionnaires';
import { ScheduleForm } from '../components/AdminSchedules';
import { LocationForm } from '../components/AdminLocations';
import { LocationGroupForm } from '../components/AdminLocationGroups';
import '../components/AdminCrud.css';
import './AdminMapPage.css';

// ─── Constants ───────────────────────────────────────────────────────────────

const LONG_PRESS_DURATION = 2000;

const COLUMNS = [
  { index: 0, label: 'Scales & Word Clouds', icon: '📊' },
  { index: 1, label: 'Questions', icon: '❓' },
  { index: 2, label: 'Questionnaires', icon: '📋' },
  { index: 3, label: 'Schedules', icon: '📅' },
  { index: 4, label: 'Location Groups', icon: '🏢' },
  { index: 5, label: 'Locations', icon: '📍' },
];

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function getQuestionIcon(type) {
  switch (type) {
    case 'scale': return '📊';
    case 'text': return '📝';
    case 'wordcloud': return '☁️';
    case 'continuous_scale': return '📡';
    default: return '❓';
  }
}

function getColumnEntities(colIndex, scales, wordClouds, questions, questionnaires, schedules, locationGroups, locations) {
  switch (colIndex) {
    case 0:
      return [
        ...scales.map(s => ({ type: 'scale', id: s.id, label: s.name, icon: '📊' })),
        ...wordClouds.map(w => ({ type: 'wordcloud', id: w.id, label: w.name, icon: '☁️' })),
      ];
    case 1:
      return questions.map(q => ({
        type: 'question', id: q.id,
        label: q.text.length > 45 ? q.text.slice(0, 45) + '…' : q.text,
        icon: getQuestionIcon(q.type),
      }));
    case 2:
      return questionnaires.map(q => ({ type: 'questionnaire', id: q.id, label: q.name, icon: '📋' }));
    case 3:
      return schedules.map(s => {
        const firstTarget = (s.locationTargets || [])[0];
        const label = firstTarget
          ? (firstTarget.location_name || firstTarget.location_group_name || `Schedule #${s.id}`)
          : `Schedule #${s.id}`;
        return { type: 'schedule', id: s.id, label, icon: s.schedule_type === 'recurring_weekday' ? '🔄' : '📅' };
      });
    case 4: {
      const groups = locationGroups.map(g => ({ type: 'locationgroup', id: g.id, label: g.name, icon: '🏢' }));
      const directLocIds = new Set();
      for (const s of schedules) {
        for (const lt of (s.locationTargets || [])) {
          if (lt.location_id) directLocIds.add(lt.location_id);
        }
      }
      const directLocs = locations
        .filter(l => directLocIds.has(l.id))
        .map(l => ({ type: 'directlocation', id: l.id, label: l.name, icon: '📍' }));
      return [...groups, ...directLocs];
    }
    case 5:
      return locations.map(l => ({ type: 'location', id: l.id, label: l.name, icon: '📍' }));
    default:
      return [];
  }
}

function computeConnections(scales, wordClouds, questions, questionnaires, schedules, locationGroups, locations) {
  const conns = [];

  // Col 0 → Col 1
  for (const q of questions) {
    if (q.answer_scale_id) {
      conns.push({ id: `sc-${q.answer_scale_id}-q-${q.id}`, fromType: 'scale', fromId: q.answer_scale_id, fromCol: 0, toType: 'question', toId: q.id, toCol: 1 });
    }
    if (q.word_cloud_options_id) {
      conns.push({ id: `wc-${q.word_cloud_options_id}-q-${q.id}`, fromType: 'wordcloud', fromId: q.word_cloud_options_id, fromCol: 0, toType: 'question', toId: q.id, toCol: 1 });
    }
  }

  // Col 1 → Col 2
  for (const qnr of questionnaires) {
    for (const qId of (qnr.questionIds || [])) {
      conns.push({ id: `q-${qId}-qnr-${qnr.id}`, fromType: 'question', fromId: qId, fromCol: 1, toType: 'questionnaire', toId: qnr.id, toCol: 2 });
    }
  }

  // Col 2 → Col 3
  for (const sched of schedules) {
    for (const qnr of (sched.questionnaires || [])) {
      conns.push({ id: `qnr-${qnr.id}-sched-${sched.id}`, fromType: 'questionnaire', fromId: qnr.id, fromCol: 2, toType: 'schedule', toId: sched.id, toCol: 3 });
    }
    if (!sched.questionnaires?.length && sched.questionnaire_id) {
      conns.push({ id: `qnr-${sched.questionnaire_id}-sched-${sched.id}`, fromType: 'questionnaire', fromId: sched.questionnaire_id, fromCol: 2, toType: 'schedule', toId: sched.id, toCol: 3 });
    }
  }

  // Col 3 → Col 4
  for (const sched of schedules) {
    for (const lt of (sched.locationTargets || [])) {
      if (lt.location_group_id) {
        conns.push({ id: `sched-${sched.id}-lg-${lt.location_group_id}`, fromType: 'schedule', fromId: sched.id, fromCol: 3, toType: 'locationgroup', toId: lt.location_group_id, toCol: 4 });
      } else if (lt.location_id) {
        conns.push({ id: `sched-${sched.id}-dloc-${lt.location_id}`, fromType: 'schedule', fromId: sched.id, fromCol: 3, toType: 'directlocation', toId: lt.location_id, toCol: 4 });
      }
    }
  }

  // Col 4 → Col 5
  for (const loc of locations) {
    if (loc.group_id) {
      conns.push({ id: `lg-${loc.group_id}-loc-${loc.id}`, fromType: 'locationgroup', fromId: loc.group_id, fromCol: 4, toType: 'location', toId: loc.id, toCol: 5 });
    }
  }

  return conns;
}

function bezierPath(x1, y1, x2, y2) {
  const cx = (x2 - x1) * 0.5;
  return `M ${x1} ${y1} C ${x1 + cx} ${y1}, ${x2 - cx} ${y2}, ${x2} ${y2}`;
}

function getAnchorPoint(key, side, cardRefs, containerEl) {
  const el = cardRefs.current[key];
  if (!el || !containerEl) return null;
  const cardRect = el.getBoundingClientRect();
  const contRect = containerEl.getBoundingClientRect();
  return {
    x: (side === 'right' ? cardRect.right : cardRect.left) - contRect.left + containerEl.scrollLeft,
    y: (cardRect.top - contRect.top + containerEl.scrollTop) + cardRect.height / 2,
  };
}

function getConnectedKeys(selectedId, connections) {
  if (!selectedId) return null;
  const selfKey = `${selectedId.type}-${selectedId.id}`;
  const connected = new Set([selfKey]);
  for (const conn of connections) {
    const fromKey = `${conn.fromType}-${conn.fromId}`;
    const toKey = `${conn.toType}-${conn.toId}`;
    if (fromKey === selfKey) connected.add(toKey);
    if (toKey === selfKey) connected.add(fromKey);
  }
  return connected;
}

// ─── EntityCard ──────────────────────────────────────────────────────────────

function EntityCard({ entity, colIndex, cardRefs, dragState, selectedId, connectedKeys, onCardClick, onLongPress, onDragStart, onDrop }) {
  const cardKey = `${entity.type}-${entity.id}`;
  const [longPressProgress, setLongPressProgress] = useState(0);
  const pressTimerRef = useRef(null);
  const pressStartRef = useRef(null);

  const isSelected = selectedId && selectedId.type === entity.type && selectedId.id === entity.id;
  const isDimmed = connectedKeys && !connectedKeys.has(cardKey);
  const isDropTarget = dragState && dragState.fromColIndex + 1 === colIndex;

  const handlePressStart = (e) => {
    if (e.target.classList.contains('map-card-anchor')) return;
    pressStartRef.current = Date.now();
    pressTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - pressStartRef.current;
      const progress = Math.min((elapsed / LONG_PRESS_DURATION) * 100, 100);
      setLongPressProgress(progress);
      if (elapsed >= LONG_PRESS_DURATION) {
        clearInterval(pressTimerRef.current);
        pressTimerRef.current = null;
        setLongPressProgress(0);
        onLongPress(entity);
      }
    }, 30);
  };

  const handlePressEnd = (e) => {
    if (pressTimerRef.current) {
      clearInterval(pressTimerRef.current);
      pressTimerRef.current = null;
    }
    const elapsed = pressStartRef.current ? Date.now() - pressStartRef.current : 0;
    pressStartRef.current = null;
    if (longPressProgress < 100 && elapsed < LONG_PRESS_DURATION) {
      setLongPressProgress(0);
      onCardClick(entity);
    } else {
      setLongPressProgress(0);
    }
  };

  useEffect(() => {
    return () => { if (pressTimerRef.current) clearInterval(pressTimerRef.current); };
  }, []);

  return (
    <div
      ref={el => {
        if (el) cardRefs.current[cardKey] = el;
        else delete cardRefs.current[cardKey];
      }}
      className={`map-card${isSelected ? ' highlighted' : ''}${isDimmed ? ' dimmed' : ''}${longPressProgress > 0 ? ' long-pressing' : ''}`}
      onMouseDown={handlePressStart}
      onMouseUp={handlePressEnd}
      onMouseLeave={handlePressEnd}
      onTouchStart={(e) => { e.preventDefault(); handlePressStart(e); }}
      onTouchEnd={(e) => { e.preventDefault(); handlePressEnd(e); }}
      onTouchCancel={handlePressEnd}
    >
      {/* Left anchor (drop target) */}
      {colIndex > 0 && (
        <div
          className={`map-card-anchor left${isDropTarget ? ' drop-target' : ''}`}
          onMouseUp={(e) => {
            e.stopPropagation();
            if (dragState && dragState.fromColIndex + 1 === colIndex) {
              onDrop(dragState.fromType, dragState.fromId, entity.type, entity.id);
            }
          }}
          onTouchEnd={(e) => {
            e.stopPropagation();
            if (dragState && dragState.fromColIndex + 1 === colIndex) {
              onDrop(dragState.fromType, dragState.fromId, entity.type, entity.id);
            }
          }}
        />
      )}

      <span className="card-icon">{entity.icon}</span>
      <span className="card-label">{entity.label}</span>

      {/* Long-press progress bar */}
      {longPressProgress > 0 && (
        <div className="card-long-press-bar">
          <div className="card-long-press-fill" style={{ width: `${longPressProgress}%` }} />
        </div>
      )}

      {/* Right anchor (drag source) */}
      {colIndex < COLUMNS.length - 1 && (
        <div
          className="map-card-anchor right"
          onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); onDragStart(entity, colIndex, e); }}
          onTouchStart={(e) => { e.stopPropagation(); e.preventDefault(); onDragStart(entity, colIndex, e.touches[0]); }}
        />
      )}
    </div>
  );
}

// ─── AdminMapPage ─────────────────────────────────────────────────────────────

export default function AdminMapPage() {
  const navigate = useNavigate();

  // Auth check
  useEffect(() => {
    if (!localStorage.getItem('adminToken')) navigate('/admin');
  }, []);

  // ── Data state ──
  const [scales, setScales] = useState([]);
  const [wordClouds, setWordClouds] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [questionnaires, setQuestionnaires] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [locationGroups, setLocationGroups] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState(null);

  // ── Interaction state ──
  const [selectedId, setSelectedId] = useState(null);
  const [dragState, setDragState] = useState(null);
  const [editModal, setEditModal] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [mobilePair, setMobilePair] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  // ── SVG ──
  const scrollContainerRef = useRef(null);
  const cardRefs = useRef({});
  const [svgDims, setSvgDims] = useState({ width: 0, height: 0 });
  const [, forceRender] = useState(0); // trigger re-render for line positions

  // Mobile detection
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    setIsMobile(mq.matches);
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Load all data
  const loadData = async () => {
    setLoading(true);
    setDataError(null);
    try {
      const [scalesData, wordCloudData, questionsData, qnrListData, schedulesData, lgData, locsData] = await Promise.all([
        api.adminRequest('/answer-scales'),
        api.adminRequest('/word-cloud-options'),
        api.adminRequest('/questions'),
        api.adminRequest('/questionnaires'),
        api.adminRequest('/schedules'),
        api.adminRequest('/location-groups'),
        api.adminRequest('/locations'),
      ]);

      // Enrich questionnaires with question IDs
      const enriched = await Promise.all(
        qnrListData.map(q => api.adminRequest(`/questionnaires/${q.id}`))
      );
      const withQIds = enriched.map(q => ({
        ...q,
        questionIds: (q.questions || []).map(e => e.question_id),
      }));

      setScales(scalesData || []);
      setWordClouds(wordCloudData || []);
      setQuestions(questionsData || []);
      setQuestionnaires(withQIds);
      setSchedules(schedulesData || []);
      setLocationGroups(lgData || []);
      setLocations(locsData || []);
    } catch (err) {
      setDataError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // SVG resize observer
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const update = () => {
      setSvgDims({ width: el.scrollWidth, height: el.scrollHeight });
      forceRender(n => n + 1);
    };
    update();

    const ro = new ResizeObserver(update);
    ro.observe(el);
    el.addEventListener('scroll', update);

    return () => {
      ro.disconnect();
      el.removeEventListener('scroll', update);
    };
  }, [loading]);

  // Drag tracking
  useEffect(() => {
    if (!dragState) return;

    const handleMove = (e) => {
      const pointer = e.touches ? e.touches[0] : e;
      const el = scrollContainerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setDragState(prev => ({
        ...prev,
        currentX: pointer.clientX - rect.left + el.scrollLeft,
        currentY: pointer.clientY - rect.top + el.scrollTop,
      }));
    };

    const handleUp = () => setDragState(null);

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleUp);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleUp);
    };
  }, [!!dragState]);

  // ── Event handlers ──

  const handleCardClick = (entity) => {
    setSelectedId(prev =>
      prev && prev.type === entity.type && prev.id === entity.id ? null : { type: entity.type, id: entity.id }
    );
  };

  const handleLongPress = (cardEntity) => {
    const entity = getFullEntity(cardEntity.type, cardEntity.id);
    setEditModal({ type: cardEntity.type, entity });
  };

  const getFullEntity = (type, id) => {
    switch (type) {
      case 'scale': return scales.find(s => s.id === id);
      case 'wordcloud': return wordClouds.find(w => w.id === id);
      case 'question': return questions.find(q => q.id === id);
      case 'questionnaire': return questionnaires.find(q => q.id === id);
      case 'schedule': return schedules.find(s => s.id === id);
      case 'locationgroup': return locationGroups.find(g => g.id === id);
      case 'directlocation':
      case 'location': return locations.find(l => l.id === id);
      default: return null;
    }
  };

  const handleDragStart = (entity, colIndex, pointerEvent) => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setDragState({
      fromType: entity.type,
      fromId: entity.id,
      fromColIndex: colIndex,
      currentX: pointerEvent.clientX - rect.left + el.scrollLeft,
      currentY: pointerEvent.clientY - rect.top + el.scrollTop,
    });
  };

  const handleDrop = async (fromType, fromId, toType, toId) => {
    setDragState(null);
    await createLink(fromType, fromId, toType, toId);
  };

  const createLink = async (fromType, fromId, toType, toId) => {
    try {
      if (fromType === 'scale' && toType === 'question') {
        const q = questions.find(x => x.id === toId);
        await api.adminRequest(`/questions/${toId}`, {
          method: 'PUT',
          body: JSON.stringify({ text: q.text, type: q.type, answerScaleId: fromId, wordCloudOptionsId: q.word_cloud_options_id || null, maxSelections: q.max_selections || 3, continuousAxes: q.continuous_axes || [] }),
        });
      } else if (fromType === 'wordcloud' && toType === 'question') {
        const q = questions.find(x => x.id === toId);
        await api.adminRequest(`/questions/${toId}`, {
          method: 'PUT',
          body: JSON.stringify({ text: q.text, type: q.type, answerScaleId: q.answer_scale_id || null, wordCloudOptionsId: fromId, maxSelections: q.max_selections || 3, continuousAxes: q.continuous_axes || [] }),
        });
      } else if (fromType === 'question' && toType === 'questionnaire') {
        const details = await api.adminRequest(`/questionnaires/${toId}`);
        const existing = (details.questions || []).map((q, i) => ({ questionId: q.question_id, pageNumber: q.page_number || 1, orderIndex: q.order_index ?? i }));
        if (!existing.some(e => e.questionId === fromId)) {
          await api.adminRequest(`/questionnaires/${toId}`, {
            method: 'PUT',
            body: JSON.stringify({ name: details.name, description: details.description || '', questions: [...existing, { questionId: fromId, pageNumber: 1, orderIndex: existing.length }] }),
          });
        }
      } else if (fromType === 'questionnaire' && toType === 'schedule') {
        const sched = schedules.find(s => s.id === toId);
        const existing = (sched.questionnaires || []).map(q => q.id.toString());
        if (!existing.includes(fromId.toString())) {
          const locTargets = (sched.locationTargets || []).map(lt => lt.location_id ? { locationId: lt.location_id } : { locationGroupId: lt.location_group_id });
          await api.adminRequest(`/schedules/${toId}`, {
            method: 'PUT',
            body: JSON.stringify({ locationTargets: locTargets, questionnaireIds: [...existing, fromId.toString()], scheduleType: sched.schedule_type, showOnlyOne: sched.show_only_one || false, ...(sched.schedule_type === 'date_based' ? { startTime: sched.start_time, endTime: sched.end_time } : { weekdayPattern: sched.weekday_pattern }) }),
          });
        }
      } else if (fromType === 'schedule' && toType === 'locationgroup') {
        const sched = schedules.find(s => s.id === fromId);
        const qIds = (sched.questionnaires || []).map(q => q.id.toString());
        const existing = (sched.locationTargets || []).map(lt => lt.location_id ? { locationId: lt.location_id } : { locationGroupId: lt.location_group_id });
        if (!existing.some(t => t.locationGroupId === toId)) {
          await api.adminRequest(`/schedules/${fromId}`, {
            method: 'PUT',
            body: JSON.stringify({ locationTargets: [...existing, { locationGroupId: toId }], questionnaireIds: qIds, scheduleType: sched.schedule_type, showOnlyOne: sched.show_only_one || false, ...(sched.schedule_type === 'date_based' ? { startTime: sched.start_time, endTime: sched.end_time } : { weekdayPattern: sched.weekday_pattern }) }),
          });
        }
      } else if (fromType === 'schedule' && toType === 'directlocation') {
        const sched = schedules.find(s => s.id === fromId);
        const qIds = (sched.questionnaires || []).map(q => q.id.toString());
        const existing = (sched.locationTargets || []).map(lt => lt.location_id ? { locationId: lt.location_id } : { locationGroupId: lt.location_group_id });
        if (!existing.some(t => t.locationId === toId)) {
          await api.adminRequest(`/schedules/${fromId}`, {
            method: 'PUT',
            body: JSON.stringify({ locationTargets: [...existing, { locationId: toId }], questionnaireIds: qIds, scheduleType: sched.schedule_type, showOnlyOne: sched.show_only_one || false, ...(sched.schedule_type === 'date_based' ? { startTime: sched.start_time, endTime: sched.end_time } : { weekdayPattern: sched.weekday_pattern }) }),
          });
        }
      } else if (fromType === 'locationgroup' && toType === 'location') {
        const loc = locations.find(l => l.id === toId);
        await api.adminRequest(`/locations/${toId}`, {
          method: 'PUT',
          body: JSON.stringify({ slug: loc.slug, name: loc.name, active: loc.active, groupId: fromId, passwordRequired: loc.password_required || false, password: '' }),
        });
      }
      await loadData();
    } catch (err) {
      setDataError(err.message);
    }
  };

  const removeLink = async (conn) => {
    const { fromType, fromId, toType, toId } = conn;
    try {
      if (fromType === 'scale' && toType === 'question') {
        const q = questions.find(x => x.id === toId);
        await api.adminRequest(`/questions/${toId}`, { method: 'PUT', body: JSON.stringify({ text: q.text, type: q.type, answerScaleId: null, wordCloudOptionsId: q.word_cloud_options_id || null, maxSelections: q.max_selections || 3, continuousAxes: q.continuous_axes || [] }) });
      } else if (fromType === 'wordcloud' && toType === 'question') {
        const q = questions.find(x => x.id === toId);
        await api.adminRequest(`/questions/${toId}`, { method: 'PUT', body: JSON.stringify({ text: q.text, type: q.type, answerScaleId: q.answer_scale_id || null, wordCloudOptionsId: null, maxSelections: q.max_selections || 3, continuousAxes: q.continuous_axes || [] }) });
      } else if (fromType === 'question' && toType === 'questionnaire') {
        const details = await api.adminRequest(`/questionnaires/${toId}`);
        const remaining = (details.questions || []).filter(q => q.question_id !== fromId).map((q, i) => ({ questionId: q.question_id, pageNumber: q.page_number || 1, orderIndex: i }));
        await api.adminRequest(`/questionnaires/${toId}`, { method: 'PUT', body: JSON.stringify({ name: details.name, description: details.description || '', questions: remaining }) });
      } else if (fromType === 'questionnaire' && toType === 'schedule') {
        const sched = schedules.find(s => s.id === toId);
        const remaining = (sched.questionnaires || []).filter(q => q.id !== fromId).map(q => q.id.toString());
        const locTargets = (sched.locationTargets || []).map(lt => lt.location_id ? { locationId: lt.location_id } : { locationGroupId: lt.location_group_id });
        await api.adminRequest(`/schedules/${toId}`, { method: 'PUT', body: JSON.stringify({ locationTargets: locTargets, questionnaireIds: remaining, scheduleType: sched.schedule_type, showOnlyOne: sched.show_only_one || false, ...(sched.schedule_type === 'date_based' ? { startTime: sched.start_time, endTime: sched.end_time } : { weekdayPattern: sched.weekday_pattern }) }) });
      } else if (fromType === 'schedule' && (toType === 'locationgroup' || toType === 'directlocation')) {
        const sched = schedules.find(s => s.id === fromId);
        const qIds = (sched.questionnaires || []).map(q => q.id.toString());
        const remaining = (sched.locationTargets || [])
          .filter(lt => toType === 'locationgroup' ? lt.location_group_id !== toId : lt.location_id !== toId)
          .map(lt => lt.location_id ? { locationId: lt.location_id } : { locationGroupId: lt.location_group_id });
        await api.adminRequest(`/schedules/${fromId}`, {
          method: 'PUT',
          body: JSON.stringify({ locationTargets: remaining, questionnaireIds: qIds, scheduleType: sched.schedule_type, showOnlyOne: sched.show_only_one || false, ...(sched.schedule_type === 'date_based' ? { startTime: sched.start_time, endTime: sched.end_time } : { weekdayPattern: sched.weekday_pattern }) }),
        });
      } else if (fromType === 'locationgroup' && toType === 'location') {
        const loc = locations.find(l => l.id === toId);
        await api.adminRequest(`/locations/${toId}`, { method: 'PUT', body: JSON.stringify({ slug: loc.slug, name: loc.name, active: loc.active, groupId: null, passwordRequired: loc.password_required || false, password: '' }) });
      }
      setDeleteConfirm(null);
      await loadData();
    } catch (err) {
      setDataError(err.message);
    }
  };

  const handleLineClick = (conn, e) => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setDeleteConfirm({
      conn,
      x: e.clientX - rect.left + el.scrollLeft,
      y: e.clientY - rect.top + el.scrollTop,
    });
  };

  const handleEditSave = async () => {
    setEditModal(null);
    await loadData();
  };

  // ── Derived ──
  const connections = computeConnections(scales, wordClouds, questions, questionnaires, schedules, locationGroups, locations);
  const connectedKeys = getConnectedKeys(selectedId, connections);

  // ── SVG lines rendering ──
  const renderLines = () => {
    if (!scrollContainerRef.current) return null;
    const el = scrollContainerRef.current;
    const lines = [];

    for (const conn of connections) {
      const fromKey = `${conn.fromType}-${conn.fromId}`;
      const toKey = `${conn.toType}-${conn.toId}`;
      const from = getAnchorPoint(fromKey, 'right', cardRefs, el);
      const to = getAnchorPoint(toKey, 'left', cardRefs, el);
      if (!from || !to) continue;

      const isHighlighted = connectedKeys && (connectedKeys.has(fromKey) && connectedKeys.has(toKey));
      const isDimmed = connectedKeys && !isHighlighted;
      const d = bezierPath(from.x, from.y, to.x, to.y);

      lines.push(
        <g key={conn.id}>
          {/* Hit area */}
          <path d={d} stroke="transparent" strokeWidth={14} fill="none" style={{ pointerEvents: 'stroke', cursor: 'pointer' }} onClick={(e) => handleLineClick(conn, e)} />
          {/* Visible line */}
          <path d={d} stroke={isHighlighted ? '#667eea' : '#c0cbe0'} strokeWidth={isHighlighted ? 2.5 : 1.5} fill="none" opacity={isDimmed ? 0.15 : 1} style={{ pointerEvents: 'none' }} />
        </g>
      );
    }

    // Drag preview line
    if (dragState) {
      const fromKey = `${dragState.fromType}-${dragState.fromId}`;
      const from = getAnchorPoint(fromKey, 'right', cardRefs, el);
      if (from) {
        lines.push(
          <path key="drag-preview" d={bezierPath(from.x, from.y, dragState.currentX, dragState.currentY)} stroke="#667eea" strokeWidth={2} strokeDasharray="6,4" fill="none" style={{ pointerEvents: 'none' }} />
        );
      }
    }

    return lines;
  };

  // ── Render ──
  if (loading) {
    return (
      <div className="admin-map-page">
        <div className="map-page-header">
          <button className="btn btn-secondary" onClick={() => navigate('/admin')}>← Back to Admin</button>
          <h1>Visual Map</h1>
        </div>
        <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>Loading data…</div>
      </div>
    );
  }

  return (
    <div className="admin-map-page" onClick={() => { setSelectedId(null); setDeleteConfirm(null); }}>
      <div className="map-page-header" onClick={e => e.stopPropagation()}>
        <button className="btn btn-secondary" onClick={() => navigate('/admin')}>← Back</button>
        <h1>Visual Map</h1>
        {dataError && <span className="map-error">{dataError}</span>}
        <button className="btn btn-secondary" onClick={loadData} style={{ marginLeft: 'auto' }}>↺ Refresh</button>
      </div>

      <div
        className="map-canvas-scroll"
        ref={scrollContainerRef}
        onClick={e => e.stopPropagation()}
      >
        <div className="map-columns-container">
          {COLUMNS.map((col) => {
            const entities = getColumnEntities(col.index, scales, wordClouds, questions, questionnaires, schedules, locationGroups, locations);
            const hidden = isMobile && (col.index < mobilePair || col.index > mobilePair + 1);

            return (
              <div
                key={col.index}
                className="map-column"
                style={hidden ? { display: 'none' } : undefined}
              >
                <div className="map-column-header">{col.icon} {col.label}</div>
                <div className="map-card-list">
                  {entities.length === 0 && (
                    <div className="map-column-empty">—</div>
                  )}
                  {entities.map(entity => (
                    <EntityCard
                      key={`${entity.type}-${entity.id}`}
                      entity={entity}
                      colIndex={col.index}
                      cardRefs={cardRefs}
                      dragState={dragState}
                      selectedId={selectedId}
                      connectedKeys={connectedKeys}
                      onCardClick={handleCardClick}
                      onLongPress={handleLongPress}
                      onDragStart={handleDragStart}
                      onDrop={handleDrop}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* SVG overlay */}
        <svg
          className="map-svg-overlay"
          width={svgDims.width}
          height={svgDims.height}
          style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
        >
          {renderLines()}
        </svg>

        {/* Delete popover */}
        {deleteConfirm && (
          <div
            className="link-delete-popover"
            style={{ left: deleteConfirm.x, top: deleteConfirm.y }}
            onClick={e => e.stopPropagation()}
          >
            <p>Remove this link?</p>
            <div className="popover-actions">
              <button className="btn btn-secondary btn-sm" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button className="btn btn-danger btn-sm" onClick={() => removeLink(deleteConfirm.conn)}>Remove</button>
            </div>
          </div>
        )}
      </div>

      {/* Mobile navigation */}
      {isMobile && (
        <div className="mobile-col-nav">
          <button className="btn btn-secondary" disabled={mobilePair === 0} onClick={() => setMobilePair(p => p - 1)}>← Prev</button>
          <span className="mobile-col-label">{COLUMNS[mobilePair].label} / {COLUMNS[mobilePair + 1].label}</span>
          <button className="btn btn-secondary" disabled={mobilePair === COLUMNS.length - 2} onClick={() => setMobilePair(p => p + 1)}>Next →</button>
        </div>
      )}

      {/* Edit modal */}
      {editModal && (
        <div className="form-modal" onClick={() => setEditModal(null)}>
          <div className="form-container" onClick={e => e.stopPropagation()} style={{ maxHeight: '85vh', overflowY: 'auto' }}>
            {editModal.type === 'scale' && (
              <AnswerScaleForm entity={editModal.entity} onSave={handleEditSave} onCancel={() => setEditModal(null)} />
            )}
            {editModal.type === 'wordcloud' && (
              <WordCloudOptionsForm entity={editModal.entity} onSave={handleEditSave} onCancel={() => setEditModal(null)} />
            )}
            {editModal.type === 'question' && (
              <QuestionForm entity={editModal.entity} scales={scales} wordClouds={wordClouds} onSave={handleEditSave} onCancel={() => setEditModal(null)} />
            )}
            {editModal.type === 'questionnaire' && (
              <QuestionnaireForm entity={editModal.entity} questions={questions} onSave={handleEditSave} onCancel={() => setEditModal(null)} />
            )}
            {editModal.type === 'schedule' && (
              <ScheduleForm entity={editModal.entity} locations={locations} locationGroups={locationGroups} questionnaires={questionnaires} onSave={handleEditSave} onCancel={() => setEditModal(null)} />
            )}
            {editModal.type === 'locationgroup' && (
              <LocationGroupForm entity={editModal.entity} onSave={handleEditSave} onCancel={() => setEditModal(null)} />
            )}
            {(editModal.type === 'location' || editModal.type === 'directlocation') && (
              <LocationForm entity={editModal.entity} locationGroups={locationGroups} onSave={handleEditSave} onCancel={() => setEditModal(null)} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

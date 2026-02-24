import React from 'react';
import i18n from '../i18n';
import './MultiScaleQuestion.css';

/**
 * Get localized text from a JSONB label object.
 */
function getLabelText(label) {
  if (!label) return '';
  if (typeof label === 'string') return label;
  return label[i18n.language] || label.en || label.fi || label.sv ||
    Object.values(label).find(v => v) || '';
}

/**
 * ScaleButtons — row of clickable buttons.
 */
function ScaleButtons({ scale, value, onChange, showValueLabels, showEndLabels, minLabelOverride, maxLabelOverride }) {
  const buttons = scale.buttons || [];
  const minLabel = getLabelText(minLabelOverride || scale.minLabel);
  const maxLabel = getLabelText(maxLabelOverride || scale.maxLabel);

  return (
    <div className="ms-buttons-wrapper">
      {showEndLabels && (minLabel || maxLabel) && (
        <div className="ms-end-labels">
          <span>{minLabel}</span>
          <span>{maxLabel}</span>
        </div>
      )}
      <div className="ms-buttons">
        {buttons.map((btn) => {
          const btnVal = typeof btn.value === 'number' ? btn.value : Number(btn.value);
          const selected = value === btnVal;
          return (
            <button
              key={btn.value}
              type="button"
              className={`ms-btn ${selected ? 'selected' : ''}`}
              style={{
                backgroundColor: selected ? (btn.color || '#667eea') : undefined,
                borderColor: btn.color || '#667eea',
              }}
              onClick={() => onChange(btnVal)}
              aria-pressed={selected}
            >
              {showValueLabels ? (btn.label || btn.value) : (btn.label || btn.value)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * ScaleSlider — continuous range input.
 */
function ScaleSlider({ scale, value, onChange, showEndLabels, showValueLabels, minLabelOverride, maxLabelOverride }) {
  const buttons = scale.buttons || [];
  const inferredMin = buttons.length > 0 ? Math.min(...buttons.map(b => Number(b.value))) : 1;
  const inferredMax = buttons.length > 0 ? Math.max(...buttons.map(b => Number(b.value))) : 5;
  const sliderMin = scale.minValue !== null && scale.minValue !== undefined
    ? scale.minValue
    : (scale.scaleMode === 'bipolar' ? -inferredMax : inferredMin);
  const sliderMax = scale.maxValue !== null && scale.maxValue !== undefined ? scale.maxValue : inferredMax;
  const defaultVal = scale.scaleMode === 'bipolar' ? 0 : sliderMin;
  const currentValue = value !== null && value !== undefined ? value : null;

  const minLabel = getLabelText(minLabelOverride || scale.minLabel);
  const maxLabel = getLabelText(maxLabelOverride || scale.maxLabel);

  return (
    <div className="ms-slider-wrapper">
      {showEndLabels && (minLabel || maxLabel) && (
        <div className="ms-end-labels">
          <span>{minLabel}</span>
          <span>{maxLabel}</span>
        </div>
      )}
      <input
        type="range"
        className="ms-slider"
        min={sliderMin}
        max={sliderMax}
        step={scale.step}
        value={currentValue !== null ? currentValue : defaultVal}
        onChange={e => onChange(parseFloat(e.target.value))}
      />
      {showValueLabels && (
        <div className="ms-slider-value">
          {currentValue !== null ? currentValue : <span className="no-selection">—</span>}
        </div>
      )}
    </div>
  );
}

/**
 * ScaleLabeledLine — horizontal line with tick marks.
 */
function ScaleLabeledLine({ scale, value, onChange, showValueLabels, showEndLabels, minLabelOverride, maxLabelOverride }) {
  const buttons = scale.buttons || [];
  const minLabel = getLabelText(minLabelOverride || scale.minLabel);
  const maxLabel = getLabelText(maxLabelOverride || scale.maxLabel);

  return (
    <div className="ms-labeled-line-wrapper">
      {showEndLabels && (minLabel || maxLabel) && (
        <div className="ms-end-labels">
          <span>{minLabel}</span>
          <span>{maxLabel}</span>
        </div>
      )}
      <div className="ms-labeled-line">
        {buttons.map((btn) => {
          const btnVal = typeof btn.value === 'number' ? btn.value : Number(btn.value);
          const selected = value === btnVal;
          return (
            <div
              key={btn.value}
              className="ms-tick-wrapper"
              onClick={() => onChange(btnVal)}
            >
              <div className={`ms-tick ${selected ? 'selected' : ''}`}
                style={selected ? { backgroundColor: btn.color || '#667eea' } : undefined}
              />
              {showValueLabels && (
                <span className="ms-tick-label">{btn.label || btn.value}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * ScaleStars — star rating.
 */
function ScaleStars({ scale, value, onChange, showValueLabels, showEndLabels, minLabelOverride, maxLabelOverride }) {
  const buttons = scale.buttons || [];
  const minLabel = getLabelText(minLabelOverride || scale.minLabel);
  const maxLabel = getLabelText(maxLabelOverride || scale.maxLabel);

  return (
    <div className="ms-stars-wrapper">
      {showEndLabels && (minLabel || maxLabel) && (
        <div className="ms-end-labels">
          <span>{minLabel}</span>
          <span>{maxLabel}</span>
        </div>
      )}
      <div className="ms-stars">
        {buttons.map((btn) => {
          const btnVal = typeof btn.value === 'number' ? btn.value : Number(btn.value);
          const filled = value !== null && value !== undefined && btnVal <= value;
          return (
            <button
              key={btn.value}
              type="button"
              className={`ms-star ${filled ? 'filled' : ''}`}
              onClick={() => onChange(btnVal)}
              aria-label={`${btnVal} star${btnVal !== 1 ? 's' : ''}`}
            >
              {filled ? '★' : '☆'}
            </button>
          );
        })}
      </div>
      {showValueLabels && value !== null && value !== undefined && (
        <span className="ms-star-value">{value}</span>
      )}
    </div>
  );
}

/**
 * ScaleThumbs — binary thumbs up/down.
 */
function ScaleThumbs({ scale, value, onChange, showValueLabels, showEndLabels, minLabelOverride, maxLabelOverride }) {
  const buttons = scale.buttons || [];
  const minLabel = getLabelText(minLabelOverride || scale.minLabel);
  const maxLabel = getLabelText(maxLabelOverride || scale.maxLabel);
  const thumbDown = buttons[0];
  const thumbUp = buttons[buttons.length - 1];
  const downVal = thumbDown ? (typeof thumbDown.value === 'number' ? thumbDown.value : Number(thumbDown.value)) : 0;
  const upVal = thumbUp ? (typeof thumbUp.value === 'number' ? thumbUp.value : Number(thumbUp.value)) : 1;

  return (
    <div className="ms-thumbs-wrapper">
      {showEndLabels && (minLabel || maxLabel) && (
        <div className="ms-end-labels">
          <span>{minLabel}</span>
          <span>{maxLabel}</span>
        </div>
      )}
      <div className="ms-thumbs">
        <button
          type="button"
          className={`ms-thumb ms-thumb-down ${value === downVal ? 'selected' : ''}`}
          onClick={() => onChange(downVal)}
          aria-pressed={value === downVal}
        >
          👎
        </button>
        <button
          type="button"
          className={`ms-thumb ms-thumb-up ${value === upVal ? 'selected' : ''}`}
          onClick={() => onChange(upVal)}
          aria-pressed={value === upVal}
        >
          👍
        </button>
      </div>
    </div>
  );
}

/**
 * Resolve which renderer to use for a scale item.
 * Priority: item.displayMode → scale.step-based default
 */
function resolveDisplayMode(item) {
  if (item.displayMode) return item.displayMode;
  if (item.scale && item.scale.step < 1) return 'slider';
  return 'buttons';
}

/**
 * ScaleItemRow — wraps any renderer with item label + layout.
 */
function ScaleItemRow({ item, value, onChange }) {
  const mode = resolveDisplayMode(item);
  const itemLabel = getLabelText(item.label);

  const rendererProps = {
    scale: item.scale,
    value,
    onChange,
    showValueLabels: item.showValueLabels !== false,
    showEndLabels: item.showEndLabels !== false,
    minLabelOverride: item.minLabelOverride,
    maxLabelOverride: item.maxLabelOverride,
  };

  let renderer;
  switch (mode) {
    case 'slider':
      renderer = <ScaleSlider {...rendererProps} />;
      break;
    case 'labeled-line':
      renderer = <ScaleLabeledLine {...rendererProps} />;
      break;
    case 'stars':
      renderer = <ScaleStars {...rendererProps} />;
      break;
    case 'thumbs':
      renderer = <ScaleThumbs {...rendererProps} />;
      break;
    default:
      renderer = <ScaleButtons {...rendererProps} />;
  }

  return (
    <div className="ms-item-row">
      {item.showItemLabel !== false && itemLabel && (
        <div className="ms-item-label">{itemLabel}</div>
      )}
      {renderer}
    </div>
  );
}

/**
 * MultiScaleQuestion — orchestrates layout for a set of scale items.
 */
export default function MultiScaleQuestion({ question, itemAnswers, onItemAnswer }) {
  const { scaleItems, multiScaleLayout } = question;
  const layout = multiScaleLayout || 'stacked';

  if (!scaleItems || scaleItems.length === 0) return null;

  // Check if all items use same scale (for matrix layout)
  const allSameScale = scaleItems.every(item => item.answerScaleId === scaleItems[0].answerScaleId);

  if (layout === 'matrix' && allSameScale) {
    const firstItem = scaleItems[0];
    const buttons = firstItem.scale?.buttons || [];
    const minLabel = getLabelText(firstItem.minLabelOverride || firstItem.scale?.minLabel);
    const maxLabel = getLabelText(firstItem.minLabelOverride || firstItem.scale?.maxLabel);

    return (
      <div className="ms-matrix">
        {/* Column headers */}
        <div className="ms-matrix-header">
          <div className="ms-matrix-row-label" />
          {buttons.map(btn => (
            <div key={btn.value} className="ms-matrix-col-header">
              {btn.label || btn.value}
            </div>
          ))}
        </div>

        {/* Item rows */}
        {scaleItems.map(item => {
          const itemLabel = getLabelText(item.label);
          const value = itemAnswers[item.id] ?? null;
          return (
            <div key={item.id} className="ms-matrix-row">
              <div className="ms-matrix-row-label">{itemLabel}</div>
              {buttons.map(btn => {
                const btnVal = typeof btn.value === 'number' ? btn.value : Number(btn.value);
                const selected = value === btnVal;
                return (
                  <div key={btn.value} className="ms-matrix-cell">
                    <button
                      type="button"
                      className={`ms-matrix-btn ${selected ? 'selected' : ''}`}
                      style={selected ? { backgroundColor: btn.color || '#667eea', borderColor: btn.color || '#667eea' } : { borderColor: btn.color || '#667eea' }}
                      onClick={() => onItemAnswer(item.id, btnVal)}
                      aria-pressed={selected}
                    />
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* End labels row */}
        {(minLabel || maxLabel) && (
          <div className="ms-matrix-footer">
            <div className="ms-matrix-row-label" />
            <span className="ms-matrix-end-label">{minLabel}</span>
            <span className="ms-matrix-end-label-right">{maxLabel}</span>
          </div>
        )}
      </div>
    );
  }

  // Stacked or compact layout
  const isCompact = layout === 'compact';
  return (
    <div className={`ms-stacked ${isCompact ? 'ms-compact' : ''}`}>
      {scaleItems.map(item => (
        <ScaleItemRow
          key={item.id}
          item={item}
          value={itemAnswers[item.id] ?? null}
          onChange={val => onItemAnswer(item.id, val)}
        />
      ))}
    </div>
  );
}

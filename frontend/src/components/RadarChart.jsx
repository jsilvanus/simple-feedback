import React, { useState, useRef, useEffect } from 'react';
import './RadarChart.css';

export default function RadarChart({ question, value, onChange, readOnly = false }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const [dimensions, setDimensions] = useState({ width: 400, height: 400 });

  const scaleButtons = question.answerScale?.buttons || [];
  const axisConfig = Array.isArray(question.continuousAxes) ? question.continuousAxes : [];

  const minFromScale = scaleButtons.length > 0
    ? Math.min(...scaleButtons.map(button => {
        if (typeof button.min === 'number') return button.min;
        return Number(button.value);
      }).filter(value => !Number.isNaN(value)))
    : 0;
  const maxFromScale = scaleButtons.length > 0
    ? Math.max(...scaleButtons.map(button => {
        if (typeof button.max === 'number') return button.max;
        return Number(button.value);
      }).filter(value => !Number.isNaN(value)))
    : 10;

  // Prefer explicit minValue/maxValue from scale config over inference from buttons
  const explicitMin = question.answerScale?.minValue !== null && question.answerScale?.minValue !== undefined
    ? Number(question.answerScale.minValue)
    : null;
  const explicitMax = question.answerScale?.maxValue !== null && question.answerScale?.maxValue !== undefined
    ? Number(question.answerScale.maxValue)
    : null;

  const resolvedMin = Number.isFinite(explicitMin)
    ? explicitMin
    : (Number.isFinite(minFromScale) ? minFromScale : 0);
  const resolvedMax = Number.isFinite(explicitMax)
    ? explicitMax
    : (Number.isFinite(maxFromScale) && maxFromScale > resolvedMin ? maxFromScale : 10);

  const scaleStep = question.answerScale?.step ? Number(question.answerScale.step) : 1;

  const axes = axisConfig.map((axis, index) => ({
    label: axis.label || `Axis ${index + 1}`,
    min: resolvedMin,
    max: resolvedMax,
    value: axis.id || `axis_${index + 1}`,
  }));

  // Initialize values state - each axis can have a separate value
  const [values, setValues] = useState(() => {
    if (value && typeof value === 'object') {
      return value;
    }
    // Initialize all axes to their minimum value
    return axes.reduce((acc, axis) => {
      acc[axis.value] = axis.min;
      return acc;
    }, {});
  });

  const numAxes = axes.length;

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Update parent component when values change
  useEffect(() => {
    if (!readOnly && typeof onChangeRef.current === 'function') {
      onChangeRef.current(values);
    }
  }, [values, readOnly]);

  // Handle responsive sizing
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const width = Math.min(containerRef.current.clientWidth, 600);
        setDimensions({ width, height: width });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Redraw canvas when values or dimensions change
  useEffect(() => {
    drawChart();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, dimensions, numAxes]);

  const drawChart = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const { width, height } = dimensions;
    const centerX = width / 2;
    const centerY = height / 2;
    const maxRadius = Math.min(width, height) * 0.35;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    if (numAxes === 0) {
      // No axes configured
      ctx.fillStyle = '#666';
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No axes configured', centerX, centerY);
      return;
    }

    if (numAxes === 1) {
      // Single axis - draw as a horizontal line with gradient
      drawSingleAxisLine(ctx, centerX, centerY, maxRadius * 2);
    } else if (numAxes === 2) {
      // Two axes - draw as V shape
      drawVShape(ctx, centerX, centerY, maxRadius);
    } else {
      // Three or more axes - draw as radar chart
      drawRadarChart(ctx, centerX, centerY, maxRadius);
    }
  };

  const drawSingleAxisLine = (ctx, centerX, centerY, lineWidth) => {
    const axis = axes[0];
    const lineHeight = 40;
    const startX = centerX - lineWidth / 2;
    const endX = centerX + lineWidth / 2;
    const y = centerY;

    // Draw gradient background line
    const gradient = ctx.createLinearGradient(startX, y, endX, y);
    gradient.addColorStop(0, '#ff4444');
    gradient.addColorStop(0.5, '#ffcc00');
    gradient.addColorStop(1, '#44ff44');

    ctx.fillStyle = gradient;
    ctx.fillRect(startX, y - lineHeight / 2, lineWidth, lineHeight);

    // Draw scale marks
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    const numMarks = Math.min(axis.max - axis.min + 1, 11);
    for (let i = 0; i < numMarks; i++) {
      const x = startX + (lineWidth * i) / (numMarks - 1);
      ctx.beginPath();
      ctx.moveTo(x, y - lineHeight / 2 - 5);
      ctx.lineTo(x, y + lineHeight / 2 + 5);
      ctx.stroke();

      // Draw labels
      ctx.fillStyle = '#333';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      const value = axis.min + ((axis.max - axis.min) * i) / (numMarks - 1);
      ctx.fillText(Math.round(value), x, y + lineHeight / 2 + 20);
    }

    // Draw current value marker
    const currentValue = values[axis.value] || axis.min;
    const ratio = (currentValue - axis.min) / (axis.max - axis.min);
    const markerX = startX + lineWidth * ratio;

    ctx.fillStyle = '#0066ff';
    ctx.beginPath();
    ctx.arc(markerX, y, 12, 0, 2 * Math.PI);
    ctx.fill();

    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(markerX, y, 8, 0, 2 * Math.PI);
    ctx.fill();

    // Draw axis label
    ctx.fillStyle = '#333';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(axis.label, centerX, y - lineHeight / 2 - 30);
  };

  const drawVShape = (ctx, centerX, centerY, maxRadius) => {
    const axis1 = axes[0];
    const axis2 = axes[1];

    // Calculate V shape points
    const angle = Math.PI / 4; // 45 degrees
    const length = maxRadius * 1.5;

    // Left line (axis1)
    const leftEndX = centerX - Math.cos(angle) * length;
    const leftEndY = centerY + Math.sin(angle) * length;

    // Right line (axis2)
    const rightEndX = centerX + Math.cos(angle) * length;
    const rightEndY = centerY + Math.sin(angle) * length;

    // Draw background lines
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 20;
    ctx.lineCap = 'round';

    // Left line
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(leftEndX, leftEndY);
    ctx.stroke();

    // Right line
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(rightEndX, rightEndY);
    ctx.stroke();

    // Draw value indicators
    const drawValueOnLine = (axis, startX, startY, endX, endY) => {
      const currentValue = values[axis.value] || axis.min;
      const ratio = (currentValue - axis.min) / (axis.max - axis.min);
      
      const valueX = startX + (endX - startX) * ratio;
      const valueY = startY + (endY - startY) * ratio;

      // Draw colored line up to value
      const gradient = ctx.createLinearGradient(startX, startY, endX, endY);
      gradient.addColorStop(0, '#ff4444');
      gradient.addColorStop(0.5, '#ffcc00');
      gradient.addColorStop(1, '#44ff44');

      ctx.strokeStyle = gradient;
      ctx.lineWidth = 18;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(valueX, valueY);
      ctx.stroke();

      // Draw marker
      ctx.fillStyle = '#0066ff';
      ctx.beginPath();
      ctx.arc(valueX, valueY, 12, 0, 2 * Math.PI);
      ctx.fill();

      ctx.fillStyle = 'white';
      ctx.beginPath();
      ctx.arc(valueX, valueY, 8, 0, 2 * Math.PI);
      ctx.fill();
    };

    drawValueOnLine(axis1, centerX, centerY, leftEndX, leftEndY);
    drawValueOnLine(axis2, centerX, centerY, rightEndX, rightEndY);

    // Draw axis labels
    ctx.fillStyle = '#333';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(axis1.label, leftEndX, leftEndY + 25);
    ctx.fillText(axis2.label, rightEndX, rightEndY + 25);

    // Draw min/max labels
    ctx.font = '12px sans-serif';
    ctx.fillText(axis1.min, centerX - 10, centerY + 20);
    ctx.fillText(axis1.max, leftEndX + 10, leftEndY - 10);
    ctx.fillText(axis2.min, centerX + 10, centerY + 20);
    ctx.fillText(axis2.max, rightEndX - 10, rightEndY - 10);
  };

  const drawRadarChart = (ctx, centerX, centerY, maxRadius) => {
    const angleStep = (2 * Math.PI) / numAxes;

    // Draw background circles
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    const levels = 5;
    for (let i = 1; i <= levels; i++) {
      const radius = (maxRadius * i) / levels;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
      ctx.stroke();
    }

    // Draw axes lines
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 2;
    axes.forEach((axis, i) => {
      const angle = i * angleStep - Math.PI / 2; // Start from top
      const x = centerX + Math.cos(angle) * maxRadius;
      const y = centerY + Math.sin(angle) * maxRadius;

      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(x, y);
      ctx.stroke();
    });

    // Draw value polygon
    ctx.fillStyle = 'rgba(0, 102, 255, 0.3)';
    ctx.strokeStyle = '#0066ff';
    ctx.lineWidth = 3;
    ctx.beginPath();

    axes.forEach((axis, i) => {
      const angle = i * angleStep - Math.PI / 2;
      const currentValue = values[axis.value] || axis.min;
      const ratio = (currentValue - axis.min) / (axis.max - axis.min);
      const radius = maxRadius * ratio;
      
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Draw value points and labels
    axes.forEach((axis, i) => {
      const angle = i * angleStep - Math.PI / 2;
      const currentValue = values[axis.value] || axis.min;
      const ratio = (currentValue - axis.min) / (axis.max - axis.min);
      const radius = maxRadius * ratio;
      
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;

      // Draw point
      ctx.fillStyle = '#0066ff';
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, 2 * Math.PI);
      ctx.fill();

      // Draw axis label
      const labelRadius = maxRadius + 30;
      const labelX = centerX + Math.cos(angle) * labelRadius;
      const labelY = centerY + Math.sin(angle) * labelRadius;

      ctx.fillStyle = '#333';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(axis.label, labelX, labelY);

      // Draw value label rounded to step precision
      const stepDecimals = scaleStep < 1 ? Math.ceil(-Math.log10(scaleStep)) : 0;
      ctx.font = '11px sans-serif';
      ctx.fillText(parseFloat(currentValue.toFixed(stepDecimals)), labelX, labelY + 15);
    });
  };

  const handleCanvasClick = (e) => {
    if (readOnly) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = dimensions.width / 2;
    const centerY = dimensions.height / 2;
    const maxRadius = Math.min(dimensions.width, dimensions.height) * 0.35;

    if (numAxes === 1) {
      // Handle click on single axis line
      handleSingleAxisClick(x, y, centerX, centerY, maxRadius * 2);
    } else if (numAxes === 2) {
      // Handle click on V shape
      handleVShapeClick(x, y, centerX, centerY, maxRadius);
    } else {
      // Handle click on radar chart
      handleRadarClick(x, y, centerX, centerY, maxRadius);
    }
  };

  const handleSingleAxisClick = (x, y, centerX, centerY, lineWidth) => {
    const axis = axes[0];
    const startX = centerX - lineWidth / 2;
    const endX = centerX + lineWidth / 2;

    // Check if click is within the line area
    if (x >= startX && x <= endX && Math.abs(y - centerY) < 40) {
      const ratio = (x - startX) / lineWidth;
      const newValue = axis.min + (axis.max - axis.min) * ratio;
      const clampedValue = Math.max(axis.min, Math.min(axis.max, newValue));

      setValues({ ...values, [axis.value]: clampedValue });
    }
  };

  const handleVShapeClick = (x, y, centerX, centerY, maxRadius) => {
    const angle = Math.PI / 4;
    const length = maxRadius * 1.5;

    // Check which line was clicked
    const distToLeft = distanceToLine(x, y, centerX, centerY, 
      centerX - Math.cos(angle) * length, 
      centerY + Math.sin(angle) * length);
    const distToRight = distanceToLine(x, y, centerX, centerY,
      centerX + Math.cos(angle) * length,
      centerY + Math.sin(angle) * length);

    if (distToLeft < 20) {
      // Clicked on left line (axis1)
      const axis = axes[0];
      const ratio = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2)) / length;
      const newValue = axis.min + (axis.max - axis.min) * ratio;
      const clampedValue = Math.max(axis.min, Math.min(axis.max, newValue));
      setValues({ ...values, [axis.value]: clampedValue });
    } else if (distToRight < 20) {
      // Clicked on right line (axis2)
      const axis = axes[1];
      const ratio = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2)) / length;
      const newValue = axis.min + (axis.max - axis.min) * ratio;
      const clampedValue = Math.max(axis.min, Math.min(axis.max, newValue));
      setValues({ ...values, [axis.value]: clampedValue });
    }
  };

  const handleRadarClick = (x, y, centerX, centerY, maxRadius) => {
    const dx = x - centerX;
    const dy = y - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    let clickAngle = Math.atan2(dy, dx) + Math.PI / 2;
    if (clickAngle < 0) clickAngle += 2 * Math.PI;

    const angleStep = (2 * Math.PI) / numAxes;

    // Find the closest axis
    let closestAxisIndex = Math.round(clickAngle / angleStep) % numAxes;
    const axis = axes[closestAxisIndex];

    // Calculate the new value based on distance from center
    const ratio = Math.min(distance / maxRadius, 1);
    const newValue = axis.min + (axis.max - axis.min) * ratio;
    const clampedValue = Math.max(axis.min, Math.min(axis.max, newValue));

    setValues({ ...values, [axis.value]: clampedValue });
  };

  const distanceToLine = (px, py, x1, y1, x2, y2) => {
    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;

    if (lenSq !== 0) param = dot / lenSq;

    let xx, yy;

    if (param < 0) {
      xx = x1;
      yy = y1;
    } else if (param > 1) {
      xx = x2;
      yy = y2;
    } else {
      xx = x1 + param * C;
      yy = y1 + param * D;
    }

    const dx = px - xx;
    const dy = py - yy;
    return Math.sqrt(dx * dx + dy * dy);
  };

  return (
    <div className="radar-chart-container" ref={containerRef}>
      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        onClick={readOnly ? undefined : handleCanvasClick}
        className="radar-chart-canvas"
      />
    </div>
  );
}

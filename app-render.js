function makeSvg(tag, attrs = {}) {
  const element = document.createElementNS(svgNS, tag);
  Object.entries(attrs).forEach(([key, value]) => element.setAttribute(key, value));
  return element;
}
function addFillPatterns(root) {
  let defs = root.querySelector('defs');
  if (!defs) {
    defs = makeSvg('defs');
    root.prepend(defs);
  }
  if (defs.querySelector('#hatchFill')) return;
  const hatch = makeSvg('pattern', { id: 'hatchFill', width: 10, height: 10, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' });
  hatch.append(makeSvg('line', { x1: 0, y1: 0, x2: 0, y2: 10, stroke: '#263238', 'stroke-width': 1 }));
  const cross = makeSvg('pattern', { id: 'crossHatchFill', width: 10, height: 10, patternUnits: 'userSpaceOnUse' });
  cross.append(makeSvg('path', { d: 'M 0 0 L 10 10 M 10 0 L 0 10', stroke: '#263238', 'stroke-width': 0.9 }));
  const reverse = makeSvg('pattern', { id: 'reverseHatchFill', width: 10, height: 10, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(-45)' });
  reverse.append(makeSvg('line', { x1: 0, y1: 0, x2: 0, y2: 10, stroke: '#263238', 'stroke-width': 1 }));
  const horizontal = makeSvg('pattern', { id: 'horizontalHatchFill', width: 10, height: 10, patternUnits: 'userSpaceOnUse' });
  horizontal.append(makeSvg('line', { x1: 0, y1: 5, x2: 10, y2: 5, stroke: '#263238', 'stroke-width': 1 }));
  const vertical = makeSvg('pattern', { id: 'verticalHatchFill', width: 10, height: 10, patternUnits: 'userSpaceOnUse' });
  vertical.append(makeSvg('line', { x1: 5, y1: 0, x2: 5, y2: 10, stroke: '#263238', 'stroke-width': 1 }));
  const dots = makeSvg('pattern', { id: 'dotHatchFill', width: 10, height: 10, patternUnits: 'userSpaceOnUse' });
  dots.append(makeSvg('circle', { cx: 3, cy: 3, r: 1.2, fill: '#263238' }), makeSvg('circle', { cx: 8, cy: 8, r: 1.2, fill: '#263238' }));
  const brick = makeSvg('pattern', { id: 'brickHatchFill', width: 24, height: 12, patternUnits: 'userSpaceOnUse' });
  brick.append(makeSvg('path', { d: 'M 0 0 H 24 M 0 6 H 24 M 0 12 H 24 M 6 0 V 6 M 18 0 V 6 M 0 6 V 12 M 12 6 V 12 M 24 6 V 12', fill: 'none', stroke: '#263238', 'stroke-width': 0.8 }));
  const concrete = makeSvg('pattern', { id: 'concreteHatchFill', width: 28, height: 22, patternUnits: 'userSpaceOnUse' });
  concrete.append(makeSvg('path', { d: 'M 3 5 l 4 -2 l 3 4 l -5 3 z M 17 4 l 5 1 l -2 5 l -4 -2 z M 10 16 l 4 -3 l 4 4 l -5 2 z M 23 15 l 3 3 l -4 2', fill: 'none', stroke: '#263238', 'stroke-width': 0.8 }));
  defs.append(hatch, cross, reverse, horizontal, vertical, dots, brick, concrete);
}
function distance(a, b) { return Math.hypot(b.x - a.x, b.y - a.y); }
function polarPoint(center, radius, angle) { return { x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius }; }
function semicirclePath(object, scale = drawingScale(), offsetX = 0, offsetY = 0) {
  const radius = object.r / scale;
  const center = { x: object.x / scale + offsetX, y: object.y / scale + offsetY };
  const start = polarPoint(center, radius, object.angle || 0);
  const end = polarPoint(center, radius, (object.angle || 0) + Math.PI);
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 0 1 ${end.x} ${end.y}`;
}
function ellipseArcPath(object, scale = drawingScale(), offsetX = 0, offsetY = 0) {
  const cx = object.x / scale + offsetX; const cy = object.y / scale + offsetY;
  const rx = object.rx / scale; const ry = object.ry / scale;
  return `M ${cx - rx} ${cy} A ${rx} ${ry} 0 0 1 ${cx + rx} ${cy}`;
}
function slotPath(object, scale = drawingScale(), offsetX = 0, offsetY = 0) {
  const x1 = object.x1 / scale + offsetX; const y1 = object.y1 / scale + offsetY; const x2 = object.x2 / scale + offsetX; const y2 = object.y2 / scale + offsetY;
  const radius = object.width / scale / 2; const angle = Math.atan2(y2 - y1, x2 - x1); const nx = -Math.sin(angle) * radius; const ny = Math.cos(angle) * radius;
  return `M ${x1 + nx} ${y1 + ny} L ${x2 + nx} ${y2 + ny} A ${radius} ${radius} 0 0 1 ${x2 - nx} ${y2 - ny} L ${x1 - nx} ${y1 - ny} A ${radius} ${radius} 0 0 1 ${x1 + nx} ${y1 + ny} Z`;
}
function rectShapePath(object, scale = drawingScale(), offsetX = 0, offsetY = 0) {
  const x = object.x / scale + offsetX; const y = object.y / scale + offsetY; const width = object.width / scale; const height = object.height / scale;
  const size = Math.min(Number(object.cornerSize) || 0, object.width / 2, object.height / 2) / scale;
  if (object.cornerMode === 'chamfer' && size > 0) return `M ${x + size} ${y} H ${x + width - size} L ${x + width} ${y + size} V ${y + height - size} L ${x + width - size} ${y + height} H ${x + size} L ${x} ${y + height - size} V ${y + size} Z`;
  return null;
}
function distanceToLine(point, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len === 0) return distance(point, { x: x1, y: y1 });
  let t = ((point.x - x1) * dx + (point.y - y1) * dy) / (len * len);
  t = Math.max(0, Math.min(1, t));
  const closestX = x1 + t * dx;
  const closestY = y1 + t * dy;
  return distance(point, { x: closestX, y: closestY });
}
function closestPointOnSegment(point, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = dx * dx + dy * dy;
  if (len === 0) return { x: x1, y: y1 };
  const t = Math.max(0, Math.min(1, ((point.x - x1) * dx + (point.y - y1) * dy) / len));
  return { x: x1 + t * dx, y: y1 + t * dy };
}
function addSnapCandidate(candidates, point, x1, y1, x2, y2) {
  const snapped = closestPointOnSegment(point, x1, y1, x2, y2);
  candidates.push({ point: snapped, distance: distance(point, snapped), type: 'Kante' });
}
function addPointCandidate(candidates, rawPoint, snapPointValue, type, guide = null) {
  candidates.push({ point: snapPointValue, distance: distance(rawPoint, snapPointValue), type, guide });
}
function rectCorners(object) {
  const center = { x: object.x + object.width / 2, y: object.y + object.height / 2 };
  return [
    { x: object.x, y: object.y }, { x: object.x + object.width, y: object.y },
    { x: object.x + object.width, y: object.y + object.height }, { x: object.x, y: object.y + object.height }
  ].map(point => rotatePoint(point, center, object.rotation || 0));
}
function lineSegments() {
  const segments = [];
  activeViewObjects().forEach(object => {
    if (object.type === 'line') segments.push({ x1: object.x1, y1: object.y1, x2: object.x2, y2: object.y2, objectId: object.id });
    if (object.type === 'rect') {
      const corners = rectCorners(object);
      corners.forEach((point, index) => { const next = corners[(index + 1) % corners.length]; segments.push({ x1: point.x, y1: point.y, x2: next.x, y2: next.y, objectId: object.id }); });
    }
    if (object.type === 'polyline') object.points.slice(1).forEach((pointB, index) => {
      const pointA = object.points[index];
      segments.push({ x1: pointA.x, y1: pointA.y, x2: pointB.x, y2: pointB.y, objectId: object.id });
    });
    if (object.type === 'polygon') object.points.forEach((pointA, index) => { const pointB = object.points[(index + 1) % object.points.length]; segments.push({ x1: pointA.x, y1: pointA.y, x2: pointB.x, y2: pointB.y, objectId: object.id }); });
  });
  return segments;
}
function segmentIntersection(a, b) {
  const dax = a.x2 - a.x1; const day = a.y2 - a.y1;
  const dbx = b.x2 - b.x1; const dby = b.y2 - b.y1;
  const denom = dax * dby - day * dbx;
  if (Math.abs(denom) < 0.001) return null;
  const t = ((b.x1 - a.x1) * dby - (b.y1 - a.y1) * dbx) / denom;
  const u = ((b.x1 - a.x1) * day - (b.y1 - a.y1) * dax) / denom;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { x: a.x1 + t * dax, y: a.y1 + t * day };
}
function infiniteLineSegmentIntersection(line, segment) {
  const dax = line.x2 - line.x1; const day = line.y2 - line.y1; const dbx = segment.x2 - segment.x1; const dby = segment.y2 - segment.y1;
  const denominator = dax * dby - day * dbx; if (Math.abs(denominator) < 0.001) return null;
  const t = ((segment.x1 - line.x1) * dby - (segment.y1 - line.y1) * dbx) / denominator;
  const u = ((segment.x1 - line.x1) * day - (segment.y1 - line.y1) * dax) / denominator;
  return u >= 0 && u <= 1 ? { x: line.x1 + t * dax, y: line.y1 + t * day, t } : null;
}
function smartEditLineAt(point, mode) {
  const threshold = Math.max(12, state.scale * 12);
  const line = activeViewObjects().filter(object => object.type === 'line' && !isObjectLocked(object)).sort((a, b) => distanceToLine(point, a.x1, a.y1, a.x2, a.y2) - distanceToLine(point, b.x1, b.y1, b.x2, b.y2))[0];
  if (!line || distanceToLine(point, line.x1, line.y1, line.x2, line.y2) > threshold) { setStatus('Linie nahe dem gewünschten Ende anklicken'); return; }
  const editStart = distance(point, { x: line.x1, y: line.y1 }) < distance(point, { x: line.x2, y: line.y2 });
  const candidates = lineSegments().filter(segment => segment.objectId !== line.id).map(segment => infiniteLineSegmentIntersection(line, segment)).filter(Boolean).filter(hit => mode === 'trim' ? hit.t > 0.001 && hit.t < 0.999 : editStart ? hit.t < -0.001 : hit.t > 1.001);
  candidates.sort((a, b) => editStart ? Math.abs(a.t) - Math.abs(b.t) : Math.abs(a.t - 1) - Math.abs(b.t - 1));
  const hit = candidates[0]; if (!hit) { setStatus('Keine passende Schnittkante gefunden'); return; }
  pushHistory(); if (editStart) { line.x1 = hit.x; line.y1 = hit.y; } else { line.x2 = hit.x; line.y2 = hit.y; } selectObject(line.id); render(); setStatus(mode === 'trim' ? 'Linie bis Schnittkante getrimmt' : 'Linie bis Schnittkante verlängert');
}
function objectSnapResult(point, origin = null) {
  const candidates = [];
  const segments = lineSegments();
  if (state.snapModes.midpoint) {
    logicalObjectEntries().forEach(entry => {
      const members = entry.members.filter(object => isObjectVisible(object) && objectView(object) === state.activeView && object.type !== 'dimension' && object.type !== 'angleDimension');
      const bounds = boundsForObjects(members);
      if (bounds) addPointCandidate(candidates, point, { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 }, 'Objektzentrum');
    });
  }
  segments.forEach(segment => {
    if (state.snapModes.endpoint) { addPointCandidate(candidates, point, { x: segment.x1, y: segment.y1 }, 'Endpunkt'); addPointCandidate(candidates, point, { x: segment.x2, y: segment.y2 }, 'Endpunkt'); }
    if (state.snapModes.midpoint) addPointCandidate(candidates, point, { x: (segment.x1 + segment.x2) / 2, y: (segment.y1 + segment.y2) / 2 }, 'Mittelpunkt');
    addSnapCandidate(candidates, point, segment.x1, segment.y1, segment.x2, segment.y2);
    const dx = segment.x2 - segment.x1; const dy = segment.y2 - segment.y1; const segmentLength = Math.hypot(dx, dy) || 1;
    const ux = dx / segmentLength; const uy = dy / segmentLength;
    const infiniteT = (point.x - segment.x1) * ux + (point.y - segment.y1) * uy;
    if (infiniteT < 0 || infiniteT > segmentLength) {
      const extension = { x: segment.x1 + ux * infiniteT, y: segment.y1 + uy * infiniteT };
      if (state.snapModes.extension) addPointCandidate(candidates, point, extension, 'Verlängerung', { x1: segment.x1, y1: segment.y1, x2: extension.x, y2: extension.y });
    }
    if (origin) {
      const parallelT = (point.x - origin.x) * ux + (point.y - origin.y) * uy;
      const parallel = { x: origin.x + ux * parallelT, y: origin.y + uy * parallelT };
      addPointCandidate(candidates, point, parallel, 'Parallel', { x1: origin.x, y1: origin.y, x2: parallel.x, y2: parallel.y });
      const px = -uy; const py = ux; const perpendicularT = (point.x - origin.x) * px + (point.y - origin.y) * py;
      const perpendicular = { x: origin.x + px * perpendicularT, y: origin.y + py * perpendicularT };
      if (state.snapModes.perpendicular) addPointCandidate(candidates, point, perpendicular, 'Senkrecht', { x1: origin.x, y1: origin.y, x2: perpendicular.x, y2: perpendicular.y });
    }
    if (origin) {
      const foot = closestPointOnSegment(origin, segment.x1, segment.y1, segment.x2, segment.y2);
      const atStart = distance(foot, { x: segment.x1, y: segment.y1 }) < 0.001;
      const atEnd = distance(foot, { x: segment.x2, y: segment.y2 }) < 0.001;
      if (!atStart && !atEnd && state.snapModes.perpendicular) addPointCandidate(candidates, point, foot, 'Lotpunkt');
    }
    if (origin && Math.abs(segment.x1 - segment.x2) < 0.001) {
      const minY = Math.min(segment.y1, segment.y2);
      const maxY = Math.max(segment.y1, segment.y2);
      if (origin.y >= minY && origin.y <= maxY && state.snapModes.perpendicular) addPointCandidate(candidates, point, { x: segment.x1, y: origin.y }, 'Lotpunkt');
    }
    if (origin && Math.abs(segment.y1 - segment.y2) < 0.001) {
      const minX = Math.min(segment.x1, segment.x2);
      const maxX = Math.max(segment.x1, segment.x2);
      if (origin.x >= minX && origin.x <= maxX && state.snapModes.perpendicular) addPointCandidate(candidates, point, { x: origin.x, y: segment.y1 }, 'Lotpunkt');
    }
  });
  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) {
      const intersection = segmentIntersection(segments[i], segments[j]);
      if (intersection && state.snapModes.intersection) addPointCandidate(candidates, point, intersection, 'Schnittpunkt');
    }
  }
  activeViewObjects().forEach(object => {
    if (object.type === 'circle' || object.type === 'semicircle') {
      if (state.snapModes.midpoint) addPointCandidate(candidates, point, { x: object.x, y: object.y }, 'Objektzentrum');
      if (state.snapModes.quadrant) [{ x: object.x + object.r, y: object.y }, { x: object.x - object.r, y: object.y }, { x: object.x, y: object.y + object.r }, { x: object.x, y: object.y - object.r }].forEach(quadrant => addPointCandidate(candidates, point, quadrant, 'Quadrant'));
      if (origin) {
        const centerDistance = distance(origin, { x: object.x, y: object.y });
        if (centerDistance > object.r + 0.001) {
          const base = Math.atan2(origin.y - object.y, origin.x - object.x); const offset = Math.acos(object.r / centerDistance);
          if (state.snapModes.tangent) [base + offset, base - offset].forEach(angle => { const tangent = polarPoint(object, object.r, angle); addPointCandidate(candidates, point, tangent, 'Tangente', { x1: origin.x, y1: origin.y, x2: tangent.x, y2: tangent.y }); });
        }
      }
    }
    if (object.type === 'ellipse' || object.type === 'ellipseArc') {
      if (state.snapModes.midpoint) addPointCandidate(candidates, point, { x: object.x, y: object.y }, 'Objektzentrum');
      if (state.snapModes.quadrant) [{ x: object.x + object.rx, y: object.y }, { x: object.x - object.rx, y: object.y }, { x: object.x, y: object.y + object.ry }, { x: object.x, y: object.y - object.ry }].forEach(quadrant => addPointCandidate(candidates, point, quadrant, 'Quadrant'));
    }
  });
  const canvasRect = canvas.getBoundingClientRect();
  const modelUnitsPerScreenPixel = viewBox.width / Math.max(1, canvasRect.width) * drawingScale();
  const threshold = Math.max(150, modelUnitsPerScreenPixel * 14);
  const priority = { Endpunkt: 0, Schnittpunkt: 1, Objektzentrum: 2, Quadrant: 3, Tangente: 4, Mittelpunkt: 5, Lotpunkt: 6, Senkrecht: 7, Parallel: 8, Verlängerung: 9, Kante: 10 };
  const nearbyCenters = candidates.filter(candidate => candidate.type === 'Objektzentrum' && candidate.distance <= threshold).sort((a, b) => a.distance - b.distance);
  if (nearbyCenters.length) return nearbyCenters[0];
  const pointCandidates = candidates.filter(candidate => candidate.type !== 'Kante' && candidate.distance <= threshold);
  const best = (pointCandidates.length ? pointCandidates : candidates).sort((a, b) => a.distance - b.distance || (priority[a.type] ?? 9) - (priority[b.type] ?? 9))[0];
  return best && best.distance <= threshold ? best : { point, type: null, distance: 0 };
}
function snapPoint(point) { return state.snap ? { x: Math.round(point.x / snapSize) * snapSize, y: Math.round(point.y / snapSize) * snapSize } : point; }
function eventPoint(event, objectSnap = false, snapOrigin = null) {
  const svg = canvas;
  const rect = svg.getBoundingClientRect();
  const x = viewBox.x + (event.clientX - rect.left) / rect.width * viewBox.width;
  const y = viewBox.y + (event.clientY - rect.top) / rect.height * viewBox.height;
  const snappedX = state.snap ? Math.round(x / snapSize) * snapSize : x;
  const snappedY = state.snap ? Math.round(y / snapSize) * snapSize : y;
  const scale = drawingScale();
  const rawPoint = { x: x * scale, y: y * scale };
  const gridPoint = { x: snappedX * scale, y: snappedY * scale };
  currentSnap = null;
  if (!objectSnap) return gridPoint;
  const snapped = objectSnapResult(rawPoint, snapOrigin);
  if (!snapped.type) return gridPoint;
  currentSnap = snapped;
  return snapped.point;
}
function toolUsesObjectSnap() { return ['line', 'dimension', 'polyline', 'rect', 'circle', 'semicircle', 'ellipse', 'ellipseArc', 'slot', 'polygon'].includes(state.tool) || isWoodTool(state.tool); }
function constrainedEndPoint(start, current) {
  const realLength = Number(document.querySelector('#targetLength')?.value);
  if (!realLength || realLength <= 0) return current;
  const len = modelLength(realLength);
  const dx = current.x - start.x;
  const dy = current.y - start.y;
  const d = Math.hypot(dx, dy);
  if (d < 1) return { x: start.x + len, y: start.y };
  return { x: start.x + (dx / d) * len, y: start.y + (dy / d) * len };
}
function lineEndPoint(start, current, event) {
  return constrainedEndPoint(start, applyAngleConstraint(start, current, event));
}
function radiusEndPoint(start, current, event) {
  const anglePoint = applyAngleConstraint(start, current, event);
  return constrainedEndPoint(start, anglePoint);
}
function angleDegrees(start, end) {
  const raw = (Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI + 360) % 360;
  return raw > 180 ? 360 - raw : raw;
}
function formatAngle(value) {
  return `${value.toFixed(1).replace('.', ',')}${String.fromCharCode(176)}`;
}
function shortestAngleDelta(startAngle, endAngle) {
  let delta = ((endAngle - startAngle) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  return delta;
}
function angleDimensionLabel(object) {
  if (object.labelOverride) return String(object.labelOverride);
  return formatAngle(Math.abs(shortestAngleDelta(object.startAngle || 0, object.endAngle || 0)) * 180 / Math.PI);
}
function angleArcPath(object, scale = drawingScale(), offsetX = 0, offsetY = 0) {
  const radius = Math.max(1, object.r || 500) / scale;
  const center = { x: object.cx / scale + offsetX, y: object.cy / scale + offsetY };
  const start = polarPoint(center, radius, object.startAngle || 0);
  const delta = shortestAngleDelta(object.startAngle || 0, object.endAngle || 0);
  const end = polarPoint(center, radius, (object.startAngle || 0) + delta);
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 0 ${delta >= 0 ? 1 : 0} ${end.x} ${end.y}`;
}
function updateLiveAngle(start, end) {
  const output = document.querySelector('#liveAngle');
  if (!output) return;
  output.textContent = start && end ? formatAngle(angleDegrees(start, end)) : '-';
}
function canvasValue(value) { return value / drawingScale(); }
function formatLength(value) { return value >= 1000 ? `${(value / 1000).toFixed(2).replace('.', ',')} m` : `${Math.round(value)} mm`; }
function dimensionStyle() {
  return state.dimensionStyle || { endStyle: 'arrow', textSize: 14, defaultOffset: 22, unit: 'auto', decimals: 0 };
}
function formatDimensionLength(value, options = {}) {
  const style = dimensionStyle();
  const decimalsSource = options.decimals ?? style.decimals;
  const unitSetting = options.unit || style.unit || 'auto';
  const unit = unitSetting === 'auto' ? (value >= 1000 ? 'm' : 'mm') : unitSetting;
  const decimals = Math.max(unit === 'm' ? 1 : 0, Math.min(3, Number(decimalsSource) || 0));
  const displayValue = unit === 'm' ? value / 1000 : unit === 'cm' ? value / 10 : value;
  return `${displayValue.toFixed(decimals).replace('.', ',')} ${unit}`;
}
function objectReferenceFactor(object, side = null) {
  const view = object ? objectView(object) : state.activeView;
  const factor = Number(state.viewReferences[view]?.factor);
  return Number.isFinite(factor) && factor > 0 ? factor : 1;
}
function calibratedLength(value, object = null, side = null) {
  return value * objectReferenceFactor(object, side);
}
function modelLength(realLength, view = state.activeView) {
  const factor = Number(state.viewReferences[view]?.factor);
  return realLength / (Number.isFinite(factor) && factor > 0 ? factor : 1);
}
function dimensionLabelText(object, measuredLength) {
  if (object.labelOverride) return String(object.labelOverride);
  const displayLength = calibratedLength(measuredLength, object);
  return `${object.labelPrefix || ''}${formatDimensionLength(displayLength, { unit: object.dimensionUnit, decimals: object.dimensionDecimals })}`;
}
function updateDimensionStyleFromControls() {
  const style = dimensionStyle();
  style.endStyle = document.querySelector('#dimensionEndStyle')?.value || 'arrow';
  style.textSize = Math.max(8, Math.min(32, Number(document.querySelector('#dimensionTextSize')?.value) || 14));
  const offset = Number(document.querySelector('#dimensionDefaultOffset')?.value);
  style.defaultOffset = clampDimensionOffset(Number.isFinite(offset) ? offset : 22);
  style.unit = document.querySelector('#dimensionUnit')?.value || 'auto';
  style.decimals = Math.max(0, Math.min(3, Number(document.querySelector('#dimensionDecimals')?.value) || 0));
  state.dimensionStyle = style;
}
function clampDimensionOffset(value) { return Math.max(-500, Math.min(500, Number.isFinite(Number(value)) ? Number(value) : 22)); }
function syncDimensionStyleControls() {
  const style = dimensionStyle();
  if (document.querySelector('#dimensionEndStyle')) document.querySelector('#dimensionEndStyle').value = style.endStyle;
  if (document.querySelector('#dimensionTextSize')) document.querySelector('#dimensionTextSize').value = style.textSize;
  if (document.querySelector('#dimensionDefaultOffset')) document.querySelector('#dimensionDefaultOffset').value = style.defaultOffset;
  if (document.querySelector('#dimensionUnit')) document.querySelector('#dimensionUnit').value = style.unit;
  if (document.querySelector('#dimensionDecimals')) document.querySelector('#dimensionDecimals').value = style.decimals;
}
function updateProjectMetaFromForm() {
  state.projectName = document.querySelector('#projectName')?.value || 'Projekt01';
  state.drawingNumber = document.querySelector('#drawingNumber')?.value || '-';
  state.drawnBy = document.querySelector('#drawnBy')?.value || '-';
  state.projectDate = document.querySelector('#projectDate')?.value || new Date().toISOString().slice(0, 10);
}
function objectListLabel(object, index = state.objects.indexOf(object)) {
  return `${index + 1}. ${object.name || toolNames[object.type] || object.type} - ${objectSummary(object)} - ${viewNames[objectView(object)]}`;
}
function linkedObjectText(item) {
  const ids = materialObjectIds(item);
  if (!ids.length) return '';
  return ids.map(id => {
    const object = state.objects.find(entry => entry.id === id);
    return object ? objectListLabel(object) : 'Objekt fehlt';
  }).join(', ');
}
function materialObjectIds(item) {
  if (Array.isArray(item.objectIds)) return item.objectIds.filter(Boolean);
  return item.objectId ? [item.objectId] : [];
}
function materialDimensionsFromObject(object) {
  if (!object) return '';
  if (object.type === 'line') return formatLength(calibratedLength(distance({ x: object.x1, y: object.y1 }, { x: object.x2, y: object.y2 }), object));
  if (object.type === 'rect') return `${formatLength(calibratedLength(object.width, object))} x ${formatLength(calibratedLength(object.height, object))}`;
  if (object.type === 'circle') return `Ø ${formatLength(calibratedLength(object.r * 2, object))}`;
  if (object.type === 'semicircle') return `R ${formatLength(calibratedLength(object.r, object))}`;
  return objectSummary(object);
}
function trimNumber(value) {
  return Number(value.toFixed(3)).toString().replace('.', ',');
}
function formatScaleRatio(scale) {
  const value = Number(scale);
  if (!Number.isFinite(value) || value <= 0) return '1:1';
  return value >= 1 ? `1:${trimNumber(value)}` : `${trimNumber(1 / value)}:1`;
}
function parseMaterialNumber(value, fallback = 0) {
  const number = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(number) ? number : fallback;
}
function calculatedMaterialQuantity(item) {
  const objects = materialObjectIds(item).map(id => state.objects.find(entry => entry.id === id)).filter(Boolean);
  if (!objects.length) return '';
  if (item.unit === 'St') return trimNumber(objects.length * Math.max(1, Number(item.objectQty) || 1));
  const values = objects.map(object => {
    if (item.unit === 'm') {
      if (object.type === 'line') return calibratedLength(distance({ x: object.x1, y: object.y1 }, { x: object.x2, y: object.y2 }), object) / 1000;
      if (object.type === 'rect') return calibratedLength((object.width + object.height) * 2, object) / 1000;
      if (object.type === 'circle') return calibratedLength(2 * Math.PI * object.r, object) / 1000;
      if (object.type === 'semicircle') return calibratedLength(Math.PI * object.r + object.r * 2, object) / 1000;
    }
    if (item.unit === 'm2') {
      const factor = viewCalibrationFactor(objectView(object));
      if (object.type === 'rect') return object.width * object.height * factor * factor / 1000000;
      if (object.type === 'circle') return Math.PI * object.r * object.r * factor * factor / 1000000;
      if (object.type === 'semicircle') return Math.PI * object.r * object.r * factor * factor / 2000000;
    }
    return null;
  }).filter(value => value !== null);
  return values.length ? trimNumber(values.reduce((sum, value) => sum + value, 0) * Math.max(1, Number(item.objectQty) || 1)) : '';
}
function materialMarkerPoint(object) {
  if (object.type === 'line' || object.type === 'dimension') return { x: (object.x1 + object.x2) / 2, y: (object.y1 + object.y2) / 2 };
  if (object.type === 'rect') return { x: object.x + object.width / 2, y: object.y + object.height / 2 };
  if (object.type === 'circle' || object.type === 'semicircle') return { x: object.x, y: object.y };
  if (object.type === 'angleDimension') return { x: object.cx, y: object.cy };
  if (object.type === 'text') return { x: object.x, y: object.y };
  return null;
}
function materialMarkersForObject(object) {
  return state.materials.filter(item => materialObjectIds(item).includes(object.id)).map(item => `Pos. ${item.pos || state.materials.indexOf(item) + 1}`);
}
function defaultMaterialRow() {
  return { pos: String(state.materials.length + 1), qty: '1', unit: 'St', objectQty: '1', objectIds: [], name: '', material: '', dimensions: '', note: '' };
}
function materialRowFromObject(object) {
  return {
    pos: String(state.materials.length + 1),
    qty: '1',
    unit: 'St',
    objectQty: '1',
    objectIds: [object.id],
    name: object.materialName || toolNames[object.type] || 'Teil',
    material: '',
    dimensions: materialDimensionsFromObject(object),
    note: ''
  };
}
function updateMaterialsFromForm() {
  const list = document.querySelector('#materialList');
  if (!list) return;
  state.materials = [...list.querySelectorAll('.material-row')].map(row => ({
    pos: row.querySelector('[name="pos"]').value.trim(),
    qty: row.querySelector('[name="qty"]').value.trim(),
    unit: row.querySelector('[name="unit"]').value,
    objectQty: row.querySelector('[name="objectQty"]')?.value.trim() || '1',
    objectIds: [...(row.querySelector('[name="objectIds"]')?.selectedOptions || [])].map(option => option.value).filter(Boolean),
    name: row.querySelector('[name="name"]').value.trim(),
    material: row.querySelector('[name="material"]').value.trim(),
    dimensions: row.querySelector('[name="dimensions"]').value.trim(),
    note: row.querySelector('[name="note"]').value.trim()
  })).filter(item => item.name || item.material || item.dimensions || item.note || item.objectIds.length);
}
function renderMaterialList() {
  const list = document.querySelector('#materialList');
  if (!list) return;
  list.replaceChildren();
  if (!state.materials.length) {
    const empty = document.createElement('div');
    empty.className = 'property-empty';
    empty.textContent = 'Keine Materialpositionen angelegt.';
    list.append(empty);
    return;
  }
  state.materials.forEach((item, index) => {
    const row = document.createElement('div');
    row.className = 'material-row';
    row.dataset.index = index;
    const selectedObjectIds = materialObjectIds(item);
    const objectOptions = state.objects.map((object, objectIndex) => `<option value="${escapeHtml(object.id)}">${escapeHtml(objectListLabel(object, objectIndex))}</option>`).join('');
    row.innerHTML = `<label>Pos.<input name="pos" value="${escapeHtml(item.pos || String(index + 1))}"></label><label>Menge<input name="qty" value="${escapeHtml(item.qty || '1')}"></label><label>Einheit<select name="unit"><option value="St">St</option><option value="m">m</option><option value="m2">m²</option><option value="m3">m³</option><option value="kg">kg</option><option value="l">l</option></select></label><label>St./Objekt<input name="objectQty" type="number" min="1" step="1" value="${escapeHtml(item.objectQty || '1')}"></label><label class="wide-field">Verknüpfte Objekte<select name="objectIds" multiple size="3">${objectOptions}</select></label><label class="wide-field">Bezeichnung<input name="name" value="${escapeHtml(item.name || '')}"></label><label class="wide-field">Werkstoff / Material<input name="material" value="${escapeHtml(item.material || '')}"></label><label class="wide-field">Abmessung<input name="dimensions" value="${escapeHtml(item.dimensions || '')}"></label><label class="wide-field">Bemerkung<input name="note" value="${escapeHtml(item.note || '')}"></label><button class="calc-material" type="button">Optional: Menge berechnen</button><button class="remove-material" type="button">Position löschen</button>`;
    row.querySelector('[name="unit"]').value = item.unit || 'St';
    row.querySelectorAll('[name="objectIds"] option').forEach(option => { option.selected = selectedObjectIds.includes(option.value); });
    row.querySelector('[name="objectIds"]').addEventListener('change', event => {
      const object = state.objects.find(entry => entry.id === event.target.selectedOptions[0]?.value);
      if (!object) return;
      if (!row.querySelector('[name="dimensions"]').value.trim()) row.querySelector('[name="dimensions"]').value = materialDimensionsFromObject(object);
      if (!row.querySelector('[name="name"]').value.trim()) row.querySelector('[name="name"]').value = toolNames[object.type] || 'Teil';
      updateMaterialsFromForm();
      render();
    });
    row.querySelectorAll('input,select').forEach(input => input.addEventListener('input', () => { updateMaterialsFromForm(); setDirty(); renderProjectWarnings(); }));
    row.querySelector('[name="pos"]').addEventListener('change', () => { updateMaterialsFromForm(); render(); });
    row.querySelector('.calc-material').addEventListener('click', () => {
      updateMaterialsFromForm();
      const current = state.materials[index];
      const calculated = calculatedMaterialQuantity(current);
      if (!calculated) { setStatus('Für diese Einheit ist keine Berechnung möglich'); return; }
      state.materials[index].qty = calculated;
      setDirty();
      renderMaterialList();
      setStatus('Menge aus Objekt berechnet');
    });
    row.querySelector('.remove-material').addEventListener('click', () => { updateMaterialsFromForm(); state.materials.splice(index, 1); setDirty(); renderMaterialList(); render(); });
    list.append(row);
  });
}
function objectBounds(object) {
  if (object.type === 'line') return { minX: Math.min(object.x1, object.x2), minY: Math.min(object.y1, object.y2), maxX: Math.max(object.x1, object.x2), maxY: Math.max(object.y1, object.y2) };
  if (object.type === 'dimension') {
    const dx = object.x2 - object.x1; const dy = object.y2 - object.y1; const length = Math.hypot(dx, dy) || 1;
    const offset = (Number.isFinite(Number(object.offset)) ? Number(object.offset) : dimensionStyle().defaultOffset) * drawingScale(objectView(object));
    const normal = { x: -dy / length, y: dx / length };
    const points = [
      { x: object.x1, y: object.y1 },
      { x: object.x2, y: object.y2 },
      { x: object.x1 + normal.x * offset, y: object.y1 + normal.y * offset },
      { x: object.x2 + normal.x * offset, y: object.y2 + normal.y * offset }
    ];
    return { minX: Math.min(...points.map(point => point.x)) - 250, minY: Math.min(...points.map(point => point.y)) - 250, maxX: Math.max(...points.map(point => point.x)) + 250, maxY: Math.max(...points.map(point => point.y)) + 250 };
  }
  if (object.type === 'rect') {
    const corners = rectCorners(object);
    return { minX: Math.min(...corners.map(point => point.x)), minY: Math.min(...corners.map(point => point.y)), maxX: Math.max(...corners.map(point => point.x)), maxY: Math.max(...corners.map(point => point.y)) };
  }
  if (object.type === 'circle' || object.type === 'semicircle') return { minX: object.x - object.r, minY: object.y - object.r, maxX: object.x + object.r, maxY: object.y + object.r };
  if (object.type === 'ellipse' || object.type === 'ellipseArc') { const angle = object.rotation || 0; const extentX = Math.sqrt(object.rx ** 2 * Math.cos(angle) ** 2 + object.ry ** 2 * Math.sin(angle) ** 2); const extentY = Math.sqrt(object.rx ** 2 * Math.sin(angle) ** 2 + object.ry ** 2 * Math.cos(angle) ** 2); return { minX: object.x - extentX, minY: object.y - extentY, maxX: object.x + extentX, maxY: object.y + extentY }; }
  if (object.type === 'slot') { const radius = object.width / 2; return { minX: Math.min(object.x1, object.x2) - radius, minY: Math.min(object.y1, object.y2) - radius, maxX: Math.max(object.x1, object.x2) + radius, maxY: Math.max(object.y1, object.y2) + radius }; }
  if (object.type === 'angleDimension') return { minX: object.cx - object.r, minY: object.cy - object.r, maxX: object.cx + object.r, maxY: object.cy + object.r };
  if (object.type === 'polyline' || object.type === 'polygon') {
    const xs = object.points.map(point => point.x);
    const ys = object.points.map(point => point.y);
    return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
  }
  if (object.type === 'text') return { minX: object.x, minY: object.y - 250, maxX: object.x + String(object.value || '').length * 180, maxY: object.y + 80 };
  return null;
}
function ellipseEdgeDistance(point, object) {
  const local = rotatePoint(point, { x: object.x, y: object.y }, -(object.rotation || 0));
  return Math.abs(Math.hypot((local.x - object.x) / object.rx, (local.y - object.y) / object.ry) - 1) * Math.max(object.rx, object.ry);
}
function drawingBounds(padding = 0) {
  const boxes = state.objects.filter(object => object.visible !== false).map(objectBounds).filter(Boolean);
  if (!boxes.length) return null;
  return {
    minX: Math.min(...boxes.map(box => box.minX)) - padding,
    minY: Math.min(...boxes.map(box => box.minY)) - padding,
    maxX: Math.max(...boxes.map(box => box.maxX)) + padding,
    maxY: Math.max(...boxes.map(box => box.maxY)) + padding
  };
}
function boundsForObjects(objects, padding = 0) {
  const boxes = objects.map(objectBounds).filter(Boolean);
  if (!boxes.length) return null;
  return {
    minX: Math.min(...boxes.map(box => box.minX)) - padding,
    minY: Math.min(...boxes.map(box => box.minY)) - padding,
    maxX: Math.max(...boxes.map(box => box.maxX)) + padding,
    maxY: Math.max(...boxes.map(box => box.maxY)) + padding
  };
}
function exportBoundsForObjects(objects, padding = 0) {
  const boxes = objects.map(object => {
    if (object.type === 'dimension') return { minX: Math.min(object.x1, object.x2), minY: Math.min(object.y1, object.y2), maxX: Math.max(object.x1, object.x2), maxY: Math.max(object.y1, object.y2) };
    return objectBounds(object);
  }).filter(Boolean);
  if (!boxes.length) return null;
  return { minX: Math.min(...boxes.map(box => box.minX)) - padding, minY: Math.min(...boxes.map(box => box.minY)) - padding, maxX: Math.max(...boxes.map(box => box.maxX)) + padding, maxY: Math.max(...boxes.map(box => box.maxY)) + padding };
}
function objectView(object) {
  return viewNames[object.view] ? object.view : 'front';
}
function defaultLayerForType(type) {
  if (type === 'dimension' || type === 'angleDimension') return 'dimension';
  if (type === 'text') return 'text';
  return 'contour';
}
function objectLayer(object) { return state.layers.some(layer => layer.id === object.layer) ? object.layer : defaultLayerForType(object.type); }
function layerForObject(object) { return state.layers.find(layer => layer.id === objectLayer(object)) || state.layers[0]; }
function isObjectVisible(object) { return object.visible !== false && layerForObject(object).visible !== false; }
function isObjectLocked(object) { return object.locked === true || layerForObject(object).locked === true; }
function isObjectPrintable(object) {
  const layer = layerForObject(object); const setting = ensureViewSetting(objectView(object));
  const visibleInView = setting.layerVisibility?.[layer.id] ?? layer.visible !== false;
  return object.visible !== false && visibleInView && layer.printable !== false;
}
function renderLayerControls() {
  const select = document.querySelector('#activeLayer'); const list = document.querySelector('#layerList');
  if (!select || !list) return;
  select.innerHTML = state.layers.map(layer => `<option value="${escapeHtml(layer.id)}">${escapeHtml(layer.name)}</option>`).join('');
  if (!state.layers.some(layer => layer.id === state.activeLayer)) state.activeLayer = state.layers[0].id;
  select.value = state.activeLayer;
  document.querySelector('#activeLayerName').textContent = state.layers.find(layer => layer.id === state.activeLayer)?.name || '';
  list.replaceChildren();
  state.layers.forEach(layer => {
    const row = document.createElement('div'); row.className = `layer-row${layer.id === state.activeLayer ? ' active' : ''}${layer.locked ? ' locked' : ''}`;
    const layerIndex = state.layers.indexOf(layer);
    row.draggable = true;
    row.innerHTML = `<button type="button" data-action="activate" title="Ebene aktivieren">${layer.id === state.activeLayer ? '● ' : ''}${escapeHtml(layer.name)}</button><button type="button" class="layer-order-button" data-action="rename" title="Ebene umbenennen">✎</button><button type="button" class="layer-order-button" data-action="duplicate" title="Ebene duplizieren">＋</button><button type="button" class="layer-order-button" data-action="delete" title="Ebene löschen" ${state.layers.length === 1 ? 'disabled' : ''}>×</button><button type="button" class="layer-order-button" data-action="backward" title="Ebene nach hinten verschieben" ${layerIndex === 0 ? 'disabled' : ''}>↓</button><button type="button" class="layer-order-button" data-action="forward" title="Ebene nach vorne verschieben" ${layerIndex === state.layers.length - 1 ? 'disabled' : ''}>↑</button><label title="Sichtbar"><input type="checkbox" data-action="visible" ${layer.visible !== false ? 'checked' : ''}>S</label><label title="Gesperrt"><input type="checkbox" data-action="locked" ${layer.locked ? 'checked' : ''}>G</label><label title="Druckbar"><input type="checkbox" data-action="printable" ${layer.printable !== false ? 'checked' : ''}>D</label>`;
    row.querySelector('[data-action="activate"]').addEventListener('click', () => { state.activeLayer = layer.id; setDirty(); renderLayerControls(); });
    row.querySelector('[data-action="activate"]').addEventListener('dblclick', () => renameLayer(layer.id));
    row.querySelector('[data-action="rename"]').addEventListener('click', () => renameLayer(layer.id));
    row.querySelector('[data-action="duplicate"]').addEventListener('click', () => duplicateLayer(layer.id));
    row.querySelector('[data-action="delete"]').addEventListener('click', () => deleteLayer(layer.id));
    row.querySelector('[data-action="backward"]').addEventListener('click', () => moveLayer(layer.id, -1));
    row.querySelector('[data-action="forward"]').addEventListener('click', () => moveLayer(layer.id, 1));
    row.addEventListener('dragstart', event => { event.dataTransfer.setData('text/layer-id', layer.id); row.classList.add('dragging'); });
    row.addEventListener('dragend', () => row.classList.remove('dragging'));
    row.addEventListener('dragover', event => { event.preventDefault(); row.classList.add('drop-target'); });
    row.addEventListener('dragleave', () => row.classList.remove('drop-target'));
    row.addEventListener('drop', event => { event.preventDefault(); row.classList.remove('drop-target'); reorderLayer(event.dataTransfer.getData('text/layer-id'), layer.id); });
    row.querySelectorAll('input').forEach(input => input.addEventListener('change', () => { layer[input.dataset.action] = input.checked; if (input.dataset.action === 'visible') ensureViewSetting().layerVisibility[layer.id] = input.checked; setDirty(); render(); renderLayerControls(); if (input.dataset.action === 'locked') setStatus(`Ebene „${layer.name}“ ${layer.locked ? 'gesperrt' : 'entsperrt'}`); }));
    list.append(row);
  });
  const addLayerButton = document.querySelector('#addLayer');
  if (addLayerButton) addLayerButton.onclick = addLayer;
}
function moveLayer(layerId, direction) {
  const index = state.layers.findIndex(layer => layer.id === layerId);
  const targetIndex = index + direction;
  if (index < 0 || targetIndex < 0 || targetIndex >= state.layers.length) return;
  [state.layers[index], state.layers[targetIndex]] = [state.layers[targetIndex], state.layers[index]];
  setDirty();
  renderLayerControls();
  render();
  setStatus(`${state.layers[targetIndex].name} ${direction < 0 ? 'nach hinten' : 'nach vorne'} verschoben`);
}
function reorderLayer(sourceId, targetId) {
  if (!sourceId || sourceId === targetId) return;
  const sourceIndex = state.layers.findIndex(layer => layer.id === sourceId); const targetIndex = state.layers.findIndex(layer => layer.id === targetId);
  if (sourceIndex < 0 || targetIndex < 0) return;
  const [layer] = state.layers.splice(sourceIndex, 1); state.layers.splice(targetIndex, 0, layer); setDirty(); renderLayerControls(); render(); setStatus(`Ebene „${layer.name}“ verschoben`);
}
function renameLayer(layerId) {
  const layer = state.layers.find(item => item.id === layerId); if (!layer) return;
  const name = window.prompt('Name der Ebene:', layer.name)?.trim(); if (!name || name === layer.name) return;
  layer.name = name; setDirty(); renderLayerControls(); renderObjectList(); setStatus(`Ebene in „${name}“ umbenannt`);
}
function duplicateLayer(layerId) {
  const source = state.layers.find(item => item.id === layerId); if (!source) return;
  const copy = { ...source, id: `layer-${newId()}`, name: `${source.name} Kopie` }; const index = state.layers.indexOf(source);
  state.layers.splice(index + 1, 0, copy); state.activeLayer = copy.id; setDirty(); renderLayerControls(); render(); setStatus(`Ebene „${copy.name}“ dupliziert`);
}
function deleteLayer(layerId) {
  if (state.layers.length <= 1) return;
  const layer = state.layers.find(item => item.id === layerId); if (!layer) return;
  if (!window.confirm(`Ebene „${layer.name}“ und ihre Objekte löschen?`)) return;
  const fallback = state.layers.find(item => item.id !== layerId) || state.layers[0]; pushHistory(); state.objects = state.objects.filter(object => object.layer !== layerId);
  state.layers = state.layers.filter(item => item.id !== layerId); if (state.activeLayer === layerId) state.activeLayer = fallback.id; setDirty(); renderLayerControls(); render(); setStatus(`Ebene „${layer.name}“ gelöscht`);
}
function addLayer() {
  const name = window.prompt('Name der neuen Ebene:', 'Neue Ebene')?.trim();
  if (!name) return false;
  const id = `layer-${newId()}`;
  state.layers.push({ id, name, visible: true, locked: false, printable: true });
  state.activeLayer = id;
  setDirty();
  renderLayerControls();
  render();
  setStatus(`Ebene „${name}“ hinzugefügt`);
  return true;
}
function projectWarnings() {
  updateSheetFromState();
  const warnings = []; const objectIds = new Set(state.objects.map(object => object.id));
  state.objects.forEach(object => {
    const missingSourceId = object.sourceRectId || object.sourceObjectId;
    if (missingSourceId && !objectIds.has(missingSourceId)) warnings.push({ type: 'link', objectId: object.id, message: `${object.name || toolNames[object.type] || 'Bemaßung'} verweist auf ein gelöschtes Objekt.` });
    const layer = layerForObject(object);
    if (layer.locked) warnings.push({ type: 'layer', objectId: object.id, message: `${object.name || toolNames[object.type] || 'Objekt'} liegt auf der gesperrten Ebene „${layer.name}“.` });
    if (layer.printable === false) warnings.push({ type: 'print', objectId: object.id, message: `${object.name || toolNames[object.type] || 'Objekt'} liegt auf der nicht druckbaren Ebene „${layer.name}“.` });
  });
  state.materials.forEach((item, index) => { materialObjectIds(item).filter(id => !objectIds.has(id)).forEach(() => warnings.push({ type: 'material', message: `Materialposition ${item.pos || index + 1} verweist auf ein gelöschtes Objekt.` })); });
  enabledViews().forEach(view => {
    const setting = ensureViewSetting(view); const hasManualPosition = Number.isFinite(setting.exportX) || Number.isFinite(setting.exportY);
    if (!hasManualPosition) return;
    const objects = state.objects.filter(object => objectView(object) === view && isObjectPrintable(object)); const bounds = exportBoundsForObjects(objects);
    if (!bounds) return;
    const requiredScale = calculateRequiredExportScale(bounds) * viewCalibrationFactor(view);
    const requestedScale = setting.autoScale !== false ? 1 : Math.max(1, Number(setting.scale) || 20);
    const exportScale = Math.max(requiredScale, requestedScale);
    const x = Number.isFinite(setting.exportX) ? setting.exportX : sheet.margin; const y = Number.isFinite(setting.exportY) ? setting.exportY : sheet.margin;
    const calibrationFactor = viewCalibrationFactor(view);
    const width = (bounds.maxX - bounds.minX) * calibrationFactor / exportScale; const height = (bounds.maxY - bounds.minY) * calibrationFactor / exportScale;
    if (x < 28 || y < 28 || x + width > sheet.width - 28 || y + height > sheet.height - 28) warnings.push({ type: 'view', view, message: `${viewNames[view]} liegt teilweise außerhalb des ${state.sheetFormat}-Exportblatts.` });
  });
  if (state.exportScaleMode === 'manual') {
    const requiredScale = calculateCommonExportRequirement(exportViewGroups(), 0.001, state.exportScale);
    if (state.exportScale + 0.001 < requiredScale) warnings.push({ type: 'view', message: `Der manuelle Exportmaßstab ${formatScaleRatio(state.exportScale)} ist zu groß für den Inhalt. Mindestens ${formatScaleRatio(Math.ceil(requiredScale * 1000) / 1000)} wird benötigt.` });
  }
  return warnings;
}
function renderProjectWarnings() {
  const list = document.querySelector('#warningList'); const count = document.querySelector('#warningCount'); if (!list || !count) return;
  const warnings = projectWarnings(); count.textContent = warnings.length; count.classList.toggle('has-warnings', warnings.length > 0); list.replaceChildren();
  if (!warnings.length) { const clear = document.createElement('div'); clear.className = 'warning-clear'; clear.textContent = 'Keine Probleme gefunden.'; list.append(clear); return; }
  warnings.forEach(warning => { const button = document.createElement('button'); button.type = 'button'; button.className = `warning-item ${warning.type}`; button.textContent = warning.message; button.addEventListener('click', () => { if (warning.objectId) selectObject(warning.objectId); else if (warning.view) setActiveView(warning.view); }); list.append(button); });
}
function enabledViews() {
  const views = Array.isArray(state.enabledViews) ? state.enabledViews.filter(view => viewNames[view]) : [];
  return views.length ? views : ['front'];
}
function activeViewObjects() {
  const layerOrder = new Map(state.layers.map((layer, index) => [layer.id, index]));
  return state.objects.filter(object => isObjectVisible(object) && objectView(object) === state.activeView).sort((a, b) => (layerOrder.get(objectLayer(a)) ?? 0) - (layerOrder.get(objectLayer(b)) ?? 0));
}
function syncViewControls() {
  const enabled = enabledViews();
  document.querySelectorAll('.view-toggle').forEach(input => { input.checked = enabled.includes(input.value); });
  document.querySelectorAll('.view-button').forEach(button => {
    const active = button.dataset.view === state.activeView;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  const label = document.querySelector('#activeViewLabel');
  if (label) label.textContent = viewNames[state.activeView] || viewNames[enabled[0]];
}
function updateViewsFromControls() {
  const selected = [...document.querySelectorAll('.view-toggle:checked')].map(input => input.value).filter(view => viewNames[view]);
  state.enabledViews = selected.length ? selected : ['front'];
  if (!state.enabledViews.includes(state.activeView)) state.activeView = state.enabledViews[0];
  syncViewControls();
}
function setActiveView(view) {
  if (!viewNames[view]) return;
  saveActiveViewSettings();
  state.activeView = view;
  if (!enabledViews().includes(view)) state.enabledViews = [...enabledViews(), view];
  selectedId = null; selectedIds.clear();
  loadActiveViewSettings();
  syncViewControls();
  render();
  setDirty();
  setStatus(`${viewNames[view]} aktiv`);
}
function commandDefinitions() {
  const toolCommands = Object.entries(toolNames).filter(([tool]) => !['angleDimension', 'polyline', 'ellipse', 'ellipseArc'].includes(tool)).map(([tool, name]) => ({ label: `Werkzeug: ${name}`, keywords: `zeichnen ${tool}`, run: () => setTool(tool) }));
  const woodCommands = Object.entries(woodToolNames).map(([tool, name]) => ({ label: `Werkzeug: ${name}`, keywords: `holz zimmerei fachwerk zeichnen ${tool}`, run: () => setTool(tool) }));
  const viewCommands = Object.entries(viewNames).map(([view, name]) => ({ label: `Ansicht: ${name}`, keywords: 'arbeitsansicht wechseln', run: () => setActiveView(view) }));
  const layerCommands = state.layers.map(layer => ({ label: `Ebene aktivieren: ${layer.name}`, keywords: 'layer ebene', run: () => { state.activeLayer = layer.id; renderLayerControls(); setDirty(); setStatus(`${layer.name} aktiv`); } }));
  return [
    ...toolCommands, ...woodCommands, ...viewCommands, ...layerCommands,
    { label: 'Datei: Neues Projekt', keywords: 'neu leeren', run: () => document.querySelector('#newProject').click() },
    { label: 'Datei: Projekt laden', keywords: 'öffnen werkplan', run: () => fileInput.click() },
    { label: 'Datei: Projekt exportieren', keywords: 'export werkplan datei sichern', run: saveProjectFile },
    { label: 'Bibliothek: Projekt speichern', keywords: 'speichern strg s db lokal autosave', run: saveProject },
    { label: 'Bibliothek: DB exportieren', keywords: 'backup datenbank sichern', run: exportLibraryDb },
    { label: 'Bearbeiten: Rückgängig', keywords: 'undo', run: undo },
    { label: 'Bearbeiten: Wiederholen', keywords: 'redo', run: redo },
    { label: 'Export: SVG', keywords: 'ausgabe', run: exportSheetSvg },
    { label: 'Export: PNG', keywords: 'bild ausgabe', run: exportPng },
    { label: 'Export: PDF', keywords: 'drucken ausgabe', run: exportPdf },
    { label: 'Ansicht: Alles einpassen', keywords: 'zoom fit', run: fitAllObjects },
    { label: 'Ansicht: Auswahl einpassen', keywords: 'zoom objekt fit', run: fitSelectedObject },
    { label: 'Ansicht: Vergrößern', keywords: 'zoom plus', run: () => setViewportZoom(state.zoom * 1.2) },
    { label: 'Ansicht: Verkleinern', keywords: 'zoom minus', run: () => setViewportZoom(state.zoom / 1.2) },
    { label: 'Raster: Anzeige umschalten', keywords: 'grid sichtbar', run: () => document.querySelector('#gridToggle').click() },
    { label: 'Raster: Einrasten umschalten', keywords: 'snap fangen', run: () => document.querySelector('#snapToggle').click() }
  ];
}
function filteredCommands() {
  const query = (document.querySelector('#commandSearch')?.value || '').trim().toLowerCase();
  return commandDefinitions().filter(command => !query || `${command.label} ${command.keywords || ''}`.toLowerCase().includes(query)).slice(0, 14);
}
function renderCommandResults() {
  const results = document.querySelector('#commandResults'); const commands = filteredCommands();
  commandSelectionIndex = Math.max(0, Math.min(commandSelectionIndex, Math.max(0, commands.length - 1)));
  results.replaceChildren();
  if (!commands.length) { const empty = document.createElement('div'); empty.className = 'command-empty'; empty.textContent = 'Kein passender Befehl'; results.append(empty); return; }
  commands.forEach((command, index) => { const button = document.createElement('button'); button.type = 'button'; button.className = index === commandSelectionIndex ? 'active' : ''; button.setAttribute('role', 'option'); button.setAttribute('aria-selected', String(index === commandSelectionIndex)); button.textContent = command.label; button.addEventListener('mouseenter', () => { commandSelectionIndex = index; [...results.querySelectorAll('button')].forEach((item, itemIndex) => { item.classList.toggle('active', itemIndex === index); item.setAttribute('aria-selected', String(itemIndex === index)); }); }); button.addEventListener('click', () => executeCommand(index)); results.append(button); });
}
function openCommandPalette() { const palette = document.querySelector('#commandPalette'); palette.hidden = false; document.querySelector('#commandSearch').value = ''; commandSelectionIndex = 0; renderCommandResults(); requestAnimationFrame(() => document.querySelector('#commandSearch').focus()); }
function closeCommandPalette() { document.querySelector('#commandPalette').hidden = true; }
function executeCommand(index = commandSelectionIndex) { const command = filteredCommands()[index]; if (!command) return; closeCommandPalette(); command.run(); }
function exportViewGroups() {
  const visible = state.objects.filter(isObjectPrintable);
  const grouped = new Map();
  visible.forEach(object => {
    const view = objectView(object);
    if (!grouped.has(view)) grouped.set(view, []);
    grouped.get(view).push(object);
  });
  return viewOrder.filter(view => enabledViews().includes(view)).map(view => ({ view, objects: grouped.get(view) || [] })).filter(group => enabledViews().length > 1 || group.objects.length);
}
function materialTableHeight() {
  const rows = Math.min(state.materials.length, 6);
  return state.materials.length ? 22 * (rows + 2) : 0;
}
function exportDrawingAreaHeight() {
  const titleTop = sheet.height - sheet.margin - sheet.titleHeight;
  const reservedMaterial = materialTableHeight() ? materialTableHeight() + 32 : 0;
  return Math.max(120, titleTop - sheet.margin - 6 - reservedMaterial);
}
function exportPaddingMm(rawBounds, calibrationFactor = 1, exportScale = null) {
  if (!rawBounds) return 0;
  const factor = Number(calibrationFactor) > 0 ? Number(calibrationFactor) : 1;
  const realExtent = Math.max(rawBounds.maxX - rawBounds.minX, rawBounds.maxY - rawBounds.minY) * factor;
  const paddingMm = Math.min(500, Math.max(150, realExtent * 0.08));
  const scale = Number(exportScale);
  return Number.isFinite(scale) && scale > 0 ? Math.min(paddingMm, Math.max(6, 28 * scale)) : paddingMm;
}
function calculateRequiredExportScale(bounds, usableWidth = sheet.width - sheet.margin * 2, usableHeight = exportDrawingAreaHeight(), minimumScale = 1) {
  return Math.max((bounds.maxX - bounds.minX) / usableWidth, (bounds.maxY - bounds.minY) / usableHeight, minimumScale);
}
function calculateAutoScale() {
  updateSheetFromState();
  updateMaterialsFromForm();
  const bounds = boundsForObjects(activeViewObjects(), 500);
  if (!bounds) return state.scale || 20;
  const required = calculateRequiredExportScale(bounds) * viewCalibrationFactor();
  return scaleSteps.find(step => step >= required) || Math.ceil(required / 1000) * 1000;
}
function updateAutoScale() {
  if (!state.autoScale) return;
  state.scale = calculateAutoScale();
}
function syncScaleControls() {
  const select = document.querySelector('#scaleSelect');
  const customWrap = document.querySelector('#customScaleWrap');
  if (state.autoScale) {
    select.value = 'auto';
    customWrap.hidden = true;
    document.querySelector('#customScale').value = state.scale;
    return;
  }
  const preset = [...select.options].some(option => option.value === String(state.scale));
  select.value = preset ? String(state.scale) : 'custom';
  customWrap.hidden = preset;
  document.querySelector('#customScale').value = state.scale;
}
function updateScaleUi() {
  const effectiveScale = state.autoScale ? calculateAutoScale() : state.scale;
  document.querySelector('#scaleMeta').textContent = state.autoScale ? `Auto ${formatScaleRatio(effectiveScale)}` : formatScaleRatio(state.scale);
  document.querySelector('#sheetMeta').textContent = `${state.sheetFormat} ${state.sheetOrientation === 'portrait' ? 'hoch' : 'quer'}`;
  const reference = state.viewReferences[state.activeView];
  document.querySelector('#viewReferenceStatus').textContent = reference ? `${viewNames[state.activeView]} kalibriert: × ${trimNumber(reference.factor)}` : `${viewNames[state.activeView]}: nicht kalibriert`;
  document.querySelector('#scaleDescription').textContent = state.autoScale ? `Der Exportmaßstab wird automatisch als ${formatScaleRatio(effectiveScale)} errechnet. Die Arbeitsfläche bleibt beim Zeichnen stabil.` : `Ein gezeichnetes Blattmaß von 100 mm entspricht bei ${formatScaleRatio(state.scale)} einem echten Maß von ${formatLength(100 * state.scale)}.`;
  document.querySelector('#gridStatus').textContent = `Raster ${formatLength(snapSize * state.scale)}`;
}
function setScale(value) {
  const nextScale = Number(value);
  if (!Number.isFinite(nextScale) || nextScale < 1) return;
  state.autoScale = false;
  state.scale = Math.round(nextScale);
  ensureViewSetting().scale = state.scale; ensureViewSetting().autoScale = false;
  setDirty();
  syncScaleControls();
  render();
  setStatus(`Maßstab 1:${state.scale} eingestellt`);
}
function styleAttrs(object) {
  const baseWidth = Number(object.strokeWidth) || state.strokeWidth;
  const attrs = { stroke: object.stroke || state.strokeColor, 'stroke-width': baseWidth, fill: 'none', 'vector-effect': 'non-scaling-stroke', 'stroke-linecap': 'butt', 'stroke-linejoin': 'miter' };
  if (object.style === 'dashed') { attrs['stroke-dasharray'] = '12 8'; attrs['stroke-width'] = Math.max(.35, baseWidth * .67); }
  if (object.style === 'center') { attrs['stroke-dasharray'] = '24 7 4 7'; attrs['stroke-width'] = Math.max(.35, baseWidth * .67); }
  if (object.style === 'cutting') { attrs['stroke-dasharray'] = '32 7 5 7'; attrs['stroke-width'] = Math.max(1.4, baseWidth * 1.5); }
  return attrs;
}
function rectFillAttrs(object) {
  if (object.fillMode === 'solid') return { fill: '#000000' };
  if (object.fillMode === 'hatch') return { fill: 'url(#hatchFill)' };
  if (object.fillMode === 'crosshatch') return { fill: 'url(#crossHatchFill)' };
  if (object.fillMode === 'reverseHatch') return { fill: 'url(#reverseHatchFill)' };
  if (object.fillMode === 'horizontalHatch') return { fill: 'url(#horizontalHatchFill)' };
  if (object.fillMode === 'verticalHatch') return { fill: 'url(#verticalHatchFill)' };
  if (object.fillMode === 'dots') return { fill: 'url(#dotHatchFill)' };
  if (object.fillMode === 'brick') return { fill: 'url(#brickHatchFill)' };
  if (object.fillMode === 'concrete') return { fill: 'url(#concreteHatchFill)' };
  return { fill: 'none' };
}
function appendDimensionEnds(group, attrs, ax, ay, bx, by, color) {
  const style = dimensionStyle();
  const angle = Math.atan2(by - ay, bx - ax);
  if (style.endStyle === 'slash') {
    const slash = Math.PI / 4;
    const size = 10;
    [[ax, ay], [bx, by]].forEach(([x, y]) => {
      group.append(makeSvg('line', { ...attrs, x1: x - Math.cos(angle + slash) * size, y1: y - Math.sin(angle + slash) * size, x2: x + Math.cos(angle + slash) * size, y2: y + Math.sin(angle + slash) * size }));
    });
    return;
  }
  group.append(makeSvg('path', { ...attrs, d: `M ${ax} ${ay} l 8 -4 l 0 8 z M ${bx} ${by} l -8 -4 l 0 8 z`, fill: color }));
}
function renderObject(object, layer = drawingLayer) {
  let element;
  const attrs = styleAttrs(object);
  if (object.type === 'line') element = makeSvg('line', { ...attrs, x1: canvasValue(object.x1), y1: canvasValue(object.y1), x2: canvasValue(object.x2), y2: canvasValue(object.y2) });
  if (object.type === 'rect') {
    const centerX = canvasValue(object.x + object.width / 2); const centerY = canvasValue(object.y + object.height / 2);
    const path = rectShapePath(object);
    element = path ? makeSvg('path', { ...attrs, ...rectFillAttrs(object), d: path, transform: `rotate(${(object.rotation || 0) * 180 / Math.PI} ${centerX} ${centerY})` }) : makeSvg('rect', { ...attrs, ...rectFillAttrs(object), x: canvasValue(object.x), y: canvasValue(object.y), width: canvasValue(object.width), height: canvasValue(object.height), rx: object.cornerMode === 'round' ? canvasValue(object.cornerSize || 0) : 0, transform: `rotate(${(object.rotation || 0) * 180 / Math.PI} ${centerX} ${centerY})` });
  }
  if (object.type === 'circle') element = makeSvg('circle', { ...attrs, cx: canvasValue(object.x), cy: canvasValue(object.y), r: canvasValue(object.r) });
  if (object.type === 'semicircle') element = makeSvg('path', { ...attrs, d: semicirclePath(object) });
  if (object.type === 'polyline') element = makeSvg('polyline', { ...attrs, points: object.points.map(point => `${canvasValue(point.x)},${canvasValue(point.y)}`).join(' ') });
  if (object.type === 'polygon') element = makeSvg('polygon', { ...attrs, points: object.points.map(point => `${canvasValue(point.x)},${canvasValue(point.y)}`).join(' ') });
  if (object.type === 'ellipse') { const cx = canvasValue(object.x); const cy = canvasValue(object.y); element = makeSvg('ellipse', { ...attrs, cx, cy, rx: canvasValue(object.rx), ry: canvasValue(object.ry), transform: `rotate(${(object.rotation || 0) * 180 / Math.PI} ${cx} ${cy})` }); }
  if (object.type === 'ellipseArc') { const cx = canvasValue(object.x); const cy = canvasValue(object.y); element = makeSvg('path', { ...attrs, d: ellipseArcPath(object), transform: `rotate(${(object.rotation || 0) * 180 / Math.PI} ${cx} ${cy})` }); }
  if (object.type === 'slot') element = makeSvg('path', { ...attrs, d: slotPath(object) });
  if (object.type === 'angleDimension') {
    const style = dimensionStyle();
    const radius = Math.max(1, object.r || 500);
    const center = { x: canvasValue(object.cx), y: canvasValue(object.cy) };
    const scale = drawingScale();
    const start = polarPoint(center, radius / scale, object.startAngle || 0);
    const end = polarPoint(center, radius / scale, (object.startAngle || 0) + shortestAngleDelta(object.startAngle || 0, object.endAngle || 0));
    const mid = polarPoint(center, (radius + 180) / scale, (object.startAngle || 0) + shortestAngleDelta(object.startAngle || 0, object.endAngle || 0) / 2);
    element = makeSvg('g', { class: 'dimension-object' });
    element.append(
      makeSvg('line', { ...attrs, x1: center.x, y1: center.y, x2: start.x, y2: start.y }),
      makeSvg('line', { ...attrs, x1: center.x, y1: center.y, x2: end.x, y2: end.y }),
      makeSvg('path', { ...attrs, d: angleArcPath(object) })
    );
    const label = makeSvg('text', { x: mid.x, y: mid.y, 'text-anchor': 'middle', class: 'dimension-label', 'font-size': style.textSize });
    label.textContent = angleDimensionLabel(object);
    element.append(label);
  }
  if (object.type === 'dimension') {
    const { x1, y1, x2, y2 } = object;
    const dx = x2 - x1; const dy = y2 - y1; const length = Math.max(1, Math.round(Math.hypot(dx, dy)));
    const style = dimensionStyle();
    const offset = Number.isFinite(Number(object.offset)) ? Number(object.offset) : style.defaultOffset; const normal = { x: -dy / (length || 1), y: dx / (length || 1) };
    const ax = canvasValue(x1) + normal.x * offset; const ay = canvasValue(y1) + normal.y * offset; const bx = canvasValue(x2) + normal.x * offset; const by = canvasValue(y2) + normal.y * offset;
    element = makeSvg('g', { class: 'dimension-object' });
    element.append(makeSvg('line', { ...attrs, x1: canvasValue(x1), y1: canvasValue(y1), x2: ax, y2: ay }), makeSvg('line', { ...attrs, x1: canvasValue(x2), y1: canvasValue(y2), x2: bx, y2: by }), makeSvg('line', { ...attrs, x1: ax, y1: ay, x2: bx, y2: by }));
    appendDimensionEnds(element, attrs, ax, ay, bx, by, object.stroke || state.strokeColor);
    const label = makeSvg('text', { x: (ax + bx) / 2, y: (ay + by) / 2 - 7, 'text-anchor': 'middle', class: 'dimension-label', 'font-size': style.textSize });
    label.textContent = dimensionLabelText(object, length); element.append(label);
  }
  if (object.type === 'text') { const x = canvasValue(object.x); const y = canvasValue(object.y); element = makeSvg('text', { ...attrs, x, y, stroke: 'none', fill: object.stroke || state.strokeColor, 'font-size': 16, transform: `rotate(${(object.rotation || 0) * 180 / Math.PI} ${x} ${y})` }); element.textContent = object.value; }
  if (!element) return null;
  element.dataset.id = object.id;
  if (selectedIds.has(object.id) || object.id === selectedId) element.classList.add('selected-shape');
  element.addEventListener('pointerdown', event => { if (state.tool === 'select' && layer === drawingLayer && !isObjectLocked(object)) { event.preventDefault(); event.stopPropagation(); canvas.setPointerCapture?.(event.pointerId); startDraggingObject(object, eventPoint(event), event.shiftKey); } });
  layer.append(element);
  return element;
}
function render() {
  addFillPatterns(canvas);
  drawingLayer.replaceChildren(); activeViewObjects().forEach(object => renderObject(object));
  renderMaterialMarkers();
  emptyState.classList.toggle('hidden', activeViewObjects().length > 0);
  document.querySelector('#objectCount').textContent = logicalObjectEntries().length;
  document.querySelector('#gridLayer').style.display = state.grid ? '' : 'none';
  document.querySelector('#zoomLabel').textContent = `${Math.round(state.zoom * 100)}%`;
  updateScaleUi();
  canvas.classList.toggle('select-mode', state.tool === 'select');
  if (selectedIds.size > 1) showMultiSelectionProperties();
  else if (selectedId) { const selected = state.objects.find(object => object.id === selectedId); if (selected) showProperties(selected); }
  renderHandles();
  renderObjectList();
  renderProjectWarnings();
  updateHistoryControls();
}
function renderMaterialMarkers() {
  activeViewObjects().forEach(object => {
    const labels = materialMarkersForObject(object);
    const point = labels.length ? materialMarkerPoint(object) : null;
    if (!point) return;
    const group = makeSvg('g', { class: 'material-marker' });
    const x = canvasValue(point.x); const y = canvasValue(point.y);
    group.append(makeSvg('circle', { cx: x, cy: y, r: 13 }));
    const text = makeSvg('text', { x, y: y + 4, 'text-anchor': 'middle' });
    text.textContent = labels.map(label => label.replace('Pos. ', '')).join('/');
    group.append(text);
    drawingLayer.append(group);
  });
}

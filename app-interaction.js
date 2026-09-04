function snapshotObjects() { return JSON.stringify(state.objects); }
function restoreObjects(snapshot) { state.objects = JSON.parse(snapshot); selectedId = null; selectedIds.clear(); render(); }
function setDirty(dirty = true) {
  state.dirty = dirty;
  document.title = `${dirty ? '* ' : ''}${documentTitle}`;
  if (dirty) scheduleLibraryAutoSave();
}
function updateHistoryControls() {
  const undoButton = document.querySelector('#undoAction');
  const redoButton = document.querySelector('#redoAction');
  if (undoButton) undoButton.disabled = !state.history.length;
  if (redoButton) redoButton.disabled = !state.redo.length;
}
function pushHistory() { state.history.push(snapshotObjects()); state.redo = []; if (state.history.length > 30) state.history.shift(); setDirty(); }
function undo() { if (!state.history.length) { setStatus('Nichts zum Rückgängig machen'); return; } state.redo.push(snapshotObjects()); restoreObjects(state.history.pop()); setDirty(); setStatus('Letzte Aktion rückgängig gemacht'); }
function redo() { if (!state.redo.length) { setStatus('Nichts zum Wiederholen'); return; } state.history.push(snapshotObjects()); restoreObjects(state.redo.pop()); setDirty(); setStatus('Wiederholt'); }
function addObject(object) { pushHistory(); state.objects.push({ ...object, id: newId(), view: object.view || state.activeView, layer: object.layer || state.activeLayer || defaultLayerForType(object.type), style: state.style, strokeWidth: state.strokeWidth, stroke: state.strokeColor }); selectedId = null; selectedIds.clear(); render(); setStatus('Objekt hinzugefügt'); }
function selectedObjects() { return state.objects.filter(object => selectedIds.has(object.id)); }
function selectObject(id, additive = false) {
  if (additive && selectedIds.has(id)) selectedIds.delete(id);
  else { if (!additive) selectedIds.clear(); selectedIds.add(id); }
  selectedId = selectedIds.has(id) ? id : [...selectedIds].at(-1) || null;
  const object = state.objects.find(item => item.id === id);
  if (object) {
    if (state.activeView !== objectView(object)) saveActiveViewSettings();
    state.activeView = objectView(object);
    loadActiveViewSettings();
    if (!enabledViews().includes(state.activeView)) state.enabledViews = [...enabledViews(), state.activeView];
    syncViewControls();
  }
  render();
  if (object) setStatus(selectedIds.size > 1 ? `${selectedIds.size} Objekte ausgewählt` : `${toolNames[object.type] || 'Objekt'} ausgewählt`);
}
function setStatus(message, type = '') {
  statusText.textContent = message;
  statusText.classList.toggle('status-success', type === 'success');
  statusText.classList.toggle('status-error', type === 'error');
  if (pageMessage) {
    clearTimeout(pageMessageTimer);
    pageMessage.textContent = message;
    pageMessage.className = `page-message ${type ? `page-message-${type}` : ''}`.trim();
    pageMessage.hidden = type !== 'success';
    if (type === 'success') {
      pageMessageTimer = setTimeout(() => { pageMessage.hidden = true; }, 3000);
    }
  }
}
function applyViewBox() {
  canvas.setAttribute('viewBox', `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`);
  const gridLayer = document.querySelector('#gridLayer');
  if (gridLayer) {
    const padX = Math.max(2000, viewBox.width * 8);
    const padY = Math.max(2000, viewBox.height * 8);
    gridLayer.setAttribute('x', String(viewBox.x - padX));
    gridLayer.setAttribute('y', String(viewBox.y - padY));
    gridLayer.setAttribute('width', String(viewBox.width + padX * 2));
    gridLayer.setAttribute('height', String(viewBox.height + padY * 2));
  }
  state.zoom = 1200 / viewBox.width;
  if (state.viewSettings) ensureViewSetting().viewBox = { ...viewBox };
  document.querySelector('#zoomLabel').textContent = `${Math.round(state.zoom * 100)}%`;
}
function canvasScreenPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: viewBox.x + (event.clientX - rect.left) / rect.width * viewBox.width,
    y: viewBox.y + (event.clientY - rect.top) / rect.height * viewBox.height
  };
}
function setViewportZoom(nextZoom, anchor = { x: viewBox.x + viewBox.width / 2, y: viewBox.y + viewBox.height / 2 }) {
  const zoom = Math.max(0.25, Math.min(8, nextZoom));
  const width = 1200 / zoom;
  const height = 760 / zoom;
  const ratioX = (anchor.x - viewBox.x) / viewBox.width;
  const ratioY = (anchor.y - viewBox.y) / viewBox.height;
  viewBox = { x: anchor.x - width * ratioX, y: anchor.y - height * ratioY, width, height };
  applyViewBox();
}
function fitCanvasBounds(bounds) {
  if (!bounds) {
    viewBox = { x: 0, y: 0, width: 1200, height: 760 };
    applyViewBox();
    return;
  }
  const padding = 45;
  const scale = drawingScale();
  let minX = bounds.minX / scale - padding;
  let minY = bounds.minY / scale - padding;
  let width = Math.max(20, (bounds.maxX - bounds.minX) / scale + padding * 2);
  let height = Math.max(20, (bounds.maxY - bounds.minY) / scale + padding * 2);
  const aspect = 1200 / 760;
  if (width / height > aspect) {
    const nextHeight = width / aspect;
    minY -= (nextHeight - height) / 2;
    height = nextHeight;
  } else {
    const nextWidth = height * aspect;
    minX -= (nextWidth - width) / 2;
    width = nextWidth;
  }
  viewBox = { x: minX, y: minY, width, height };
  applyViewBox();
}
function fitAllObjects() { fitCanvasBounds(boundsForObjects(activeViewObjects())); setStatus(activeViewObjects().length ? 'Zeichnung eingepasst' : 'Gesamtansicht'); }
function fitSelectedObject() {
  const object = state.objects.find(item => item.id === selectedId);
  if (!object) { setStatus('Kein Objekt ausgewählt'); return; }
  fitCanvasBounds(objectBounds(object));
  setStatus('Auswahl eingepasst');
}
function objectSummary(object) {
  if (object.type === 'line') return formatLength(calibratedLength(distance({ x: object.x1, y: object.y1 }, { x: object.x2, y: object.y2 }), object));
  if (object.type === 'dimension') return dimensionLabelText(object, distance({ x: object.x1, y: object.y1 }, { x: object.x2, y: object.y2 }));
  if (object.type === 'angleDimension') return angleDimensionLabel(object);
  if (object.type === 'rect') return `${formatLength(calibratedLength(object.width, object))} x ${formatLength(calibratedLength(object.height, object))}`;
  if (object.type === 'circle' || object.type === 'semicircle') return `R ${formatLength(calibratedLength(object.r, object))}`;
  if (object.type === 'ellipse' || object.type === 'ellipseArc') return `${formatLength(calibratedLength(object.rx * 2, object))} x ${formatLength(calibratedLength(object.ry * 2, object))}`;
  if (object.type === 'slot') return `${formatLength(calibratedLength(distance({ x: object.x1, y: object.y1 }, { x: object.x2, y: object.y2 }) + object.width, object))} x ${formatLength(calibratedLength(object.width, object))}`;
  if (object.type === 'polygon') return `${object.points.length}-Eck`;
  if (object.type === 'text') return object.value || 'Text';
  return 'Objekt';
}
function logicalObjectEntries() {
  const entries = []; const groups = new Map();
  state.objects.forEach(object => {
    if (!object.groupId) { entries.push({ key: object.id, members: [object] }); return; }
    if (!groups.has(object.groupId)) { const entry = { key: object.groupId, members: [] }; groups.set(object.groupId, entry); entries.push(entry); }
    groups.get(object.groupId).members.push(object);
  });
  return entries;
}
function renderObjectList() {
  const list = document.querySelector('#objectList');
  if (!list) return;
  list.replaceChildren();
  if (!state.objects.length) {
    const empty = document.createElement('div');
    empty.className = 'property-empty';
    empty.textContent = 'Keine Objekte.';
    list.append(empty);
    return;
  }
  const search = (document.querySelector('#objectSearch')?.value || '').toLowerCase(); const typeFilter = document.querySelector('#objectTypeFilter')?.value || ''; const viewFilter = document.querySelector('#objectViewFilter')?.value || ''; const layerFilter = document.querySelector('#objectLayerFilter')?.value || '';
  logicalObjectEntries().forEach((entry, index) => {
    const members = entry.members; const object = members.find(item => item.type !== 'dimension' && item.type !== 'angleDimension') || members[0];
    const toolId = members.find(item => item.woodTool)?.woodTool; const groupName = toolId ? woodToolNames[toolId] : members.length > 1 ? 'Gruppe' : object.name || toolNames[object.type] || object.type;
    const searchable = `${groupName} ${members.map(item => `${item.name || ''} ${toolNames[item.type] || item.type}`).join(' ')}`.toLowerCase();
    if ((search && !searchable.includes(search)) || (typeFilter && !members.some(item => item.type === typeFilter)) || (viewFilter && !members.some(item => objectView(item) === viewFilter)) || (layerFilter && !members.some(item => objectLayer(item) === layerFilter))) return;
    const row = document.createElement('div');
    const memberIds = new Set(members.map(item => item.id)); const linked = state.materials.filter(item => materialObjectIds(item).some(id => memberIds.has(id)));
    const dimensions = members.filter(item => item.type === 'dimension' || item.type === 'angleDimension').length + state.objects.filter(item => item.type === 'dimension' && members.some(member => item.sourceRectId === member.id || item.sourceObjectId === member.id)).length;
    const materialSuffix = `${dimensions ? ` | ${dimensions} Maß(e)` : ''}${linked.length ? ` | Material: ${linked.map(item => `${item.name || 'Teil'} x${item.objectQty || 1}`).join(', ')}` : ''}`;
    row.className = `object-row${members.some(item => selectedIds.has(item.id)) ? ' active' : ''}`;
    const activeLayerMarker = objectLayer(object) === state.activeLayer ? '◆ ' : '';
    const geometryMembers = members.filter(item => item.type !== 'dimension' && item.type !== 'angleDimension'); const bounds = boundsForObjects(geometryMembers.length ? geometryMembers : members);
    const summary = members.length > 1 && bounds ? `${formatLength(calibratedLength(bounds.maxX - bounds.minX, object))} x ${formatLength(calibratedLength(bounds.maxY - bounds.minY, object))}` : objectSummary(object);
    const label = `${index + 1}. ${groupName} - ${summary} - ${viewNames[objectView(object)]}`;
    const allHidden = members.every(item => item.visible === false); const anyLocked = members.some(isObjectLocked);
    row.innerHTML = `<button type="button" title="Sichtbarkeit">${allHidden ? '○' : '●'}</button><button type="button" title="Sperre">${anyLocked ? '■' : '□'}</button><span title="${escapeHtml(materialSuffix || `${members.length} Teil(e)`)}">${activeLayerMarker}${escapeHtml(label + materialSuffix)}</span><button type="button" title="Auswählen">›</button>`;
    const selectEntry = () => { selectObject(object.id); members.forEach(item => selectedIds.add(item.id)); selectedId = object.id; render(); setStatus(`${groupName} ausgewählt`); };
    row.querySelector('button:first-child').addEventListener('click', event => { event.stopPropagation(); pushHistory(); const visible = allHidden; members.forEach(item => { item.visible = visible; }); render(); setStatus(`${groupName} ${visible ? 'eingeblendet' : 'ausgeblendet'}`); });
    row.querySelector('button:nth-child(2)').addEventListener('click', event => { event.stopPropagation(); pushHistory(); const locked = !anyLocked; members.forEach(item => { item.locked = locked; }); render(); setStatus(`${groupName} ${locked ? 'gesperrt' : 'entsperrt'}`); });
    row.querySelector('button:last-child').addEventListener('click', event => { event.stopPropagation(); selectEntry(); });
    row.addEventListener('click', selectEntry);
    list.append(row);
  });
}
function clearPreview() { previewLayer.replaceChildren(); }
function previewLine(a, b) { clearPreview(); renderObject({ type: 'line', x1: a.x, y1: a.y, x2: b.x, y2: b.y, style: state.style, strokeWidth: state.strokeWidth, stroke: state.strokeColor }, previewLayer); }
function drawAngleLabel(start, end) {
  if (!start || !end || distance(start, end) < 1) return;
  const x = canvasValue(end.x);
  const y = canvasValue(end.y);
  const label = makeSvg('text', { x: x + 12, y: y - 12, fill: '#075e5a', 'font-size': 13, 'font-weight': 700, 'paint-order': 'stroke', stroke: '#fffdf8', 'stroke-width': 4, 'stroke-linejoin': 'round' });
  label.textContent = formatAngle(angleDegrees(start, end));
  previewLayer.append(label);
}
function addHandle(x, y, kind) {
  const handle = makeSvg('circle', { cx: canvasValue(x), cy: canvasValue(y), r: 6, class: 'handle-point', 'data-handle': kind });
  handle.addEventListener('pointerdown', event => {
    event.preventDefault();
    event.stopPropagation();
    const object = state.objects.find(item => item.id === selectedId);
    if (!object) return;
    pushHistory();
    draggingHandle = { object, kind };
    canvas.setPointerCapture?.(event.pointerId);
  });
  drawingLayer.append(handle);
}
function ellipseHandlePoint(object, kind) {
  const angle = object.rotation || 0;
  if (kind === 'ellipseRx') return polarPoint({ x: object.x, y: object.y }, object.rx, angle);
  if (kind === 'ellipseRy') return polarPoint({ x: object.x, y: object.y }, object.ry, angle + Math.PI / 2);
  return { x: object.x, y: object.y };
}
function slotWidthHandlePoint(object) {
  const dx = object.x2 - object.x1;
  const dy = object.y2 - object.y1;
  const length = Math.hypot(dx, dy) || 1;
  return {
    x: (object.x1 + object.x2) / 2 - dy / length * object.width / 2,
    y: (object.y1 + object.y2) / 2 + dx / length * object.width / 2
  };
}
function renderHandles() {
  const object = state.objects.find(item => item.id === selectedId && item.visible !== false && objectView(item) === state.activeView);
  if (!object || state.tool !== 'select' || isObjectLocked(object)) return;
  if (object.type === 'line' || object.type === 'dimension') {
    addHandle(object.x1, object.y1, 'p1');
    addHandle(object.x2, object.y2, 'p2');
  }
  if (object.type === 'rect') {
    const [nw, ne, se, sw] = rectCorners(object);
    addHandle(nw.x, nw.y, 'nw');
    addHandle(ne.x, ne.y, 'ne');
    addHandle(se.x, se.y, 'se');
    addHandle(sw.x, sw.y, 'sw');
  }
  if (object.type === 'circle') addHandle(object.x + object.r, object.y, 'radius');
  if (object.type === 'semicircle') {
    const start = polarPoint(object, object.r, object.angle || 0);
    const end = polarPoint(object, object.r, (object.angle || 0) + Math.PI);
    addHandle(start.x, start.y, 'arcStart');
    addHandle(end.x, end.y, 'arcEnd');
  }
  if (object.type === 'ellipse' || object.type === 'ellipseArc') {
    const rx = ellipseHandlePoint(object, 'ellipseRx');
    const ry = ellipseHandlePoint(object, 'ellipseRy');
    addHandle(rx.x, rx.y, 'ellipseRx');
    addHandle(ry.x, ry.y, 'ellipseRy');
  }
  if (object.type === 'slot') {
    const width = slotWidthHandlePoint(object);
    addHandle(object.x1, object.y1, 'p1');
    addHandle(object.x2, object.y2, 'p2');
    addHandle(width.x, width.y, 'slotWidth');
  }
  if (object.type === 'polyline' || object.type === 'polygon') object.points.forEach((point, index) => addHandle(point.x, point.y, `point:${index}`));
  if (object.type === 'text') addHandle(object.x, object.y, 'textAnchor');
  if (object.type === 'angleDimension') {
    addHandle(object.cx, object.cy, 'angleCenter');
    const start = polarPoint({ x: object.cx, y: object.cy }, object.r, object.startAngle || 0);
    const end = polarPoint({ x: object.cx, y: object.cy }, object.r, object.endAngle || 0);
    addHandle(start.x, start.y, 'angleStart');
    addHandle(end.x, end.y, 'angleEnd');
  }
}
function resizeRectFromCorner(object, kind, point) {
  const corners = rectCorners(object);
  const oppositeIndex = { nw: 2, ne: 3, se: 0, sw: 1 }[kind];
  if (oppositeIndex === undefined) return;
  const opposite = corners[oppositeIndex];
  const angle = object.rotation || 0;
  const axisX = { x: Math.cos(angle), y: Math.sin(angle) };
  const axisY = { x: -Math.sin(angle), y: Math.cos(angle) };
  const dx = point.x - opposite.x;
  const dy = point.y - opposite.y;
  const width = Math.max(1, Math.abs(dx * axisX.x + dy * axisX.y));
  const height = Math.max(1, Math.abs(dx * axisY.x + dy * axisY.y));
  object.x = (point.x + opposite.x) / 2 - width / 2;
  object.y = (point.y + opposite.y) / 2 - height / 2;
  object.width = width;
  object.height = height;
}
function resizeEllipseFromHandle(object, kind, point) {
  const local = rotatePoint(point, { x: object.x, y: object.y }, -(object.rotation || 0));
  if (kind === 'ellipseRx') object.rx = Math.max(1, Math.abs(local.x - object.x));
  if (kind === 'ellipseRy') object.ry = Math.max(1, Math.abs(local.y - object.y));
}
function moveHandle(point) {
  if (!draggingHandle) return;
  const { object, kind } = draggingHandle;
  if (kind === 'p1') { object.x1 = point.x; object.y1 = point.y; }
  if (kind === 'p2') { object.x2 = point.x; object.y2 = point.y; }
  if (object.type === 'rect') {
    resizeRectFromCorner(object, kind, point);
  }
  if (object.type === 'circle' && kind === 'radius') object.r = Math.max(1, distance({ x: object.x, y: object.y }, point));
  if (object.type === 'semicircle' && (kind === 'arcStart' || kind === 'arcEnd')) {
    object.r = Math.max(1, distance({ x: object.x, y: object.y }, point));
    object.angle = Math.atan2(point.y - object.y, point.x - object.x) - (kind === 'arcEnd' ? Math.PI : 0);
  }
  if ((object.type === 'ellipse' || object.type === 'ellipseArc') && (kind === 'ellipseRx' || kind === 'ellipseRy')) resizeEllipseFromHandle(object, kind, point);
  if (object.type === 'slot' && kind === 'slotWidth') object.width = Math.max(1, distanceToLine(point, object.x1, object.y1, object.x2, object.y2) * 2);
  if ((object.type === 'polyline' || object.type === 'polygon') && kind.startsWith('point:')) {
    const index = Number(kind.split(':')[1]);
    if (object.points[index]) { object.points[index].x = point.x; object.points[index].y = point.y; }
  }
  if (object.type === 'text' && kind === 'textAnchor') { object.x = point.x; object.y = point.y; }
  if (object.type === 'angleDimension' && kind === 'angleCenter') { object.cx = point.x; object.cy = point.y; }
  if (object.type === 'angleDimension' && (kind === 'angleStart' || kind === 'angleEnd')) {
    object.r = Math.max(1, distance({ x: object.cx, y: object.cy }, point));
    object[kind === 'angleStart' ? 'startAngle' : 'endAngle'] = Math.atan2(point.y - object.cy, point.x - object.cx);
  }
  syncLinkedDimensions(object);
  render();
}
function previewPolyline(currentPoint = null) {
  clearPreview();
  if (!polylinePoints.length) return;
  const points = currentPoint ? [...polylinePoints, currentPoint] : polylinePoints;
  if (points.length > 1) renderObject({ type: 'polyline', points, style: state.style, strokeWidth: state.strokeWidth, stroke: state.strokeColor }, previewLayer);
}
function finishPolyline() {
  if (polylinePoints.length > 1) addObject({ type: 'polyline', points: polylinePoints });
  polylinePoints = [];
  pointerStart = null;
  clearPreview();
}
function drawSnapMarker() {
  if (!currentSnap) return;
  const x = canvasValue(currentSnap.point.x);
  const y = canvasValue(currentSnap.point.y);
  const group = makeSvg('g', { class: 'snap-marker' });
  if (currentSnap.guide) group.append(makeSvg('line', { x1: canvasValue(currentSnap.guide.x1), y1: canvasValue(currentSnap.guide.y1), x2: canvasValue(currentSnap.guide.x2), y2: canvasValue(currentSnap.guide.y2), class: 'snap-guide' }));
  group.append(
    makeSvg('circle', { cx: x, cy: y, r: 7, fill: 'none', stroke: '#f0a52d', 'stroke-width': 1.8, 'vector-effect': 'non-scaling-stroke' }),
    makeSvg('line', { x1: x - 10, y1: y, x2: x + 10, y2: y, stroke: '#f0a52d', 'stroke-width': 1.4, 'vector-effect': 'non-scaling-stroke' }),
    makeSvg('line', { x1: x, y1: y - 10, x2: x, y2: y + 10, stroke: '#f0a52d', 'stroke-width': 1.4, 'vector-effect': 'non-scaling-stroke' })
  );
  const label = makeSvg('text', { x: x + 12, y: y - 10, fill: '#9b5b00', 'font-size': 11, 'font-weight': 700 });
  label.textContent = currentSnap.type;
  group.append(label);
  previewLayer.append(group);
}
function applyAngleConstraint(start, current, event) {
  const angleInput = document.querySelector('#targetAngle')?.value;
  const fixedAngle = Number(angleInput);
  const useFixedAngle = angleInput !== '' && Number.isFinite(fixedAngle);
  if (!event?.shiftKey && !useFixedAngle) return current;
  const dx = current.x - start.x;
  const dy = current.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length < 1) return current;
  const angle = useFixedAngle ? fixedAngle * Math.PI / 180 : Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
  return { x: start.x + Math.cos(angle) * length, y: start.y + Math.sin(angle) * length };
}
function exactRectEndPoint(start, current) {
  const widthInput = document.querySelector('#targetRectWidth')?.value;
  const heightInput = document.querySelector('#targetRectHeight')?.value;
  const width = modelLength(Number(widthInput));
  const height = modelLength(Number(heightInput));
  if (widthInput === '' || heightInput === '') return current;
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) return current;
  return { x: start.x + width * (current.x < start.x ? -1 : 1), y: start.y + height * (current.y < start.y ? -1 : 1) };
}
function startDraggingObject(object, point, additive = false) {
  if (additive || !selectedIds.has(object.id)) selectObject(object.id, additive);
  if (object.groupId && !additive) state.objects.filter(item => item.groupId === object.groupId).forEach(item => selectedIds.add(item.id));
  selectedId = object.id;
  draggingObject = object;
  draggingObjects = selectedObjects().filter(item => !isObjectLocked(item));
  dragMode = object.type === 'dimension' ? 'dimensionOffset' : 'move';
  pointerStart = point;
  dragChanged = false;
  dragHistoryCaptured = false;
  render();
  setStatus(object.type === 'dimension' ? 'Bemaßungsabstand verschieben' : `${toolNames[object.type] || 'Objekt'} zum Verschieben ausgewählt`);
}
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character])); }
function unitInput(name, value, unit = 'mm', attrs = '') {
  return `<span class="unit-input"><input name="${name}" type="number" step="1" value="${value}" ${attrs}><span>${unit}</span></span>`;
}
function geometryFields(object) {
  const real = value => calibratedLength(value, object);
  if (object.type === 'line' || object.type === 'dimension') return `<label>X1 ${unitInput('x1', real(object.x1))}</label><label>Y1 ${unitInput('y1', real(object.y1))}</label><label>X2 ${unitInput('x2', real(object.x2))}</label><label>Y2 ${unitInput('y2', real(object.y2))}</label>${object.type === 'dimension' ? `<label class="wide-field">Maßlinienabstand ${unitInput('offset', clampDimensionOffset(object.offset), 'px', 'min="-500" max="500"')}</label><label>Einheit<select name="dimensionUnit"><option value="">Global</option><option value="auto">Auto</option><option value="m">m</option><option value="cm">cm</option><option value="mm">mm</option></select></label><label>Nachkommastellen<input name="dimensionDecimals" type="number" min="0" max="3" step="1" value="${object.dimensionDecimals ?? ''}" placeholder="${dimensionStyle().decimals}"></label><label class="wide-field">Maßtext manuell<input name="labelOverride" type="text" placeholder="leer = automatisch" value="${escapeHtml(object.labelOverride || '')}"></label>` : ''}`;
  if (object.type === 'circle') return `<label>X Mitte ${unitInput('x', real(object.x))}</label><label>Y Mitte ${unitInput('y', real(object.y))}</label><label class="wide-field">Radius ${unitInput('r', real(object.r), 'mm', 'min="1"')}</label>`;
  if (object.type === 'semicircle') return `<label>X Mitte ${unitInput('x', real(object.x))}</label><label>Y Mitte ${unitInput('y', real(object.y))}</label><label>Radius ${unitInput('r', real(object.r), 'mm', 'min="1"')}</label><label>Winkel ${unitInput('angleDeg', Math.round(((object.angle || 0) * 180 / Math.PI + 360) % 360), '°')}</label>`;
  if (object.type === 'ellipse' || object.type === 'ellipseArc') return `<label>X Mitte ${unitInput('x', real(object.x))}</label><label>Y Mitte ${unitInput('y', real(object.y))}</label><label>Radius X ${unitInput('rx', real(object.rx), 'mm', 'min="1"')}</label><label>Radius Y ${unitInput('ry', real(object.ry), 'mm', 'min="1"')}</label>`;
  if (object.type === 'slot') return `<label>X1 ${unitInput('x1', real(object.x1))}</label><label>Y1 ${unitInput('y1', real(object.y1))}</label><label>X2 ${unitInput('x2', real(object.x2))}</label><label>Y2 ${unitInput('y2', real(object.y2))}</label><label class="wide-field">Breite ${unitInput('width', real(object.width), 'mm', 'min="1"')}</label>`;
  if (object.type === 'angleDimension') return `<label>X Mitte ${unitInput('cx', real(object.cx))}</label><label>Y Mitte ${unitInput('cy', real(object.cy))}</label><label>Radius ${unitInput('r', real(object.r), 'mm', 'min="1"')}</label><label class="wide-field">Winkeltext manuell<input name="labelOverride" type="text" placeholder="leer = automatisch" value="${escapeHtml(object.labelOverride || '')}"></label>`;
  if (object.type === 'rect') return `<label>X ${unitInput('x', real(object.x))}</label><label>Y ${unitInput('y', real(object.y))}</label><label>Breite ${unitInput('width', real(object.width), 'mm', 'min="1"')}</label><label>Höhe ${unitInput('height', real(object.height), 'mm', 'min="1"')}</label><label>Ecken<select name="cornerMode"><option value="square">Rechtwinklig</option><option value="chamfer">Fase</option><option value="round">Abrundung</option></select></label><label>Eckmaß ${unitInput('cornerSize', real(object.cornerSize || 0), 'mm', 'min="0"')}</label><label class="wide-field">Füllung<select name="fillMode"><option value="none">Keine</option><option value="solid">Vollfarbe schwarz</option><option value="hatch">Diagonal 45°</option><option value="reverseHatch">Diagonal -45°</option><option value="crosshatch">Kreuzschraffur</option><option value="horizontalHatch">Horizontal</option><option value="verticalHatch">Vertikal</option><option value="dots">Punktraster</option><option value="brick">Mauerwerk / Ziegel</option><option value="concrete">Beton</option></select></label>`;
  if (object.type === 'text') return `<label class="wide-field">Text<input name="value" type="text" value="${escapeHtml(object.value)}"></label><label>X ${unitInput('x', real(object.x))}</label><label>Y ${unitInput('y', real(object.y))}</label>`;
  return '<div class="property-note">Dieses Objekt hat derzeit keine zusätzlichen Eigenschaften.</div>';
}
function referenceMeasurement(objects, side = 'width') {
  if (objects.length === 1 && (objects[0].type === 'line' || objects[0].type === 'dimension')) return distance({ x: objects[0].x1, y: objects[0].y1 }, { x: objects[0].x2, y: objects[0].y2 });
  const groupId = objects[0]?.groupId;
  const dimensionObjects = objects.filter(object => object.type === 'dimension');
  const groupDimension = groupId ? dimensionObjects.find(object => object.groupId === groupId) : null;
  if (groupDimension) return distance({ x: groupDimension.x1, y: groupDimension.y1 }, { x: groupDimension.x2, y: groupDimension.y2 });
  if (dimensionObjects.length) return distance({ x: dimensionObjects[0].x1, y: dimensionObjects[0].y1 }, { x: dimensionObjects[0].x2, y: dimensionObjects[0].y2 });
  const geometry = objects.filter(object => object.type !== 'dimension' && object.type !== 'angleDimension');
  const bounds = boundsForObjects(geometry.length ? geometry : objects);
  return bounds ? side === 'height' ? bounds.maxY - bounds.minY : bounds.maxX - bounds.minX : 0;
}
function referenceControlHtml(objects) {
  if (!objects.length) return '';
  const object = objects[0]; const viewName = viewNames[objectView(object)]; const linear = objects.length === 1 && (object.type === 'line' || object.type === 'dimension');
  const defaultSide = linear ? 'length' : 'width'; const length = referenceMeasurement(objects, defaultSide);
  const sideControl = linear ? '' : '<select id="referenceSide"><option value="width" selected>Gesamtbreite</option><option value="height">Gesamthöhe</option></select>';
  const rectDimensions = objects.length === 1 && object.type === 'rect' ? '<button id="addRectDimensions" class="reference-button">Breite und Höhe bemaßen</button>' : '';
  return `<details class="reference-box" open><summary>Richtmaß ${viewName}</summary><span>Kalibriert alle Maße und exakten Eingaben dieser Ansicht. Die Geometrie bleibt unverändert.</span><div class="reference-row reference-row-stack">${sideControl}<div class="reference-length-line"><input id="referenceLength" type="number" min="1" step="1" value="${Math.max(1, Math.round(calibratedLength(length, object)))}"><span>mm</span></div><button id="setReference" class="reference-button">Übernehmen</button>${rectDimensions}</div></details>`;
}
function showProperties(object) {
  document.querySelector('#selectionCount').textContent = '1 ausgewählt';
  const measuredLength = object.type === 'line' || object.type === 'dimension' ? distance({ x: object.x1, y: object.y1 }, { x: object.x2, y: object.y2 }) : 0;
  const dimension = object.type === 'dimension' ? dimensionLabelText(object, measuredLength) : object.type === 'angleDimension' ? angleDimensionLabel(object) : object.type === 'line' ? formatLength(calibratedLength(measuredLength, object)) : object.type === 'rect' ? `${formatLength(calibratedLength(object.width, object))} x ${formatLength(calibratedLength(object.height, object))}` : object.type === 'circle' || object.type === 'semicircle' ? `R ${formatLength(calibratedLength(object.r, object))}` : objectSummary(object);
  const rectHasAutoDimensions = object.type === 'rect' && state.objects.some(item => item.type === 'dimension' && item.sourceRectId === object.id);
  const referenceViewName = viewNames[objectView(object)];
  const referenceControl = referenceControlHtml([object]);
  const referenceResetControl = state.viewReferences[objectView(object)] ? '<button id="clearReference" class="copy-button">Richtmaß dieser Ansicht entfernen</button>' : '';
  const rectControls = '';
  const circleControls = object.type === 'circle' || object.type === 'semicircle' ? `<button id="addRadiusDimension" class="copy-button">Radius bemaßen</button><button id="addDiameterDimension" class="copy-button">Durchmesser bemaßen</button>` : '';
  const referenceLine = state.objects.find(item => item.id === angleReferenceId && item.type === 'line');
  const angleReady = object.type === 'line' && referenceLine && referenceLine.id !== object.id;
  const angleControls = object.type === 'line' ? `<button id="rememberAngleLine" class="copy-button" ${referenceLine?.id === object.id ? 'disabled' : ''}>${referenceLine?.id === object.id ? 'Linie 1 gespeichert' : 'Linie 1 merken'}</button><button id="addAngleDimension" class="copy-button" ${angleReady ? '' : 'disabled'}>Winkel zu Linie 1</button>` : '';
  const quickActions = `<div class="quick-actions" aria-label="Schnellaktionen"><button id="quickDuplicate" type="button" title="Duplizieren">Duplizieren</button><button id="quickRotate" type="button" title="Drehen">Drehen</button><button id="quickMirrorH" type="button" title="Horizontal spiegeln">Spiegeln</button><button id="quickDimension" type="button" title="Bemaßen">Bemaßen</button>${object.type === 'line' ? `<button id="quickAngleDimension" type="button" title="Winkel bemaßen" ${angleReady ? '' : 'disabled'}>Winkel bemaßen</button>` : ''}<button id="quickMoveLayer" type="button" title="Auf aktive Ebene verschieben">Auf aktive Ebene</button><button id="quickMoveNewLayer" type="button" title="Auf neue Ebene verschieben">Auf neue Ebene</button><button id="quickDelete" class="delete-button" type="button" title="Auswahl löschen">Löschen</button></div>`;
  const transformControls = `<details class="operation-box" open><summary>Transformieren &amp; duplizieren</summary><div class="operation-grid"><label>Δ X ${unitInput('moveX', 0)}</label><label>Δ Y ${unitInput('moveY', 0)}</label><button id="moveExact" type="button">Verschieben</button><button id="duplicateExact" type="button">Duplizieren</button><label class="wide-field">Drehwinkel ${unitInput('rotateAngle', 0, '°')}</label><button id="rotateExact" type="button">Drehen</button><button id="mirrorHorizontal" type="button">Horizontal spiegeln</button><button id="mirrorVertical" type="button">Vertikal spiegeln</button></div></details>`;
  const lineEditControls = object.type === 'line' ? `<details class="operation-box" open><summary>Linie bearbeiten</summary><div class="operation-grid"><label class="wide-field">Länge ${unitInput('lineEditLength', Math.round(measuredLength / 2), 'mm', 'min="1"')}</label><button id="trimStart" type="button">Anfang trimmen</button><button id="trimEnd" type="button">Ende trimmen</button><button id="extendStart" type="button">Anfang verlängern</button><button id="extendEnd" type="button">Ende verlängern</button><button id="splitLine" class="wide-field" type="button">Bei Länge teilen</button></div></details>` : '';
  const layerOptions = state.layers.map(layer => `<option value="${escapeHtml(layer.id)}">${escapeHtml(layer.name)}</option>`).join('');
  propertyPanel.innerHTML = `<div class="property-form"><label class="wide-field">Objektname<input name="name" value="${escapeHtml(object.name || '')}" placeholder="${toolNames[object.type] || object.type}"></label><label>Typ<input value="${toolNames[object.type] || object.type}" readonly></label><label>Abmessung<input value="${dimension}" readonly></label>${geometryFields(object)}<label>Linienstärke<input name="strokeWidth" type="number" min="0.25" max="2.5" step="0.25" value="${object.strokeWidth}"></label><label>Stil<select name="style"><option value="solid" ${object.style === 'solid' ? 'selected' : ''}>Volllinie</option><option value="dashed" ${object.style === 'dashed' ? 'selected' : ''}>Strichlinie</option><option value="center" ${object.style === 'center' ? 'selected' : ''}>Achse</option></select></label><label>Farbe<input name="stroke" type="color" value="${object.stroke || state.strokeColor}"></label><label>Ebene<select name="layer">${layerOptions}</select></label><label>Gesperrt<select name="locked"><option value="false">Nein</option><option value="true">Ja</option></select></label><label class="wide-field">Ansicht<select name="view"><option value="front">Frontansicht</option><option value="side">Seitenansicht</option><option value="top">Draufsicht</option><option value="detail">Detail</option></select></label></div>${quickActions}${referenceControl}${referenceResetControl}${rectControls}${circleControls}${angleControls}${transformControls}${lineEditControls}<button id="addObjectMaterial" class="copy-button">Als Materialposition übernehmen</button><button id="copyObject" class="copy-button">Kopieren</button>`;
  propertyPanel.querySelector('.property-form').addEventListener('change', applySelectedChanges);
  document.querySelector('[name="view"]').value = objectView(object);
  document.querySelector('[name="layer"]').value = objectLayer(object);
  document.querySelector('[name="locked"]').value = String(object.locked === true);
  if (object.type === 'rect') document.querySelector('[name="cornerMode"]').value = object.cornerMode || 'square';
  if (object.type === 'rect') document.querySelector('[name="fillMode"]').value = object.fillMode || 'none';
  if (object.type === 'dimension' && document.querySelector('[name="dimensionUnit"]')) document.querySelector('[name="dimensionUnit"]').value = object.dimensionUnit || '';
  document.querySelector('#setReference')?.addEventListener('click', setSelectedAsReference);
  document.querySelector('#clearReference')?.addEventListener('click', clearSelectedReference);
  document.querySelector('#referenceSide')?.addEventListener('change', event => { document.querySelector('#referenceLength').value = Math.round(calibratedLength(referenceMeasurement([object], event.target.value), object)); });
  document.querySelector('#addRectDimensions')?.addEventListener('click', addRectDimensions);
  document.querySelector('#addRadiusDimension')?.addEventListener('click', addRadiusDimension);
  document.querySelector('#addDiameterDimension')?.addEventListener('click', addDiameterDimension);
  document.querySelector('#rememberAngleLine')?.addEventListener('click', rememberAngleLine);
  document.querySelector('#addAngleDimension')?.addEventListener('click', addAngleDimension);
  document.querySelector('#quickDuplicate')?.addEventListener('click', duplicateSelectedExact);
  document.querySelector('#quickRotate')?.addEventListener('click', rotateSelectedExact);
  document.querySelector('#quickMirrorH')?.addEventListener('click', () => mirrorSelected('horizontal'));
  document.querySelector('#quickDimension')?.addEventListener('click', dimensionSelectedFromMenu);
  document.querySelector('#quickAngleDimension')?.addEventListener('click', addAngleDimension);
  document.querySelector('#quickMoveLayer')?.addEventListener('click', moveSelectedToActiveLayer);
  document.querySelector('#quickMoveNewLayer')?.addEventListener('click', moveSelectedToNewLayer);
  document.querySelector('#quickDelete')?.addEventListener('click', deleteSelected);
  document.querySelector('#moveExact')?.addEventListener('click', moveSelectedExact);
  document.querySelector('#duplicateExact')?.addEventListener('click', duplicateSelectedExact);
  document.querySelector('#rotateExact')?.addEventListener('click', rotateSelectedExact);
  document.querySelector('#mirrorHorizontal')?.addEventListener('click', () => mirrorSelected('horizontal'));
  document.querySelector('#mirrorVertical')?.addEventListener('click', () => mirrorSelected('vertical'));
  document.querySelector('#trimStart')?.addEventListener('click', () => resizeSelectedLine('start', 'trim'));
  document.querySelector('#trimEnd')?.addEventListener('click', () => resizeSelectedLine('end', 'trim'));
  document.querySelector('#extendStart')?.addEventListener('click', () => resizeSelectedLine('start', 'extend'));
  document.querySelector('#extendEnd')?.addEventListener('click', () => resizeSelectedLine('end', 'extend'));
  document.querySelector('#splitLine')?.addEventListener('click', splitSelectedLine);
  document.querySelector('#addObjectMaterial')?.addEventListener('click', addSelectedToMaterialList);
  document.querySelector('#copyObject')?.addEventListener('click', copySelected);
  document.querySelector('#deleteSelected')?.addEventListener('click', deleteSelected);
}
function showMultiSelectionProperties() {
  const objects = selectedObjects();
  document.querySelector('#selectionCount').textContent = `${objects.length} ausgewählt`;
  const grouped = objects.every(object => object.groupId && object.groupId === objects[0].groupId);
  const referenceControl = referenceControlHtml(objects); const referenceResetControl = state.viewReferences[objectView(objects[0])] ? '<button id="clearReference" class="copy-button">Richtmaß dieser Ansicht entfernen</button>' : '';
  propertyPanel.innerHTML = `<div class="property-note">${objects.length} Teile als ein Werkzeug ausgewählt.</div>${referenceControl}${referenceResetControl}<div class="quick-actions"><button id="moveToActiveLayer" type="button">Auf aktive Ebene</button><button id="moveToNewLayer" type="button">Auf neue Ebene</button><button id="groupSelection" type="button">Gruppieren</button><button id="ungroupSelection" type="button" ${grouped ? '' : 'disabled'}>Gruppierung aufheben</button><button id="addObjectMaterial" type="button">Als Materialposition zuordnen</button><button id="copyObject" type="button">Kopieren</button><label class="wide-field">Drehwinkel ${unitInput('rotateAngle', 90, '°')}</label><button id="rotateExact" type="button">Gemeinsam drehen</button><button id="mirrorHorizontal" type="button">Horizontal spiegeln</button><button id="mirrorVertical" type="button">Vertikal spiegeln</button><button id="deleteSelected" type="button">Auswahl löschen</button></div>${grouped ? `<div class="property-note">Gemeinsame Gruppe</div>` : ''}`;
  document.querySelector('#setReference')?.addEventListener('click', setSelectedAsReference);
  document.querySelector('#clearReference')?.addEventListener('click', clearSelectedReference);
  document.querySelector('#referenceSide')?.addEventListener('change', event => { document.querySelector('#referenceLength').value = Math.round(calibratedLength(referenceMeasurement(objects, event.target.value), objects[0])); });
  document.querySelector('#moveToActiveLayer').addEventListener('click', moveSelectedToActiveLayer);
  document.querySelector('#moveToNewLayer').addEventListener('click', moveSelectedToNewLayer);
  document.querySelector('#groupSelection').addEventListener('click', groupSelection);
  document.querySelector('#ungroupSelection').addEventListener('click', ungroupSelection);
  document.querySelector('#addObjectMaterial').addEventListener('click', addSelectedToMaterialList);
  document.querySelector('#copyObject').addEventListener('click', copySelected);
  document.querySelector('#rotateExact').addEventListener('click', rotateSelectedExact);
  document.querySelector('#mirrorHorizontal').addEventListener('click', () => mirrorSelected('horizontal'));
  document.querySelector('#mirrorVertical').addEventListener('click', () => mirrorSelected('vertical'));
  document.querySelector('#deleteSelected').addEventListener('click', deleteSelected);
}
function groupSelection() {
  const objects = selectedObjects(); if (objects.length < 2) return;
  pushHistory(); const groupId = `gruppe-${newId()}`; objects.forEach(object => { object.groupId = groupId; }); render(); setStatus(`${objects.length} Objekte gruppiert`);
}
function ungroupSelection() {
  const objects = selectedObjects(); if (!objects.length) return;
  pushHistory(); objects.forEach(object => { delete object.groupId; }); render(); setStatus('Gruppierung aufgehoben');
}
function moveSelectedToActiveLayer() {
  const objects = selectedObjects(); if (!objects.length || !state.activeLayer) return;
  pushHistory(); objects.forEach(object => { object.layer = state.activeLayer; }); render(); setStatus(`${objects.length} Objekt(e) auf Ebene „${state.layers.find(layer => layer.id === state.activeLayer)?.name}“ verschoben`);
}
function moveSelectedToNewLayer() {
  if (!selectedObjects().length) return;
  if (addLayer()) moveSelectedToActiveLayer();
}
function operationNumber(name, fallback = 0) {
  const value = Number(propertyPanel.querySelector(`[name="${name}"]`)?.value);
  return Number.isFinite(value) ? value : fallback;
}
function rotatePoint(point, center, angle) {
  const cos = Math.cos(angle); const sin = Math.sin(angle); const dx = point.x - center.x; const dy = point.y - center.y;
  return { x: center.x + dx * cos - dy * sin, y: center.y + dx * sin + dy * cos };
}
function objectCenter(object) {
  const bounds = objectBounds(object);
  return bounds ? { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 } : { x: 0, y: 0 };
}
function translateObject(object, dx, dy) {
  if (object.type === 'line' || object.type === 'dimension') { object.x1 += dx; object.y1 += dy; object.x2 += dx; object.y2 += dy; }
  if (object.type === 'rect' || object.type === 'circle' || object.type === 'semicircle' || object.type === 'ellipse' || object.type === 'ellipseArc' || object.type === 'text') { object.x += dx; object.y += dy; }
  if (object.type === 'slot') { object.x1 += dx; object.y1 += dy; object.x2 += dx; object.y2 += dy; }
  if (object.type === 'angleDimension') { object.cx += dx; object.cy += dy; }
  if (object.type === 'polyline' || object.type === 'polygon') object.points.forEach(point => { point.x += dx; point.y += dy; });
  syncLinkedDimensions(object);
}
function rotateObject(object, angle, center = objectCenter(object)) {
  if (object.type === 'line' || object.type === 'dimension') {
    const a = rotatePoint({ x: object.x1, y: object.y1 }, center, angle); const b = rotatePoint({ x: object.x2, y: object.y2 }, center, angle);
    object.x1 = a.x; object.y1 = a.y; object.x2 = b.x; object.y2 = b.y;
  }
  if (object.type === 'rect') {
    const currentCenter = { x: object.x + object.width / 2, y: object.y + object.height / 2 };
    const rotatedCenter = rotatePoint(currentCenter, center, angle);
    object.x = rotatedCenter.x - object.width / 2; object.y = rotatedCenter.y - object.height / 2;
    object.rotation = (object.rotation || 0) + angle;
  }
  if (object.type === 'semicircle') object.angle = (object.angle || 0) + angle;
  if (object.type === 'polyline' || object.type === 'polygon') object.points = object.points.map(point => rotatePoint(point, center, angle));
  if (object.type === 'slot') { const a = rotatePoint({ x: object.x1, y: object.y1 }, center, angle); const b = rotatePoint({ x: object.x2, y: object.y2 }, center, angle); Object.assign(object, { x1: a.x, y1: a.y, x2: b.x, y2: b.y }); }
  if (object.type === 'angleDimension') { const point = rotatePoint({ x: object.cx, y: object.cy }, center, angle); object.cx = point.x; object.cy = point.y; object.startAngle += angle; object.endAngle += angle; }
  if (object.type === 'text') { const point = rotatePoint({ x: object.x, y: object.y }, center, angle); object.x = point.x; object.y = point.y; object.rotation = (object.rotation || 0) + angle; }
  if (object.type === 'circle' || object.type === 'ellipse' || object.type === 'ellipseArc') { const point = rotatePoint({ x: object.x, y: object.y }, center, angle); object.x = point.x; object.y = point.y; object.rotation = (object.rotation || 0) + angle; }
  if (object.type === 'semicircle') { const point = rotatePoint({ x: object.x, y: object.y }, center, angle); object.x = point.x; object.y = point.y; }
  syncLinkedDimensions(object);
}
function cloneObject(object) { const copy = JSON.parse(JSON.stringify(object)); copy.id = newId(); delete copy.sourceRectId; delete copy.autoRectSide; return copy; }
function moveSelectedExact() {
  const object = state.objects.find(item => item.id === selectedId); if (!object) return;
  pushHistory(); translateObject(object, operationNumber('moveX'), operationNumber('moveY')); render(); setStatus('Objekt exakt verschoben');
}
function duplicateSelectedExact() {
  const object = state.objects.find(item => item.id === selectedId); if (!object) return;
  pushHistory(); const copy = cloneObject(object); translateObject(copy, operationNumber('moveX'), operationNumber('moveY')); state.objects.push(copy); selectedId = copy.id; render(); setStatus('Exaktes Duplikat erstellt');
}
function rotateSelectedExact() {
  const objects = selectedObjects(); if (!objects.length) return;
  const bounds = boundsForObjects(objects); const center = { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 };
  pushHistory(); const angle = operationNumber('rotateAngle') * Math.PI / 180; objects.forEach(object => rotateObject(object, angle, center)); render(); setStatus(`${objects.length} Objekt(e) gedreht`);
}
function mirrorPoint(point, center, axis) { return axis === 'horizontal' ? { x: point.x, y: center.y * 2 - point.y } : { x: center.x * 2 - point.x, y: point.y }; }
function mirrorSelected(axis) {
  const objects = selectedObjects(); if (!objects.length) return;
  const bounds = boundsForObjects(objects); const center = { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 }; pushHistory();
  objects.forEach(object => {
    if (object.type === 'line' || object.type === 'dimension') { const a = mirrorPoint({ x: object.x1, y: object.y1 }, center, axis); const b = mirrorPoint({ x: object.x2, y: object.y2 }, center, axis); Object.assign(object, { x1: a.x, y1: a.y, x2: b.x, y2: b.y }); }
    if (object.type === 'polyline' || object.type === 'polygon') object.points = object.points.map(point => mirrorPoint(point, center, axis));
    if (object.type === 'slot') { const a = mirrorPoint({ x: object.x1, y: object.y1 }, center, axis); const b = mirrorPoint({ x: object.x2, y: object.y2 }, center, axis); Object.assign(object, { x1: a.x, y1: a.y, x2: b.x, y2: b.y }); }
    if (['rect', 'circle', 'semicircle', 'ellipse', 'ellipseArc', 'text'].includes(object.type)) { const oldCenter = objectCenter(object); const nextCenter = mirrorPoint(oldCenter, center, axis); translateObject(object, nextCenter.x - oldCenter.x, nextCenter.y - oldCenter.y); }
    if (object.type === 'rect') object.rotation = axis === 'horizontal' ? -(object.rotation || 0) : Math.PI - (object.rotation || 0);
    if (object.type === 'ellipse' || object.type === 'ellipseArc') object.rotation = axis === 'horizontal' ? -(object.rotation || 0) : Math.PI - (object.rotation || 0);
    if (object.type === 'semicircle') object.angle = axis === 'horizontal' ? -(object.angle || 0) : Math.PI - (object.angle || 0);
    if (object.type === 'angleDimension') { const next = mirrorPoint({ x: object.cx, y: object.cy }, center, axis); object.cx = next.x; object.cy = next.y; object.startAngle = axis === 'horizontal' ? -object.startAngle : Math.PI - object.startAngle; object.endAngle = axis === 'horizontal' ? -object.endAngle : Math.PI - object.endAngle; }
    if (object.type === 'text') object.rotation = axis === 'horizontal' ? -(object.rotation || 0) : Math.PI - (object.rotation || 0);
    syncLinkedDimensions(object);
  });
  render(); setStatus(`${objects.length} Objekt(e) ${axis === 'horizontal' ? 'horizontal' : 'vertikal'} gespiegelt`);
}
function resizeSelectedLine(end, mode) {
  const object = state.objects.find(item => item.id === selectedId && item.type === 'line'); if (!object) return;
  const amount = Math.max(0, operationNumber('lineEditLength')); const length = distance({ x: object.x1, y: object.y1 }, { x: object.x2, y: object.y2 });
  if (mode === 'trim' && amount >= length - 1) { setStatus('Trimmlänge ist zu groß'); return; }
  const ux = (object.x2 - object.x1) / length; const uy = (object.y2 - object.y1) / length; const direction = mode === 'trim' ? 1 : -1; pushHistory();
  if (end === 'start') { object.x1 += ux * amount * direction; object.y1 += uy * amount * direction; }
  else { object.x2 -= ux * amount * direction; object.y2 -= uy * amount * direction; }
  render(); setStatus(`Linie ${mode === 'trim' ? 'getrimmt' : 'verlängert'}`);
}
function splitSelectedLine() {
  const object = state.objects.find(item => item.id === selectedId && item.type === 'line'); if (!object) return;
  const length = distance({ x: object.x1, y: object.y1 }, { x: object.x2, y: object.y2 }); const split = operationNumber('lineEditLength', length / 2);
  if (split <= 0 || split >= length) { setStatus('Teilpunkt muss innerhalb der Linie liegen'); return; }
  const ratio = split / length; const point = { x: object.x1 + (object.x2 - object.x1) * ratio, y: object.y1 + (object.y2 - object.y1) * ratio }; pushHistory();
  const second = cloneObject(object); second.x1 = point.x; second.y1 = point.y; object.x2 = point.x; object.y2 = point.y; state.objects.push(second); render(); setStatus('Linie geteilt');
}
function scaleObject(object, factor) {
  if (object.type === 'line' || object.type === 'dimension') { object.x1 *= factor; object.y1 *= factor; object.x2 *= factor; object.y2 *= factor; }
  if (object.type === 'rect') { object.x *= factor; object.y *= factor; object.width *= factor; object.height *= factor; }
  if (object.type === 'circle' || object.type === 'semicircle') { object.x *= factor; object.y *= factor; object.r *= factor; }
  if (object.type === 'ellipse' || object.type === 'ellipseArc') { object.x *= factor; object.y *= factor; object.rx *= factor; object.ry *= factor; }
  if (object.type === 'slot') { object.x1 *= factor; object.y1 *= factor; object.x2 *= factor; object.y2 *= factor; object.width *= factor; }
  if (object.type === 'angleDimension') { object.cx *= factor; object.cy *= factor; object.r *= factor; }
  if (object.type === 'polyline' || object.type === 'polygon') object.points.forEach(point => { point.x *= factor; point.y *= factor; });
  if (object.type === 'text') { object.x *= factor; object.y *= factor; }
}
function setSelectedAsReference() {
  const objects = selectedObjects(); const object = objects[0];
  const targetLength = Number(document.querySelector('#referenceLength')?.value);
  if (!object || !Number.isFinite(targetLength) || targetLength <= 0) return;
  const side = document.querySelector('#referenceSide')?.value || 'length';
  const currentLength = referenceMeasurement(objects, side);
  if (currentLength < 0.001) { setStatus('Richtmaß benötigt eine vorhandene Länge'); return; }
  const view = objectView(object);
  const previousDrawingScale = drawingScale(view);
  const factor = targetLength / currentLength;
  state.viewReferences[view] = { targetLength, factor, sourceObjectId: object.id, sourceObjectIds: objects.map(item => item.id), side, updatedAt: new Date().toISOString() };
  state.scale = previousDrawingScale * factor;
  const setting = ensureViewSetting(view); setting.scale = state.scale; setting.autoScale = false; state.autoScale = false;
  setDirty();
  syncScaleControls(); render();
  setStatus(`${viewNames[view]} auf ${formatLength(targetLength)} kalibriert`);
}
function clearSelectedReference() {
  const object = selectedObjects()[0] || state.objects.find(item => item.id === selectedId); if (!object) return;
  const view = objectView(object); if (!state.viewReferences[view]) return;
  const previousDrawingScale = drawingScale(view);
  delete state.viewReferences[view]; state.scale = previousDrawingScale;
  const setting = ensureViewSetting(view); setting.scale = state.scale; setting.autoScale = false; state.autoScale = false;
  setDirty(); syncScaleControls(); render(); setStatus(`Richtmaß der ${viewNames[view]} entfernt`);
}
function applySelectedChanges() {
  const object = state.objects.find(item => item.id === selectedId);
  if (!object) return;
  const form = propertyPanel.querySelector('.property-form');
  const values = Object.fromEntries([...form.querySelectorAll('[name]')].map(input => [input.name, input.value]));
  const calibrationFactor = viewCalibrationFactor(objectView(object));
  pushHistory();
  Object.keys(values).forEach(key => { object[key] = ['strokeWidth', 'x', 'y', 'cx', 'cy', 'x1', 'y1', 'x2', 'y2', 'width', 'height', 'offset', 'r', 'rx', 'ry', 'cornerSize', 'angleDeg', 'dimensionDecimals'].includes(key) && values[key] !== '' ? Number(values[key]) : values[key]; });
  ['x', 'y', 'cx', 'cy', 'x1', 'y1', 'x2', 'y2', 'width', 'height', 'r', 'rx', 'ry', 'cornerSize'].forEach(key => { if (Object.hasOwn(values, key) && Number.isFinite(object[key])) object[key] /= calibrationFactor; });
  object.locked = values.locked === 'true';
  if (object.type === 'semicircle' && Number.isFinite(object.angleDeg)) { object.angle = object.angleDeg * Math.PI / 180; delete object.angleDeg; }
  if ((object.type === 'dimension' || object.type === 'angleDimension') && !String(object.labelOverride || '').trim()) delete object.labelOverride;
  if (object.type === 'dimension' && !object.dimensionUnit) delete object.dimensionUnit;
  if (object.type === 'dimension' && object.dimensionDecimals === '') delete object.dimensionDecimals;
  if (object.type === 'dimension') object.offset = clampDimensionOffset(object.offset);
  if (object.type === 'rect') { object.width = Math.max(1, object.width); object.height = Math.max(1, object.height); }
  if ((object.type === 'circle' || object.type === 'semicircle' || object.type === 'angleDimension') && (!Number.isFinite(object.r) || object.r < 1)) object.r = 1;
  if (object.strokeWidth < 0.25 || !Number.isFinite(object.strokeWidth)) object.strokeWidth = 0.75;
  syncLinkedDimensions(object);
  state.activeView = objectView(object);
  if (!enabledViews().includes(state.activeView)) state.enabledViews = [...enabledViews(), state.activeView];
  syncViewControls();
  render();
  setStatus('Änderungen übernommen');
}
function showContextMenu(x, y) {
  const menu = document.querySelector('#contextMenu'); const objects = selectedObjects(); const object = objects.length === 1 ? objects[0] : null; const locked = objects.some(isObjectLocked);
  menu.querySelectorAll('[data-action]').forEach(button => { button.hidden = true; });
  const show = (action, visible) => { const button = menu.querySelector(`[data-action="${action}"]`); if (button) button.hidden = !visible; };
  const dimensionButton = menu.querySelector('[data-action="dimension"]');
  if (dimensionButton) dimensionButton.textContent = object?.type === 'line' ? 'Länge bemaßen' : object?.type === 'rect' ? 'Breite/Höhe bemaßen' : ['circle', 'semicircle'].includes(object?.type) ? 'Radius bemaßen' : 'Gesamtmaße bemaßen';
  show('properties', objects.length > 0); show('dimension', !locked && objects.length > 0); show('diameterDimension', !locked && objects.length === 1 && ['circle', 'semicircle'].includes(object?.type));
  show('angleDimension', !locked && objects.length === 2 && objects.every(item => item.type === 'line'));
  show('rotate', !locked && objects.length > 0); show('mirrorH', !locked && objects.length > 0); show('mirrorV', !locked && objects.length > 0); show('copy', !locked && objects.length > 0); show('duplicate', !locked && objects.length > 0); show('delete', !locked && objects.length > 0); show('material', !locked && objects.length > 0);
  menu.querySelectorAll('[data-action="copyToView"]').forEach(button => { button.hidden = locked || !objects.length; });
  const copyLabel = menu.querySelector('.context-menu-label'); if (copyLabel) copyLabel.hidden = locked || !objects.length;
  menu.hidden = false; menu.style.left = `${Math.min(x, innerWidth - 190)}px`; menu.style.top = `${Math.max(6, Math.min(y, innerHeight - menu.offsetHeight - 6))}px`;
}
function hideContextMenu() { document.querySelector('#contextMenu').hidden = true; }
function contextObjectAtPoint(point) {
  const threshold = Math.max(18, drawingScale() * 18);
  const pointChainDistance = (points, closed = false) => {
    const pairs = points.slice(1).map((next, index) => [points[index], next]);
    if (closed && points.length > 2) pairs.push([points.at(-1), points[0]]);
    return Math.min(...pairs.map(([a, b]) => distanceToLine(point, a.x, a.y, b.x, b.y)));
  };
  const contextDistance = object => {
    if (object.type === 'line' || object.type === 'dimension') return distanceToLine(point, object.x1, object.y1, object.x2, object.y2);
    if (object.type === 'polyline' || object.type === 'polygon') return pointChainDistance(object.points, object.type === 'polygon');
    if (object.type === 'slot') return Math.max(0, distanceToLine(point, object.x1, object.y1, object.x2, object.y2) - object.width / 2);
    if (object.type === 'angleDimension') return Math.abs(distance(point, { x: object.cx, y: object.cy }) - object.r);
    if (object.type === 'text') return distance(point, { x: object.x, y: object.y });
    if (object.type === 'rect') {
      const local = rotatePoint(point, objectCenter(object), -(object.rotation || 0));
      const px = Math.max(object.x, Math.min(local.x, object.x + object.width));
      const py = Math.max(object.y, Math.min(local.y, object.y + object.height));
      return distance(local, { x: px, y: py });
    }
    if (object.type === 'ellipse' || object.type === 'ellipseArc') return ellipseEdgeDistance(point, object);
    return Math.abs(distance(point, { x: object.x, y: object.y }) - object.r);
  };
  const angleOnArc = (angle, start, end) => {
    const delta = shortestAngleDelta(start, end);
    const position = shortestAngleDelta(start, angle);
    return delta >= 0 ? position >= -0.02 && position <= delta + 0.02 : position <= 0.02 && position >= delta - 0.02;
  };
  const candidates = activeViewObjects().filter(object => {
    if (object.type === 'line' || object.type === 'dimension') return distanceToLine(point, object.x1, object.y1, object.x2, object.y2) <= threshold;
    if (object.type === 'polyline' || object.type === 'polygon' || object.type === 'slot' || object.type === 'angleDimension' || object.type === 'text') return contextDistance(object) <= threshold;
    if (object.type === 'rect') return contextDistance(object) <= threshold;
    if (object.type === 'circle') return Math.abs(distance(point, { x: object.x, y: object.y }) - object.r) <= threshold;
    if (object.type === 'semicircle') {
      const radius = distance(point, { x: object.x, y: object.y });
      return Math.abs(radius - object.r) <= threshold && angleOnArc(Math.atan2(point.y - object.y, point.x - object.x), object.angle || 0, (object.angle || 0) + Math.PI);
    }
    if (object.type === 'ellipse' || object.type === 'ellipseArc') {
      return ellipseEdgeDistance(point, object) <= threshold;
    }
    return false;
  });
  return candidates.sort((a, b) => {
    const dimensionPriorityA = a.type === 'dimension' || a.type === 'angleDimension' ? 1 : 0;
    const dimensionPriorityB = b.type === 'dimension' || b.type === 'angleDimension' ? 1 : 0;
    return dimensionPriorityA - dimensionPriorityB || contextDistance(a) - contextDistance(b);
  })[0] || null;
}
function handleCanvasContextMenu(event) {
  if (state.tool !== 'select') return;
  const object = contextObjectAtPoint(eventPoint(event));
  if (!object) return;
  event.preventDefault();
  if (!selectedIds.has(object.id)) {
    selectObject(object.id);
    if (object.groupId) { state.objects.filter(item => item.groupId === object.groupId).forEach(item => selectedIds.add(item.id)); selectedId = object.id; render(); }
  }
  showContextMenu(event.clientX, event.clientY);
}
function dimensionSelectedFromMenu() {
  const objects = selectedObjects(); const object = objects.length === 1 ? objects[0] : null; if (!objects.length) return;
  if (object?.type === 'rect') addRectDimensions();
  else if (object?.type === 'circle' || object?.type === 'semicircle') addRadiusDimension();
  else if (object?.type === 'line') { pushHistory(); state.objects.push({ type: 'dimension', id: newId(), sourceObjectId: object.id, view: objectView(object), layer: 'dimension', x1: object.x1, y1: object.y1, x2: object.x2, y2: object.y2, offset: dimensionStyle().defaultOffset, style: state.style, strokeWidth: state.strokeWidth, stroke: state.strokeColor }); render(); setStatus('Linie bemaßt'); }
  else {
    const bounds = boundsForObjects(objects); if (!bounds) return; const offset = dimensionStyle().defaultOffset; pushHistory();
    state.objects.push(
      { type: 'dimension', id: newId(), view: objectView(objects[0]), layer: 'dimension', x1: bounds.minX, y1: bounds.maxY, x2: bounds.maxX, y2: bounds.maxY, offset, style: state.style, strokeWidth: state.strokeWidth, stroke: state.strokeColor },
      { type: 'dimension', id: newId(), view: objectView(objects[0]), layer: 'dimension', x1: bounds.maxX, y1: bounds.maxY, x2: bounds.maxX, y2: bounds.minY, offset, style: state.style, strokeWidth: state.strokeWidth, stroke: state.strokeColor }
    ); render(); setStatus('Gesamtbreite und Gesamthöhe bemaßt');
  }
}
function addAngleDimensionFromSelection() {
  const lines = selectedObjects().filter(object => object.type === 'line');
  if (lines.length !== 2) { setStatus('Zwei Linien auswählen'); return; }
  const [lineA, lineB] = lines;
  const intersection = segmentIntersection(lineA, lineB) || { x: (lineA.x1 + lineA.x2 + lineB.x1 + lineB.x2) / 4, y: (lineA.y1 + lineA.y2 + lineB.y1 + lineB.y2) / 4 };
  const farPoint = line => distance(intersection, { x: line.x1, y: line.y1 }) > distance(intersection, { x: line.x2, y: line.y2 }) ? { x: line.x1, y: line.y1 } : { x: line.x2, y: line.y2 };
  const pointA = farPoint(lineA); const pointB = farPoint(lineB); pushHistory();
  state.objects.push({ type: 'angleDimension', id: newId(), sourceObjectIds: lines.map(line => line.id), view: objectView(lineA), layer: 'dimension', cx: intersection.x, cy: intersection.y, r: 500, startAngle: Math.atan2(pointA.y - intersection.y, pointA.x - intersection.x), endAngle: Math.atan2(pointB.y - intersection.y, pointB.x - intersection.x), style: state.style, strokeWidth: state.strokeWidth, stroke: state.strokeColor });
  render(); setStatus('Winkelbemaßung erstellt');
}
function syncLinkedDimensions(object) {
  if (!object) return;
  const linked = state.objects.filter(item => item.type === 'dimension' && (item.sourceRectId === object.id || item.sourceObjectId === object.id));
  if (object.type === 'rect') {
    const [topLeft, topRight, bottomRight, bottomLeft] = rectCorners(object);
    linked.forEach(item => {
      if (item.autoRectSide === 'width') { item.x1 = bottomLeft.x; item.y1 = bottomLeft.y; item.x2 = bottomRight.x; item.y2 = bottomRight.y; }
      if (item.autoRectSide === 'height') { item.x1 = bottomRight.x; item.y1 = bottomRight.y; item.x2 = topRight.x; item.y2 = topRight.y; }
    });
  }
  if (object.type === 'line') linked.forEach(item => { item.x1 = object.x1; item.y1 = object.y1; item.x2 = object.x2; item.y2 = object.y2; });
  if (object.type === 'circle' || object.type === 'semicircle') linked.forEach(item => {
    const angle = Number.isFinite(item.sourceAngle) ? item.sourceAngle : object.angle || 0;
    const a = polarPoint(object, object.r, angle); const b = polarPoint(object, object.r, angle + Math.PI);
    if (item.labelPrefix === 'Ø ') { item.x1 = a.x; item.y1 = a.y; item.x2 = b.x; item.y2 = b.y; }
    else { item.x1 = object.x; item.y1 = object.y; item.x2 = a.x; item.y2 = a.y; }
  });
}
function deleteSelected() {
  if (!selectedIds.size && !selectedId) return;
  const ids = selectedIds.size ? new Set(selectedIds) : new Set([selectedId]);
  const linkedDimension = object => object.type === 'dimension'
    ? ids.has(object.sourceRectId) || ids.has(object.sourceObjectId)
    : object.type === 'angleDimension' && Array.isArray(object.sourceObjectIds) && object.sourceObjectIds.some(id => ids.has(id));
  pushHistory();
  const deletedIds = new Set([...ids, ...state.objects.filter(linkedDimension).map(object => object.id)]);
  state.objects = state.objects.filter(object => !deletedIds.has(object.id));
  state.materials.forEach(item => {
    item.objectIds = materialObjectIds(item).filter(id => !deletedIds.has(id));
    if (item.objectId && deletedIds.has(item.objectId)) delete item.objectId;
  });
  selectedId = null; selectedIds.clear(); propertyPanel.innerHTML = '<div class="property-empty">Objekt anklicken, um seine Eigenschaften zu sehen.</div>'; document.querySelector('#selectionCount').textContent = 'Nichts ausgewählt'; render(); setStatus(`${ids.size} Objekt(e) gelöscht`);
}
function copySelected() {
  const objects = selectedObjects(); if (!objects.length) return;
  const selectedSourceIds = new Set(objects.map(object => object.id));
  const linkedDimensions = state.objects.filter(object => object.type === 'dimension' && !selectedSourceIds.has(object.id) && (selectedSourceIds.has(object.sourceRectId) || selectedSourceIds.has(object.sourceObjectId)));
  const sources = [...objects, ...linkedDimensions];
  clipboard = JSON.parse(JSON.stringify(sources));
  clipboardSourceScale = state.scale;
  clipboardSourceCalibration = viewCalibrationFactor();
  setStatus(`${sources.length} Objekt(e) kopiert – Strg+V zum Einfügen`);
}
function duplicateSelection() {
  const sources = selectedObjects(); if (!sources.length) return;
  const idMap = new Map(sources.map(source => [source.id, newId()])); const groupMap = new Map(); pushHistory();
  const copies = sources.map(source => {
    const copy = JSON.parse(JSON.stringify(source)); copy.id = idMap.get(source.id);
    if (copy.groupId) { if (!groupMap.has(copy.groupId)) groupMap.set(copy.groupId, `gruppe-${newId()}`); copy.groupId = groupMap.get(copy.groupId); }
    if (copy.sourceRectId) copy.sourceRectId = idMap.get(copy.sourceRectId) || '';
    if (copy.sourceObjectId) copy.sourceObjectId = idMap.get(copy.sourceObjectId) || '';
    translateObject(copy, 400, 400); return copy;
  });
  state.objects.push(...copies); selectedIds = new Set(copies.map(copy => copy.id)); selectedId = copies.at(-1).id; render(); setStatus(`${copies.length} Objekt(e) dupliziert`);
}
function pasteClipboardToView(targetView) {
  if (!clipboard || !viewNames[targetView]) { setStatus('Keine gültige Kopie oder Zielansicht'); return; }
  const sources = Array.isArray(clipboard) ? clipboard : [clipboard];
  const targetSetting = ensureViewSetting(targetView);
  targetSetting.scale = Math.max(1, Number(clipboardSourceScale) || 20);
  targetSetting.autoScale = false;
  const targetCalibration = viewCalibrationFactor(targetView);
  const viewScaleFactor = clipboardSourceCalibration / targetCalibration;
  const idMap = new Map(sources.map(source => [source.id, newId()]));
  const groupMap = new Map();
  pushHistory();
  const copies = sources.map(source => {
    const copy = JSON.parse(JSON.stringify(source));
    copy.id = idMap.get(source.id);
    copy.view = targetView;
    scaleObject(copy, viewScaleFactor);
    if (copy.groupId) {
      if (!groupMap.has(copy.groupId)) groupMap.set(copy.groupId, `gruppe-${newId()}`);
      copy.groupId = groupMap.get(copy.groupId);
    }
    if (copy.sourceRectId) copy.sourceRectId = idMap.get(copy.sourceRectId) || '';
    if (copy.sourceObjectId) copy.sourceObjectId = idMap.get(copy.sourceObjectId) || '';
    if (!copy.sourceRectId) { delete copy.sourceRectId; delete copy.autoRectSide; }
    if (!copy.sourceObjectId) delete copy.sourceObjectId;
    return copy;
  });
  state.objects.push(...copies);
  state.activeView = targetView;
  if (!enabledViews().includes(targetView)) state.enabledViews = [...enabledViews(), targetView];
  selectedIds = new Set(copies.map(copy => copy.id));
  selectedId = copies.at(-1)?.id || null;
  loadActiveViewSettings(); syncViewControls(); render();
  setStatus(`${copies.length} Objekt(e) größengetreu in ${viewNames[targetView]} eingefügt`);
}
function addSelectedToMaterialList() {
  const objects = selectedObjects();
  const object = state.objects.find(item => item.id === selectedId) || objects[0];
  if (!object || !objects.length) return;
  updateMaterialsFromForm();
  const selectedObjectIds = objects.map(item => item.id);
  const existing = state.materials.find(item => selectedObjectIds.some(id => materialObjectIds(item).includes(id)));
  if (existing) {
    existing.objectIds = [...new Set([...materialObjectIds(existing), ...selectedObjectIds])];
    delete existing.objectId;
    if (!existing.dimensions) existing.dimensions = materialDimensionsFromObject(object);
    if (!existing.name) existing.name = toolNames[object.type] || 'Teil';
  } else {
    const material = materialRowFromObject(object);
    material.objectIds = selectedObjectIds;
    state.materials.push(material);
  }
  setDirty();
  renderMaterialList();
  render();
  setStatus(`${objects.length} Objekt(e) mit Materialposition verknüpft`);
}
function addRectDimensions() {
  const object = state.objects.find(item => item.id === selectedId);
  if (!object || object.type !== 'rect') return;
  const existing = state.objects.filter(item => item.type === 'dimension' && item.sourceRectId === object.id);
  pushHistory();
  if (existing.length) {
    state.objects = state.objects.filter(item => !(item.type === 'dimension' && item.sourceRectId === object.id));
    render();
    setStatus('Automatische Rechteckbemaßung entfernt');
    return;
  }
  const offset = dimensionStyle().defaultOffset;
  const view = objectView(object);
  state.objects.push(
    { type: 'dimension', id: newId(), sourceRectId: object.id, autoRectSide: 'width', useReferenceScale: false, view, layer: 'dimension', x1: object.x, y1: object.y + object.height, x2: object.x + object.width, y2: object.y + object.height, offset, style: state.style, strokeWidth: state.strokeWidth, stroke: state.strokeColor },
    { type: 'dimension', id: newId(), sourceRectId: object.id, autoRectSide: 'height', useReferenceScale: false, view, layer: 'dimension', x1: object.x + object.width, y1: object.y + object.height, x2: object.x + object.width, y2: object.y, offset, style: state.style, strokeWidth: state.strokeWidth, stroke: state.strokeColor }
  );
  render();
  setStatus('Rechteck automatisch bemaßt');
}
function addRadiusDimension() {
  const object = state.objects.find(item => item.id === selectedId);
  if (!object || !['circle', 'semicircle'].includes(object.type)) return;
  pushHistory();
  const angle = object.angle || 0;
  const end = polarPoint(object, object.r, angle);
  state.objects.push({ type: 'dimension', id: newId(), sourceObjectId: object.id, sourceAngle: angle, view: objectView(object), layer: 'dimension', x1: object.x, y1: object.y, x2: end.x, y2: end.y, offset: dimensionStyle().defaultOffset, labelPrefix: 'R ', style: state.style, strokeWidth: state.strokeWidth, stroke: state.strokeColor });
  render();
  setStatus('Radiusbemaßung erstellt');
}
function addDiameterDimension() {
  const object = state.objects.find(item => item.id === selectedId);
  if (!object || !['circle', 'semicircle'].includes(object.type)) return;
  pushHistory();
  const angle = object.angle || 0;
  const a = polarPoint(object, object.r, angle);
  const b = polarPoint(object, object.r, angle + Math.PI);
  state.objects.push({ type: 'dimension', id: newId(), sourceObjectId: object.id, sourceAngle: angle, view: objectView(object), layer: 'dimension', x1: a.x, y1: a.y, x2: b.x, y2: b.y, offset: dimensionStyle().defaultOffset, labelPrefix: 'Ø ', style: state.style, strokeWidth: state.strokeWidth, stroke: state.strokeColor });
  render();
  setStatus('Durchmesserbemaßung erstellt');
}
function rememberAngleLine() {
  const object = state.objects.find(item => item.id === selectedId);
  if (!object || object.type !== 'line') return;
  angleReferenceId = object.id;
  setStatus('Linie 1 für Winkelbemaßung gemerkt');
}
function addAngleDimension() {
  const lineA = state.objects.find(item => item.id === angleReferenceId && item.type === 'line');
  const lineB = state.objects.find(item => item.id === selectedId && item.type === 'line');
  if (!lineA || !lineB || lineA.id === lineB.id) { setStatus('Zwei verschiedene Linien nötig'); return; }
  const intersection = segmentIntersection(lineA, lineB) || { x: (lineA.x1 + lineA.x2 + lineB.x1 + lineB.x2) / 4, y: (lineA.y1 + lineA.y2 + lineB.y1 + lineB.y2) / 4 };
  const farA = distance(intersection, { x: lineA.x1, y: lineA.y1 }) > distance(intersection, { x: lineA.x2, y: lineA.y2 }) ? { x: lineA.x1, y: lineA.y1 } : { x: lineA.x2, y: lineA.y2 };
  const farB = distance(intersection, { x: lineB.x1, y: lineB.y1 }) > distance(intersection, { x: lineB.x2, y: lineB.y2 }) ? { x: lineB.x1, y: lineB.y1 } : { x: lineB.x2, y: lineB.y2 };
  const angleA = Math.atan2(farA.y - intersection.y, farA.x - intersection.x);
  const angleB = Math.atan2(farB.y - intersection.y, farB.x - intersection.x);
  pushHistory();
  state.objects.push({ type: 'angleDimension', id: newId(), view: objectView(lineB), cx: intersection.x, cy: intersection.y, r: 500, startAngle: angleA, endAngle: angleB, style: state.style, strokeWidth: state.strokeWidth, stroke: state.strokeColor });
  render();
  setStatus('Winkelbemaßung erstellt');
}
function pasteClipboard() { if (!clipboard) { setStatus('Nichts zum Einfügen'); return; } pushHistory(); const copies = (Array.isArray(clipboard) ? clipboard : [clipboard]).map(source => { const copy = cloneObject(source); translateObject(copy, 400, 400); return copy; }); state.objects.push(...copies); selectedIds = new Set(copies.map(copy => copy.id)); selectedId = copies.at(-1).id; render(); setStatus(`${copies.length} Objekt(e) eingefügt`); }
function handlePointerDown(event) {
  if (event.button === 1 || (spacePressed && event.button === 0)) {
    event.preventDefault();
    panStart = { clientX: event.clientX, clientY: event.clientY, viewX: viewBox.x, viewY: viewBox.y };
    canvas.setPointerCapture?.(event.pointerId);
    canvas.classList.add('panning');
    return;
  }
  const point = eventPoint(event, toolUsesObjectSnap(), polylinePoints.at(-1) || null);
  if (state.tool === 'smartTrim' || state.tool === 'smartExtend') { smartEditLineAt(point, state.tool === 'smartTrim' ? 'trim' : 'extend'); return; }
  if (state.tool === 'select') {
    const hitObject = activeViewObjects().find(object => {
      const hitThreshold = Math.max(12, drawingScale() * 12);
      if (object.type === 'line' || object.type === 'dimension') {
        return distanceToLine(point, object.x1, object.y1, object.x2, object.y2) <= hitThreshold;
      }
      if (object.type === 'rect') {
        const local = rotatePoint(point, objectCenter(object), -(object.rotation || 0));
        const px = Math.max(object.x, Math.min(local.x, object.x + object.width));
        const py = Math.max(object.y, Math.min(local.y, object.y + object.height));
        return distance(local, { x: px, y: py }) <= hitThreshold;
      }
      if (object.type === 'circle' || object.type === 'semicircle') {
        return Math.abs(distance(point, { x: object.x, y: object.y }) - object.r) <= hitThreshold;
      }
      if (object.type === 'ellipse' || object.type === 'ellipseArc') {
        return ellipseEdgeDistance(point, object) <= hitThreshold;
      }
      if (object.type === 'slot') return distanceToLine(point, object.x1, object.y1, object.x2, object.y2) <= object.width / 2 + hitThreshold;
      if (object.type === 'angleDimension') {
        return Math.abs(distance(point, { x: object.cx, y: object.cy }) - object.r) <= hitThreshold;
      }
      if (object.type === 'polyline' || object.type === 'polygon') {
        return object.points.some(p => distance(point, p) <= hitThreshold);
      }
      if (object.type === 'text') {
        return distance(point, { x: object.x, y: object.y }) <= hitThreshold;
      }
      return false;
    });
    if (hitObject) {
      canvas.setPointerCapture?.(event.pointerId);
      startDraggingObject(hitObject, point, event.shiftKey || event.ctrlKey);
    } else {
      if (event.shiftKey || event.ctrlKey) {
        draggingObject = null;
        dragChanged = false;
        selectionBoxStart = point;
      } else {
        selectedId = null;
        selectedIds.clear();
        panStart = { clientX: event.clientX, clientY: event.clientY, viewX: viewBox.x, viewY: viewBox.y };
        canvas.classList.add('panning');
      }
      canvas.setPointerCapture?.(event.pointerId);
      render();
    }
    return;
  }
  if (state.tool === 'freihandkurve') { polylinePoints = [point]; pointerStart = point; return; }
  if (state.tool === 'polyline') {
    polylinePoints.push(point);
    pointerStart = null;
    if (event.detail >= 2) finishPolyline();
    else previewPolyline();
    return;
  }
  if (state.tool === 'text') { const value = window.prompt('Text eingeben:', 'Hinweis'); if (value) addObject({ type: 'text', x: point.x, y: point.y, value }); return; }
  pointerStart = point;
}
function handlePointerMove(event) {
  if (panStart) {
    const rect = canvas.getBoundingClientRect();
    viewBox.x = panStart.viewX - (event.clientX - panStart.clientX) / rect.width * viewBox.width;
    viewBox.y = panStart.viewY - (event.clientY - panStart.clientY) / rect.height * viewBox.height;
    applyViewBox();
    return;
  }
  const snapOrigin = pointerStart || polylinePoints.at(-1) || null;
  const point = eventPoint(event, !draggingObject && toolUsesObjectSnap(), snapOrigin); document.querySelector('#cursorCoords').textContent = `X ${formatLength(point.x * viewCalibrationFactor())}   Y ${formatLength(point.y * viewCalibrationFactor())}`;
  if (selectionBoxStart && state.tool === 'select') {
    clearPreview();
    const x = Math.min(selectionBoxStart.x, point.x); const y = Math.min(selectionBoxStart.y, point.y);
    previewLayer.append(makeSvg('rect', { x: canvasValue(x), y: canvasValue(y), width: canvasValue(Math.abs(point.x - selectionBoxStart.x)), height: canvasValue(Math.abs(point.y - selectionBoxStart.y)), class: 'selection-box' }));
    return;
  }
  if (draggingHandle) {
    moveHandle(point);
    return;
  }
  if (draggingObject && pointerStart) {
    const dx = point.x - pointerStart.x;
    const dy = point.y - pointerStart.y;
    if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) return;
    if (!dragHistoryCaptured) {
      pushHistory();
      dragHistoryCaptured = true;
    }
    if (draggingObject.type === 'dimension' && dragMode === 'dimensionOffset') {
      const lineDx = draggingObject.x2 - draggingObject.x1;
      const lineDy = draggingObject.y2 - draggingObject.y1;
      const lineLength = Math.hypot(lineDx, lineDy) || 1;
      const normal = { x: -lineDy / lineLength, y: lineDx / lineLength };
      draggingObject.offset = clampDimensionOffset((Number.isFinite(Number(draggingObject.offset)) ? Number(draggingObject.offset) : dimensionStyle().defaultOffset) + (dx / drawingScale()) * normal.x + (dy / drawingScale()) * normal.y);
    } else draggingObjects.forEach(object => translateObject(object, dx, dy));
    dragChanged = true;
    pointerStart = point;
    render();
    return;
  }
  if (!pointerStart) { updateLiveAngle(null, null); clearPreview(); if (toolUsesObjectSnap()) drawSnapMarker(); if (state.tool === 'polyline') { previewPolyline(point); drawSnapMarker(); } return; }
  if (state.tool === 'freihandkurve') { if (distance(polylinePoints.at(-1), point) > 8) polylinePoints.push(point); clearPreview(); if (polylinePoints.length > 1) renderObject({ type: 'polyline', points: polylinePoints, style: state.style, strokeWidth: state.strokeWidth, stroke: state.strokeColor }, previewLayer); return; }
  if (state.tool === 'line' || state.tool === 'dimension') { const end = lineEndPoint(pointerStart, point, event); previewLine(pointerStart, end); drawAngleLabel(pointerStart, end); updateLiveAngle(pointerStart, end); drawSnapMarker(); }
  if (state.tool === 'circle' || state.tool === 'semicircle') {
    clearPreview();
    const end = radiusEndPoint(pointerStart, point, event);
    const radius = distance(pointerStart, end);
    const angle = Math.atan2(end.y - pointerStart.y, end.x - pointerStart.x);
    renderObject({ type: state.tool, x: pointerStart.x, y: pointerStart.y, r: radius, angle, style: state.style, strokeWidth: state.strokeWidth, stroke: state.strokeColor }, previewLayer);
    drawAngleLabel(pointerStart, end);
    updateLiveAngle(pointerStart, end);
  }
  if (state.tool === 'ellipse' || state.tool === 'ellipseArc') {
    clearPreview(); const rx = Math.abs(point.x - pointerStart.x); const ry = Math.abs(point.y - pointerStart.y);
    renderObject({ type: state.tool, x: pointerStart.x, y: pointerStart.y, rx, ry, style: state.style, strokeWidth: state.strokeWidth, stroke: state.strokeColor }, previewLayer);
  }
  if (state.tool === 'slot') { clearPreview(); renderObject({ type: 'slot', x1: pointerStart.x, y1: pointerStart.y, x2: point.x, y2: point.y, width: Number(document.querySelector('#targetRectHeight')?.value) || 200, style: state.style, strokeWidth: state.strokeWidth, stroke: state.strokeColor }, previewLayer); }
  if (state.tool === 'polygon') { clearPreview(); const sides = Math.max(3, Math.min(24, Number(document.querySelector('#polygonSides')?.value) || 6)); const radius = distance(pointerStart, point); const angle = Math.atan2(point.y - pointerStart.y, point.x - pointerStart.x); const points = Array.from({ length: sides }, (_, index) => polarPoint(pointerStart, radius, angle + index * Math.PI * 2 / sides)); renderObject({ type: 'polygon', points, style: state.style, strokeWidth: state.strokeWidth, stroke: state.strokeColor }, previewLayer); }
  if (state.tool === 'rect') { clearPreview(); const end = exactRectEndPoint(pointerStart, point); const x = Math.min(pointerStart.x, end.x); const y = Math.min(pointerStart.y, end.y); renderObject({ type: 'rect', x, y, width: Math.abs(end.x - pointerStart.x), height: Math.abs(end.y - pointerStart.y), style: state.style, strokeWidth: state.strokeWidth, stroke: state.strokeColor }, previewLayer); }
  if (isWoodTool() && state.tool !== 'freihandkurve') { clearPreview(); createWoodGeometry(pointerStart, point).filter(Boolean).forEach(object => renderObject(object, previewLayer)); }
}
function handlePointerUp(event) {
  if (panStart) {
    canvas.releasePointerCapture?.(event.pointerId);
    panStart = null;
    canvas.classList.remove('panning');
    return;
  }
  if (selectionBoxStart) {
    const end = eventPoint(event);
    const box = { minX: Math.min(selectionBoxStart.x, end.x), minY: Math.min(selectionBoxStart.y, end.y), maxX: Math.max(selectionBoxStart.x, end.x), maxY: Math.max(selectionBoxStart.y, end.y) };
    const leftToRight = end.x >= selectionBoxStart.x;
    const selectedInBox = activeViewObjects().filter(object => !isObjectLocked(object)).filter(object => {
      const bounds = objectBounds(object); if (!bounds) return false;
      return leftToRight ? bounds.minX >= box.minX && bounds.maxX <= box.maxX && bounds.minY >= box.minY && bounds.maxY <= box.maxY : bounds.maxX >= box.minX && bounds.minX <= box.maxX && bounds.maxY >= box.minY && bounds.minY <= box.maxY;
    });
    selectedInBox.forEach(object => selectedIds.add(object.id));
    selectedId = [...selectedIds].at(-1) || null;
    selectionBoxStart = null; clearPreview(); canvas.releasePointerCapture?.(event.pointerId); render(); setStatus(`${selectedIds.size} Objekt(e) ausgewählt`); return;
  }
  if (draggingHandle) {
    canvas.releasePointerCapture?.(event.pointerId);
    draggingHandle = null;
    setStatus('Griff bearbeitet');
    return;
  }
  if (draggingObject) {
    canvas.releasePointerCapture?.(event.pointerId);
    draggingObject = null;
    draggingObjects = [];
    dragMode = 'move';
    pointerStart = null;
    setStatus(dragChanged ? 'Objekt verschoben' : 'Objekt ausgewählt');
    dragChanged = false;
    dragHistoryCaptured = false;
    return;
  }
  if (state.tool === 'freihandkurve') { if (polylinePoints.length > 1) { addWoodObjects([woodStyle('polyline', { points: polylinePoints.slice() })]); } polylinePoints = []; pointerStart = null; return; }
  if (isWoodTool()) { if (!pointerStart) return; const point = eventPoint(event, false, pointerStart); if (distance(pointerStart, point) >= 3) addWoodObjects(createWoodGeometry(pointerStart, point)); pointerStart = null; clearPreview(); return; }
  if (state.tool === 'polyline') return;
  if (!pointerStart) return; const point = eventPoint(event, toolUsesObjectSnap(), pointerStart); const start = pointerStart; pointerStart = null; clearPreview();
  const endPoint = state.tool === 'rect' ? exactRectEndPoint(start, point) : lineEndPoint(start, point, event);
  updateLiveAngle(null, null);
  if (distance(start, endPoint) < 3) return;
  if (state.tool === 'line') addObject({ type: 'line', x1: start.x, y1: start.y, x2: endPoint.x, y2: endPoint.y });
  if (state.tool === 'circle' || state.tool === 'semicircle') addObject({ type: state.tool, x: start.x, y: start.y, r: distance(start, endPoint), angle: Math.atan2(endPoint.y - start.y, endPoint.x - start.x) });
  if (state.tool === 'ellipse' || state.tool === 'ellipseArc') addObject({ type: state.tool, x: start.x, y: start.y, rx: Math.abs(point.x - start.x), ry: Math.abs(point.y - start.y) });
  if (state.tool === 'slot') addObject({ type: 'slot', x1: start.x, y1: start.y, x2: point.x, y2: point.y, width: Number(document.querySelector('#targetRectHeight')?.value) || 200 });
  if (state.tool === 'polygon') { const sides = Math.max(3, Math.min(24, Number(document.querySelector('#polygonSides')?.value) || 6)); const radius = distance(start, point); const angle = Math.atan2(point.y - start.y, point.x - start.x); addObject({ type: 'polygon', points: Array.from({ length: sides }, (_, index) => polarPoint(start, radius, angle + index * Math.PI * 2 / sides)) }); }
  if (state.tool === 'dimension') addObject({ type: 'dimension', x1: start.x, y1: start.y, x2: endPoint.x, y2: endPoint.y, offset: dimensionStyle().defaultOffset });
  if (state.tool === 'rect') addObject({ type: 'rect', x: Math.min(start.x, endPoint.x), y: Math.min(start.y, endPoint.y), width: Math.abs(endPoint.x - start.x), height: Math.abs(endPoint.y - start.y), fillMode: 'none' });
}
function setTool(tool) { state.tool = tool; document.querySelectorAll('.tool-button').forEach(button => button.classList.toggle('active', button.dataset.tool === tool || button.dataset.planned === tool)); document.querySelector('#toolHint').textContent = `${toolNames[tool] || woodToolNames[tool] || tool} aktiv`; document.querySelector('#lineLengthPanel').hidden = !(['line', 'dimension', 'rect', 'circle', 'semicircle', 'ellipse', 'ellipseArc', 'slot', 'polygon'].includes(tool) || isWoodTool(tool)); updateLiveAngle(null, null); clearPreview(); polylinePoints = []; }
function exportSvg() { exportSheetSvg(); }
function fileBaseName() { updateProjectMetaFromForm(); return safeFileName(state.projectName); }
function downloadBlob(blob, filename) { const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = filename; link.click(); URL.revokeObjectURL(link.href); }
function safeFileName(value, fallback = 'werkplan') { return (value || fallback).replace(/[^a-z0-9_-]+/gi, '_'); }
function currentProjectData() {
  updateDimensionStyleFromControls();
  updateProjectMetaFromForm();
  updateMaterialsFromForm();
  saveActiveViewSettings();
  return projectDataFromState({ ...state, enabledViews: enabledViews() });
}

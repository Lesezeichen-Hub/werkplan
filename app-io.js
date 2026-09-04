const VALID_OBJECT_TYPES = new Set(['line', 'rect', 'circle', 'semicircle', 'ellipse', 'ellipseArc', 'polyline', 'polygon', 'slot', 'dimension', 'angleDimension', 'text']);
const REQUIRED_NUMERIC_FIELDS = {
  line: ['x1', 'y1', 'x2', 'y2'], dimension: ['x1', 'y1', 'x2', 'y2'], slot: ['x1', 'y1', 'x2', 'y2', 'width'],
  rect: ['x', 'y', 'width', 'height'], circle: ['x', 'y', 'r'], semicircle: ['x', 'y', 'r'],
  ellipse: ['x', 'y', 'rx', 'ry'], ellipseArc: ['x', 'y', 'rx', 'ry'],
  angleDimension: ['cx', 'cy', 'r', 'startAngle', 'endAngle'], text: ['x', 'y']
};
function validateProjectObject(object, index) {
  if (!object || typeof object !== 'object') return `Objekt ${index + 1}: kein gültiges Objekt`;
  if (typeof object.type !== 'string' || !VALID_OBJECT_TYPES.has(object.type)) return `Objekt ${index + 1}: unbekannter Typ „${object.type}“`;
  const missingField = (REQUIRED_NUMERIC_FIELDS[object.type] || []).find(field => !Number.isFinite(object[field]));
  if (missingField) return `Objekt ${index + 1} (${object.type}): Feld „${missingField}“ ist keine gültige Zahl`;
  if ((object.type === 'polyline' || object.type === 'polygon') && (!Array.isArray(object.points) || object.points.length < 2 || object.points.some(point => !point || !Number.isFinite(point.x) || !Number.isFinite(point.y)))) return `Objekt ${index + 1} (${object.type}): Punkteliste ungültig`;
  return null;
}
function validateProjectData(data) {
  if (!data || typeof data !== 'object') return 'Datei enthält kein gültiges Projekt';
  if (data.objects !== undefined && !Array.isArray(data.objects)) return 'Feld „objects“ muss eine Liste sein';
  if (Array.isArray(data.objects)) for (let index = 0; index < data.objects.length; index += 1) { const error = validateProjectObject(data.objects[index], index); if (error) return error; }
  if (data.materials !== undefined && !Array.isArray(data.materials)) return 'Feld „materials“ muss eine Liste sein';
  return null;
}
function openLibraryDb() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) { reject(new Error('IndexedDB nicht verfügbar')); return; }
    const request = indexedDB.open(libraryDbName, libraryDbVersion);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(libraryStoreName)) {
        const store = db.createObjectStore(libraryStoreName, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt');
        store.createIndex('name', 'name');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function libraryTransaction(mode, callback) {
  const db = await openLibraryDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(libraryStoreName, mode);
    const store = transaction.objectStore(libraryStoreName);
    let result;
    transaction.oncomplete = () => { db.close(); resolve(result); };
    transaction.onerror = () => { db.close(); reject(transaction.error); };
    transaction.onabort = () => { db.close(); reject(transaction.error); };
    result = callback(store);
  });
}
function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function listLibraryProjects() {
  return libraryTransaction('readonly', store => requestResult(store.getAll()));
}
async function putLibraryProject(record) {
  await libraryTransaction('readwrite', store => { store.put(record); });
}
async function getLibraryProject(id) {
  return libraryTransaction('readonly', store => requestResult(store.get(id)));
}
async function deleteLibraryProject(id) {
  await libraryTransaction('readwrite', store => { store.delete(id); });
}
async function clearLibraryProjects() {
  await libraryTransaction('readwrite', store => { store.clear(); });
}
function libraryRecordFromData(data, existingId = null) {
  const now = new Date().toISOString();
  const name = data.projectName || 'Projekt01';
  const id = existingId || `project-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  return {
    id,
    name,
    nameKey: projectNameKey(name),
    drawingNumber: data.drawingNumber || '',
    objectCount: Array.isArray(data.objects) ? data.objects.length : 0,
    createdAt: now,
    updatedAt: now,
    data
  };
}
function projectNameKey(name) { return String(name || 'Projekt01').trim().toLocaleLowerCase('de-DE') || 'projekt01'; }
function normalizedLibraryRecord(project) {
  const data = project?.data || {};
  const name = project?.name || data.projectName || 'Projekt01';
  return { ...project, name, nameKey: projectNameKey(name), data: { ...data, projectName: data.projectName || name } };
}
async function findLibraryProjectsByName(name) {
  const key = projectNameKey(name);
  return (await listLibraryProjects()).filter(project => projectNameKey(project.name || project.data?.projectName) === key);
}
function updateLibraryStatus(text = null) {
  const status = document.querySelector('#libraryStatus');
  if (!status) return;
  status.textContent = text || (state.libraryProjectId ? 'Auto-Save aktiv' : 'DB bereit');
}
async function openProjectLibraryPanel() {
  await renderProjectLibrary();
  const section = document.querySelector('#projectLibrarySection');
  if (section) {
    section.open = true;
    section.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
  setStatus('Bibliothek geöffnet: Zeichnung auswählen und Laden klicken');
}
function scheduleLibraryAutoSave() {
  if (!state.libraryProjectId || state.autoSaving) return;
  window.clearTimeout(state.autoSaveTimer);
  state.autoSaveTimer = window.setTimeout(() => { if (state.libraryProjectId) saveProjectToLibrary({ auto: true }); }, autoSaveDelay);
}
async function renderProjectLibrary() {
  const list = document.querySelector('#projectLibraryList');
  if (!list) return;
  try {
    const projects = (await listLibraryProjects()).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    list.replaceChildren();
    if (!projects.length) {
      const empty = document.createElement('div');
      empty.className = 'project-library-empty';
      empty.textContent = 'Keine gespeicherten Zeichnungen. Speichern legt die Bibliothek an und speichert dieses Projekt.';
      list.append(empty);
      updateLibraryStatus();
      return;
    }
    projects.forEach(project => {
      const row = document.createElement('div');
      row.className = 'project-library-row';
      if (project.id === state.libraryProjectId) row.classList.add('active');
      const updated = project.updatedAt ? new Date(project.updatedAt).toLocaleString('de-DE') : '-';
      row.innerHTML = `<div><strong></strong><span></span></div><button type="button" data-action="load">Laden</button><button type="button" data-action="delete">Löschen</button>`;
      row.querySelector('strong').textContent = project.name || 'Projekt';
      row.querySelector('span').textContent = `${project.drawingNumber || '-'} · ${project.objectCount || 0} Objekt(e) · ${updated}`;
      row.querySelector('[data-action="load"]').addEventListener('click', () => loadProjectFromLibrary(project.id));
      row.querySelector('[data-action="delete"]').addEventListener('click', () => removeProjectFromLibrary(project.id, project.name));
      list.append(row);
    });
    updateLibraryStatus();
  } catch {
    updateLibraryStatus('DB nicht verfügbar');
  }
}
async function saveProjectToLibrary(options = {}) {
  try {
    state.autoSaving = true;
    if (!options.auto) setStatus('Bibliothek wird vorbereitet');
    const data = currentProjectData();
    const sameNameProjects = await findLibraryProjectsByName(data.projectName);
    const currentRecord = state.libraryProjectId ? await getLibraryProject(state.libraryProjectId) : null;
    const existingByCurrentId = state.libraryProjectId ? sameNameProjects.find(project => project.id === state.libraryProjectId) : null;
    const existingByName = existingByCurrentId || sameNameProjects[0] || currentRecord || null;
    let record;
    if (existingByName) {
      record = { ...libraryRecordFromData(data, existingByName.id), createdAt: existingByName.createdAt || new Date().toISOString() };
      state.libraryProjectId = existingByName.id;
    } else {
      record = libraryRecordFromData(data);
      state.libraryProjectId = record.id;
    }
    await putLibraryProject(record);
    if (currentRecord && currentRecord.id !== record.id) await deleteLibraryProject(currentRecord.id);
    for (const duplicate of sameNameProjects.filter(project => project.id !== record.id)) await deleteLibraryProject(duplicate.id);
    setDirty(false);
    await renderProjectLibrary();
    setStatus(options.auto ? 'Automatisch in Bibliothek gespeichert' : 'Erfolgreich in Bibliothek gespeichert', options.auto ? '' : 'success');
  } catch {
    setStatus('Bibliothek konnte nicht gespeichert werden', 'error');
  } finally {
    state.autoSaving = false;
  }
}
async function loadProjectFromLibrary(id) {
  try {
    const record = await getLibraryProject(id);
    if (!record?.data) { setStatus('Projekt nicht gefunden'); return; }
    pushHistory();
    loadProjectData(record.data);
    state.libraryProjectId = id;
    setDirty(false);
    await renderProjectLibrary();
    setStatus('Projekt aus Bibliothek geladen', 'success');
  } catch {
    setStatus('Projekt konnte nicht geladen werden', 'error');
  }
}
async function removeProjectFromLibrary(id, name) {
  if (!window.confirm(`Projekt „${name || 'Projekt'}“ aus der Bibliothek löschen?`)) return;
  await deleteLibraryProject(id);
  if (state.libraryProjectId === id) state.libraryProjectId = null;
  await renderProjectLibrary();
  setStatus('Projekt aus Bibliothek gelöscht');
}
async function exportLibraryDb() {
  try {
    const projects = await listLibraryProjects();
    const dbDump = { app: 'Werkplan', type: 'project-library', version: 1, exportedAt: new Date().toISOString(), projects };
    downloadBlob(new Blob([JSON.stringify(dbDump, null, 2)], { type: 'application/json' }), `werkplan_bibliothek_${new Date().toISOString().slice(0, 10)}.werkplan-db`);
    setStatus('Bibliothek exportiert');
  } catch {
    setStatus('Bibliothek konnte nicht exportiert werden');
  }
}
function importLibraryDb(file) {
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const dump = JSON.parse(reader.result);
      const projects = Array.isArray(dump.projects) ? dump.projects : [];
      if (!projects.length) throw new Error('empty');
      if (!window.confirm('Aktuelle Projektbibliothek durch den Import ersetzen?')) return;
      await clearLibraryProjects();
      const uniqueProjects = new Map();
      let skipped = 0;
      for (const project of projects) {
        if (project?.id && project?.data && !validateProjectData(project.data)) uniqueProjects.set(projectNameKey(project.name || project.data.projectName), normalizedLibraryRecord(project));
        else skipped += 1;
      }
      for (const project of uniqueProjects.values()) await putLibraryProject(project);
      state.libraryProjectId = null;
      await renderProjectLibrary();
      setStatus(skipped ? `Bibliothek importiert (${skipped} ungültige Projekt(e) übersprungen)` : 'Bibliothek importiert');
    } catch {
      setStatus('DB-Import konnte nicht gelesen werden');
    }
  };
  reader.readAsText(file);
}
function exportPoint(value, min, scale, offset = sheet.margin) { return offset + (value - min) / scale; }
function renderExportObject(object, layer, bounds, exportScale, offsetX = sheet.margin, offsetY = sheet.margin) {
  const attrs = styleAttrs(object);
  attrs['stroke-width'] = Math.max(0.6, Number(attrs['stroke-width']) || 0.75);
  let element;
  if (object.type === 'line') element = makeSvg('line', { ...attrs, x1: exportPoint(object.x1, bounds.minX, exportScale, offsetX), y1: exportPoint(object.y1, bounds.minY, exportScale, offsetY), x2: exportPoint(object.x2, bounds.minX, exportScale, offsetX), y2: exportPoint(object.y2, bounds.minY, exportScale, offsetY) });
  if (object.type === 'rect') {
    const x = exportPoint(object.x, bounds.minX, exportScale, offsetX); const y = exportPoint(object.y, bounds.minY, exportScale, offsetY);
    const width = object.width / exportScale; const height = object.height / exportScale;
    const path = rectShapePath(object, exportScale, offsetX - bounds.minX / exportScale, offsetY - bounds.minY / exportScale);
    element = path ? makeSvg('path', { ...attrs, ...rectFillAttrs(object), d: path, transform: `rotate(${(object.rotation || 0) * 180 / Math.PI} ${x + width / 2} ${y + height / 2})` }) : makeSvg('rect', { ...attrs, ...rectFillAttrs(object), x, y, width, height, rx: object.cornerMode === 'round' ? (object.cornerSize || 0) / exportScale : 0, transform: `rotate(${(object.rotation || 0) * 180 / Math.PI} ${x + width / 2} ${y + height / 2})` });
  }
  if (object.type === 'circle') element = makeSvg('circle', { ...attrs, cx: exportPoint(object.x, bounds.minX, exportScale, offsetX), cy: exportPoint(object.y, bounds.minY, exportScale, offsetY), r: object.r / exportScale });
  if (object.type === 'semicircle') element = makeSvg('path', { ...attrs, d: semicirclePath(object, exportScale, offsetX - bounds.minX / exportScale, offsetY - bounds.minY / exportScale) });
  if (object.type === 'polyline') element = makeSvg('polyline', { ...attrs, points: object.points.map(point => `${exportPoint(point.x, bounds.minX, exportScale, offsetX)},${exportPoint(point.y, bounds.minY, exportScale, offsetY)}`).join(' ') });
  if (object.type === 'polygon') element = makeSvg('polygon', { ...attrs, points: object.points.map(point => `${exportPoint(point.x, bounds.minX, exportScale, offsetX)},${exportPoint(point.y, bounds.minY, exportScale, offsetY)}`).join(' ') });
  if (object.type === 'ellipse') { const cx = exportPoint(object.x, bounds.minX, exportScale, offsetX); const cy = exportPoint(object.y, bounds.minY, exportScale, offsetY); element = makeSvg('ellipse', { ...attrs, cx, cy, rx: object.rx / exportScale, ry: object.ry / exportScale, transform: `rotate(${(object.rotation || 0) * 180 / Math.PI} ${cx} ${cy})` }); }
  if (object.type === 'ellipseArc') { const cx = exportPoint(object.x, bounds.minX, exportScale, offsetX); const cy = exportPoint(object.y, bounds.minY, exportScale, offsetY); element = makeSvg('path', { ...attrs, d: ellipseArcPath(object, exportScale, offsetX - bounds.minX / exportScale, offsetY - bounds.minY / exportScale), transform: `rotate(${(object.rotation || 0) * 180 / Math.PI} ${cx} ${cy})` }); }
  if (object.type === 'slot') element = makeSvg('path', { ...attrs, d: slotPath(object, exportScale, offsetX - bounds.minX / exportScale, offsetY - bounds.minY / exportScale) });
  if (object.type === 'angleDimension') {
    const style = dimensionStyle();
    const angleOffsetX = offsetX - bounds.minX / exportScale;
    const angleOffsetY = offsetY - bounds.minY / exportScale;
    const center = { x: object.cx / exportScale + angleOffsetX, y: object.cy / exportScale + angleOffsetY };
    const radius = Math.max(1, object.r || 500) / exportScale;
    const delta = shortestAngleDelta(object.startAngle || 0, object.endAngle || 0);
    const start = polarPoint(center, radius, object.startAngle || 0);
    const end = polarPoint(center, radius, (object.startAngle || 0) + delta);
    const mid = polarPoint(center, radius + 16, (object.startAngle || 0) + delta / 2);
    element = makeSvg('g', {});
    element.append(
      makeSvg('line', { ...attrs, x1: center.x, y1: center.y, x2: start.x, y2: start.y }),
      makeSvg('line', { ...attrs, x1: center.x, y1: center.y, x2: end.x, y2: end.y }),
      makeSvg('path', { ...attrs, d: angleArcPath(object, exportScale, angleOffsetX, angleOffsetY) })
    );
    const label = makeSvg('text', { x: mid.x, y: mid.y, 'text-anchor': 'middle', class: 'dimension-label', 'font-size': style.textSize });
    label.textContent = angleDimensionLabel(object);
    element.append(label);
  }
  if (object.type === 'dimension') {
    const dx = object.x2 - object.x1; const dy = object.y2 - object.y1; const length = Math.max(1, Math.round(Math.hypot(dx, dy)));
    const style = dimensionStyle();
    const normal = { x: -dy / length, y: dx / length }; const offset = Number.isFinite(Number(object.offset)) ? Number(object.offset) : style.defaultOffset;
    const x1 = exportPoint(object.x1, bounds.minX, exportScale, offsetX); const y1 = exportPoint(object.y1, bounds.minY, exportScale, offsetY);
    const x2 = exportPoint(object.x2, bounds.minX, exportScale, offsetX); const y2 = exportPoint(object.y2, bounds.minY, exportScale, offsetY);
    const ax = x1 + normal.x * offset; const ay = y1 + normal.y * offset; const bx = x2 + normal.x * offset; const by = y2 + normal.y * offset;
    element = makeSvg('g', {});
    element.append(makeSvg('line', { ...attrs, x1, y1, x2: ax, y2: ay }), makeSvg('line', { ...attrs, x1: x2, y1: y2, x2: bx, y2: by }), makeSvg('line', { ...attrs, x1: ax, y1: ay, x2: bx, y2: by }));
    appendDimensionEnds(element, attrs, ax, ay, bx, by, object.stroke || state.strokeColor);
    const label = makeSvg('text', { x: (ax + bx) / 2, y: (ay + by) / 2 - 7, 'text-anchor': 'middle', class: 'dimension-label', 'font-size': style.textSize });
    label.textContent = dimensionLabelText(object, length); element.append(label);
  }
  if (object.type === 'text') { const x = exportPoint(object.x, bounds.minX, exportScale, offsetX); const y = exportPoint(object.y, bounds.minY, exportScale, offsetY); element = makeSvg('text', { ...attrs, x, y, stroke: 'none', fill: object.stroke || state.strokeColor, 'font-size': 16, transform: `rotate(${(object.rotation || 0) * 180 / Math.PI} ${x} ${y})` }); element.textContent = object.value; }
  if (element) layer.append(element);
}
function renderExportMaterialMarkers(layer, bounds, exportScale, objects = state.objects.filter(object => object.visible !== false), offsetX = sheet.margin, offsetY = sheet.margin) {
  objects.forEach(object => {
    const labels = materialMarkersForObject(object);
    const point = labels.length ? materialMarkerPoint(object) : null;
    if (!point) return;
    const x = exportPoint(point.x, bounds.minX, exportScale, offsetX);
    const y = exportPoint(point.y, bounds.minY, exportScale, offsetY);
    const group = makeSvg('g', {});
    group.append(makeSvg('circle', { cx: x, cy: y, r: 13, fill: '#fffdf8', stroke: '#263238', 'stroke-width': 1.1 }));
    const text = makeSvg('text', { x, y: y + 4, 'text-anchor': 'middle', class: 'sheet-text', 'font-weight': 700, fill: '#263238' });
    text.textContent = labels.map(label => label.replace('Pos. ', '')).join('/');
    group.append(text);
    layer.append(group);
  });
}
function calculateCommonExportRequirement(groups = exportViewGroups(), minimumScale = 1, exportScaleForPadding = null) {
  if (!groups.length) return minimumScale;
  const gap = groups.length > 1 ? 28 : 0; const labelHeight = 24;
  const slotWidth = (sheet.width - sheet.margin * 2 - gap * (groups.length - 1)) / groups.length;
  const usableHeight = Math.max(120, exportDrawingAreaHeight() - labelHeight);
  return Math.max(minimumScale, ...groups.map(group => {
    const factor = viewCalibrationFactor(group.view); const rawBounds = exportBoundsForObjects(group.objects);
    if (!rawBounds) return minimumScale;
    const paddingMm = exportPaddingMm(rawBounds, factor, exportScaleForPadding);
    const bounds = exportBoundsForObjects(group.objects, paddingMm / factor);
    return calculateRequiredExportScale(bounds, slotWidth, usableHeight, minimumScale) * factor;
  }));
}
function renderExportViews(root) {
  const groups = exportViewGroups();
  if (!groups.length) return state.autoScale ? calculateAutoScale() : state.scale;
  const drawing = makeSvg('g', {});
  const gap = groups.length > 1 ? 28 : 0;
  const labelHeight = 24;
  const totalWidth = sheet.width - sheet.margin * 2;
  const areaHeight = exportDrawingAreaHeight();
  const slotWidth = (totalWidth - gap * (groups.length - 1)) / groups.length;
  const viewLayouts = groups.map((group, index) => {
    const setting = ensureViewSetting(group.view);
    const calibrationFactor = viewCalibrationFactor(group.view);
    const rawBounds = exportBoundsForObjects(group.objects);
    const paddingMm = exportPaddingMm(rawBounds, calibrationFactor);
    const bounds = exportBoundsForObjects(group.objects, paddingMm / calibrationFactor);
    const x = Number.isFinite(setting.exportX) ? setting.exportX : sheet.margin + index * (slotWidth + gap);
    const y = Number.isFinite(setting.exportY) ? setting.exportY : sheet.margin + labelHeight;
    const usableHeight = Math.max(120, areaHeight - labelHeight);
    const requiredScale = bounds ? calculateRequiredExportScale(bounds, slotWidth, usableHeight, 0.001) * calibrationFactor : 0.001;
    return { ...group, bounds, rawBounds, x, y, usableHeight, requiredScale, setting, calibrationFactor };
  });
  const filledLayouts = viewLayouts.filter(layout => layout.bounds);
  const minimumCommonScale = Math.max(1, ...filledLayouts.map(layout => layout.requiredScale));
  const manualScale = Number(state.exportScale);
  const commonScale = state.exportScaleMode === 'manual' && Number.isFinite(manualScale) && manualScale > 0 ? manualScale : Math.max(1, Math.ceil(minimumCommonScale));
  viewLayouts.forEach((group, groupIndex) => {
    addTableText(drawing, group.x, sheet.margin + 15, viewNames[group.view], { 'font-size': 13, 'font-weight': 700, fill: '#263238' });
    if (groups.length > 1) {
      drawing.append(makeSvg('rect', { x: group.x, y: group.y, width: slotWidth, height: group.usableHeight, fill: 'none', stroke: '#d6dfdd', 'stroke-width': 0.7, 'stroke-dasharray': '5 5' }));
    }
    if (!group.bounds) return;
    const clipId = `viewClip-${group.view}`;
    const clipPath = makeSvg('clipPath', { id: clipId });
    const clipPaddingX = groups.length > 1 ? gap / 2 : 22;
    const clipX = groupIndex === 0 ? 28 : Math.max(28, group.x - clipPaddingX);
    const clipRight = groupIndex === viewLayouts.length - 1 ? sheet.width - 28 : Math.min(sheet.width - 28, group.x + slotWidth + clipPaddingX);
    clipPath.append(makeSvg('rect', { x: clipX, y: Math.max(28, group.y - 12), width: clipRight - clipX, height: group.usableHeight + 12 }));
    drawing.append(clipPath);
    const viewLayer = makeSvg('g', { class: 'export-view-content', 'data-view': group.view, 'clip-path': `url(#${clipId})` });
    const coordinateScale = commonScale / group.calibrationFactor;
    const renderPaddingMm = state.exportScaleMode === 'manual' ? exportPaddingMm(group.rawBounds, group.calibrationFactor, commonScale) : exportPaddingMm(group.rawBounds, group.calibrationFactor);
    const renderBounds = exportBoundsForObjects(group.objects, renderPaddingMm / group.calibrationFactor) || group.bounds;
    const renderedWidth = (renderBounds.maxX - renderBounds.minX) / coordinateScale;
    const renderedHeight = (renderBounds.maxY - renderBounds.minY) / coordinateScale;
    const contentX = group.x + Math.max(0, (slotWidth - renderedWidth) / 2);
    const contentY = group.y + Math.max(0, (group.usableHeight - renderedHeight) / 2);
    group.objects.forEach(object => renderExportObject(object, viewLayer, renderBounds, coordinateScale, contentX, contentY));
    renderExportMaterialMarkers(viewLayer, renderBounds, coordinateScale, group.objects, contentX, contentY);
    drawing.append(viewLayer);
  });
  root.append(drawing);
  return commonScale || state.scale;
}
function addTitleCell(root, x, y, width, height, label, value) {
  root.append(makeSvg('rect', { x, y, width, height, fill: 'none', stroke: '#263238', 'stroke-width': 1 }));
  const labelNode = makeSvg('text', { x: x + 8, y: y + 14, class: 'title-block-label' }); labelNode.textContent = label;
  const valueNode = makeSvg('text', { x: x + 8, y: y + height - 12, class: 'title-block-value' }); valueNode.textContent = value;
  root.append(labelNode, valueNode);
}
function addTableText(root, x, y, value, attrs = {}) {
  const text = makeSvg('text', { x, y, class: 'sheet-text', ...attrs });
  text.textContent = String(value || '');
  root.append(text);
}
function materialExportValues(item, index) {
  const objectInfo = linkedObjectText(item);
  const baseQty = parseMaterialNumber(item.qty, NaN);
  const linkedCount = materialObjectIds(item).length;
  const objectQty = parseMaterialNumber(item.objectQty, NaN);
  const exportQty = Number.isFinite(baseQty) && (baseQty !== 1 || !Number.isFinite(objectQty) || objectQty === 1) ? baseQty : objectQty;
  const qty = Number.isFinite(exportQty) ? trimNumber(exportQty) : item.qty || '';
  const unit = item.unit === 'm2' ? 'm²' : item.unit === 'm3' ? 'm³' : item.unit;
  const objectQtyNote = linkedCount > 1 ? `${linkedCount} Objekte` : item.objectQty && Number(item.objectQty) > 1 ? `${item.objectQty} St./Objekt` : '';
  const linkedNote = objectInfo ? `Verknüpfungen: ${objectInfo}` : '';
  const note = [item.note || '', objectQtyNote, linkedNote].filter(Boolean).join(' | ');
  return [item.pos || index + 1, qty, unit, item.name, item.material, item.dimensions, note];
}
function addMaterialTable(root) {
  updateMaterialsFromForm();
  if (!state.materials.length) return;
  const x = sheet.margin;
  const baseWidth = 640;
  const width = Math.min(baseWidth, sheet.width - sheet.margin * 2);
  const rowHeight = 22;
  const factor = width / baseWidth;
  const headers = [
    ['Pos.', 38], ['Menge', 58], ['ME', 38], ['Benennung', 170],
    ['Werkstoff', 110], ['Abmessung', 105], ['Bemerkung', 121]
  ].map(([label, colWidth]) => [label, colWidth * factor]);
  const rows = state.materials.slice(0, 6);
  const height = rowHeight * (rows.length + 2);
  const titleTop = sheet.height - sheet.margin - sheet.titleHeight;
  const y = titleTop - height - 16;
  root.append(makeSvg('rect', { x, y, width, height, fill: '#fffdf8', stroke: '#263238', 'stroke-width': 1.1 }));
  addTableText(root, x + 8, y + 15, 'Materialliste / Stückliste', { 'font-weight': 700, fill: '#263238' });
  let colX = x;
  headers.forEach(([label, colWidth]) => {
    root.append(makeSvg('rect', { x: colX, y: y + rowHeight, width: colWidth, height: rowHeight, fill: 'none', stroke: '#263238', 'stroke-width': 0.8 }));
    addTableText(root, colX + 4, y + rowHeight + 15, label, { 'font-weight': 700, 'font-size': 9 });
    colX += colWidth;
  });
  rows.forEach((item, rowIndex) => {
    const values = materialExportValues(item, rowIndex);
    let cellX = x;
    headers.forEach(([, colWidth], colIndex) => {
      const cellY = y + rowHeight * (rowIndex + 2);
      root.append(makeSvg('rect', { x: cellX, y: cellY, width: colWidth, height: rowHeight, fill: 'none', stroke: '#263238', 'stroke-width': 0.6 }));
      addTableText(root, cellX + 4, cellY + 15, String(values[colIndex] || '').slice(0, colWidth > 90 ? 20 : 10), { 'font-size': 9 });
      cellX += colWidth;
    });
  });
  if (state.materials.length > rows.length) addTableText(root, x + 8, y + height - 5, `+ ${state.materials.length - rows.length} weitere Position(en) im Projekt`, { 'font-size': 8, fill: '#667574' });
}
function buildSheetSvg() {
  updateProjectMetaFromForm();
  updateSheetFromState();
  updateMaterialsFromForm();
  const mm = sheetSizeMm();
  const root = makeSvg('svg', { xmlns: svgNS, width: `${mm.w}mm`, height: `${mm.h}mm`, viewBox: `0 0 ${sheet.width} ${sheet.height}` });
  addFillPatterns(root);
  const style = makeSvg('style', {});
  style.textContent = ".dimension-label{font:600 14px Arial,sans-serif;fill:#263238;paint-order:stroke;stroke:#fffdf8;stroke-width:5px;stroke-linejoin:round}.title-block-label{font:700 8px Arial,sans-serif;fill:#667574}.title-block-value{font:600 13px Arial,sans-serif;fill:#263238}.sheet-text{font:500 10px Arial,sans-serif;fill:#566665}";
  root.append(style);
  root.append(makeSvg('rect', { width: sheet.width, height: sheet.height, fill: '#fffdf8' }));
  root.append(makeSvg('rect', { x: 28, y: 28, width: sheet.width - 56, height: sheet.height - 56, fill: 'none', stroke: '#263238', 'stroke-width': 1.4 }));
  root.append(makeSvg('rect', { x: sheet.margin, y: sheet.margin, width: sheet.width - sheet.margin * 2, height: exportDrawingAreaHeight(), fill: 'none', stroke: '#c8d2d0', 'stroke-width': 0.8, 'stroke-dasharray': '6 6' }));
  const exportScale = renderExportViews(root);
  addMaterialTable(root);
  const titleX = sheet.width - sheet.margin - 540; const titleY = sheet.height - sheet.margin - sheet.titleHeight;
  root.append(makeSvg('rect', { x: titleX, y: titleY, width: 540, height: sheet.titleHeight, fill: '#fffdf8', stroke: '#263238', 'stroke-width': 1.2 }));
  addTitleCell(root, titleX, titleY, 270, 59, 'Projekt', state.projectName);
  addTitleCell(root, titleX + 270, titleY, 135, 59, 'Massstab', formatScaleRatio(exportScale));
  addTitleCell(root, titleX + 405, titleY, 135, 59, 'Einheit', 'mm');
  addTitleCell(root, titleX, titleY + 59, 180, 59, 'Zeichnung', state.drawingNumber);
  addTitleCell(root, titleX + 180, titleY + 59, 150, 59, 'Bearbeiter', state.drawnBy);
  addTitleCell(root, titleX + 330, titleY + 59, 120, 59, 'Datum', state.projectDate);
  addTitleCell(root, titleX + 450, titleY + 59, 90, 59, 'Format', `${state.sheetFormat} ${state.sheetOrientation === 'portrait' ? 'hoch' : 'quer'}`);
  return new XMLSerializer().serializeToString(root);
}
function exportSheetSvg() {
  const source = buildSheetSvg();
  downloadBlob(new Blob([source], { type: 'image/svg+xml' }), `${fileBaseName()}.svg`);
  setStatus('SVG exportiert');
}
function svgToCanvas(source, scale = 2) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(new Blob([source], { type: 'image/svg+xml' }));
    image.onload = () => {
      const out = document.createElement('canvas');
      out.width = sheet.width * scale; out.height = sheet.height * scale;
      const ctx = out.getContext('2d');
      ctx.fillStyle = '#fffdf8'; ctx.fillRect(0, 0, out.width, out.height);
      ctx.drawImage(image, 0, 0, out.width, out.height);
      URL.revokeObjectURL(url);
      resolve(out);
    };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('SVG konnte nicht gerendert werden')); };
    image.src = url;
  });
}
async function exportPng() {
  const out = await svgToCanvas(buildSheetSvg(), 3);
  out.toBlob(blob => { if (blob) downloadBlob(blob, `${fileBaseName()}.png`); }, 'image/png');
  setStatus('PNG exportiert');
}
function pdfEscape(value) { return String(value).replace(/[\\()]/g, '\\$&'); }
function buildMaterialListSvgPages(items = state.materials.slice(6)) {
  updateSheetFromState();
  const mm = sheetSizeMm();
  const baseHeaders = [['Pos.', 48], ['Menge', 70], ['ME', 44], ['Benennung', 230], ['Werkstoff', 150], ['Abmessung', 150], ['Bemerkung', 307]];
  const fullWidth = sheet.width - sheet.margin * 2;
  const fullFactor = fullWidth / baseHeaders.reduce((sum, [, w]) => sum + w, 0);
  const headers = baseHeaders.map(([label, w]) => [label, w * fullFactor]);
  const rowHeight = 24;
  const rowsPerPage = Math.max(1, Math.floor((sheet.height - sheet.margin * 2 - 82) / rowHeight));
  const chunks = [];
  for (let index = 0; index < items.length; index += rowsPerPage) chunks.push(items.slice(index, index + rowsPerPage));
  return chunks.map((rows, pageIndex) => {
    const root = makeSvg('svg', { xmlns: svgNS, width: `${mm.w}mm`, height: `${mm.h}mm`, viewBox: `0 0 ${sheet.width} ${sheet.height}` });
    const style = makeSvg('style', {});
    style.textContent = ".title-block-label{font:700 8px Arial,sans-serif;fill:#667574}.title-block-value{font:600 13px Arial,sans-serif;fill:#263238}.sheet-text{font:500 10px Arial,sans-serif;fill:#566665}";
    root.append(style);
    root.append(makeSvg('rect', { width: sheet.width, height: sheet.height, fill: '#fffdf8' }));
    root.append(makeSvg('rect', { x: 28, y: 28, width: sheet.width - 56, height: sheet.height - 56, fill: 'none', stroke: '#263238', 'stroke-width': 1.4 }));
    addTableText(root, sheet.margin, sheet.margin + 10, `Materialliste / Stückliste - ${state.projectName}`, { 'font-size': 18, 'font-weight': 700, fill: '#263238' });
    addTableText(root, sheet.width - sheet.margin, sheet.margin + 10, `Seite ${pageIndex + 1} / ${chunks.length}`, { 'font-size': 10, 'text-anchor': 'end', fill: '#566665' });
    let y = sheet.margin + 36; let x = sheet.margin;
    headers.forEach(([label, width]) => { root.append(makeSvg('rect', { x, y, width, height: rowHeight, fill: 'none', stroke: '#263238', 'stroke-width': 0.8 })); addTableText(root, x + 4, y + 16, label, { 'font-weight': 700, 'font-size': 10 }); x += width; });
    rows.forEach((item, rowIndex) => {
      y += rowHeight; x = sheet.margin;
      const absoluteIndex = 6 + pageIndex * rowsPerPage + rowIndex;
      const values = materialExportValues(item, absoluteIndex);
      headers.forEach(([, width], column) => { root.append(makeSvg('rect', { x, y, width, height: rowHeight, fill: 'none', stroke: '#263238', 'stroke-width': 0.55 })); addTableText(root, x + 4, y + 16, String(values[column] || '').slice(0, width > 150 ? 28 : 16), { 'font-size': 9 }); x += width; });
    });
    return new XMLSerializer().serializeToString(root);
  });
}
function buildImagePdf(jpegDataUrls) {
  const mm = sheetSizeMm();
  const pageW = mm.w * 72 / 25.4; const pageH = mm.h * 72 / 25.4;
  const objects = [];
  const add = value => { objects.push(value); return objects.length; };
  add('<< /Type /Catalog /Pages 2 0 R >>');
  add('');
  const pageIds = [];
  jpegDataUrls.forEach((dataUrl, index) => {
    const imageId = objects.length + 2;
    const contentId = objects.length + 3;
    pageIds.push(add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /XObject << /Im${index} ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`));
    const jpeg = atob(dataUrl.split(',')[1]);
    add(`<< /Type /XObject /Subtype /Image /Width ${sheet.width * 2} /Height ${sheet.height * 2} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n${jpeg}\nendstream`);
    const content = `q\n${pageW} 0 0 ${pageH} 0 0 cm\n/Im${index} Do\nQ`;
    add(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  });
  objects[1] = `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;
  let pdf = '%PDF-1.4\n'; const offsets = [0];
  objects.forEach((object, index) => { offsets.push(pdf.length); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach(offset => { pdf += `${String(offset).padStart(10, '0')} 00000 n \n`; });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const bytes = new Uint8Array(pdf.length);
  for (let i = 0; i < pdf.length; i++) bytes[i] = pdf.charCodeAt(i) & 0xff;
  return new Blob([bytes], { type: 'application/pdf' });
}
async function exportPdf() {
  const pages = [buildSheetSvg()];
  updateMaterialsFromForm();
  if (state.materials.length > 6) pages.push(...buildMaterialListSvgPages());
  const canvases = [];
  for (const page of pages) canvases.push(await svgToCanvas(page, 2));
  const pdf = buildImagePdf(canvases.map(out => out.toDataURL('image/jpeg', 0.92)));
  downloadBlob(pdf, `${fileBaseName()}.pdf`);
  setStatus('PDF exportiert');
}
function projectDataFromState(projectState) {
  return {
    app: 'Werkplan',
    version: 13,
    unit: 'mm',
    projectName: projectState.projectName,
    drawingNumber: projectState.drawingNumber,
    drawnBy: projectState.drawnBy,
    projectDate: projectState.projectDate,
    materials: projectState.materials,
    objects: projectState.objects,
    settings: { grid: projectState.grid, snap: projectState.snap, snapModes: projectState.snapModes, zoom: projectState.zoom, scale: projectState.scale, autoScale: projectState.autoScale, dimensionStyle: projectState.dimensionStyle, sheetFormat: projectState.sheetFormat, sheetOrientation: projectState.sheetOrientation, enabledViews: projectState.enabledViews, activeView: projectState.activeView, viewReferences: projectState.viewReferences, layers: projectState.layers, activeLayer: projectState.activeLayer, viewSettings: projectState.viewSettings, exportScaleMode: projectState.exportScaleMode, exportScale: projectState.exportScale }
  };
}
saveProject = function() {
  saveProjectToLibrary();
};
function saveProjectFile() {
  const data = currentProjectData();
  downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), `${fileBaseName()}.werkplan`);
  setDirty(false);
  setStatus('Projekt als Datei gespeichert');
}
function loadProjectData(data) {
  state.objects = Array.isArray(data.objects) ? data.objects : [];
  state.materials = Array.isArray(data.materials) ? data.materials : [];
  state.projectName = data.projectName || 'Projekt01';
  state.drawingNumber = data.drawingNumber || 'TZ-001';
  state.drawnBy = data.drawnBy || '';
  state.projectDate = data.projectDate || new Date().toISOString().slice(0, 10);
  document.querySelector('#projectName').value = state.projectName;
  document.querySelector('#drawingNumber').value = state.drawingNumber;
  document.querySelector('#drawnBy').value = state.drawnBy;
  document.querySelector('#projectDate').value = state.projectDate;
  renderMaterialList();
  state.grid = data.settings?.grid ?? true;
  state.snap = data.settings?.snap ?? true;
  state.snapModes = { ...state.snapModes, ...(data.settings?.snapModes || {}) };
  state.autoScale = data.settings?.autoScale ?? true;
  state.sheetFormat = data.settings?.sheetFormat || 'A3';
  state.sheetOrientation = data.settings?.sheetOrientation || 'landscape';
  state.exportScaleMode = data.settings?.exportScaleMode === 'manual' ? 'manual' : 'auto';
  state.exportScale = Number(data.settings?.exportScale) > 0 ? Number(data.settings.exportScale) : 10;
  state.enabledViews = Array.isArray(data.settings?.enabledViews) ? data.settings.enabledViews.filter(view => viewNames[view]) : ['front'];
  state.activeView = viewNames[data.settings?.activeView] ? data.settings.activeView : state.enabledViews[0];
  state.viewReferences = data.settings?.viewReferences && typeof data.settings.viewReferences === 'object' ? data.settings.viewReferences : {};
  if (Number(data.version) < 7) Object.values(state.viewReferences).forEach(reference => { reference.factor = 1; });
  if (Number(data.version) < 8) state.viewReferences = {};
  if (Number(data.version) < 10) state.objects.forEach(object => {
    const factor = Number(object.referenceScale?.factor); const view = objectView(object);
    if (!state.viewReferences[view] && !object.referenceScale?.copiedBetweenViews && Number.isFinite(factor) && factor > 0) state.viewReferences[view] = { factor, targetLength: object.referenceScale.targetLength, sourceObjectId: object.id, migrated: true };
  });
  if (Array.isArray(data.settings?.layers)) state.layers = data.settings.layers.filter(layer => layer.id !== 'guide');
  if (!state.layers.length) state.layers = [{ id: 'contour', name: 'Kontur', visible: true, locked: false, printable: true }];
  state.objects.forEach(object => { if (object.layer === 'guide') object.layer = 'contour'; });
  state.activeLayer = data.settings?.activeLayer === 'guide' ? 'contour' : data.settings?.activeLayer || state.layers[0].id;
  if (!state.layers.some(layer => layer.id === state.activeLayer)) state.activeLayer = state.layers[0].id;
  state.viewSettings = data.settings?.viewSettings && typeof data.settings.viewSettings === 'object' ? data.settings.viewSettings : {};
  if (Number(data.version) < 12) Object.entries(state.viewReferences).forEach(([view, reference]) => {
    const factor = Number(reference?.factor); const setting = state.viewSettings[view];
    if (setting && Number.isFinite(factor) && factor > 0) { setting.scale = (Number(setting.scale) || 20) * factor; setting.autoScale = false; }
  });
  document.querySelector('#sheetFormat').value = state.sheetFormat;
  document.querySelector('#sheetOrientation').value = state.sheetOrientation;
  syncViewControls();
  renderLayerControls();
  syncExportScaleControls();
  state.dimensionStyle = data.settings?.dimensionStyle || state.dimensionStyle;
  syncDimensionStyleControls();
  state.scale = Number(data.settings?.scale) > 0 ? Number(data.settings.scale) : 20;
  const legacyZoom = Number(data.settings?.zoom) > 0 ? Number(data.settings.zoom) : 1;
  if (!state.viewSettings[state.activeView]) state.viewSettings[state.activeView] = { scale: state.scale, autoScale: state.autoScale, viewBox: { x: 0, y: 0, width: 1200 / legacyZoom, height: 760 / legacyZoom }, layerVisibility: {}, exportX: null, exportY: null };
  loadActiveViewSettings();
  syncScaleControls();
  document.querySelector('#gridToggle').checked = state.grid;
  document.querySelector('#snapToggle').checked = state.snap;
  document.querySelectorAll('.snap-mode').forEach(input => { input.checked = state.snapModes[input.dataset.snapMode] !== false; });
  selectedId = null; selectedIds.clear();
  render();
}
loadProject = function(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      const validationError = validateProjectData(data);
      if (validationError) { setStatus(`Datei ungültig: ${validationError}`, 'error'); return; }
      pushHistory();
      loadProjectData(data);
      state.libraryProjectId = null;
      renderProjectLibrary();
      setDirty(false);
      setStatus('Projekt geladen');
    } catch {
      setStatus('Datei konnte nicht gelesen werden');
    }
  };
  reader.readAsText(file);
};


const hardwareToolNames = {
  topfband: 'Topfband 35', schubladenauszug: 'Schubladenauszug', bodentraeger: 'Bodenträger',
  exzenter: 'Exzenterverbinder', moebelverbinder: 'Möbelverbinder', winkel: 'Winkelverbinder', confirmat: 'Confirmat',
  magnetverschluss: 'Magnetverschluss', profilEditor: 'Profil-Editor'
};

function isHardwareTool(tool = state.tool) { return Object.hasOwn(hardwareToolNames, tool); }
function isGeneratedTool(tool = state.tool) { return isWoodTool(tool) || isHardwareTool(tool); }
function generatedStyle(type, geometry) { return { ...geometry, type, id: newId(), view: state.activeView, layer: geometry.layer || state.activeLayer, style: geometry.style || state.style, strokeWidth: state.strokeWidth, stroke: state.strokeColor }; }
function addGeneratedObjects(objects, tool = state.tool) {
  const visibleObjects = objects.filter(Boolean);
  if (!visibleObjects.length) return;
  pushHistory();
  const groupId = `werkstatt-${newId()}`;
  const name = hardwareToolNames[tool] || woodToolNames[tool] || tool;
  const created = visibleObjects.map((object, index) => ({ ...object, groupId, name: visibleObjects.length > 1 ? `${name} ${index + 1}` : name, workshopTool: tool }));
  state.objects.push(...created); selectedIds = new Set(created.map(object => object.id)); selectedId = created.at(-1).id;
  render(); setStatus(`${name} eingefügt`);
}
function createHardwareGeometry(start, end) {
  const left = Math.min(start.x, end.x); const top = Math.min(start.y, end.y); const width = Math.max(40, Math.abs(end.x - start.x)); const height = Math.max(40, Math.abs(end.y - start.y));
  const right = left + width; const bottom = top + height; const midX = left + width / 2; const midY = top + height / 2;
  const line = (x1, y1, x2, y2, style = state.style) => generatedStyle('line', { x1, y1, x2, y2, style });
  const rect = (x, y, w, h) => generatedStyle('rect', { x, y, width: w, height: h, fillMode: 'none' });
  const circle = (x, y, r) => generatedStyle('circle', { x, y, r });
  const r = Math.max(5, Math.min(width, height) * .1);
  if (state.tool === 'topfband') return [circle(midX, midY, Math.max(17.5, r * 1.75)), circle(midX - width * .22, midY, r * .42), circle(midX + width * .22, midY, r * .42), line(left, midY, right, midY, 'center')];
  if (state.tool === 'schubladenauszug') return [rect(left, top + height * .25, width, height * .5), line(left + width * .1, midY, right - width * .1, midY, 'center'), ...[.16, .5, .84].map(t => circle(left + width * t, midY, r * .48))];
  if (state.tool === 'bodentraeger') return [circle(midX, midY, Math.max(2.5, r * .45)), line(midX - r * 2, midY, midX + r * 2, midY, 'center'), line(midX, midY - r * 2, midX, midY + r * 2, 'center')];
  if (state.tool === 'exzenter') return [circle(midX, midY, Math.max(7.5, r)), circle(midX, midY, Math.max(2, r * .28)), line(midX - r, midY, midX + r, midY, 'dashed')];
  if (state.tool === 'moebelverbinder') return [circle(left + width * .27, midY, r), circle(right - width * .27, midY, r), line(left + width * .27, midY, right - width * .27, midY, 'center'), rect(midX - r * .5, midY - r * .5, r, r)];
  if (state.tool === 'winkel') return [rect(left, top, width * .2, height), rect(left, bottom - height * .2, width, height * .2), circle(left + width * .1, top + height * .28, r * .42), circle(left + width * .38, bottom - height * .1, r * .42)];
  if (state.tool === 'confirmat') return [circle(midX, midY, Math.max(3.5, r * .55)), line(midX - r * 1.6, midY, midX + r * 1.6, midY, 'center'), line(midX, midY - r * 1.6, midX, midY + r * 1.6, 'center')];
  if (state.tool === 'magnetverschluss') return [rect(left + width * .2, top + height * .25, width * .6, height * .5), circle(midX, midY, r * .5), line(midX, top, midX, bottom, 'center')];
  return [];
}
function createProfileGeometry(start, end) {
  const left = Math.min(start.x, end.x); const right = Math.max(start.x, end.x); const top = Math.min(start.y, end.y); const bottom = Math.max(start.y, end.y); const axisY = (top + bottom) / 2; const half = Math.max(20, (bottom - top) / 2); const preset = document.querySelector('#profilePreset')?.value || 'spindle';
  const at = t => { const x = left + (right - left) * t; const ratios = { spindle: .45 + .48 * Math.sin(Math.PI * t), bowl: .2 + .8 * Math.sin(Math.PI * t / 2), cove: .82 - .43 * Math.sin(Math.PI * t), bead: .45 + .42 * Math.sin(Math.PI * t) }; return { x, y: axisY - half * ratios[preset] }; };
  const upper = Array.from({ length: 25 }, (_, index) => at(index / 24)); const lower = upper.map(point => ({ x: point.x, y: axisY + (axisY - point.y) }));
  return [generatedStyle('line', { x1: left, y1: axisY, x2: right, y2: axisY, style: 'center', layer: 'axis' }), generatedStyle('polyline', { points: upper }), generatedStyle('polyline', { points: lower }), generatedStyle('line', { x1: left, y1: upper[0].y, x2: left, y2: lower[0].y, style: 'dashed' }), generatedStyle('line', { x1: right, y1: upper.at(-1).y, x2: right, y2: lower.at(-1).y, style: 'dashed' })];
}
function createGeneratedGeometry(start, end) { return state.tool === 'profilEditor' ? createProfileGeometry(start, end) : isHardwareTool() ? createHardwareGeometry(start, end) : createWoodGeometry(start, end); }
function updateBlankCalculation() {
  const diameter = Number(document.querySelector('#blankDiameter')?.value); const length = Number(document.querySelector('#blankLength')?.value); const density = Number(document.querySelector('#blankDensity')?.value); const output = document.querySelector('#blankCalculation');
  if (!output) return;
  if (![diameter, length, density].every(value => Number.isFinite(value) && value > 0)) { output.textContent = 'Gültige Maße eingeben.'; return; }
  const volume = Math.PI * (diameter / 2000) ** 2 * (length / 1000);
  output.textContent = `Zylinderrohling: ${(volume * 1000).toFixed(2).replace('.', ',')} l · ${(volume * density).toFixed(2).replace('.', ',')} kg`;
}
function explodeSelectedGroups() {
  const groups = [...new Set(selectedObjects().map(object => object.groupId).filter(Boolean))];
  if (!groups.length) { setStatus('Eine zusammengehörige Werkzeuggruppe auswählen'); return; }
  pushHistory(); let expanded = false;
  groups.forEach(groupId => {
    const members = state.objects.filter(object => object.groupId === groupId);
    if (members.some(object => object.explosionOffset)) { members.forEach(object => { if (object.explosionOffset) { translateObject(object, -object.explosionOffset.x, -object.explosionOffset.y); delete object.explosionOffset; } }); return; }
    const bounds = boundsForObjects(members); const center = { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 }; const spacing = Math.max(60, Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) * .16);
    members.forEach((object, index) => { const position = objectCenter(object); let dx = position.x - center.x; let dy = position.y - center.y; const length = Math.hypot(dx, dy); if (length < 1) { const angle = index * Math.PI * 2 / members.length; dx = Math.cos(angle); dy = Math.sin(angle); } else { dx /= length; dy /= length; } object.explosionOffset = { x: dx * spacing * (index + 1), y: dy * spacing * (index + 1) }; translateObject(object, object.explosionOffset.x, object.explosionOffset.y); }); expanded = true;
  });
  render(); setStatus(expanded ? 'Explosionsansicht erstellt' : 'Explosionsansicht zusammengefügt');
}
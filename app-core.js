const canvas = document.querySelector('#drawingCanvas');
const drawingLayer = document.querySelector('#drawingLayer');
const previewLayer = document.querySelector('#previewLayer');
const emptyState = document.querySelector('#emptyState');
const statusText = document.querySelector('#statusText');
const pageMessage = document.querySelector('#pageMessage');
const propertyPanel = document.querySelector('#propertyPanel');
const fileInput = document.querySelector('#fileInput');
const dbImportInput = document.querySelector('#dbImportInput');
const documentTitle = document.title;
const themeStorageKey = 'werkplan-theme';
const libraryDbName = 'werkplan-library';
const libraryStoreName = 'projects';
const libraryDbVersion = 1;
const autoSaveDelay = 3000;

function preferredTheme() {
  const stored = localStorage.getItem(themeStorageKey);
  if (stored === 'dark' || stored === 'light') return stored;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
function applyTheme(theme, persist = false) {
  const dark = theme === 'dark';
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  const toggle = document.querySelector('#themeToggle');
  if (toggle) {
    toggle.textContent = dark ? '☀' : '☾';
    toggle.title = dark ? 'Helles Design aktivieren' : 'Dunkles Design aktivieren';
    toggle.setAttribute('aria-label', toggle.title);
    toggle.setAttribute('aria-pressed', String(dark));
  }
  if (persist) localStorage.setItem(themeStorageKey, dark ? 'dark' : 'light');
}
applyTheme(preferredTheme());

const state = {
  tool: 'select', style: 'solid', strokeWidth: 0.75, strokeColor: '#263238',
  snap: true, grid: true, zoom: 1, scale: 20, projectName: 'Projekt01',
  objects: [], draft: null, history: [], dirty: false
};
state.autoScale = true;
state.snapModes = { endpoint: true, midpoint: true, intersection: true, tangent: true, perpendicular: true, quadrant: true, extension: true };
state.drawingNumber = 'TZ-001';
state.drawnBy = '';
state.projectDate = new Date().toISOString().slice(0, 10);
state.dimensionStyle = { endStyle: 'arrow', textSize: 14, defaultOffset: 22, unit: 'auto', decimals: 0 };
state.materials = [];
state.redo = [];
state.sheetFormat = 'A3';
state.sheetOrientation = 'landscape';
state.enabledViews = ['front'];
state.activeView = 'front';
state.viewReferences = {};
state.exportScaleMode = 'auto';
state.exportScale = 10;
state.layers = [
  { id: 'contour', name: 'Kontur', visible: true, locked: false, printable: true },
  { id: 'axis', name: 'Achsen', visible: true, locked: false, printable: true },
  { id: 'dimension', name: 'Bemaßung', visible: true, locked: false, printable: true },
  { id: 'text', name: 'Text', visible: true, locked: false, printable: true }
];
state.activeLayer = 'contour';
state.viewSettings = {};
state.libraryProjectId = null;
state.autoSaveTimer = null;
state.autoSaving = false;
let pointerStart = null;
let selectedId = null;
let selectedIds = new Set();
let draggingObject = null;
let draggingObjects = [];
let draggingHandle = null;
let dragMode = 'move';
let dragChanged = false;
let dragHistoryCaptured = false;
let polylinePoints = [];
let clipboard = null;
let clipboardSourceScale = 20;
let clipboardSourceCalibration = 1;
let currentSnap = null;
let angleReferenceId = null;
let viewBox = { x: 0, y: 0, width: 1200, height: 760 };
let panStart = null;
let spacePressed = false;
let selectionBoxStart = null;
let commandSelectionIndex = 0;
let pageMessageTimer = null;

const svgNS = 'http://www.w3.org/2000/svg';
const snapSize = 10;
const sheet = { width: 1200, height: 760, margin: 50, titleHeight: 118 };
const scaleSteps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000];
const toolNames = { select: 'Auswahl', line: 'Linie', circle: 'Kreis', semicircle: 'Halbkreis', rect: 'Rechteck', dimension: 'Bemaßung', angleDimension: 'Winkelmaß', text: 'Text', polyline: 'Polylinie', ellipse: 'Ellipse', ellipseArc: 'Ellipsenbogen', slot: 'Langloch', polygon: 'Polygon', smartTrim: 'Bis Schnittkante trimmen', smartExtend: 'Bis Schnittkante verlängern' };
const woodToolNames = { zapfenSchlitz: 'Zapfen und Schlitz', ueberblattung: 'Überblattung', fingerzinken: 'Fingerzinken', schwalbenschwanz: 'Schwalbenschwanzzinken', duebel: 'Dübel', duebelsatz: 'Dübelplatzierung', nutFeder: 'Nut und Feder', bohrung: 'Bohrung', zentrierbohrung: 'Zentrierbohrung', senkbohrung: 'Senkbohrung', lochkreis: 'Lochkreis', eckverbindung: 'Eckverbindung', scharnier: 'Scharnier', schnittlinie: 'Schnittlinie', freihandkurve: 'Freihandkurve', bezierkurve: 'Bézierkurve', ornamentsegment: 'Ornamentsegment', rosette: 'Rosette', blatt: 'Blatt', bluete: 'Blüte', ranke: 'Ranke', reliefprofil: 'Reliefprofil', symmetrieachse: 'Symmetrieachse', drehachse: 'Drehachse', kehle: 'Kehle', kegel: 'Kegel', kegelstumpf: 'Kegelstumpf', schalenprofil: 'Schalenprofil', absatz: 'Absatz', zapfen: 'Zapfen', wandstaerke: 'Wandstärke', bohrtiefe: 'Bohrtiefe', fachwerkWand: 'Fachwerkwand', schwelle: 'Schwelle', raehm: 'Rähm', staender: 'Ständer', riegel: 'Riegel', strebe: 'Strebe', kopfband: 'Kopfband', fussband: 'Fußband', andreaskreuz: 'Andreaskreuz', fensterGefach: 'Fenstergefach', tuerGefach: 'Türgefach', dachstuhl: 'Dachstuhl', staenderZapfen: 'Ständer mit Zapfen', strebenUeberblattung: 'Streben-Überblattung', strebenVersatz: 'Strebenversatz', schwalbenschwanzblatt: 'Schwalbenschwanzblatt', holznaegel: 'Holznägel', sparren: 'Sparren', pfette: 'Pfette', kehlbalken: 'Kehlbalken', first: 'First', stuhlstaender: 'Stuhlständer', dachKopfband: 'Dach-Kopfband' };
const carpentryToolIds = new Set(['fachwerkWand', 'schwelle', 'raehm', 'staender', 'riegel', 'strebe', 'kopfband', 'fussband', 'andreaskreuz', 'fensterGefach', 'tuerGefach', 'dachstuhl', 'staenderZapfen', 'strebenUeberblattung', 'strebenVersatz', 'schwalbenschwanzblatt', 'holznaegel', 'sparren', 'pfette', 'kehlbalken', 'first', 'stuhlstaender', 'dachKopfband']);
const toolOrder = ['select', 'line', 'circle', 'semicircle', 'rect', 'dimension', 'text'];
const viewNames = { front: 'Frontansicht', side: 'Seitenansicht', top: 'Draufsicht', detail: 'Detail' };
const viewOrder = ['front', 'side', 'top', 'detail'];
function ensureViewSetting(view = state.activeView) {
  if (!state.viewSettings[view]) state.viewSettings[view] = { scale: 20, autoScale: true, viewBox: { x: 0, y: 0, width: 1200, height: 760 }, layerVisibility: {}, exportX: null, exportY: null };
  return state.viewSettings[view];
}
function saveActiveViewSettings() {
  const setting = ensureViewSetting(); setting.scale = state.scale; setting.autoScale = state.autoScale; setting.viewBox = { ...viewBox };
  setting.layerVisibility = Object.fromEntries(state.layers.map(layer => [layer.id, layer.visible !== false]));
}
function loadActiveViewSettings() {
  const setting = ensureViewSetting(); state.scale = Number(setting.scale) > 0 ? Number(setting.scale) : 20; state.autoScale = setting.autoScale !== false; viewBox = { ...(setting.viewBox || { x: 0, y: 0, width: 1200, height: 760 }) };
  state.layers.forEach(layer => { layer.visible = setting.layerVisibility?.[layer.id] ?? true; });
  applyViewBox(); syncScaleControls(); renderLayerControls(); syncViewSettingControls();
}
function syncViewSettingControls() {
  const setting = ensureViewSetting(); const x = document.querySelector('#viewExportX'); const y = document.querySelector('#viewExportY');
  if (x) x.value = Number.isFinite(setting.exportX) ? setting.exportX : '';
  if (y) y.value = Number.isFinite(setting.exportY) ? setting.exportY : '';
}
function syncExportScaleControls() {
  const select = document.querySelector('#exportScaleSelect'); const wrap = document.querySelector('#customExportScaleWrap'); const input = document.querySelector('#customExportScale'); const status = document.querySelector('#exportScaleStatus');
  if (!select || !wrap || !input || !status) return;
  if (state.exportScaleMode === 'auto') { select.value = 'auto'; wrap.hidden = true; status.textContent = 'Wird beim Export automatisch passend berechnet.'; }
  else {
    const preset = [...select.options].some(option => option.value === String(state.exportScale)); select.value = preset ? String(state.exportScale) : 'custom'; wrap.hidden = preset; input.value = state.exportScale; status.textContent = `Fest eingestellt: ${formatScaleRatio(state.exportScale)}`;
  }
}
function updateSheetFromState() {
  const landscape = state.sheetOrientation !== 'portrait';
  if (state.sheetFormat === 'A4') { sheet.width = landscape ? 900 : 640; sheet.height = landscape ? 640 : 900; }
  else { sheet.width = landscape ? 1200 : 840; sheet.height = landscape ? 760 : 1200; }
}
function sheetSizeMm() {
  const landscape = state.sheetOrientation !== 'portrait';
  if (state.sheetFormat === 'A4') return landscape ? { w: 297, h: 210 } : { w: 210, h: 297 };
  return landscape ? { w: 420, h: 297 } : { w: 297, h: 420 };
}
function viewCalibrationFactor(view = state.activeView) {
  const factor = Number(state.viewReferences[view]?.factor);
  return Number.isFinite(factor) && factor > 0 ? factor : 1;
}
function drawingScale(view = state.activeView) {
  const viewScale = view === state.activeView ? state.scale : Number(ensureViewSetting(view).scale) || state.scale;
  return viewScale / viewCalibrationFactor(view);
}


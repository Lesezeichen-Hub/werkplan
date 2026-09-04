const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const appModules = ['app-core.js', 'app-render.js', 'app-wood.js', 'app-interaction.js', 'app-io.js', 'app-main.js'];
const appSource = appModules.map(name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8')).join('\n');
const indexSource = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function extractFunction(name) {
  const start = appSource.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `function ${name} must exist`);
  const open = appSource.indexOf('{', start);
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let index = open; index < appSource.length; index += 1) {
    const character = appSource[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === "'" || character === '"' || character === '`') {
      quote = character;
      continue;
    }
    if (character === '{') depth += 1;
    if (character === '}') {
      depth -= 1;
      if (depth === 0) return appSource.slice(start, index + 1);
    }
  }
  throw new Error(`Could not extract ${name}`);
}

const distance = eval(`(${extractFunction('distance')})`);
const rotatePoint = eval(`(${extractFunction('rotatePoint')})`);
const rectCorners = eval(`(${extractFunction('rectCorners')})`);
const resizeRectFromCorner = eval(`(${extractFunction('resizeRectFromCorner')})`);
const resizeEllipseFromHandle = eval(`(${extractFunction('resizeEllipseFromHandle')})`);
const slotWidthHandlePoint = eval(`(${extractFunction('slotWidthHandlePoint')})`);
const ellipseEdgeDistance = eval(`(${extractFunction('ellipseEdgeDistance')})`);
const segmentIntersection = eval(`(${extractFunction('segmentIntersection')})`);
const clampDimensionOffset = eval(`(${extractFunction('clampDimensionOffset')})`);
const projectDataFromState = eval(`(${extractFunction('projectDataFromState')})`);

test('distance calculates Euclidean length', () => {
  assert.equal(distance({ x: 0, y: 0 }, { x: 3, y: 4 }), 5);
});

test('segmentIntersection finds a crossing and rejects parallel segments', () => {
  assert.deepEqual(
    segmentIntersection({ x1: 0, y1: 0, x2: 10, y2: 10 }, { x1: 0, y1: 10, x2: 10, y2: 0 }),
    { x: 5, y: 5 }
  );
  assert.equal(segmentIntersection({ x1: 0, y1: 0, x2: 10, y2: 0 }, { x1: 0, y1: 5, x2: 10, y2: 5 }), null);
});

test('rotated rectangle corner resize keeps the opposite corner anchored', () => {
  const rect = { type: 'rect', x: 10, y: 20, width: 100, height: 50, rotation: Math.PI / 6 };
  const originalSe = rectCorners(rect)[2];
  const nextNw = { x: originalSe.x - 120 * Math.cos(rect.rotation) + 80 * Math.sin(rect.rotation), y: originalSe.y - 120 * Math.sin(rect.rotation) - 80 * Math.cos(rect.rotation) };

  resizeRectFromCorner(rect, 'nw', nextNw);

  const corners = rectCorners(rect);
  assert.equal(rect.rotation, Math.PI / 6);
  assert.ok(Math.abs(rect.width - 120) < 0.000001);
  assert.ok(Math.abs(rect.height - 80) < 0.000001);
  assert.ok(distance(corners[0], nextNw) < 0.000001);
  assert.ok(distance(corners[2], originalSe) < 0.000001);
});

test('rotated ellipse radius handles resize along local axes', () => {
  const ellipse = { type: 'ellipse', x: 100, y: 200, rx: 40, ry: 20, rotation: Math.PI / 4 };
  resizeEllipseFromHandle(ellipse, 'ellipseRx', rotatePoint({ x: 170, y: 200 }, { x: 100, y: 200 }, Math.PI / 4));
  resizeEllipseFromHandle(ellipse, 'ellipseRy', rotatePoint({ x: 100, y: 235 }, { x: 100, y: 200 }, Math.PI / 4));

  assert.ok(Math.abs(ellipse.rx - 70) < 0.000001);
  assert.ok(Math.abs(ellipse.ry - 35) < 0.000001);
});

test('slot width handle sits on and edits the half-width normal', () => {
  const slot = { type: 'slot', x1: 0, y1: 0, x2: 100, y2: 0, width: 30 };
  assert.deepEqual(slotWidthHandlePoint(slot), { x: 50, y: 15 });
});

test('rotated ellipse edge distance respects object rotation', () => {
  const ellipse = { type: 'ellipse', x: 10, y: 20, rx: 60, ry: 20, rotation: Math.PI / 2 };
  const edge = rotatePoint({ x: ellipse.x + ellipse.rx, y: ellipse.y }, ellipse, ellipse.rotation);

  assert.ok(ellipseEdgeDistance(edge, ellipse) < 0.000001);
});

test('dimension offsets stay within the supported range', () => {
  assert.equal(clampDimensionOffset(1000), 500);
  assert.equal(clampDimensionOffset(-1000), -500);
  assert.equal(clampDimensionOffset('invalid'), 22);
});

test('project data survives JSON save/load round trip', () => {
  const state = {
    projectName: 'Test', drawingNumber: 'TZ-002', drawnBy: 'A', projectDate: '2026-08-21',
    materials: [{ objectIds: ['line-1'] }], objects: [{ id: 'line-1', type: 'line' }],
    grid: true, snap: false, snapModes: { endpoint: true }, zoom: 1, scale: 20, autoScale: true,
    dimensionStyle: { defaultOffset: 22 }, sheetFormat: 'A3', sheetOrientation: 'landscape',
    enabledViews: ['front'], activeView: 'front', viewReferences: {}, layers: [], activeLayer: 'contour',
    viewSettings: {}, exportScaleMode: 'auto', exportScale: 10
  };
  const loaded = JSON.parse(JSON.stringify(projectDataFromState(state)));
  assert.equal(loaded.version, 13);
  assert.deepEqual(loaded.objects, state.objects);
  assert.deepEqual(loaded.materials, state.materials);
  assert.deepEqual(loaded.settings.dimensionStyle, state.dimensionStyle);
  assert.deepEqual(loaded.settings.enabledViews, state.enabledViews);
});

test('carpentry automatic dimensions are disabled at the dimension factory', () => {
  assert.match(appSource, /const dimension = .*isCarpentryTool\(\) \? null/);
  assert.match(appSource, /const carpentryToolIds = new Set/);
});

test('centering drill stays anchored at the click start point', () => {
  const branch = appSource.match(/if \(state\.tool === 'zentrierbohrung'\) \{[\s\S]*?\n  \}/)?.[0] || '';
  assert.match(branch, /const radius = Math\.max\(8, distance\(start, end\)\)/);
  assert.doesNotMatch(branch, /midX|midY/);
  assert.match(branch, /circle\(start\.x, start\.y/);
  assert.match(branch, /line\(start\.x - axisLength, start\.y/);
  assert.match(branch, /line\(start\.x, start\.y - axisLength/);
});

test('only one save and load implementation remains', () => {
  assert.equal((appSource.match(/function saveProject\s*\(/g) || []).length, 0);
  assert.equal((appSource.match(/function loadProject\s*\(/g) || []).length, 0);
  assert.equal((appSource.match(/saveProject\s*=\s*function/g) || []).length, 1);
  assert.equal((appSource.match(/loadProject\s*=\s*function/g) || []).length, 1);
});

test('project library has autosave and database import/export controls', () => {
  assert.match(indexSource, /id="saveProjectToLibrary"/);
  assert.match(indexSource, /id="openProjectLibrary"/);
  assert.match(indexSource, /id="projectLibrarySection"/);
  assert.match(indexSource, /id="pageMessage"/);
  assert.match(indexSource, /id="exportLibraryDb"/);
  assert.match(indexSource, /id="importLibraryDb"/);
  assert.match(appSource, /const libraryDbName = 'werkplan-library'/);
  assert.match(appSource, /function scheduleLibraryAutoSave\(\)/);
  assert.match(appSource, /if \(dirty\) scheduleLibraryAutoSave\(\)/);
  assert.doesNotMatch(appSource, /window\.prompt\('Speichern als:/);
  assert.match(appSource, /saveProject = function\(\) \{\s*saveProjectToLibrary\(\);\s*\};/);
  assert.match(appSource, /function projectNameKey\(name\)/);
  assert.match(appSource, /function findLibraryProjectsByName\(name\)/);
  assert.match(appSource, /sameNameProjects\.filter\(project => project\.id !== record\.id\)/);
  assert.match(appSource, /uniqueProjects\.set\(projectNameKey/);
  assert.match(appSource, /function openProjectLibraryPanel\(\)/);
  assert.match(appSource, /pageMessage\.hidden = type !== 'success'/);
  assert.match(appSource, /setStatus\(options\.auto \? 'Automatisch in Bibliothek gespeichert' : 'Erfolgreich in Bibliothek gespeichert', options\.auto \? '' : 'success'\)/);
  assert.match(appSource, /function saveProjectFile\(\)/);
  assert.match(indexSource, /id="exportProjectFile"/);
  assert.match(appSource, /#exportProjectFile'\)\?\.addEventListener\('click', saveProjectFile\)/);
  assert.match(appSource, /function exportLibraryDb\(\)/);
  assert.match(appSource, /function importLibraryDb\(file\)/);
});

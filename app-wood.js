function newId() { return `${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function isWoodTool(tool = state.tool) { return Object.hasOwn(woodToolNames, tool); }
function isCarpentryTool(tool = state.tool) { return carpentryToolIds.has(tool); }
function woodStyle(type, geometry) { return { ...geometry, type, id: newId(), view: state.activeView, layer: geometry.layer || state.activeLayer, style: geometry.style || state.style, strokeWidth: state.strokeWidth, stroke: state.strokeColor }; }
function woodBounds(start, end) {
  const exactEnd = exactRectEndPoint(start, end);
  return { x: Math.min(start.x, exactEnd.x), y: Math.min(start.y, exactEnd.y), width: Math.max(40, Math.abs(exactEnd.x - start.x)), height: Math.max(40, Math.abs(exactEnd.y - start.y)) };
}
function addWoodObjects(objects) {
  if (!objects.length) return;
  const visibleObjects = objects.filter(Boolean);
  if (!visibleObjects.length) return;
  pushHistory(); const groupId = `holz-${newId()}`; const toolName = woodToolNames[state.tool]; const created = visibleObjects.map((object, index) => ({ ...object, groupId, name: visibleObjects.length > 1 ? `${toolName} ${index + 1}` : toolName, woodTool: state.tool })); state.objects.push(...created); selectedIds = new Set(created.map(object => object.id)); selectedId = created.at(-1).id; render(); setStatus(`${toolName} gezeichnet`);
}
function createWoodGeometry(start, end) {
  const box = woodBounds(start, end); const x2 = box.x + box.width; const y2 = box.y + box.height; const midX = box.x + box.width / 2; const midY = box.y + box.height / 2;
  const line = (x1, y1, x2Value, y2Value, style = state.style) => woodStyle('line', { x1, y1, x2: x2Value, y2: y2Value, style });
  const rect = (x, y, width, height, fillMode = 'none') => woodStyle('rect', { x, y, width, height, fillMode });
  const circle = (x, y, r) => woodStyle('circle', { x, y, r });
  const polyline = points => woodStyle('polyline', { points });
  const polygon = points => woodStyle('polygon', { points });
  const text = (x, y, value) => woodStyle('text', { x, y, value, layer: 'text' });
  const dimension = (x1, y1, x2Value, y2Value, offset = dimensionStyle().defaultOffset) => isCarpentryTool() ? null : woodStyle('dimension', { x1, y1, x2: x2Value, y2: y2Value, offset, layer: 'dimension' });
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const timber = clamp(Math.min(box.width, box.height) * .12, 18, 70);
  const beam = (x, y, width, height) => rect(x, y, Math.max(10, width), Math.max(10, height));
  const diagonalBeam = (a, b, width = timber) => {
    const dx = b.x - a.x; const dy = b.y - a.y; const length = Math.hypot(dx, dy) || 1;
    const nx = -dy / length * width / 2; const ny = dx / length * width / 2;
    return polygon([{ x: a.x + nx, y: a.y + ny }, { x: b.x + nx, y: b.y + ny }, { x: b.x - nx, y: b.y - ny }, { x: a.x - nx, y: a.y - ny }]);
  };
  const dimensionedTimber = objects => [...objects, dimension(box.x, y2, x2, y2, 28)];
  if (state.tool === 'schwelle') return dimensionedTimber([
    beam(box.x, y2 - timber, box.width, timber),
    line(box.x, y2 - timber / 2, x2, y2 - timber / 2, 'center'),
    line(box.x, y2 + timber * .35, x2, y2 + timber * .35, 'dashed')
  ]);
  if (state.tool === 'raehm') return dimensionedTimber([
    beam(box.x, box.y, box.width, timber),
    beam(box.x + box.width * .18, box.y + timber, timber * .7, box.height - timber),
    beam(x2 - box.width * .18 - timber * .7, box.y + timber, timber * .7, box.height - timber),
    line(box.x, box.y + timber / 2, x2, box.y + timber / 2, 'center')
  ]);
  if (state.tool === 'staender') return dimensionedTimber([
    beam(midX - timber / 2, box.y, timber, box.height),
    line(midX, box.y, midX, y2, 'center'),
    line(midX - timber * .7, box.y, midX + timber * .7, box.y, 'dashed'),
    line(midX - timber * .7, y2, midX + timber * .7, y2, 'dashed')
  ]);
  if (state.tool === 'riegel') return dimensionedTimber([
    beam(box.x, box.y, timber, box.height),
    beam(x2 - timber, box.y, timber, box.height),
    beam(box.x + timber, midY - timber / 2, box.width - timber * 2, timber),
    line(box.x + timber, midY, x2 - timber, midY, 'center')
  ]);
  if (state.tool === 'strebe') return [diagonalBeam({ x: box.x, y: y2 - timber / 2 }, { x: x2, y: box.y + timber / 2 }), line(box.x, y2, x2, box.y, 'center'), dimension(box.x, y2, x2, box.y, 30)];
  if (state.tool === 'kopfband') return [beam(box.x, box.y, timber, box.height), beam(box.x, box.y, box.width, timber), diagonalBeam({ x: box.x + timber / 2, y: y2 }, { x: x2, y: box.y + timber / 2 }), dimension(box.x + timber / 2, y2, x2, box.y + timber / 2, 24)];
  if (state.tool === 'fussband') return [beam(box.x, box.y, timber, box.height), beam(box.x, y2 - timber, box.width, timber), diagonalBeam({ x: box.x + timber / 2, y: box.y }, { x: x2, y: y2 - timber / 2 }), dimension(box.x + timber / 2, box.y, x2, y2 - timber / 2, 24)];
  if (state.tool === 'andreaskreuz') return [beam(box.x, y2 - timber, box.width, timber), beam(box.x, box.y, box.width, timber), diagonalBeam({ x: box.x, y: y2 - timber / 2 }, { x: x2, y: box.y + timber / 2 }, timber * .72), diagonalBeam({ x: box.x, y: box.y + timber / 2 }, { x: x2, y: y2 - timber / 2 }, timber * .72), line(box.x, y2, x2, box.y, 'center'), line(box.x, box.y, x2, y2, 'center')];
  if (state.tool === 'fensterGefach') {
    const post = Math.min(timber, box.width / 8); const rail = Math.min(timber, box.height / 7);
    const opening = rect(box.x + box.width * .32, box.y + box.height * .28, box.width * .36, box.height * .34);
    return [beam(box.x, y2 - rail, box.width, rail), beam(box.x, box.y, box.width, rail), beam(box.x, box.y, post, box.height), beam(x2 - post, box.y, post, box.height), beam(box.x, box.y + box.height * .28 - rail / 2, box.width, rail), beam(box.x, box.y + box.height * .62 - rail / 2, box.width, rail), opening, dimension(opening.x, opening.y + opening.height, opening.x + opening.width, opening.y + opening.height, 18)];
  }
  if (state.tool === 'tuerGefach') {
    const post = Math.min(timber, box.width / 8); const rail = Math.min(timber, box.height / 8);
    const opening = rect(box.x + box.width * .34, box.y + box.height * .24, box.width * .32, box.height * .76);
    return [beam(box.x, y2 - rail, box.width, rail), beam(box.x, box.y, box.width, rail), beam(box.x, box.y, post, box.height), beam(x2 - post, box.y, post, box.height), beam(box.x, box.y + box.height * .24 - rail / 2, box.width, rail), opening, dimension(opening.x, y2, opening.x + opening.width, y2, 20)];
  }
  if (state.tool === 'fachwerkWand') {
    const post = Math.min(timber, box.width / 10); const rail = Math.min(timber, box.height / 9);
    const third = box.width / 3; const br = box.y + box.height * .62; const st = box.y + box.height * .3;
    return [
      beam(box.x, y2 - rail, box.width, rail), beam(box.x, box.y, box.width, rail),
      beam(box.x, box.y, post, box.height), beam(x2 - post, box.y, post, box.height), beam(box.x + third - post / 2, box.y, post, box.height), beam(box.x + third * 2 - post / 2, box.y, post, box.height),
      beam(box.x, br - rail / 2, box.width, rail), beam(box.x + third, st - rail / 2, third, rail),
      diagonalBeam({ x: box.x + post / 2, y: y2 - rail / 2 }, { x: box.x + third - post / 2, y: box.y + rail / 2 }, timber * .8),
      diagonalBeam({ x: box.x + third * 2 + post / 2, y: box.y + rail / 2 }, { x: x2 - post / 2, y: y2 - rail / 2 }, timber * .8),
      diagonalBeam({ x: box.x + third + post / 2, y: y2 - rail / 2 }, { x: box.x + third * 2 - post / 2, y: box.y + rail / 2 }, timber * .65),
      diagonalBeam({ x: box.x + third + post / 2, y: box.y + rail / 2 }, { x: box.x + third * 2 - post / 2, y: y2 - rail / 2 }, timber * .65),
      rect(box.x + third + third * .28, st, third * .44, br - st),
      dimension(box.x, y2, x2, y2, 30)
    ];
  }
  if (state.tool === 'dachstuhl') {
    const eaveY = box.y + box.height * .66; const ridge = { x: midX, y: box.y }; const left = { x: box.x, y: eaveY }; const right = { x: x2, y: eaveY };
    return [beam(box.x, eaveY - timber / 2, box.width, timber), diagonalBeam(left, ridge, timber), diagonalBeam(ridge, right, timber), beam(midX - timber / 2, box.y + box.height * .18, timber, eaveY - box.y - box.height * .18), diagonalBeam({ x: box.x + box.width * .22, y: eaveY - timber / 2 }, { x: midX, y: box.y + box.height * .38 }, timber * .7), diagonalBeam({ x: x2 - box.width * .22, y: eaveY - timber / 2 }, { x: midX, y: box.y + box.height * .38 }, timber * .7), line(midX, box.y, midX, y2, 'center'), dimension(left.x, left.y, right.x, right.y, 28)];
  }
  if (state.tool === 'staenderZapfen') {
    const tenonWidth = timber * .55; const tenonHeight = Math.min(box.height * .14, timber * 1.5);
    return [beam(midX - timber / 2, box.y + tenonHeight, timber, box.height - tenonHeight * 2), beam(midX - tenonWidth / 2, box.y, tenonWidth, tenonHeight), beam(midX - tenonWidth / 2, y2 - tenonHeight, tenonWidth, tenonHeight), line(midX, box.y, midX, y2, 'center'), line(midX - timber / 2, box.y + tenonHeight, midX + timber / 2, box.y + tenonHeight, 'dashed'), line(midX - timber / 2, y2 - tenonHeight, midX + timber / 2, y2 - tenonHeight, 'dashed'), dimension(midX, box.y, midX, y2, 26)];
  }
  if (state.tool === 'strebenUeberblattung') {
    const a1 = { x: box.x, y: y2 - timber / 2 }; const a2 = { x: x2, y: box.y + timber / 2 }; const b1 = { x: box.x, y: box.y + timber / 2 }; const b2 = { x: x2, y: y2 - timber / 2 };
    return [diagonalBeam(a1, a2, timber * .82), diagonalBeam(b1, b2, timber * .82), rect(midX - timber * .9, midY - timber * .55, timber * 1.8, timber * 1.1), line(midX - timber * 1.15, midY, midX + timber * 1.15, midY, 'dashed'), line(midX, midY - timber * 1.15, midX, midY + timber * 1.15, 'dashed')];
  }
  if (state.tool === 'strebenVersatz') {
    const foot = { x: box.x + timber * .8, y: y2 - timber / 2 }; const head = { x: x2, y: box.y + timber / 2 };
    const shoulderY = y2 - timber; const notchRight = foot.x + timber * .75;
    return [
      beam(box.x, y2 - timber, box.width, timber),
      beam(box.x, box.y, timber * .72, box.height),
      diagonalBeam(foot, head, timber),
      polygon([{ x: foot.x - timber * 1.05, y: shoulderY }, { x: notchRight, y: shoulderY }, { x: foot.x + timber * .28, y: y2 }, { x: foot.x - timber * 1.45, y: y2 }]),
      line(foot.x - timber * 1.05, shoulderY, foot.x + timber * .28, y2, 'dashed'),
      line(foot.x, shoulderY - timber * .85, foot.x, y2 + timber * .25, 'center'),
      dimension(foot.x, y2, head.x, head.y, 26)
    ];
  }
  if (state.tool === 'schwalbenschwanzblatt') {
    const neck = timber * .55; const head = timber * 1.45; const pocket = timber * 1.7;
    const beamTop = midY - timber / 2; const beamBottom = midY + timber / 2;
    return [
      beam(box.x, beamTop, box.width, timber),
      polygon([{ x: midX - head / 2, y: beamTop }, { x: midX + head / 2, y: beamTop }, { x: midX + neck / 2, y: beamBottom }, { x: midX - neck / 2, y: beamBottom }]),
      polyline([{ x: midX - pocket / 2, y: beamTop - timber * .35 }, { x: midX + pocket / 2, y: beamTop - timber * .35 }, { x: midX + head / 2, y: beamTop }]),
      polyline([{ x: midX - pocket / 2, y: beamTop - timber * .35 }, { x: midX - head / 2, y: beamTop }]),
      line(midX, beamTop - timber * .55, midX, beamBottom + timber * .45, 'center'),
      line(midX - head / 2, beamTop, midX + head / 2, beamTop, 'dashed')
    ];
  }
  if (state.tool === 'holznaegel') {
    const count = Math.max(2, Math.min(8, Math.round(box.width / Math.max(65, timber * 1.6))));
    const radius = Math.max(5, timber * .2);
    const startX = box.x + timber; const endX = x2 - timber;
    const pins = Array.from({ length: count }, (_, index) => {
      const t = count === 1 ? .5 : index / (count - 1);
      const x = startX + (endX - startX) * t; const y = index % 2 ? midY + timber * .35 : midY - timber * .35;
      return [circle(x, y, radius), line(x - radius * 1.7, y, x + radius * 1.7, y, 'center'), line(x, y - radius * 1.7, x, y + radius * 1.7, 'center')];
    }).flat();
    return [line(startX, midY, endX, midY, 'dashed'), ...pins, dimension(startX, midY, endX, midY, 22)];
  }
  if (state.tool === 'sparren') {
    const foot = { x: box.x, y: y2 - timber / 2 }; const ridgePoint = { x: x2, y: box.y + timber / 2 };
    const seatX = box.x + box.width * .2; const seatY = y2 - timber * .42; const ridgeCut = timber * .95;
    return [
      diagonalBeam(foot, ridgePoint, timber),
      polygon([{ x: seatX - timber * .85, y: y2 }, { x: seatX + timber * .25, y: y2 }, { x: seatX + timber * .55, y: seatY }, { x: seatX - timber * .45, y: seatY }]),
      line(ridgePoint.x - ridgeCut, ridgePoint.y - ridgeCut * .18, ridgePoint.x, ridgePoint.y + ridgeCut * .36, 'dashed'),
      line(foot.x, foot.y, ridgePoint.x, ridgePoint.y, 'center'),
      line(seatX - timber * .65, y2, seatX + timber * .48, seatY, 'dashed'),
      dimension(foot.x, foot.y, ridgePoint.x, ridgePoint.y, 28)
    ];
  }
  if (state.tool === 'pfette') {
    const supportA = box.x + box.width * .24; const supportB = x2 - box.width * .24; const supportW = timber * .85;
    return [
      beam(box.x, box.y + box.height * .24, box.width, timber),
      beam(supportA - supportW / 2, box.y + box.height * .24 + timber, supportW, box.height * .42),
      beam(supportB - supportW / 2, box.y + box.height * .24 + timber, supportW, box.height * .42),
      beam(supportA - timber * 1.4, box.y + box.height * .24 + timber, timber * 2.8, timber * .35),
      beam(supportB - timber * 1.4, box.y + box.height * .24 + timber, timber * 2.8, timber * .35),
      line(box.x, box.y + box.height * .24 + timber / 2, x2, box.y + box.height * .24 + timber / 2, 'center'),
      line(supportA, box.y + box.height * .24 + timber, supportA, y2, 'dashed'),
      line(supportB, box.y + box.height * .24 + timber, supportB, y2, 'dashed'),
      dimension(box.x, box.y + box.height * .24 + timber / 2, x2, box.y + box.height * .24 + timber / 2, 26)
    ];
  }
  if (state.tool === 'kehlbalken') return [beam(box.x, midY - timber / 2, box.width, timber), diagonalBeam({ x: box.x, y: y2 }, { x: midX, y: midY + timber / 2 }, timber * .55), diagonalBeam({ x: x2, y: y2 }, { x: midX, y: midY + timber / 2 }, timber * .55), line(box.x, midY, x2, midY, 'center'), dimension(box.x, midY, x2, midY, 24)];
  if (state.tool === 'first') return [beam(box.x, box.y, box.width, timber), diagonalBeam({ x: box.x + box.width * .16, y: y2 }, { x: midX, y: box.y + timber }, timber * .72), diagonalBeam({ x: x2 - box.width * .16, y: y2 }, { x: midX, y: box.y + timber }, timber * .72), line(midX, box.y - timber * .35, midX, y2, 'center')];
  if (state.tool === 'stuhlstaender') return [beam(midX - timber / 2, box.y, timber, box.height), beam(box.x, box.y, box.width, timber), beam(box.x, y2 - timber, box.width, timber), diagonalBeam({ x: midX - timber / 2, y: box.y + timber }, { x: box.x, y: box.y + box.height * .38 }, timber * .55), diagonalBeam({ x: midX + timber / 2, y: box.y + timber }, { x: x2, y: box.y + box.height * .38 }, timber * .55), line(midX, box.y, midX, y2, 'center'), dimension(midX, box.y, midX, y2, 26)];
  if (state.tool === 'dachKopfband') return [beam(box.x, box.y, timber, box.height), beam(box.x, box.y, box.width, timber), diagonalBeam({ x: box.x + timber / 2, y: box.y + box.height * .72 }, { x: box.x + box.width * .72, y: box.y + timber / 2 }, timber * .72), line(box.x + timber / 2, box.y + box.height * .72, box.x + box.width * .72, box.y + timber / 2, 'center'), dimension(box.x + timber / 2, box.y + box.height * .72, box.x + box.width * .72, box.y + timber / 2, 22)];
  if (state.tool === 'zapfenSchlitz') return [rect(box.x, box.y, box.width, box.height), rect(box.x + box.width * .35, box.y + box.height * .25, box.width * .3, box.height * .5), line(midX, box.y, midX, y2, 'dashed')];
  if (state.tool === 'ueberblattung') return [rect(box.x, box.y, box.width, box.height), line(box.x, midY, x2, midY, 'dashed'), line(box.x + box.width * .25, box.y, box.x + box.width * .25, y2)];
  if (state.tool === 'fingerzinken') return [rect(box.x, box.y, box.width, box.height), ...Array.from({ length: 4 }, (_, index) => line(box.x + box.width * (index + 1) / 5, box.y, box.x + box.width * (index + 1) / 5, y2))];
  if (state.tool === 'schwalbenschwanz') return [rect(box.x, box.y, box.width, box.height), polygon([{ x: midX - box.width * .16, y: box.y }, { x: midX + box.width * .16, y: box.y }, { x: midX + box.width * .28, y: y2 }, { x: midX - box.width * .28, y: y2 }])];
  if (state.tool === 'duebel') {
    const dx = end.x - start.x; const dy = end.y - start.y; const length = Math.hypot(dx, dy) || 1; const nx = -dy / length * Math.min(box.width, box.height) / 6; const ny = dx / length * Math.min(box.width, box.height) / 6;
    const dowelRadius = Math.min(box.width, box.height) * 0.12;
    const centerA = { x: start.x + nx, y: start.y + ny };
    const centerB = { x: end.x - nx, y: end.y - ny };
    return [line(start.x + nx, start.y + ny, end.x + nx, end.y + ny, 'dashed'), line(start.x - nx, start.y - ny, end.x - nx, end.y - ny, 'dashed'), line(start.x, start.y, end.x, end.y, 'center'), circle(centerA.x, centerA.y, dowelRadius), circle(centerB.x, centerB.y, dowelRadius)];
  }
  if (state.tool === 'duebelsatz') {
    const count = Math.max(2, Math.min(5, Math.round(box.width / 120))); const startX = box.x + box.width * .18; const endX = x2 - box.width * .18; const dowelRadius = Math.max(8, Math.min(box.width, box.height) * 0.09); const positions = Array.from({ length: count }, (_, index) => {
      const t = count === 1 ? 0.5 : index / (count - 1);
      const x = startX + (endX - startX) * t;
      return { x, y: midY };
    });
    return [line(startX, midY, endX, midY, 'center'), ...positions.map(point => circle(point.x, point.y, dowelRadius)), dimension(startX, midY, endX, midY, 24), text(midX, box.y - 18, `Ø ${Math.round(dowelRadius * 2)} x ${Math.round(box.width)}`)];
  }
  if (state.tool === 'bohrung') {
    const radius = Math.max(20, distance(start, end)); const axisLength = radius * 1.45;
    return [circle(start.x, start.y, radius), line(start.x - axisLength, start.y, start.x + axisLength, start.y, 'center'), line(start.x, start.y - axisLength, start.x, start.y + axisLength, 'center')];
  }
  if (state.tool === 'zentrierbohrung') {
    const radius = Math.max(8, distance(start, end));
    const axisLength = radius * 4;
    return [circle(start.x, start.y, radius * 1.6), circle(start.x, start.y, radius), line(start.x - axisLength, start.y, start.x + axisLength, start.y, 'center'), line(start.x, start.y - axisLength, start.x, start.y + axisLength, 'center')];
  }
  if (state.tool === 'senkbohrung') {
    const radius = Math.max(16, Math.min(box.width, box.height) * 0.2);
    const axisLength = radius * 2.4;
    const topY = midY - radius;
    return [circle(midX, midY, radius), line(midX - axisLength, midY, midX + axisLength, midY, 'center'), line(midX, midY - axisLength, midX, midY + axisLength, 'center'), line(midX - radius * .7, midY + radius * .9, midX, topY, 'dashed'), line(midX + radius * .7, midY + radius * .9, midX, topY, 'dashed')];
  }
  if (state.tool === 'lochkreis') {
    const ringRadius = Math.max(24, Math.min(box.width, box.height) * 0.35);
    const holes = Math.max(4, Math.min(12, Math.round(ringRadius / 18)));
    const points = Array.from({ length: holes }, (_, index) => {
      const angle = (index / holes) * Math.PI * 2 - Math.PI / 2;
      return polarPoint({ x: midX, y: midY }, ringRadius, angle);
    });
    return [circle(midX, midY, ringRadius), ...points.map(point => circle(point.x, point.y, Math.max(8, ringRadius * 0.12))), line(midX, box.y, midX, y2, 'center')];
  }
  if (state.tool === 'nutFeder') return [rect(box.x, box.y, box.width, box.height), line(box.x, midY, x2, midY, 'center'), rect(box.x + box.width * .38, box.y + box.height * .15, box.width * .24, box.height * .7)];
  if (state.tool === 'eckverbindung') return [line(box.x, midY, x2, midY), line(midX, box.y, midX, y2), line(box.x, box.y, midX, midY, 'dashed')];
  if (state.tool === 'scharnier') return [rect(box.x, box.y, box.width, box.height), circle(midX, box.y, Math.min(box.width, box.height) / 8), circle(midX, y2, Math.min(box.width, box.height) / 8), line(midX, box.y, midX, y2, 'center')];
  if (state.tool === 'schnittlinie') return [line(start.x, start.y, end.x, end.y, 'cutting'), line(start.x, start.y, start.x + (end.x - start.x) * .12, start.y + (end.y - start.y) * .12), line(end.x, end.y, end.x - (end.x - start.x) * .12, end.y - (end.y - start.y) * .12)];
  if (state.tool === 'ornamentsegment') return [polygon([{ x: box.x, y: midY }, { x: box.x + box.width * .2, y: box.y + box.height * .2 }, { x: midX, y: box.y }, { x: box.x + box.width * .8, y: box.y + box.height * .2 }, { x: x2, y: midY }, { x: box.x + box.width * .8, y: y2 - box.height * .2 }, { x: midX, y: y2 }, { x: box.x + box.width * .2, y: y2 - box.height * .2 }]), circle(midX, midY, Math.min(box.width, box.height) * .12)];
  if (state.tool === 'bezierkurve') return [polyline(Array.from({ length: 17 }, (_, index) => { const t = index / 16; return { x: box.x + box.width * t, y: box.y + box.height * (1 - 4 * t * (1 - t)) }; }))];
  if (state.tool === 'rosette') return [circle(midX, midY, Math.min(box.width, box.height) / 2), circle(midX, midY, Math.min(box.width, box.height) / 5), polygon(Array.from({ length: 8 }, (_, index) => polarPoint({ x: midX, y: midY }, Math.min(box.width, box.height) / 2, index * Math.PI / 4)))];
  if (state.tool === 'blatt') {
    const upper = Array.from({ length: 9 }, (_, index) => { const t = index / 8; return { x: box.x + box.width * t, y: midY - Math.sin(Math.PI * t) * box.height / 2 }; });
    const lower = Array.from({ length: 9 }, (_, index) => { const t = 1 - index / 8; return { x: box.x + box.width * t, y: midY + Math.sin(Math.PI * t) * box.height / 2 }; });
    return [polygon([...upper, ...lower]), line(box.x, midY, x2, midY, 'center'), line(midX, midY, box.x + box.width * .72, box.y + box.height * .25)];
  }
  if (state.tool === 'bluete') return [circle(midX, midY, Math.min(box.width, box.height) / 5), ...Array.from({ length: 6 }, (_, index) => { const point = polarPoint({ x: midX, y: midY }, Math.min(box.width, box.height) / 3, index * Math.PI / 3); return circle(point.x, point.y, Math.min(box.width, box.height) / 6); })];
  if (state.tool === 'ranke') {
    const stem = Array.from({ length: 25 }, (_, index) => { const t = index / 24; return { x: box.x + box.width * t, y: midY + Math.sin(t * Math.PI * 2) * box.height * .22 }; });
    return [polyline(stem), polygon([{ x: box.x + box.width * .28, y: midY }, { x: box.x + box.width * .4, y: box.y }, { x: box.x + box.width * .5, y: midY }]), polygon([{ x: box.x + box.width * .58, y: midY }, { x: box.x + box.width * .7, y: y2 }, { x: box.x + box.width * .8, y: midY }])];
  }
  if (state.tool === 'reliefprofil') return [polyline([{ x: box.x, y: y2 }, { x: box.x + box.width * .12, y: y2 }, { x: box.x + box.width * .12, y: box.y + box.height * .65 }, { x: box.x + box.width * .32, y: box.y + box.height * .65 }, { x: box.x + box.width * .42, y: box.y + box.height * .25 }, { x: box.x + box.width * .58, y: box.y + box.height * .25 }, { x: box.x + box.width * .68, y: box.y + box.height * .65 }, { x: box.x + box.width * .88, y: box.y + box.height * .65 }, { x: box.x + box.width * .88, y: y2 }, { x: x2, y: y2 }])];
  if (state.tool === 'symmetrieachse') return [line(midX, box.y, midX, y2, 'center')];
  if (state.tool === 'drehachse') return [line(box.x, midY, x2, midY, 'center')];
  if (state.tool === 'kehle') {
    const groove = Array.from({ length: 17 }, (_, index) => { const t = index / 16; return { x: box.x + box.width * t, y: box.y + Math.sin(Math.PI * t) * box.height }; });
    return [polyline(groove), line(box.x, box.y, box.x, box.y + box.height * .15), line(x2, box.y, x2, box.y + box.height * .15)];
  }
  if (state.tool === 'kegel') return [line(box.x, box.y, x2, midY), line(box.x, y2, x2, midY), line(box.x, box.y, box.x, y2), line(box.x - box.width * .08, midY, x2 + box.width * .08, midY, 'center')];
  if (state.tool === 'kegelstumpf') {
    const topLeftX = box.x + box.width * .26;
    const topRightX = x2 - box.width * .26;
    return [line(topLeftX, box.y, topRightX, box.y), line(box.x, y2, x2, y2), line(topLeftX, box.y, box.x, y2), line(topRightX, box.y, x2, y2), line(midX, box.y, midX, y2, 'center')];
  }
  if (state.tool === 'schalenprofil') {
    const outer = Array.from({ length: 17 }, (_, index) => { const t = index / 16; return { x: box.x + box.width * t, y: box.y + Math.sin(Math.PI * t) * box.height }; });
    const inner = Array.from({ length: 17 }, (_, index) => { const t = index / 16; return { x: box.x + box.width * (.12 + .76 * t), y: box.y + box.height * .18 + Math.sin(Math.PI * t) * box.height * .58 }; });
    return [polyline(outer), polyline(inner), line(box.x, box.y, box.x + box.width * .12, box.y + box.height * .18), line(x2, box.y, x2 - box.width * .12, box.y + box.height * .18), line(midX, box.y - box.height * .08, midX, y2 + box.height * .08, 'center')];
  }
  if (state.tool === 'absatz') return [polyline([{ x: box.x, y: box.y }, { x: box.x + box.width * .55, y: box.y }, { x: box.x + box.width * .55, y: box.y + box.height * .28 }, { x: x2, y: box.y + box.height * .28 }]), polyline([{ x: box.x, y: y2 }, { x: box.x + box.width * .55, y: y2 }, { x: box.x + box.width * .55, y: y2 - box.height * .28 }, { x: x2, y: y2 - box.height * .28 }]), line(box.x, midY, x2, midY, 'center')];
  if (state.tool === 'zapfen') return [rect(box.x, box.y, box.width * .6, box.height), rect(box.x + box.width * .6, box.y + box.height * .28, box.width * .4, box.height * .44), line(box.x, midY, x2, midY, 'center')];
  if (state.tool === 'wandstaerke') return [polyline([{ x: box.x, y: box.y }, { x: box.x, y: y2 }, { x: x2, y: y2 }, { x: x2, y: box.y }]), polyline([{ x: box.x + box.width * .16, y: box.y }, { x: box.x + box.width * .16, y: y2 - box.height * .16 }, { x: x2 - box.width * .16, y: y2 - box.height * .16 }, { x: x2 - box.width * .16, y: box.y }]), dimension(box.x, midY, box.x + box.width * .16, midY, -18)];
  if (state.tool === 'bohrtiefe') return [line(box.x + box.width * .35, box.y, box.x + box.width * .35, y2 - box.height * .18, 'dashed'), line(box.x + box.width * .65, box.y, box.x + box.width * .65, y2 - box.height * .18, 'dashed'), line(box.x + box.width * .35, y2 - box.height * .18, midX, y2, 'dashed'), line(box.x + box.width * .65, y2 - box.height * .18, midX, y2, 'dashed'), line(midX, box.y - box.height * .08, midX, y2 + box.height * .08, 'center'), dimension(midX, box.y, midX, y2, 28)];
  return [];
}

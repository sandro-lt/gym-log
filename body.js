/* Stylised body figure (own drawing) used for muscle thumbnails and the muscle map.
 * Coordinates: viewBox 0 0 60 120, figure centred on x = 30.
 * Shapes are drawn for the figure's left half and mirrored, unless marked as centre ('c').
 */
const BODY = (() => {
  const MIRROR = 'matrix(-1 0 0 1 60 0)';

  const BASE = [
    ['c', '<ellipse cx="30" cy="9" rx="5.5" ry="6.5"/>'],
    ['c', '<rect x="26.5" y="13.5" width="7" height="7" rx="2"/>'],
    ['c', '<path d="M17 22 Q30 18.5 43 22 L41 49 Q30 52 19 49 Z"/>'],
    ['c', '<path d="M19 47.5 Q30 50.5 41 47.5 L42.6 58 L17.4 58 Z"/>'],
    ['l', '<circle cx="15.6" cy="26" r="5"/>'],
    ['l', '<path d="M10.9 27.5 L17.6 27.5 L17.1 45 L11.4 45 Z"/>'],
    ['l', '<path d="M11.2 44 L16.9 44 L15.1 59 L11 59 Z"/>'],
    ['l', '<ellipse cx="12.9" cy="62" rx="2.3" ry="3.1"/>'],
    ['l', '<path d="M17.4 56 L29.6 56 L28.4 86 L20 86 Q16.9 70 17.4 56 Z"/>'],
    ['l', '<path d="M20 85 L28.4 85 L27.2 112.5 L21.6 112.5 Q18.9 98 20 85 Z"/>'],
    ['l', '<path d="M21.4 112 L27.4 112 L28.2 117 L19.8 117 Z"/>'],
  ];

  // muscle id -> { view, shapes, crop }
  const UPPER = '5 3 50 50', ARMS = '3 15 54 54', CORE = '9 20 42 42', HIPS = '7 38 46 46', LEGS = '6 50 48 48', CALVES = '8 78 44 44';
  const MUSCLES = {
    traps:       { view: 'back',  crop: UPPER, shapes: [['c', '<path d="M30 15.5 L39.5 22.4 L33.4 25 L30 35.5 L26.6 25 L20.5 22.4 Z"/>']] },
    front_delts: { view: 'front', crop: UPPER, shapes: [['l', '<ellipse cx="17.6" cy="26.6" rx="2.6" ry="4.4"/>']] },
    side_delts:  { view: 'front', crop: UPPER, shapes: [['l', '<ellipse cx="13.2" cy="26.4" rx="2.4" ry="4.4"/>']] },
    rear_delts:  { view: 'back',  crop: UPPER, shapes: [['l', '<ellipse cx="15.4" cy="26.3" rx="3.8" ry="4"/>']] },
    chest:       { view: 'front', crop: UPPER, shapes: [['l', '<path d="M19.3 24 Q24.6 22.2 29.5 23.8 L29.5 32.4 Q24 34.6 19.9 31.2 Z"/>']] },
    upper_back:  { view: 'back',  crop: UPPER, shapes: [['l', '<path d="M20.2 25.4 L26.4 25.2 L28.3 32.8 L21.6 31.6 Z"/>']] },
    lats:        { view: 'back',  crop: UPPER, shapes: [['l', '<path d="M19.6 32.2 L26.7 33.6 L26.7 45.2 L22.1 43.4 Q19.4 37.4 19.6 32.2 Z"/>']] },
    lower_back:  { view: 'back',  crop: CORE,  shapes: [['l', '<rect x="27.1" y="37" width="2.6" height="12" rx="1.3"/>']] },
    abs:         { view: 'front', crop: CORE,  shapes: [['c', '<rect x="25.3" y="34.4" width="9.4" height="14.2" rx="2.6"/>']] },
    biceps:      { view: 'front', crop: ARMS,  shapes: [['l', '<ellipse cx="14.5" cy="36.6" rx="2.7" ry="5.6"/>']] },
    triceps:     { view: 'back',  crop: ARMS,  shapes: [['l', '<ellipse cx="14.2" cy="36.6" rx="2.7" ry="5.9"/>']] },
    forearms:    { view: 'front', crop: ARMS,  shapes: [['l', '<ellipse cx="13.7" cy="50.8" rx="2.3" ry="6"/>']] },
    glutes:      { view: 'back',  crop: HIPS,  shapes: [['l', '<ellipse cx="24.6" cy="55.4" rx="5" ry="5.1"/>']] },
    quads:       { view: 'front', crop: LEGS,  shapes: [['l', '<ellipse cx="23.4" cy="70.5" rx="4" ry="12.6"/>']] },
    hams:        { view: 'back',  crop: LEGS,  shapes: [['l', '<ellipse cx="23.6" cy="73" rx="3.9" ry="10.6"/>']] },
    adductors:   { view: 'front', crop: LEGS,  shapes: [['l', '<path d="M29.3 57.2 L26.9 59 L27.9 72.5 Q29.1 66 29.3 57.2 Z"/>']] },
    abductors:   { view: 'front', crop: LEGS,  shapes: [['l', '<path d="M17.6 56.6 L20.1 58 L19.7 66.6 Q17.8 62 17.6 56.6 Z"/>']] },
    calves:      { view: 'back',  crop: CALVES, shapes: [['l', '<ellipse cx="23.4" cy="94.5" rx="3.3" ry="7.2"/>']] },
  };

  const draw = ([side, svg], cls) => {
    const shape = cls ? svg.replace('/>', ` class="${cls}"/>`) : svg;
    return side === 'c' ? shape : shape + `<g transform="${MIRROR}">${shape}</g>`;
  };

  /** states: { muscleId: 'hl' | 'primary' | 'secondary' } */
  function svg(view, states = {}, viewBox = '0 0 60 120', cls = '') {
    const muscles = Object.entries(MUSCLES)
      .filter(([, m]) => m.view === view)
      .map(([id, m]) => m.shapes.map((s) => draw(s, 'mu ' + (states[id] || ''))).join(''))
      .join('');
    return `<svg class="fig ${cls}" viewBox="${viewBox}" aria-hidden="true">
      <g class="base">${BASE.map((s) => draw(s)).join('')}</g>${muscles}</svg>`;
  }

  return {
    /** Small cropped figure with one muscle highlighted (for picker tiles). */
    thumb: (id) => svg(MUSCLES[id].view, { [id]: 'hl' }, MUSCLES[id].crop, 'thumb-fig'),
    /** Front + back full figures showing primary and secondary muscles. */
    map(primary, secondary = []) {
      const st = Object.fromEntries(secondary.map((m) => [m, 'secondary']));
      if (primary) st[primary] = 'primary';
      return svg('front', st, '4 0 52 120', 'map-fig') + svg('back', st, '4 0 52 120', 'map-fig');
    },
  };
})();

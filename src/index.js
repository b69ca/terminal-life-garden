const rules = { life: { birth: [3], survive: [2, 3] }, highlife: { birth: [3, 6], survive: [2, 3] } };
export function createGarden({ width = 60, height = 24, seed = 42, pattern = 'random', rule = 'life', edges = 'wrap' } = {}) {
  if (![width, height].every(n => Number.isInteger(n) && n >= 5 && n <= 120)) throw new Error('dimensions must be integers from 5 to 120');
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('seed must be an unsigned 32-bit integer');
  if (!Object.hasOwn(rules, rule) || !['wrap', 'fixed'].includes(edges) || !['random', 'glider', 'blinker'].includes(pattern)) throw new Error('invalid rule, edges, or pattern');
  const cells = new Uint16Array(width * height); let state = seed;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  if (pattern === 'random') for (let i = 0; i < cells.length; i++) cells[i] = random() < 0.3 ? 1 : 0;
  else {
    const points = pattern === 'glider' ? [[1, 0], [2, 1], [0, 2], [1, 2], [2, 2]] : [[0, 1], [1, 1], [2, 1]];
    const x = Math.floor(width / 2) - 1, y = Math.floor(height / 2) - 1;
    for (const [dx, dy] of points) cells[(y + dy) * width + x + dx] = 1;
  }
  return { width, height, seed, pattern, rule, edges, generation: 0, births: 0, deaths: 0, cells };
}
export function step(garden, count = 1) {
  if (!Number.isInteger(count) || count < 0 || count > 10000) throw new Error('generation count must be an integer from 0 to 10000');
  const { width, height } = garden;
  for (let n = 0; n < count; n++) {
    const next = new Uint16Array(width * height); let births = 0, deaths = 0;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      let neighbors = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue; let nx = x + dx, ny = y + dy;
        if (garden.edges === 'wrap') { nx = (nx + width) % width; ny = (ny + height) % height; }
        if (nx >= 0 && ny >= 0 && nx < width && ny < height && garden.cells[ny * width + nx]) neighbors++;
      }
      const id = y * width + x, alive = garden.cells[id] > 0;
      const lives = (alive ? rules[garden.rule].survive : rules[garden.rule].birth).includes(neighbors);
      if (lives) { next[id] = alive ? Math.min(65535, garden.cells[id] + 1) : 1; if (!alive) births++; }
      else if (alive) deaths++;
    }
    garden.cells = next; garden.births = births; garden.deaths = deaths; garden.generation++;
  }
  return garden;
}
export function analyze(garden) {
  const population = garden.cells.reduce((n, age) => n + Number(age > 0), 0), oldest = garden.cells.reduce((n, age) => Math.max(n, age), 0);
  return { width: garden.width, height: garden.height, seed: garden.seed, pattern: garden.pattern, rule: garden.rule, edges: garden.edges, generation: garden.generation, population, density: population / garden.cells.length, oldest, births: garden.births, deaths: garden.deaths };
}
export function render(garden, { color = false } = {}) {
  return Array.from({ length: garden.height }, (_, y) => Array.from({ length: garden.width }, (_, x) => {
    const age = garden.cells[y * garden.width + x];
    return age ? color ? `\x1b[${age === 1 ? 33 : age < 8 ? 36 : 34}m${age === 1 ? '+' : 'o'}\x1b[0m` : age === 1 ? '+' : 'o' : ' ';
  }).join('')).join('\n');
}
export function renderSVG(garden) {
  const cell = 10, w = Math.max(640, garden.width * cell + 64), h = garden.height * cell + 132, report = analyze(garden);
  const cells = [...garden.cells].map((age, id) => age ? `<rect x="${32 + id % garden.width * cell}" y="${88 + Math.floor(id / garden.width) * cell}" width="8" height="8" rx="2" fill="${age === 1 ? '#ffd166' : age < 8 ? '#5de4c7' : '#70a5ff'}"/>` : '').join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="${Math.round(h * 800 / w)}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" rx="18" fill="#0d1525"/><g font-family="monospace"><text x="32" y="36" font-size="22" fill="#e8edf8">TERMINAL LIFE GARDEN</text><text x="32" y="62" font-size="12" fill="#93a4bc">${garden.rule} / ${garden.edges} / seed ${garden.seed} / generation ${garden.generation}</text>${cells}<text x="32" y="${h - 16}" font-size="12" fill="#93a4bc">${report.population} alive / ${report.births} births / ${report.deaths} deaths / ages in color</text></g></svg>\n`;
}

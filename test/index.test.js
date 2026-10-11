import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createGarden, step, analyze, render, renderSVG } from '../src/index.js';
const live = g => [...g.cells].map(n => Number(n > 0));
const cli = args => spawnSync(process.execPath, ['src/cli.js', ...args], { encoding: 'utf8' });
test('random seeds reproduce boards without changing global randomness', () => {
  assert.deepEqual(createGarden(), createGarden()); assert.notDeepEqual(createGarden({ seed: 1 }).cells, createGarden({ seed: 2 }).cells);
  assert.ok(analyze(createGarden()).population > 0);
});
test('blinker oscillates with period two while survivor ages advance', () => {
  const g = createGarden({ width: 9, height: 9, pattern: 'blinker' }), before = live(g); step(g);
  assert.notDeepEqual(live(g), before); assert.equal(analyze(g).population, 3); step(g); assert.deepEqual(live(g), before);
  assert.equal(g.cells[4 * 9 + 4], 3);
});
test('glider translates one cell diagonally after four generations', () => {
  const g = createGarden({ width: 15, height: 15, pattern: 'glider', edges: 'fixed' }), expected = new Set();
  g.cells.forEach((age, id) => { if (age) expected.add(id + g.width + 1); }); step(g, 4);
  const actual = new Set(); g.cells.forEach((age, id) => { if (age) actual.add(id); }); assert.deepEqual(actual, expected);
});
test('HighLife births with six neighbors, while Life does not; edges affect evolution', () => {
  const a = createGarden({ width: 5, height: 5, rule: 'life' }), b = createGarden({ width: 5, height: 5, rule: 'highlife' });
  for (const g of [a, b]) { g.cells.fill(0); for (const id of [6, 7, 8, 11, 13, 16]) g.cells[id] = 1; }
  step(a); step(b); assert.equal(a.cells[12], 0); assert.equal(b.cells[12], 1);
  const wrap = createGarden({ width: 5, height: 5 }), fixed = createGarden({ width: 5, height: 5, edges: 'fixed' });
  for (const g of [wrap, fixed]) { g.cells.fill(0); for (const id of [4, 0, 1]) g.cells[id] = 1; }
  step(wrap); step(fixed); assert.notDeepEqual(live(wrap), live(fixed));
});
test('population change equals births minus deaths; stepping is synchronous and bounded', () => {
  const a = createGarden(), b = createGarden(); const before = analyze(a).population; step(a);
  const after = analyze(a); assert.equal(after.population - before, after.births - after.deaths);
  step(a, 19); for (let i = 0; i < 20; i++) step(b); assert.deepEqual(a, b);
  const snapshot = structuredClone(a); step(a, 0); assert.deepEqual(a, snapshot);
  const block = createGarden({ width: 5, height: 5 }); block.cells.fill(0); for (const id of [6, 7, 11, 12]) block.cells[id] = 65535; step(block); assert.equal(block.cells[6], 65535);
});
test('validates arguments, renders exact dimensions, and exports SVG', () => {
  for (const options of [{ width: 4 }, { seed: -1 }, { rule: 'toString' }, { edges: 'bad' }, { pattern: 'bad' }]) assert.throws(() => createGarden(options));
  assert.throws(() => step(createGarden(), 1.5)); const g = createGarden({ width: 10, height: 5 });
  assert.ok(render(g).split('\n').every(row => row.length === 10)); assert.equal(render(g).split('\n').length, 5);
  assert.match(renderSVG(g), /^<svg/); assert.equal(render(g).includes('\x1b'), false);
});
test('CLI exits cleanly without a TTY and validates modes and filesystem writes', () => {
  const r = cli(['--pattern', 'glider', '--generations', '4', '--json']); assert.equal(r.status, 0); assert.equal(JSON.parse(r.stdout).population, 5);
  const plain = cli([]); assert.equal(plain.status, 0); assert.equal(plain.stdout.includes('\x1b'), false);
  for (const args of [['--seed'], ['--rule', 'bad'], ['--generations', '-1'], ['--frames', '1', '--json'], ['--wat']]) assert.equal(cli(args).status, 2);
  const dir = mkdtempSync(join(tmpdir(), 'garden-')); try { const file = join(dir, 'life.svg'); assert.equal(cli(['--svg', file]).status, 0); assert.match(readFileSync(file, 'utf8'), /LIFE GARDEN/); assert.equal(cli(['--svg', join(dir, 'missing', 'x.svg')]).status, 2); } finally { rmSync(dir, { recursive: true, force: true }); }
});

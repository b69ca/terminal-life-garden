#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import { createGarden, step, analyze, render, renderSVG } from './index.js';
import { parse, integer, terminal } from './terminal.js';
const args = process.argv.slice(2);
if (args.includes('--help')) { console.log('Usage: terminal-life-garden [--seed N] [--pattern random|glider|blinker] [--rule life|highlife] [--edges wrap|fixed] [--width N] [--height N] [--generations N] [--frames N] [--json] [--svg FILE] [--no-color]\nControls: p pause, . single step, n new seed, r reset, 1/2 rules, +/- speed, q quit'); process.exit(0); }
try {
  const options = parse(args, ['--seed', '--pattern', '--rule', '--edges', '--width', '--height', '--generations', '--frames', '--svg']);
  const live = !!(process.stdout.isTTY && process.stdin.isTTY && !options['--json'] && !options['--svg']);
  const width = integer(options, '--width', live ? Math.max(5, Math.min(80, (process.stdout.columns || 80) - 1)) : 60, 120);
  const height = integer(options, '--height', live ? Math.max(5, Math.min(32, (process.stdout.rows || 28) - 4)) : 24, 120);
  let seed = integer(options, '--seed', 42, 0xffffffff), rule = options['--rule'] || 'life', paused = false, delay = 100;
  const pattern = options['--pattern'] || 'random', edges = options['--edges'] || 'wrap';
  const make = () => createGarden({ width, height, seed, rule, pattern, edges }); let garden = make();
  step(garden, integer(options, '--generations', 0, 10000));
  const frames = integer(options, '--frames', live ? Infinity : 1, 100000);
  if (options['--json'] || options['--svg']) {
    if (options['--frames'] !== undefined) throw new Error('--frames is only for terminal output');
    if (options['--svg']) await writeFile(options['--svg'], renderSVG(garden));
    if (options['--json']) console.log(JSON.stringify(analyze(garden), null, 2));
  } else await terminal({ live, frames, interval: () => delay,
    onKey: key => {
      if (key === 'p' || key === ' ') paused = !paused;
      else if (key === '.') { paused = true; step(garden); }
      else if (key === 'n') { seed = (seed + 1) >>> 0; garden = make(); }
      else if (key === 'r') garden = make();
      else if (key === '1' || key === '2') { rule = key === '1' ? 'life' : 'highlife'; garden.rule = rule; }
      else if (key === '+' || key === '=') delay = Math.max(10, Math.floor(delay / 2));
      else if (key === '-') delay = Math.min(1000, delay * 2);
    },
    onTick: () => { if (paused) return false; step(garden); return true; },
    draw: () => { const r = analyze(garden); return `LIFE GARDEN | ${rule} ${edges} | seed ${seed} | gen ${r.generation}${paused ? ' PAUSED' : ''}\n${render(garden, { color: live && !options['--no-color'] && !process.env.NO_COLOR })}\n${r.population} alive | p pause . step n seed r reset 1/2 rules +/- speed q quit`; }
  });
} catch (error) { console.error(`terminal-life-garden: ${error.message}`); process.exitCode = 2; }

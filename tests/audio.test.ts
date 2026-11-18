import { expect, test } from 'bun:test';
import { createSoundObserver } from '../src/audio-events';
import { build, createConvoyState, createState, pulse, repair, step } from '../src/simulation';

test('audio observes real orders once and resets across voyages', function () {
	const read = createSoundObserver(); const state = createState();
	expect(read(state)).toEqual([]);
	state.status = 'running';
	expect(read(state)).toEqual(['depart']);
	expect(read(state)).toEqual([]);
	pulse(state); expect(read(state)).toEqual(['pulse']);
	pulse(state); expect(read(state)).toEqual([]);
	state.hull -= 100; expect(read(state)).toEqual(['damage']);
	repair(state); expect(read(state)).toEqual([]); // Assignment does not replay an instant-repair cue.
	state.status = 'lost'; expect(read(state)).toEqual(['lost']);
	expect(read(createState())).toEqual([]);
});

test('completion sounds distinguish earlier convoy losses, intact arrival and destruction', function () {
	const convoy = createConvoyState();
	if (!convoy.convoy) throw new Error('Expected convoy');
	const cleanReport = { name: 'Final passage', survived: true, hullBefore: 100, hullAfter: 100, kills: 0, salvageEarned: 0, disabledPlatforms: [], escortsLost: 0, weaponsLost: 0, recoveryHull: 0, recoverySalvage: 0 };
	convoy.convoy.reports = [{ ...cleanReport, name: 'Earlier passage', disabledPlatforms: [0] }, cleanReport];
	const cases = [
		[convoy, 'won', 'arrivalWithLosses'],
		[convoy, 'lost', 'lost'],
		[createConvoyState(), 'won', 'won'],
		[createState(), 'won', 'won'],
	] as const;
	for (const [state, status, sound] of cases) {
		const read = createSoundObserver();
		state.status = 'running'; read(state);
		state.status = status;
		expect(read(state)).toEqual([sound]);
		expect(read(state)).toEqual([]);
	}
});

test('combat sounds are deduplicated and paused simulation produces no new cues', function () {
	const read = createSoundObserver(); const state = createState();
	build(state, 0, 'flak'); build(state, 1, 'flak');
	state.status = 'running'; read(state);
	state.enemies.push({ id: state.nextId++, kind: 'armored', x: -80, y: -140, hp: 260, maxHp: 260, cooldown: 10 });
	for (const mount of state.mounts) mount.aim = Math.atan2(-140 - mount.y, -80 - mount.x);
	step(state, 1 / 60);
	expect(read(state)).toEqual(['flak', 'contact']); expect(read(state)).toEqual([]);
	state.paused = true;
	for (let i = 0; i < 120; i++) { step(state, 1 / 60); expect(read(state)).toEqual([]); }
	state.paused = false;
	const enemy = state.enemies[0]; if (enemy) enemy.hp = 0;
	step(state, 1 / 60); expect(read(state)).toContain('explosion'); expect(read(state)).toEqual([]);
});

test('point-blank railgun fire is audible even when its projectile hits in the same step', function () {
	const read = createSoundObserver(); const state = createState();
	build(state, 0, 'rail'); state.status = 'running'; state.nextWave = Infinity;
	state.systems.allocation = { engines: 0, weapons: 4, shields: 6 };
	state.enemies.push({ id: state.nextId++, kind: 'armored', x: -96, y: -53, z: -100.8, hp: 260, maxHp: 260, cooldown: 10 });
	read(state); step(state, 1 / 60);
	expect(state.shots).toHaveLength(0);
	expect(read(state)).toEqual(['rail', 'impact']);
	expect(read(state)).toEqual([]);
});

test('hidden approaches stay silent until their first real detection, then cue once', function () {
	const state = createState(); state.status = 'running'; state.nextWave = Infinity;
	const enemy = { id: state.nextId++, kind: 'carrier' as const, x: 0, y: -8800, hp: 600, maxHp: 600, cooldown: 999 };
	state.enemies = [enemy];
	const read = createSoundObserver(); read(state); step(state, 1 / 60);
	expect(read(state)).not.toContain('contact');
	enemy.x = state.ark.x; enemy.y = state.ark.y - 1500;
	expect(read(state)).toContain('contact'); expect(read(state)).not.toContain('contact');
	state.systems.sensors.integrity = 0; read(state);
	enemy.y = state.ark.y - 1000;
	expect(read(state)).not.toContain('contact');
	state.systems.sensors.integrity = 100;
	expect(read(state)).toContain('contact'); expect(read(state)).not.toContain('contact');
});

import { expect, test } from 'bun:test';
import { advanceCruise, canCruise, STEP_SECONDS } from '../src/passage-cruise';
import { assignRepair, build, createConvoyState, deploy, launchPassage, PASSAGE_SECONDS, passagesFor, pulse, step } from '../src/simulation';

const quietPassage = function (final = false) {
	const state = createConvoyState();
	if (final) state.wave = passagesFor(state).length - 1;
	expect(build(state, 0, 'rail')).toBe(true);
	expect(deploy(state, 'guardian')).toBe(true);
	expect(launchPassage(state)).toBe(true);
	state.enemies = [];
	state.arrivals = [];
	return state;
};

test('cruise holds for unseen threats, pending arrivals and fire from either side', function () {
	const state = quietPassage();
	const blocked = function () {
		const snapshot = structuredClone(state);
		expect(canCruise(state)).toBe(false);
		advanceCruise(state, 10);
		expect(state).toEqual(snapshot);
	};
	state.enemies.push({ id: 100, kind: 'bomber', x: 1e6, y: 0, hp: 95, maxHp: 95, cooldown: 0 });
	blocked();
	state.enemies = [];
	state.arrivals.push({ at: state.time + 3, kind: 'raider', x: 800, y: 0 });
	blocked();
	state.arrivals = [];
	for (const side of ['player', 'enemy'] as const) {
		state.shots.push({ id: 101, x: 0, y: 0, vx: 1, vy: 0, damage: 1, side, weapon: side === 'player' ? 'rail' : 'hostile', life: 1, target: undefined });
		blocked();
		state.shots = [];
	}
	state.paused = true;
	blocked();
	state.paused = false; state.focused = false;
	blocked();
	state.focused = true;
	expect(canCruise(state)).toBe(true);
});

test('cruise batches the same repairs, recharge and exit accounting as regular travel', function () {
	for (const final of [false, true]) {
		const state = quietPassage(final);
		if (!state.convoy) throw new Error('Missing convoy');
		state.convoy.elapsed = PASSAGE_SECONDS - 5;
		state.hull -= 150;
		state.systems.shield.charge = 0;
		state.systems.shield.rechargeDelay = 1;
		expect(assignRepair(state, 'hull', 2)).toBe(true);
		expect(pulse(state)).toBe(true);
		const expected = structuredClone(state);
		for (let tick = 0; tick < 300; tick++) step(expected, STEP_SECONDS);
		for (let frame = 0; frame < 300 && canCruise(state); frame++) advanceCruise(state, 1);
		expect(state.status).toBe(final ? 'won' : 'fitting');
		expect(state).toEqual(expected);
		expect(canCruise(state)).toBe(false);
	}
});

import { expect, test } from 'bun:test';
import { build, createConvoyState, deploy, FORMATION_SLOTS, launchPassage, PASSAGE_SECONDS, PLATFORM_HP, step, type State } from '../src/simulation';
import { DECK_ALTITUDE, worldPoint } from '../src/space';
import { describeCrossingLosses, operationOutcome, systemsResultMessage } from '../src/trial-summary';

const finishPassage = function (state: State, disableFirstShip = false) {
	if (!state.convoy) throw new Error('Expected convoy');
	expect(launchPassage(state)).toBe(true);
	state.enemies = [];
	if (disableFirstShip) {
		const ship = state.convoy.platforms[0];
		if (!ship) throw new Error('Missing ship');
		const point = worldPoint(state, { ...FORMATION_SLOTS[ship.slot], z: DECK_ALTITUDE });
		state.shots.push({ ...point, id: 999, vx: 0, vy: 0, damage: PLATFORM_HP, side: 'enemy', weapon: 'hostile', target: undefined, life: 2 });
	}
	state.convoy.elapsed = PASSAGE_SECONDS - 1 / 60;
	step(state, 1 / 60);
};

test('a restored frigate disabled twice counts as one ship and two disablements even after a clean final passage', function () {
	const state = createConvoyState();
	build(state, 0, 'flak');
	build(state, 8, 'flak');
	finishPassage(state, true);
	expect(state.status).toBe('fitting');
	expect(state.convoy?.platforms[0]?.hp).toBe(PLATFORM_HP);
	expect(state.mounts[8]?.weapon).toBeUndefined();
	expect(state.convoy?.reports?.[0]).toMatchObject({ disabledPlatforms: [0], weaponsLost: 1 });
	finishPassage(state, true);
	finishPassage(state);
	expect(state.status).toBe('won');
	expect(state.resultReason).toBe('arrival');
	expect(state.convoy?.reports?.at(-1)?.disabledPlatforms).toEqual([]);
	expect(operationOutcome(state)).toBe('arrivalWithLosses');
	expect(describeCrossingLosses(state.convoy?.reports ?? [])).toBe('1 convoy ship disabled (2 disablements)');
	expect(systemsResultMessage(state)).toContain('1 convoy ship disabled (2 disablements)');
});

test('intact arrival and ark destruction remain distinct even at the passage exit', function () {
	const intact = createConvoyState();
	build(intact, 0, 'flak');
	for (let passage = 0; passage < 3; passage++) finishPassage(intact);
	expect(operationOutcome(intact)).toBe('intact');

	const destroyed = createConvoyState();
	build(destroyed, 0, 'flak');
	finishPassage(destroyed, true);
	finishPassage(destroyed);
	destroyed.hull = 0;
	finishPassage(destroyed);
	expect(destroyed.status).toBe('lost');
	expect(destroyed.resultReason).toBe('hull');
	expect(operationOutcome(destroyed)).toBe('arkDestroyed');
	expect(systemsResultMessage(destroyed)).toContain('Ark destroyed before reaching');
	expect(destroyed.convoy?.reports?.at(-1)?.survived).toBe(false);
});

test('losing a Guardian counts against its passage and the crossing after later clean passages', function () {
	const state = createConvoyState();
	build(state, 0, 'flak');
	expect(deploy(state, 'guardian')).toBe(true);
	const guard = state.escorts.at(0);
	if (!guard) throw new Error('Expected guardian');
	guard.hp = 0;
	for (let i = 0; i < 3; i++) finishPassage(state);
	expect(state.convoy?.reports?.map(function (report) { return report.escortsLost; })).toEqual([1, 0, 0]);
	expect(operationOutcome(state)).toBe('arrivalWithLosses');
	expect(systemsResultMessage(state)).toContain('1 escort craft lost');
});

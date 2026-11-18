import { expect, test } from 'bun:test';
import { applyDoctrine, DOCTRINE_IDS } from '../src/doctrines';
import { OPERATION_IDS } from '../src/operations';
import { arrangePlatform, build, createConvoyState, createState, launchPassage, operationFor, passagesFor, PASSAGES, PASSAGE_SECONDS, ROUTE_LENGTH, sell, step, type State } from '../src/simulation';
import { journeyFor } from '../src/journey';
import { systemsSummary } from '../src/trial-summary';

for (const id of OPERATION_IDS) {
	test(`${id} keeps passage speed, refits and reports through its own final arrival`, function () {
		const state = createConvoyState(id);
		const passages = passagesFor(state);
		expect(operationFor(state).name).toBeTruthy();
		expect(state.systems.routeLength).toBeCloseTo(ROUTE_LENGTH / PASSAGES.length * passages.length);
		expect(journeyFor(state).eta).toBeCloseTo(passages.length * PASSAGE_SECONDS);
		expect(systemsSummary(state).totalContacts).toBe(passages.length);
		build(state, 0, 'rail');
		for (const [index, passage] of passages.entries()) {
			expect(launchPassage(state)).toBe(true);
			expect(state.enemies.map(function (enemy) { return enemy.kind; })).toEqual(passage.threats.map(function (threat) { return threat.kind; }));
			expect(journeyFor(state).speed).toBeCloseTo(ROUTE_LENGTH / (PASSAGES.length * PASSAGE_SECONDS));
			// Isolate route timing and refit transitions from combat balance.
			state.enemies = [];
			for (let tick = 0; tick < PASSAGE_SECONDS * 20; tick++) step(state, 0.05);
			expect(state.status).toBe(index === passages.length - 1 ? 'won' : 'fitting');
			expect(state.convoy?.reports).toHaveLength(index + 1);
			expect(state.convoy?.reports?.[index]?.name).toBe(passage.name);
			expect(state.convoy?.reports?.[index]?.recoverySalvage).toBe(index === passages.length - 1 ? 0 : 200);
		}
		expect(state.systems.distanceTraveled).toBe(state.systems.routeLength);
		expect(state.time).toBeCloseTo(passages.length * PASSAGE_SECONDS);
		expect(journeyFor(state).eta).toBe(0);
		expect(launchPassage(state)).toBe(false);
	});
}

test('default convoy retains Kepler while legacy scenarios keep their original route', function () {
	const state = createConvoyState();
	expect(passagesFor(state)).toBe(PASSAGES);
	expect(state.systems.routeLength).toBe(ROUTE_LENGTH);
	const legacy = createState();
	expect(legacy.convoy).toBeUndefined();
	expect(legacy.systems.routeLength).toBe(ROUTE_LENGTH);
});

const flyKeplerPassage = function (state: State) {
	const start = state.time;
	let lastKillTime = 0;
	expect(launchPassage(state)).toBe(true);
	for (let tick = 0; tick < PASSAGE_SECONDS * 60 && state.status === 'running'; tick++) {
		const before = state.kills;
		step(state, 1 / 60);
		if (state.kills > before) lastKillTime = state.time - start;
	}
	const report = state.convoy?.reports?.at(-1);
	if (!report) throw new Error('Expected a Kepler passage report');
	return { report, lastKillTime };
};

test('Port battery gives fitted starter frigates a forgiving demonstration that affects the outcome', function () {
	for (const doctrine of DOCTRINE_IDS) {
		const state = createConvoyState();
		expect(applyDoctrine(state, doctrine)).toBe(true);
		const bare = structuredClone(state);
		const { report } = flyKeplerPassage(state);
		const guns = report.weaponActivity?.filter(function (gun) { return gun.platform !== undefined; }) ?? [];
		expect(guns.length).toBeGreaterThan(0);
		expect(guns.every(function (gun) { return gun.shots > 0 || gun.beamSeconds > 0; })).toBe(true);
		expect(report.disabledPlatforms).toEqual([]);
		expect(report.hullAfter).toBe(report.hullBefore);
		if (doctrine !== 'spearhead') continue;
		for (const gun of guns) expect(sell(bare, gun.mount)).toBe(true);
		const withoutFrigateWeapons = flyKeplerPassage(bare).report;
		expect(withoutFrigateWeapons.kills).toBeLessThan(report.kills);
		expect(withoutFrigateWeapons.disabledPlatforms.length).toBeGreaterThan(0);
	}
});

test('Crossfire rewards a free formation change or a faster paid refit', function () {
	const unchanged = createConvoyState();
	expect(applyDoctrine(unchanged, 'spearhead')).toBe(true);
	flyKeplerPassage(unchanged);
	const moved = structuredClone(unchanged);
	const reinforced = structuredClone(unchanged);
	expect(arrangePlatform(moved, 0, 'port')).toBe(true);
	expect(build(reinforced, 1, 'rail')).toBe(true);
	expect(build(reinforced, 5, 'rail')).toBe(true);
	const carried = flyKeplerPassage(unchanged).report;
	const formation = flyKeplerPassage(moved);
	const refit = flyKeplerPassage(reinforced);
	expect(formation.report.kills).toBeGreaterThan(carried.kills);
	expect(refit.report.kills).toBe(formation.report.kills);
	expect(formation.report.disabledPlatforms).toEqual([]);
	expect(refit.report.disabledPlatforms).toEqual([]);
	expect(refit.lastKillTime).toBeLessThan(formation.lastKillTime);
	expect(moved.salvage).toBeGreaterThan(reinforced.salvage);
});

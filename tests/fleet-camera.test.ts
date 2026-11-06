import { expect, test } from 'bun:test';
import { Vector3 } from 'three';
import { createFleetCamera } from '../src/fleet-camera';
import { focusedShip, type FleetShip } from '../src/fleet-focus';
import { createConvoyState } from '../src/simulation';

const ark: FleetShip = { id: 'ark', name: 'Ark', detail: '', point: { x: 0, y: 0 }, elevation: 0 };
const frigate: FleetShip = { id: 'platform:0', name: 'Frigate', detail: '', point: { x: 600, y: -400 }, elevation: 20 };
const destination = function (ship: FleetShip) { return new Vector3(ship.point.x, ship.elevation, ship.point.y); };

test('changing ships eases from the displayed anchor and follows the live destination without lasting lag', function () {
	const camera = createFleetCamera();
	expect(camera.update(ark, 0, false)).toEqual(destination(ark));
	expect(camera.update(frigate, 0, false)).toEqual(destination(ark));
	const between = camera.update(frigate, 0.15, false);
	expect(between.x).toBeGreaterThan(0); expect(between.x).toBeLessThan(frigate.point.x);
	expect(between.y).toBeGreaterThan(0); expect(between.y).toBeLessThan(frigate.elevation);
	expect(between.z).toBeLessThan(0); expect(between.z).toBeGreaterThan(frigate.point.y);
	const moved = { ...frigate, point: { x: 800, y: -300 } };
	expect(camera.update(moved, 0.5, false)).toEqual(destination(moved));
	const traveling = { ...moved, point: { x: 810, y: -290 } };
	expect(camera.update(traveling, 1 / 60, false)).toEqual(destination(traveling));
});

test('rapid focus changes start at the current camera anchor instead of a previous ship', function () {
	const camera = createFleetCamera(); camera.update(ark, 0, false);
	const between = camera.update(frigate, 0.15, false);
	expect(camera.update(ark, 0, false)).toEqual(between);
	const returning = camera.update(ark, 0.1, false);
	expect(returning.x).toBeGreaterThan(0); expect(returning.x).toBeLessThan(between.x);
	expect(camera.update(ark, 0.5, false)).toEqual(destination(ark));
});

test('losing the followed ship eases back to the ark', function () {
	const state = createConvoyState(); const platform = state.convoy?.platforms[0];
	if (!platform) throw new Error('Missing platform');
	const camera = createFleetCamera();
	const before = camera.update(focusedShip(state, `platform:${platform.id}`), 0, false);
	platform.hp = 0;
	const fallback = focusedShip(state, `platform:${platform.id}`);
	expect(fallback.id).toBe('ark');
	expect(camera.update(fallback, 0, false)).toEqual(before);
	expect(camera.update(fallback, 0.1, false).distanceTo(destination(fallback))).toBeLessThan(before.distanceTo(destination(fallback)));
	expect(camera.update(fallback, 0.5, false)).toEqual(destination(fallback));
});

test('reduced motion and a fresh scene discard any unfinished transition', function () {
	const camera = createFleetCamera(); camera.update(ark, 0, false);
	camera.update(frigate, 0.1, false);
	expect(camera.update(frigate, 0, true)).toEqual(destination(frigate));
	expect(camera.update(ark, 0, true)).toEqual(destination(ark));
	camera.update(frigate, 0.1, false); camera.reset();
	const restarted = { ...ark, point: { x: 1200, y: -700 } };
	expect(camera.update(restarted, 0, false)).toEqual(destination(restarted));
});

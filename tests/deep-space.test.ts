import { expect, test } from 'bun:test';
import { Points, Vector3 } from 'three';
import { MIN_CAMERA_ZOOM } from '../src/combat-scale';
import { createDeepSpace } from '../src/deep-space';
import { offsetView, resizeView, translateView, viewFor } from '../src/projection';

const starPositions = function (sky: ReturnType<typeof createDeepSpace>): Vector3[] {
	sky.scene.updateMatrixWorld(true);
	const layers = sky.scene.children.filter(function (child) { return child instanceof Points; });
	expect(layers).toHaveLength(3);
	return layers.flatMap(function (stars) {
		const positions = stars.geometry.getAttribute('position');
		return Array.from({ length: positions.count }, function (_, index) { return new Vector3().fromBufferAttribute(positions, index).applyMatrix4(stars.matrixWorld); });
	});
};

const visible = function (point: Vector3): boolean {
	return Math.abs(point.x) < 1 && Math.abs(point.y) < 1 && Math.abs(point.z) < 1;
};

test('celestial landmarks move with orbit and return after a full turn without moving in space', function () {
	const sky = createDeepSpace(); const view = viewFor(1440, 900);
	const positions = starPositions(sky);
	sky.update(view);
	const landmark = positions.find(function (point) { const screen = point.clone().project(sky.camera); return visible(screen) && Math.abs(screen.x) < 0.5 && Math.abs(screen.y) < 0.5; });
	if (!landmark) throw new Error('Missing central star');
	const before = landmark.clone().project(sky.camera);
	const orientation = view.camera.quaternion.clone();
	for (const axis of [new Vector3(0, 1, 0), new Vector3(1, 0, 0)]) {
		view.camera.quaternion.copy(orientation); view.camera.rotateOnWorldAxis(axis, 0.15); sky.update(view);
		expect(starPositions(sky)).toEqual(positions);
		const after = landmark.clone().project(sky.camera);
		expect(after.distanceTo(before)).toBeGreaterThan(0.1);
		view.camera.quaternion.copy(orientation); view.camera.rotateOnWorldAxis(axis, Math.PI * 2); sky.update(view);
		expect(landmark.clone().project(sky.camera).distanceTo(before)).toBeLessThan(1e-10);
	}
	expect(starPositions(sky)).toEqual(positions);
});

test('travel, fleet focus, tactical zoom and drawer offsets do not drag or resize the celestial sky', function () {
	const sky = createDeepSpace(); const view = viewFor(1440, 900); sky.update(view);
	const positions = starPositions(sky);
	const before = positions.map(function (point) { return point.clone().project(sky.camera); });
	for (const zoom of [MIN_CAMERA_ZOOM, 0.28, 2]) {
		translateView(view, { x: 0, y: 0 }, { x: 24000, y: -18000 });
		view.camera.position.y += 120;
		view.camera.zoom = zoom; view.camera.updateProjectionMatrix(); offsetView(view, 225);
		sky.update(view);
		expect(positions.map(function (point) { return point.clone().project(sky.camera); })).toEqual(before);
	}
});

for (const [width, height] of [[1440, 900], [390, 844]] as const) test(`the entire sky remains populated through a full orbit and pitch limits at ${width}x${height}`, function () {
	const sky = createDeepSpace(); const view = viewFor(width, height); const positions = starPositions(sky);
	for (const polar of [Math.PI / 8, Math.PI / 2 - 0.35]) for (let step = 0; step <= 12; step++) {
		view.camera.position.setFromSphericalCoords(20000, polar, step * Math.PI / 6);
		view.camera.lookAt(0, 0, 0); sky.update(view);
		const projected = positions.map(function (point) { return point.clone().project(sky.camera); }).filter(visible);
		for (const x of [-1, 1]) for (const y of [-1, 1]) expect(projected.some(function (point) { return point.x * x > 0 && point.y * y > 0; })).toBe(true);
	}
});

test('resizing preserves celestial bearings and updates aspect without stretching the sky', function () {
	const sky = createDeepSpace(); const view = viewFor(1440, 900); sky.update(view);
	const landmark = starPositions(sky).find(function (point) { return visible(point.clone().project(sky.camera)); });
	if (!landmark) throw new Error('Missing visible star');
	const before = landmark.clone().project(sky.camera);
	const resized = resizeView(view, 390, 844); sky.update(resized);
	const after = landmark.clone().project(sky.camera);
	expect(after.y).toBeCloseTo(before.y, 10);
	expect(after.x * 390 / 844).toBeCloseTo(before.x * 1440 / 900, 10);
});

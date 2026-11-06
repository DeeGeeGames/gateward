import { MathUtils, Vector3 } from 'three';
import type { FleetFocus, FleetShip } from './fleet-focus';

const TRANSITION_SECONDS = 0.45;

/** Ease between ships, then follow their movement without camera lag. */
export const createFleetCamera = function () {
	const anchor = new Vector3();
	const offset = new Vector3();
	let followed: FleetFocus | undefined;
	let elapsed = TRANSITION_SECONDS;
	return {
		update: function (ship: FleetShip, deltaSeconds: number, reducedMotion: boolean): Vector3 {
			const destination = new Vector3(ship.point.x, ship.elevation, ship.point.y);
			if (ship.id !== followed) {
				if (followed !== undefined) { offset.copy(anchor).sub(destination); elapsed = 0; }
				followed = ship.id;
			}
			const delta = Number.isFinite(deltaSeconds) ? Math.max(0, deltaSeconds) : 0;
			elapsed = reducedMotion ? TRANSITION_SECONDS : Math.min(TRANSITION_SECONDS, elapsed + delta);
			// Recompute the destination each frame so a moving ship stays on course.
			anchor.copy(destination).addScaledVector(offset, 1 - MathUtils.smoothstep(elapsed, 0, TRANSITION_SECONDS));
			return anchor.clone();
		},
		reset: function () { followed = undefined; elapsed = TRANSITION_SECONDS; offset.set(0, 0, 0); },
	};
};

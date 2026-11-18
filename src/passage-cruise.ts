import { step, type State } from './simulation';

export const STEP_SECONDS = 1 / 60;
export const CRUISE_SPEED = 12;
const MAX_STEPS_PER_FRAME = 24;
const FRAME_BUDGET_MS = 4;

export const canCruise = function (state: State): boolean {
	// Use the simulation, including unobserved enemies and pending arrivals.
	// Leave the final combat tick to settle payouts and expire every shot.
	return state.convoy !== undefined && state.status === 'running' && state.hull > 0 && state.focused && !state.paused
		&& state.enemies.length === 0 && state.arrivals.length === 0 && state.shots.length === 0;
};

export const advanceCruise = function (state: State, seconds: number): number {
	const deadline = performance.now() + FRAME_BUDGET_MS;
	for (let steps = 0; steps < MAX_STEPS_PER_FRAME && seconds >= STEP_SECONDS && canCruise(state) && performance.now() < deadline; steps++) {
		step(state, STEP_SECONDS);
		seconds -= STEP_SECONDS;
	}
	// Slow frames only lose acceleration. Never build up a backlog of steps.
	return seconds % STEP_SECONDS;
};

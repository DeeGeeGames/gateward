import { operationFor, passageHadLosses, passagesFor, PASSAGE_SECONDS, WAVE_COUNT, type PassageReport, type State } from './simulation';
import { effectiveOutputs } from './systems';

export interface SystemsSummary {
	result: State['status']; reason: State['resultReason']; elapsed: number;
	distance: number; routeLength: number; eta: number | null;
	hull: number; shield: number; shieldAbsorbed: number; powerChanges: number;
	contacts: number; totalContacts: number; kills: number;
	sensorImpairments: number; sensorRepairs: number; fieldPlacements: number;
	redirected: number; escortLosses: number; salvage: number;
}

export const systemsSummary = function (state: State): SystemsSummary {
	const systems = state.systems;
	const remaining = Math.max(0, systems.routeLength - systems.distanceTraveled);
	const speed = state.convoy ? systems.routeLength / (passagesFor(state).length * PASSAGE_SECONDS) : effectiveOutputs(systems).speed;
	return {
		result: state.status, reason: state.resultReason, elapsed: state.time,
		distance: systems.distanceTraveled, routeLength: systems.routeLength,
		eta: remaining === 0 ? 0 : speed > 0 ? remaining / speed : null,
		hull: state.hull, shield: systems.shield.charge, shieldAbsorbed: systems.shieldAbsorbed,
		powerChanges: systems.powerChanges, contacts: state.wave,
		totalContacts: state.convoy ? passagesFor(state).length : WAVE_COUNT, kills: state.kills,
		sensorImpairments: systems.sensors.impairments, sensorRepairs: systems.sensors.repairs,
		fieldPlacements: systems.interdiction.placements, redirected: systems.interdiction.redirected,
		escortLosses: state.escortLosses, salvage: state.salvage,
	};
};

export type OperationOutcome = 'intact' | 'arrivalWithLosses' | 'arkDestroyed';

export const describeCrossingLosses = function (reports: readonly PassageReport[]): string {
	const disabled = reports.flatMap(function (report) { return report.disabledPlatforms; });
	const ships = new Set(disabled).size;
	const losses: string[] = [];
	if (ships > 0) {
		const count = `${ships} convoy ${ships === 1 ? 'ship' : 'ships'} disabled`;
		losses.push(disabled.length > ships ? `${count} (${disabled.length} disablements)` : count);
	}
	const escortsLost = reports.reduce(function (sum, report) { return sum + report.escortsLost; }, 0);
	if (escortsLost > 0) losses.push(`${escortsLost} escort craft lost`);
	return losses.join(' · ');
};

export const operationOutcome = function (state: State): OperationOutcome | undefined {
	if (state.status === 'lost') return 'arkDestroyed';
	if (state.status !== 'won') return undefined;
	return state.convoy?.reports?.some(passageHadLosses) ? 'arrivalWithLosses' : 'intact';
};

export const systemsResultMessage = function (state: State): string {
	const outcome = operationOutcome(state);
	if (!outcome) return '';
	const destination = state.convoy ? operationFor(state).destination : 'Kepler';
	const disablements = describeCrossingLosses(state.convoy?.reports ?? []);
	if (outcome === 'arkDestroyed') return `Ark destroyed before reaching ${destination}.${disablements ? ` Crossing losses · ${disablements}.` : ''} Review shields, coverage and repair timing.`;
	const arrival = disablements ? `Crossing losses · ${disablements}.` : state.convoy ? 'All convoy ships remained operational.' : '';
	return `${destination} reached. ${arrival ? `${arrival} ` : ''}The ark can reach the gate with surviving hostiles still in the area.`;
};

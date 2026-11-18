import type { OperationId } from './operations';
import type { OperationOutcome } from './trial-summary';

const key = function (id: OperationId) { return `gateward.operation.v1.${id}`; };

const count = function (value: unknown): number {
	return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0;
};

const read = function (id: OperationId) {
	try {
		const raw: unknown = JSON.parse(localStorage.getItem(key(id)) ?? 'null');
		if (typeof raw === 'object' && raw !== null) {
			const wins = 'wins' in raw ? count(raw.wins) : 0;
			const hull = 'hull' in raw && typeof raw.hull === 'number' && raw.hull > 0 && raw.hull <= 1200 ? raw.hull : 0;
			const intact = 'intact' in raw ? count(raw.intact) : 0;
			const arrivalWithLosses = 'arrivalWithLosses' in raw ? count(raw.arrivalWithLosses) : 0;
			const arkDestroyed = 'arkDestroyed' in raw ? count(raw.arkDestroyed) : 0;
			if (wins > 0 && hull > 0) {
				if (intact <= wins - arrivalWithLosses) return { wins, hull, intact, arrivalWithLosses, arkDestroyed };
				return { wins, hull, intact: 0, arrivalWithLosses: 0, arkDestroyed };
			}
			return { wins: 0, hull: 0, intact: 0, arrivalWithLosses: 0, arkDestroyed };
		}
	} catch { /* Storage restrictions must not prevent playing. */ }
	return { wins: 0, hull: 0, intact: 0, arrivalWithLosses: 0, arkDestroyed: 0 };
};

export const operationRecord = function (id: OperationId): string {
	const { wins, hull, intact, arrivalWithLosses, arkDestroyed } = read(id);
	if (wins === 0 && arkDestroyed === 0) return 'No operation results recorded on this device.';
	const unknown = wins - intact - arrivalWithLosses;
	const arrivals = wins > 0
		? `${wins} ${wins === 1 ? 'arrival' : 'arrivals'} · ${intact} intact · ${arrivalWithLosses} with losses${unknown > 0 ? ` · ${unknown} with unknown loss history` : ''} · best ark hull ${Math.ceil(hull)} / 1200`
		: 'No arrivals recorded';
	const losses = arkDestroyed > 0 ? ` · ${arkDestroyed} ark ${arkDestroyed === 1 ? 'destruction' : 'destructions'} recorded` : '';
	return `${arrivals}${losses} · saved on this device`;
};

export const recordOperation = function (id: OperationId, outcome: OperationOutcome, hull: number) {
	if (outcome !== 'arkDestroyed' && (!Number.isFinite(hull) || hull <= 0 || hull > 1200)) return;
	const record = read(id);
	if (outcome === 'arkDestroyed') {
		record.arkDestroyed = Math.min(Number.MAX_SAFE_INTEGER, record.arkDestroyed + 1);
	} else {
		record.hull = Math.max(record.hull, hull);
		if (record.wins < Number.MAX_SAFE_INTEGER) {
			record.wins++;
			record[outcome]++;
		}
	}
	try { localStorage.setItem(key(id), JSON.stringify(record)); }
	catch { /* Completion remains valid if local storage is unavailable. */ }
};

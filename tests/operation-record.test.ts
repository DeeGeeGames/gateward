import { expect, test } from 'bun:test';
import { operationRecord, recordOperation } from '../src/operation-record';

test('historical arrivals stay unknown when new outcomes are stored under the existing key', function () {
	const key = 'gateward.operation.v1.kepler';
	const entries = new Map([[key, '{"wins":2,"hull":900.5}']]);
	const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
	Object.defineProperty(globalThis, 'localStorage', {
		configurable: true,
		value: {
			getItem: function (key: string) { return entries.get(key) ?? null; },
			setItem: function (key: string, value: string) { entries.set(key, value); },
		},
	});
	try {
		expect(operationRecord('kepler')).toContain('2 with unknown loss history');
		recordOperation('kepler', 'intact', 850);
		recordOperation('kepler', 'arrivalWithLosses', 1100.5);
		recordOperation('kepler', 'arkDestroyed', 0);
		expect(entries.size).toBe(1);
		expect(entries.get(key)).toBe(JSON.stringify({ wins: 4, hull: 1100.5, intact: 1, arrivalWithLosses: 1, arkDestroyed: 1 }));
		expect(operationRecord('kepler')).toContain('4 arrivals · 1 intact · 1 with losses · 2 with unknown loss history');
		expect(operationRecord('kepler')).toContain('best ark hull 1101 / 1200 · 1 ark destruction recorded');

		recordOperation('long-wake', 'arkDestroyed', 0);
		expect(operationRecord('long-wake')).toContain('No arrivals recorded · 1 ark destruction recorded');
	} finally {
		if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
		else Reflect.deleteProperty(globalThis, 'localStorage');
	}
});

import { DOCTRINE_IDS, DOCTRINES, type DoctrineId } from './doctrines';
import { OPERATION_IDS, OPERATIONS, type OperationId, type Passage } from './operations';
import { operationRecord } from './operation-record';
import { chooseRefitSupport, REFIT_SUPPORT_IDS, REFIT_SUPPORT, refitSupportReason } from './refit-support';
import { SCOUT_MARKERS } from './scout-overlay';
import { passagesFor, type EnemyKind, type State } from './simulation';

const node = function (id: string): HTMLElement {
	const element = document.getElementById(id);
	if (!element) throw new Error(`Missing demo element: ${id}`);
	return element;
};

export const createDemoUI = function (getState: () => State, chooseOperation: (id: OperationId) => void, order: (action: () => boolean) => void, signal: AbortSignal) {
	const operations = node('operation-cards');
	const doctrineSelect = node('loadout-select');
	if (!(doctrineSelect instanceof HTMLSelectElement)) throw new Error('Missing starting doctrine selector');
	const options = { signal };
	let selectedDoctrine: DoctrineId | undefined = 'spearhead';
	for (const id of DOCTRINE_IDS) {
		const option = document.createElement('option'); option.value = id;
		option.textContent = `${DOCTRINES[id].name} · ${DOCTRINES[id].cost} salvage`;
		doctrineSelect.append(option);
	}
	const custom = document.createElement('option'); custom.value = 'custom'; custom.textContent = 'Custom · start with blank mounts'; doctrineSelect.append(custom); doctrineSelect.value = 'spearhead';
	const describeDoctrine = function () {
		node('loadout-description').textContent = selectedDoctrine ? `${DOCTRINES[selectedDoctrine].loadout}. ${650 - DOCTRINES[selectedDoctrine].cost} salvage remains. Full refunds before launch.` : '650 salvage, two blank frigates, and eight ark mounts. Build your defense from scratch.';
	};
	doctrineSelect.addEventListener('change', function () {
		selectedDoctrine = DOCTRINE_IDS.find(function (id) { return id === doctrineSelect.value; }); describeDoctrine();
	}, options);
	describeDoctrine();
	const cards = OPERATION_IDS.map(function (id, index) {
		const operation = OPERATIONS[id];
		const card = document.createElement('button'); card.className = 'operation-card'; card.type = 'button'; card.dataset['operation'] = id;
		const title = document.createElement('b'); title.textContent = operation.name;
		const badge = document.createElement('span'); badge.textContent = index === 0 ? 'First crossing' : operation.difficulty;
		const detail = document.createElement('small'); detail.textContent = `${operation.passages.length} passages · ${index === 0 ? 'Learn the convoy' : index === 1 ? 'Build for endurance' : 'Hold both flanks'}`;
		card.append(title, badge, detail);
		card.addEventListener('click', function () { chooseOperation(id); }, options);
		operations.append(card); return { id, card };
	});
	const selectOperation = function (id: OperationId) {
		for (const entry of cards) entry.card.setAttribute('aria-pressed', String(entry.id === id));
		node('operation-description').textContent = OPERATIONS[id].description;
		node('operation-record').textContent = operationRecord(id);
	};
	selectOperation('kepler');
	const support = node('refit-support');
	const supportTitle = document.createElement('h3'); supportTitle.textContent = 'REFIT SUPPORT / CHOOSE ONE';
	const supportCopy = document.createElement('p'); supportCopy.textContent = 'One additional supply package. Choose what your next passage needs.';
	support.append(supportTitle, supportCopy);
	const supportButtons = REFIT_SUPPORT_IDS.map(function (id) {
		const control = document.createElement('button'); control.type = 'button'; control.dataset['support'] = id;
		const title = document.createElement('b'); title.textContent = REFIT_SUPPORT[id].name;
		const description = document.createElement('span'); description.textContent = REFIT_SUPPORT[id].description;
		control.append(title, description);
		control.addEventListener('click', function () { order(function () { return chooseRefitSupport(getState(), id); }); }, options);
		support.append(control); return { id, control, description };
	});
	let scoutKey = '';
	let routeKey = '';
	let readinessKey = '';
	const battlefieldScout = node('battlefield-scout');
	const scoutSummary = node('scout-summary');
	const scoutKeyItems = node('scout-key');
	const scoutDetail = node('passage-scout');
	const update = function () {
		const state = getState();
		const passages: readonly Passage[] = passagesFor(state);
		const index = Math.min(passages.length - 1, state.status === 'fitting' ? state.wave : state.wave - 1);
		const passage = passages[index];
		const fitted = state.mounts.filter(function (mount) { return mount.weapon; }).length;
		const emptyShips = state.convoy?.platforms.filter(function (platform) { return !state.mounts.some(function (mount) { return mount.platform === platform.id && mount.weapon; }); }).length ?? 0;
		const readiness = `${fitted} GUNS FITTED / ${state.convoy?.platforms.length ?? 0} SHIPS${emptyShips ? ` / ${emptyShips} UNARMED` : ''}`;
		if (readiness !== readinessKey) { node('build-readiness').textContent = readiness; readinessKey = readiness; }
		const key = `${state.convoy?.operation}/${index}`;
		if (key !== routeKey) {
			routeKey = key;
			const stages = passages.map(function (stage, stageIndex) {
				const entry = document.createElement('span'); entry.title = `${stageIndex + 1}. ${stage.name}`;
				entry.dataset['stage'] = stageIndex < index ? 'complete' : stageIndex === index ? 'current' : 'future';
				return entry;
			});
			node('route-stages').replaceChildren(...stages);
		}
		const showScout = state.status === 'fitting' && !!state.convoy && !!passage;
		battlefieldScout.hidden = scoutDetail.hidden = !showScout;
		if (showScout && passage && key !== scoutKey) {
			scoutKey = key;
			const groups = new Map<EnemyKind, number>();
			for (const threat of passage.threats) groups.set(threat.kind, (groups.get(threat.kind) ?? 0) + 1);
			scoutSummary.textContent = passage.scoutCue ?? 'Compare scouted positions with gun arcs.';
			const keys = Array.from(groups, function ([kind, count]) {
				const item = document.createElement('span');
				const marker = SCOUT_MARKERS[kind];
				const symbol = document.createElement('span');
				symbol.textContent = marker.symbol;
				symbol.style.color = marker.color;
				symbol.setAttribute('aria-hidden', 'true');
				item.append(symbol, ` ${count} ${count === 1 ? marker.one : marker.many}`);
				return item;
			});
			scoutKeyItems.replaceChildren('Starts', ...keys);
		}
		const report = state.convoy?.reports?.[state.wave - 1];
		node('last-report').hidden = state.status !== 'fitting' || !report;
		const reportSummary = node('last-report').querySelector('summary');
		const activity = report?.weaponActivity;
		if (reportSummary) {
			const text = activity?.length ? `Last passage · ${activity.filter(function (gun) { return gun.shots > 0 || gun.beamSeconds > 0; }).length}/${activity.length} guns engaged` : 'Previous passage report';
			if (reportSummary.textContent !== text) reportSummary.textContent = text;
		}
		support.hidden = state.status !== 'fitting' || !report || state.wave >= passages.length;
		if (!support.hidden) {
			const receipt = report?.support;
			supportTitle.textContent = receipt ? 'SUPPORT RECEIVED' : 'REFIT SUPPORT / CHOOSE ONE';
			for (const entry of supportButtons) {
				const reason = refitSupportReason(state, entry.id);
				entry.control.disabled = !!reason;
				entry.control.setAttribute('aria-pressed', String(receipt?.id === entry.id));
				entry.control.title = reason || REFIT_SUPPORT[entry.id].description;
				entry.description.textContent = receipt ? receipt.id === entry.id ? 'Delivered to your convoy.' : 'Choose again after the next passage.' : reason || REFIT_SUPPORT[entry.id].description;
			}
		}
	};
	return { update, selectOperation, doctrine: function () { return selectedDoctrine; }, focusOperation: function (id: OperationId) { cards.find(function (entry) { return entry.id === id; })?.card.focus({ preventScroll: true }); } };
};

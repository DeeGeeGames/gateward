import { REFIT_SUPPORT } from './refit-support';
import { passageHadLosses, WEAPONS, type PassageReport, type WeaponActivity, type WeaponIdleReason } from './simulation';

const shipName = function (platform: number | undefined) { return platform === undefined ? 'Ark' : `P${platform + 1}`; };
const idleLabels: readonly [WeaponIdleReason, string][] = [
	['arc', 'with contacts in range, all outside the outward arc'],
	['range', 'with detected contacts, all beyond weapon range'],
	['turning', 'turning to the firing solution'],
	['reloading', 'waiting for reload with a firing solution'],
	['unpowered', 'without weapons power'],
	['offline', 'with the mount offline'],
	['disabled', 'with the ship disabled'],
	['noContacts', 'without detected contacts'],
];
const describeIdle = function (gun: WeaponActivity): string {
	const measured = idleLabels.flatMap(function ([reason, label]) {
		const seconds = gun.idleSeconds?.[reason] ?? 0;
		return seconds > 0 ? [`${seconds < 0.1 ? '<0.1' : seconds.toFixed(1)}s ${label}`] : [];
	});
	return measured.length ? measured.join(' · ') : 'No firing conditions recorded.';
};

export const passageTakeaways = function (report: PassageReport, idle: readonly WeaponActivity[]): string[] {
	const takeaways = report.disabledPlatforms.map(function (platform) {
		return `${shipName(platform)} · Shift this ship away from the heaviest scouted threat or assign escorts to its flank.`;
	});
	const byShip = new Map<number | undefined, WeaponActivity[]>();
	for (const gun of idle) {
		if (gun.platform !== undefined && report.disabledPlatforms.includes(gun.platform)) continue;
		const guns = byShip.get(gun.platform);
		if (guns) guns.push(gun);
		else byShip.set(gun.platform, [gun]);
	}
	for (const [platform, guns] of byShip) {
		const ship = shipName(platform);
		let mainReason: WeaponIdleReason | undefined;
		let longest = 0;
		for (const [reason] of idleLabels) {
			const total = guns.reduce(function (sum, gun) { return sum + (gun.idleSeconds?.[reason] ?? 0); }, 0);
			if (total > longest) { longest = total; mainReason = reason; }
		}
		if (mainReason === 'arc') takeaways.push(platform === undefined
			? 'Ark · An idle gun had contacts in range outside its arc. Fit guns on the side facing the next scouted approach.'
			: `${ship} · An idle gun had contacts in range outside its arc. Try a slot facing the next scouted approach.`);
		else if (mainReason === 'range') takeaways.push(`${ship} · An idle gun had contacts beyond its reach. Try a longer-range fit.`);
		else if (mainReason === 'unpowered') takeaways.push(`${ship} · Reserve some reactor power for weapons.`);
		else if (mainReason === 'offline') takeaways.push(`${ship} · Assign a repair crew to the offline mount during combat.`);
		else if (mainReason === 'noContacts') takeaways.push(`${ship} · Idle guns spent the most time without a detected contact.`);
		else if (mainReason === 'turning') takeaways.push(`${ship} · Idle guns spent the most time turning to aim.`);
		else if (mainReason === 'reloading') takeaways.push(`${ship} · Idle guns spent the most time waiting for a reload.`);
	}
	return takeaways;
};

const rendered = new WeakMap<HTMLElement, string>();
export const renderPassageReports = function (root: HTMLElement, reports: readonly PassageReport[]) {
	const key = JSON.stringify(reports);
	if (rendered.get(root) === key) return false;
	rendered.set(root, key);
	root.hidden = reports.length === 0;
	root.replaceChildren(...reports.map(function (report) {
		const card = document.createElement('article'); card.className = 'passage-report';
		const outcome = !report.survived ? 'arkDestroyed' : passageHadLosses(report) ? 'arrivalWithLosses' : 'intact';
		card.dataset['outcome'] = outcome;
		const title = document.createElement('h3'); title.textContent = `${report.name} · ${outcome === 'arkDestroyed' ? 'Ark destroyed' : outcome === 'arrivalWithLosses' ? 'Cleared with losses' : 'Cleared intact'}`;
		const stats = document.createElement('p');
		stats.textContent = `Ark hull ${Math.ceil(report.hullBefore)} → ${Math.ceil(report.hullAfter)} · ${report.kills} hostiles destroyed · ${Math.floor(report.salvageEarned)} combat salvage`;
		const losses = document.createElement('p');
		const casualties: string[] = [];
		if (report.disabledPlatforms.length > 0) casualties.push(`${report.disabledPlatforms.map(shipName).join(', ')} disabled · ${report.weaponsLost} ${report.weaponsLost === 1 ? 'gun' : 'guns'} lost.`);
		if (report.escortsLost > 0) casualties.push(`${report.escortsLost} escort craft lost.`);
		losses.textContent = casualties.join(' ') || 'All platforms and escort craft remained operational.';
		card.append(title, stats, losses);
		const activity = report.weaponActivity ?? [];
		const idle = activity.filter(function (gun) { return gun.shots === 0 && gun.beamSeconds === 0; });
		if (activity.length > 0) {
			const feedback = document.createElement('p'); feedback.className = 'weapon-feedback';
			feedback.textContent = `${activity.length - idle.length} / ${activity.length} guns engaged.`;
			card.append(feedback);
		}
		for (const takeaway of passageTakeaways(report, idle)) {
			const row = document.createElement('p'); row.className = 'passage-takeaway'; row.textContent = takeaway; card.append(row);
		}
		if (activity.length > 0) {
			const detail = document.createElement('details'); const summary = document.createElement('summary'); summary.textContent = 'Weapon activity'; detail.append(summary);
			for (const gun of activity) {
				const row = document.createElement('p');
				const firing = idle.includes(gun) ? `Idle · ${describeIdle(gun)}` : gun.weapon === 'beam' ? `${gun.beamSeconds.toFixed(1)}s firing` : `${gun.shots} shots fired`;
				row.textContent = `${shipName(gun.platform)} · Mount ${gun.mount + 1} · ${WEAPONS[gun.weapon].name} · ${firing}`;
				detail.append(row);
			}
			card.append(detail);
		}
		if (report.recoverySalvage > 0) {
			const recovery = document.createElement('p'); recovery.className = 'recovery';
			recovery.textContent = `Refit supplies · +${report.recoverySalvage} salvage · +${Math.ceil(report.recoveryHull)} ark hull. Chassis and surviving equipment restored.${report.weaponsLost > 0 ? ' Replace lost guns at refit.' : ''}`;
			card.append(recovery);
		}
		if (report.support) {
			const support = document.createElement('p'); support.className = 'recovery';
			const receipt = report.support;
			const gains = [receipt.hull > 0 ? `+${Math.ceil(receipt.hull)} hull` : '', receipt.salvage > 0 ? `+${receipt.salvage} salvage` : '', receipt.shield > 0 ? `+${Math.ceil(receipt.shield)} shield` : ''].filter(Boolean).join(' · ');
			support.textContent = `${REFIT_SUPPORT[receipt.id].name}: ${gains}.`;
			card.append(support);
		}
		return card;
	}));
	return true;
};

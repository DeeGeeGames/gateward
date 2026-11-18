import type { Passage } from './operations';
import { toScreen, TURRET_HEIGHT, type View } from './projection';
import type { EnemyKind, State } from './simulation';
import { worldPoint } from './space';

export const SCOUT_MARKERS = {
	raider: { symbol: '▲', one: 'fighter', many: 'fighters', color: '#efca92' },
	armored: { symbol: '◆', one: 'armored ship', many: 'armored ships', color: '#efca92' },
	bomber: { symbol: '■', one: 'bomber', many: 'bombers', color: '#ffa488' },
	flagship: { symbol: '✦', one: 'flagship', many: 'flagships', color: '#ffa488' },
	carrier: { symbol: '⬡', one: 'carrier', many: 'carriers', color: '#ffa488' },
} satisfies Record<EnemyKind, { symbol: string; one: string; many: string; color: string }>;

export const drawScoutPositions = function (ctx: CanvasRenderingContext2D, passage: Passage, state: State, view: View) {
	ctx.save();
	ctx.font = 'bold 13px system-ui, sans-serif';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.lineWidth = 3;
	ctx.lineJoin = 'round';
	ctx.strokeStyle = '#09121c';
	for (const threat of passage.threats) {
		// Use the deployment offsets in the arc's plane so orbit and zoom keep both registered.
		const at = toScreen(worldPoint(state, threat), view, TURRET_HEIGHT);
		const marker = SCOUT_MARKERS[threat.kind];
		ctx.strokeText(marker.symbol, at.x, at.y);
		ctx.fillStyle = marker.color;
		ctx.fillText(marker.symbol, at.x, at.y);
	}
	ctx.restore();
};

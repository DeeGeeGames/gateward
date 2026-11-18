import { BOMBER_ATTACK, type Enemy, type State } from './simulation';
import { contactIntel } from './sensors';

// Text and fill convey timing even with audio muted and motion disabled.
export const bomberCue = function (state: State, enemy: Enemy): { text: string; progress: number; color: string } | undefined {
	if (state.status !== 'running' || enemy.hp <= 0 || enemy.kind !== 'bomber' || contactIntel(state, enemy) !== 'classified') return undefined;
	const attack = enemy.bomberAttack;
	if (attack?.phase === 'windup') return { text: `ARRAY SHOT · ${attack.remaining.toFixed(1)}s`, progress: 1 - attack.remaining / BOMBER_ATTACK.windup, color: '#ffd184' };
	if (attack?.phase === 'released') return { text: 'ARRAY · FIRED', progress: 1, color: '#ff897e' };
	if (enemy.cooldown > 0) return { text: 'ARRAY · RECHARGING', progress: 0, color: '#a6b5c4' };
	return undefined;
};

export const defenseHint = function (state: State): string | undefined {
	if (state.status !== 'running' || state.paused || !state.focused || state.pulseCooldown > 0) return undefined;
	if (state.shots.some(function (shot) { return shot.side === 'enemy' && shot.life > 0; })) return 'Incoming rounds · Aegis can clear them.';
	if (state.enemies.some(function (enemy) {
		return enemy.hp > 0 && enemy.kind === 'bomber' && enemy.bomberAttack?.phase === 'windup' && contactIntel(state, enemy) === 'classified';
	})) return 'Bomber lining up a shot · Aegis can clear it once fired.';
	return undefined;
};

export interface CuePosition { x: number; y: number }
export const placeBomberCue = function (anchor: CuePosition, width: number, height: number, occupied: readonly CuePosition[]): CuePosition | undefined {
	const x = Math.max(75, Math.min(width - 75, anchor.x));
	const y = Math.max(20, Math.min(height - 20, anchor.y));
	for (let offset = 0; offset < height; offset += 28) {
		for (const direction of offset === 0 ? [1] : [-1, 1]) {
			const candidate = { x, y: y + offset * direction };
			if (candidate.y < 20 || candidate.y > height - 20) continue;
			if (occupied.every(function (other) { return Math.abs(other.x - candidate.x) >= 150 || Math.abs(other.y - candidate.y) >= 28; })) return candidate;
		}
	}
	return undefined;
};

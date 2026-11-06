import { BackSide, BufferAttribute, BufferGeometry, Mesh, PerspectiveCamera, Points, PointsMaterial, Scene, ShaderMaterial, SphereGeometry, Vector3 } from 'three';
import { viewFor, type View } from './projection';

// Celestial scenery has angular size, even though the tactical camera is
// orthographic. Only copy its orientation: travel, focus, zoom and UI offsets
// must not drag distant objects through space or rescale them with the fleet.
export const createDeepSpace = function () {
	const scene = new Scene();
	const camera = new PerspectiveCamera(50, 1, 1, 2000);
	const reference = viewFor(1440, 900).camera.quaternion;
	const planetDirection = new Vector3(0.61, 0.41, -1).normalize().applyQuaternion(reference);
	const planetRadius = 0.27;
	const material = new ShaderMaterial({
		side: BackSide, depthWrite: false,
		uniforms: {
			planetDirection: { value: planetDirection },
			planetRadius: { value: planetRadius },
			sun: { value: new Vector3(-0.75, 0.55, 0.5).normalize().applyQuaternion(reference) },
		},
		vertexShader: `varying vec3 vDirection;
		void main() { vDirection = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
		fragmentShader: `varying vec3 vDirection;
		uniform vec3 planetDirection;
		uniform float planetRadius;
		uniform vec3 sun;
		float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
		float noise(vec3 p) {
			vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
			return mix(
				mix(mix(hash(i), hash(i + vec3(1.0, 0.0, 0.0)), f.x), mix(hash(i + vec3(0.0, 1.0, 0.0)), hash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
				mix(mix(hash(i + vec3(0.0, 0.0, 1.0)), hash(i + vec3(1.0, 0.0, 1.0)), f.x), mix(hash(i + vec3(0.0, 1.0, 1.0)), hash(i + vec3(1.0)), f.x), f.y), f.z);
		}
		float cloud(vec3 p) { return noise(p) * 0.53 + noise(p * 2.07) * 0.27 + noise(p * 4.13) * 0.13 + noise(p * 8.3) * 0.07; }
		void main() {
			vec3 direction = normalize(vDirection);
			vec3 color = vec3(0.006, 0.011, 0.019);
			float gas = cloud(direction * 3.2 + vec3(7.1, 2.8, 5.3));
			float band = exp(-pow(dot(direction, normalize(vec3(0.3, 1.0, -0.4))) * 2.8, 2.0));
			color += vec3(0.012, 0.024, 0.028) * gas * band;
			color += vec3(0.037, 0.028, 0.018) * pow(gas, 3.0) * (1.0 - band) * 0.65;
			float along = dot(direction, planetDirection);
			float discriminant = along * along - (1.0 - planetRadius * planetRadius);
			float edgeWidth = fwidth(discriminant);
			float separation = acos(clamp(along, -1.0, 1.0));
			float atmosphere = exp(-abs(separation - asin(planetRadius)) * 150.0);
			vec3 rim = direction - planetDirection * along;
			color += vec3(0.055, 0.135, 0.16) * atmosphere * (0.18 + max(dot(rim, sun) / max(length(rim), 0.00001), 0.0));
			if (along > 0.0 && discriminant > 0.0) {
				vec3 normal = normalize(direction * (along - sqrt(discriminant)) - planetDirection);
				float light = max(dot(normal, sun), 0.0);
				float terrain = cloud(normal * 5.5 + vec3(12.4, 4.1, 3.7));
				float swirls = cloud(normal * 12.0 + terrain * 3.0);
				vec3 surface = mix(vec3(0.035, 0.067, 0.083), vec3(0.15, 0.18, 0.17), smoothstep(0.43, 0.66, terrain));
				surface += vec3(0.09, 0.12, 0.13) * smoothstep(0.54, 0.8, swirls);
				vec3 planet = surface * (0.06 + light * 0.7);
				planet += vec3(0.10, 0.21, 0.24) * pow(1.0 - max(dot(normal, -direction), 0.0), 4.0) * light;
				color = mix(color, planet, smoothstep(0.0, max(edgeWidth, 0.00001), discriminant));
			}
			gl_FragColor = vec4(color, 1.0);
			#include <colorspace_fragment>
		}`,
	});
	const vista = new Mesh(new SphereGeometry(1000, 32, 16), material);
	vista.name = 'Distant planetary horizon'; vista.frustumCulled = false; vista.renderOrder = -100; scene.add(vista);
	// Distribute fixed directions over the whole sky, with no wrapping at an
	// azimuth seam and no regeneration when the camera or convoy moves.
	for (let layer = 0; layer < 3; layer++) {
		const positions: number[] = [];
		const count = 1600;
		const direction = new Vector3();
		for (let index = 0; index < count; index++) {
			const y = 1 - 2 * (index + 0.5) / count;
			const radius = Math.sqrt(1 - y * y);
			const angle = index * Math.PI * (3 - Math.sqrt(5)) + layer * 2.1;
			direction.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
			// The planet occludes the same celestial directions at every orbit.
			if (direction.dot(planetDirection) > Math.cos(Math.asin(planetRadius) + 0.003)) continue;
			positions.push(direction.x * 900, direction.y * 900, direction.z * 900);
		}
		const geometry = new BufferGeometry(); geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
		const stars = new Points(geometry, new PointsMaterial({ color: layer === 2 ? '#b8cbd2' : '#506675', size: layer === 2 ? 1.6 : 1, sizeAttenuation: false, depthWrite: false }));
		stars.name = `Distant stars ${layer + 1}`; scene.add(stars);
	}
	return {
		scene, camera,
		update: function (view: View) {
			const aspect = view.width / Math.max(1, view.height);
			if (camera.aspect !== aspect) { camera.aspect = aspect; camera.updateProjectionMatrix(); }
			camera.quaternion.copy(view.camera.quaternion); camera.updateMatrixWorld(true);
		},
	};
};

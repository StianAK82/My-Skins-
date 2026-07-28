import * as THREE from "three";

export type ProfileRing = { y: number; width: number; depth: number; z?: number };

/** Creates a closed, deterministic oval loft. It is intentionally independent of React. */
export function createLoftGeometry(rings: ProfileRing[], segments = 24): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let r = 0; r < rings.length; r++) {
    const ring = rings[r];
    for (let s = 0; s < segments; s++) {
      const a = (s / segments) * Math.PI * 2;
      positions.push(Math.sin(a) * ring.width, ring.y, Math.cos(a) * ring.depth + (ring.z ?? 0));
      uvs.push(s / segments, r / (rings.length - 1));
    }
  }
  for (let r = 0; r < rings.length - 1; r++) for (let s = 0; s < segments; s++) {
    const n = (s + 1) % segments;
    const a = r * segments + s, b = r * segments + n, c = (r + 1) * segments + n, d = (r + 1) * segments + s;
    indices.push(a, b, d, b, c, d);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

import * as THREE from "three";
import { createLoftGeometry } from "./garment-surface-utils.ts";

export const HOODIE_PARTS = ["torso", "left-shoulder", "right-shoulder", "left-sleeve", "right-sleeve", "left-cuff", "right-cuff", "waistband", "hood-exterior", "hood-interior", "hood-opening", "kangaroo-pocket", "left-drawstring", "right-drawstring", "seams"] as const;

export function createHoodieTorso(width = 1) {
  return createLoftGeometry([
    { y: .94, width: .55 * width, depth: .335 }, { y: 1.13, width: .58 * width, depth: .35 },
    { y: 1.52, width: .57 * width, depth: .35 }, { y: 1.88, width: .61 * width, depth: .34 },
    { y: 2.03, width: .48 * width, depth: .31 },
  ], 28);
}

export function createSleeve(side: -1 | 1, fullness = 1) {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(side * .48, 1.91, 0), new THREE.Vector3(side * .68, 1.78, 0),
    new THREE.Vector3(side * .73, 1.42, .01), new THREE.Vector3(side * .72, 1.04, .015),
  ]);
  return new THREE.TubeGeometry(curve, 24, .205 * fullness, 16, false);
}

export function createHood() {
  const shape = new THREE.Shape();
  shape.moveTo(-.42, 0); shape.bezierCurveTo(-.47, .38, -.42, .83, -.12, .96);
  shape.bezierCurveTo(.30, 1.05, .48, .61, .43, .12); shape.quadraticCurveTo(.36, -.04, .21, -.08);
  shape.lineTo(.13, .14); shape.bezierCurveTo(.29, .30, .29, .68, .05, .76);
  shape.bezierCurveTo(-.18, .82, -.25, .48, -.20, .17); shape.lineTo(-.28, -.05); shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: .34, bevelEnabled: true, bevelSegments: 4, bevelSize: .045, bevelThickness: .045, curveSegments: 18, steps: 1 });
  geometry.translate(0, 2.00, -.28);
  geometry.computeVertexNormals();
  return geometry;
}

export function createPocket() {
  const s = new THREE.Shape();
  s.moveTo(-.36, -.16); s.quadraticCurveTo(-.43, .03, -.29, .20); s.lineTo(.29, .20);
  s.quadraticCurveTo(.43, .03, .36, -.16); s.quadraticCurveTo(0, -.22, -.36, -.16); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: .055, bevelEnabled: true, bevelSize: .025, bevelThickness: .025, bevelSegments: 3, curveSegments: 12 });
  g.translate(0, 1.22, .34); return g;
}

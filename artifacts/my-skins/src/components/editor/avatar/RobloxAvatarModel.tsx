import type { ReactNode } from "react";

export type AvatarSurface = { torso: ReactNode; leftArm: ReactNode; rightArm: ReactNode; pants: ReactNode; skin: ReactNode };

/** A single articulated, connected block-avatar silhouette. Garments can share this group's dimensions. */
export function RobloxAvatarModel({ surfaces, children }: { surfaces: AvatarSurface; children?: ReactNode }) {
  return <group name="roblox-avatar-custom-mesh">
    <mesh position={[0, 1.65, 0]} castShadow><boxGeometry args={[1.22, 1.35, .62, 3, 3, 2]} />{surfaces.torso}</mesh>
    <mesh position={[0, 2.72, 0]} castShadow><sphereGeometry args={[.48, 24, 16]} />{surfaces.skin}</mesh>
    <mesh position={[-.91, 1.55, 0]} rotation-z={-.035} castShadow><capsuleGeometry args={[.31, 1.14, 8, 16]} />{surfaces.leftArm}</mesh>
    <mesh position={[.91, 1.55, 0]} rotation-z={.035} castShadow><capsuleGeometry args={[.31, 1.14, 8, 16]} />{surfaces.rightArm}</mesh>
    <mesh position={[-.91, .63, 0]} castShadow><capsuleGeometry args={[.29, .18, 8, 16]} />{surfaces.skin}</mesh>
    <mesh position={[.91, .63, 0]} castShadow><capsuleGeometry args={[.29, .18, 8, 16]} />{surfaces.skin}</mesh>
    <mesh position={[-.34, .28, 0]} castShadow><boxGeometry args={[.64, 1.3, .61, 2, 3, 2]} />{surfaces.pants}</mesh>
    <mesh position={[.34, .28, 0]} castShadow><boxGeometry args={[.64, 1.3, .61, 2, 3, 2]} />{surfaces.pants}</mesh>
    <mesh position={[-.34, -.46, .08]} castShadow><boxGeometry args={[.64, .25, .84, 2, 2, 2]} />{surfaces.pants}</mesh>
    <mesh position={[.34, -.46, .08]} castShadow><boxGeometry args={[.64, .25, .84, 2, 2, 2]} />{surfaces.pants}</mesh>
    {children}
  </group>;
}

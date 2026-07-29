const fs = require('fs');
const content = fs.readFileSync('artifacts/my-skins/src/components/editor/AvatarPreview.tsx', 'utf8');

const overlayStr = `
function CustomPartsOverlay({ partId, args, customParts, baseModelId }: { partId: string; args: [number, number, number]; customParts?: AvatarPreviewProps["customParts"]; baseModelId: string }) {
  if (!customParts || customParts.length === 0) return null;

  const mapAttachToPartId = (attach: string): string[] => {
    switch (attach) {
      case "forehead":
      case "head_top":
      case "face": return ["head"];
      case "neck": return ["neck"];
      case "chest": return baseModelId === "proportioned_r15" ? ["upperTorso"] : ["torso"];
      case "belly": return baseModelId === "proportioned_r15" ? ["lowerTorso"] : ["torso"];
      case "back": return baseModelId === "proportioned_r15" ? ["upperTorso"] : ["torso"];
      case "hips": return baseModelId === "proportioned_r15" ? ["lowerTorso"] : baseModelId === "heroic" ? ["hips"] : ["torso"];
      case "left_shoulder": return ["leftUpperArm"];
      case "right_shoulder": return ["rightUpperArm"];
      case "left_hand": return baseModelId === "proportioned_r15" ? ["leftHand"] : ["leftHand"]; 
      case "right_hand": return baseModelId === "proportioned_r15" ? ["rightHand"] : ["rightHand"];
      case "left_leg": return baseModelId === "proportioned_r15" ? ["leftUpperLeg", "leftLowerLeg"] : ["leftLeg"];
      case "right_leg": return baseModelId === "proportioned_r15" ? ["rightUpperLeg", "rightLowerLeg"] : ["rightLeg"];
      case "left_foot": return baseModelId === "proportioned_r15" ? ["leftLowerLeg"] : ["leftLeg"];
      case "right_foot": return baseModelId === "proportioned_r15" ? ["rightLowerLeg"] : ["rightLeg"];
      default: return [];
    }
  };

  const matchingParts = customParts.filter(p => mapAttachToPartId(p.attach).includes(partId));
  if (matchingParts.length === 0) return null;

  return (
    <>
      {matchingParts.map((p, i) => {
        let pos: [number, number, number] = [0, 0, 0];
        let rot: [number, number, number] = [0, 0, 0];
        let scaleMulti = p.size === "small" ? 0.6 : p.size === "large" ? 1.4 : 1;

        switch (p.attach) {
          case "forehead": pos = [0, args[1]*0.2, args[2]*0.5]; rot = [0.2, 0, 0]; break;
          case "head_top": pos = [0, args[1]*0.5, 0]; break;
          case "face": pos = [0, -args[1]*0.1, args[2]*0.5]; break;
          case "neck": pos = [0, 0, args[2]*0.5]; break;
          case "chest": pos = [0, baseModelId === "proportioned_r15" ? 0 : args[1]*0.2, args[2]*0.5]; break;
          case "belly": pos = [0, baseModelId === "proportioned_r15" ? 0 : -args[1]*0.2, args[2]*0.5]; break;
          case "back": pos = [0, baseModelId === "proportioned_r15" ? 0 : args[1]*0.2, -args[2]*0.5]; rot = [0, Math.PI, 0]; break;
          case "hips": pos = [0, baseModelId === "proportioned_r15" ? 0 : -args[1]*0.4, args[2]*0.5]; break;
          case "left_shoulder": pos = [-args[0]*0.5, args[1]*0.3, 0]; rot = [0, -Math.PI/2, 0]; break;
          case "right_shoulder": pos = [args[0]*0.5, args[1]*0.3, 0]; rot = [0, Math.PI/2, 0]; break;
          case "left_hand": pos = [0, -args[1]*0.5, 0]; rot = [Math.PI/2, 0, 0]; break;
          case "right_hand": pos = [0, -args[1]*0.5, 0]; rot = [Math.PI/2, 0, 0]; break;
          case "left_leg": pos = [0, 0, args[2]*0.5]; break;
          case "right_leg": pos = [0, 0, args[2]*0.5]; break;
          case "left_foot": pos = [0, baseModelId === "proportioned_r15" ? -args[1]*0.4 : -args[1]*0.4, args[2]*0.5]; rot = [0.2, 0, 0]; break;
          case "right_foot": pos = [0, baseModelId === "proportioned_r15" ? -args[1]*0.4 : -args[1]*0.4, args[2]*0.5]; rot = [0.2, 0, 0]; break;
        }

        const partScale: [number, number, number] = [scaleMulti, scaleMulti, scaleMulti];

        const renderShape = () => {
          const m = <meshStandardMaterial color={p.color} roughness={0.5} metalness={0.2} />;
          switch (p.shape) {
            case "horn":
              return (
                <group position={[0, 0, 0]}>
                  <mesh position={[0, 0, 0.1]} rotation={[Math.PI/2, 0, 0]}><coneGeometry args={[0.08, 0.2, 16]} />{m}</mesh>
                  <mesh position={[0, 0.02, 0.22]} rotation={[Math.PI/2 - 0.2, 0, 0]}><coneGeometry args={[0.05, 0.15, 16]} />{m}</mesh>
                  <mesh position={[0, 0.06, 0.32]} rotation={[Math.PI/2 - 0.4, 0, 0]}><coneGeometry args={[0.025, 0.1, 16]} />{m}</mesh>
                </group>
              );
            case "spike":
              if (p.attach === "back") {
                return (
                  <group position={[0, 0, 0]}>
                    <mesh position={[0, 0.2, 0.05]} rotation={[Math.PI/2 + 0.2, 0, 0]}><coneGeometry args={[0.06, 0.2, 4]} />{m}</mesh>
                    <mesh position={[0, 0, 0.05]} rotation={[Math.PI/2, 0, 0]}><coneGeometry args={[0.08, 0.25, 4]} />{m}</mesh>
                    <mesh position={[0, -0.2, 0.05]} rotation={[Math.PI/2 - 0.2, 0, 0]}><coneGeometry args={[0.06, 0.2, 4]} />{m}</mesh>
                  </group>
                );
              }
              return (
                <group position={[0, 0, 0]}>
                  <mesh position={[0, 0.05, 0.1]} rotation={[Math.PI/2, 0, 0]}><coneGeometry args={[0.05, 0.2, 4]} />{m}</mesh>
                  <mesh position={[0.08, -0.05, 0.08]} rotation={[Math.PI/2, 0.3, 0]}><coneGeometry args={[0.04, 0.15, 4]} />{m}</mesh>
                  <mesh position={[-0.08, -0.05, 0.08]} rotation={[Math.PI/2, -0.3, 0]}><coneGeometry args={[0.04, 0.15, 4]} />{m}</mesh>
                </group>
              );
            case "orb":
              return (
                <mesh position={[0, 0, 0.15]}>
                  <sphereGeometry args={[0.12, 24, 24]} />
                  <meshStandardMaterial color={p.color} emissive={p.color} emissiveIntensity={1.5} toneMapped={false} />
                </mesh>
              );
            case "plate":
              return (
                <group position={[0, 0, 0.03]}>
                  <RoundedBox args={[0.3, 0.3, 0.06]} radius={0.02} smoothness={4}>{m}</RoundedBox>
                </group>
              );
            case "band":
              return (
                <group rotation={[Math.PI/2, 0, 0]} position={[0, 0, -args[2]*0.5]}>
                  <mesh><torusGeometry args={[Math.max(args[0], args[2])*0.6, 0.05, 16, 32]} />{m}</mesh>
                </group>
              );
            case "snake":
              return (
                <group position={[0, 0, 0.02]}>
                  <mesh position={[0, 0, 0.05]} rotation={[0, 0, 0]}><cylinderGeometry args={[0.03, 0.04, 0.15, 8]} />{m}</mesh>
                  <mesh position={[0, 0.06, 0.1]} rotation={[0.4, 0, 0]}><cylinderGeometry args={[0.025, 0.03, 0.12, 8]} />{m}</mesh>
                  <mesh position={[0, 0.1, 0.15]} rotation={[0.8, 0, 0]}><cylinderGeometry args={[0.02, 0.025, 0.1, 8]} />{m}</mesh>
                  <mesh position={[0, 0.14, 0.18]} rotation={[1.2, 0, 0]}>
                    <sphereGeometry args={[0.04, 8, 8]} />
                    {m}
                    <mesh position={[-0.015, 0.015, 0.03]}><sphereGeometry args={[0.008]} /><meshBasicMaterial color="#ef4444" /></mesh>
                    <mesh position={[0.015, 0.015, 0.03]}><sphereGeometry args={[0.008]} /><meshBasicMaterial color="#ef4444" /></mesh>
                  </mesh>
                </group>
              );
            case "fin":
              return (
                <mesh position={[0, 0, 0.1]} rotation={[Math.PI/2, 0, 0]}>
                  <coneGeometry args={[0.04, 0.25, 3]} />
                  {m}
                </mesh>
              );
            case "blob":
              return (
                <mesh position={[0, 0, 0.06]}>
                  <sphereGeometry args={[0.12, 16, 16]} />
                  {m}
                </mesh>
              );
            default:
              return null;
          }
        };

        return (
          <group key={i} position={pos} rotation={rot} scale={partScale}>
            {renderShape()}
          </group>
        );
      })}
    </>
  );
}

function RobloxAvatar`

const newContent = content.replace('function RobloxAvatar', overlayStr);
fs.writeFileSync('artifacts/my-skins/src/components/editor/AvatarPreview.tsx', newContent);

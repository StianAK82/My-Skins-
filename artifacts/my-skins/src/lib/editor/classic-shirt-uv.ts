export const CLASSIC_SHIRT_UV = {
  torso_front: { left: 196, top: 118, width: 128, height: 128 },
  torso_back: { left: 338, top: 118, width: 128, height: 128 },
  torso_right: { left: 324, top: 118, width: 14, height: 128 },
  torso_left: { left: 466, top: 118, width: 14, height: 128 },
  torso_top: { left: 196, top: 74, width: 64, height: 44 },
  torso_bottom: { left: 260, top: 74, width: 64, height: 44 },
  right_arm_front: { left: 76, top: 118, width: 32, height: 128 },
  right_arm_back: { left: 140, top: 118, width: 32, height: 128 },
  right_arm_right: { left: 44, top: 118, width: 32, height: 128 },
  right_arm_left: { left: 108, top: 118, width: 32, height: 128 },
  right_arm_top: { left: 44, top: 74, width: 64, height: 44 },
  right_arm_bottom: { left: 108, top: 74, width: 64, height: 44 },
  left_arm_front: { left: 473, top: 288, width: 32, height: 128 },
  left_arm_back: { left: 537, top: 288, width: 32, height: 128 },
  left_arm_right: { left: 441, top: 288, width: 32, height: 128 },
  left_arm_left: { left: 505, top: 288, width: 32, height: 128 },
  left_arm_top: { left: 441, top: 74, width: 64, height: 44 },
  left_arm_bottom: { left: 505, top: 74, width: 64, height: 44 },
} as const;

/** Development-only labelled atlas; callers opt in explicitly, so it is never a production asset. */
export function drawLabelledClassicShirtTexture(ctx: CanvasRenderingContext2D) {
  ctx.clearRect(0, 0, 585, 559);
  Object.entries(CLASSIC_SHIRT_UV).forEach(([name, zone], index) => {
    ctx.fillStyle = `hsl(${(index * 47) % 360} 70% 45%)`;
    ctx.fillRect(zone.left, zone.top, zone.width, zone.height);
    ctx.fillStyle = "white";
    ctx.font = "8px sans-serif";
    ctx.fillText(name, zone.left + 2, zone.top + 10, zone.width - 4);
  });
}

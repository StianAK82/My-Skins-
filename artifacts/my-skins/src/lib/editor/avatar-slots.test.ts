import test from "node:test";
import assert from "node:assert/strict";
import { defaultAvatarState } from "./design-state.ts";
import { getAttachmentPoint, resolveSlotPosition } from "./avatar-slots.ts";

test("attachment points are deterministic for avatar slots", () => {
  const avatar = defaultAvatarState();
  assert.equal(avatar.slots.hair, null);
  const first = getAttachmentPoint("hair", avatar);
  const second = getAttachmentPoint("hair", avatar);
  assert.deepEqual(first, second);
});

test("slot offsets are applied consistently", () => {
  const avatar = defaultAvatarState();
  avatar.slots.hair = { assetId: "hair_spiky_ember", scale: 1, visible: true, color: "#111111", offset: { x: 0.1, y: 0.2, z: -0.1 }, rotation: { x: 0, y: 0, z: 0 } };
  const pos = resolveSlotPosition("hair", avatar);
  assert.equal(Math.round(pos[0] * 10) / 10, 0.1);
  assert.equal(pos[1] > 2.4, true);
});

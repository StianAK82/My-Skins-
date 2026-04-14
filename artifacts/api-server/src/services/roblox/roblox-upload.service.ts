import type { RobloxUploadableProjectType } from "../../lib/lifecycle";

export type RobloxUploadResult = {
  assetId: string;
  moderationStatus?: string;
};

export async function uploadClassicClothingToRoblox(input: {
  accessToken: string;
  title: string;
  itemType: RobloxUploadableProjectType;
  pngUrl: string;
}): Promise<RobloxUploadResult> {
  const endpoint = process.env.ROBLOX_CLASSIC_UPLOAD_URL;

  if (!endpoint) {
    // MVP seam fallback for environments without the real Roblox publishing endpoint wired yet.
    return {
      assetId: `mock-${input.itemType}-${Date.now()}`,
      moderationStatus: "pending_review",
    };
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.accessToken}`,
    },
    body: JSON.stringify({
      title: input.title,
      assetType: input.itemType === "shirt" ? "classic_shirt" : "classic_pants",
      imageUrl: input.pngUrl,
    }),
  });

  if (!response.ok) {
    throw new Error(`ROBLOX_UPLOAD_FAILED:${response.status}`);
  }

  const payload = await response.json() as { assetId?: string; moderationStatus?: string };
  if (!payload.assetId) {
    throw new Error("ROBLOX_UPLOAD_INVALID_RESPONSE");
  }

  return {
    assetId: payload.assetId,
    moderationStatus: payload.moderationStatus,
  };
}

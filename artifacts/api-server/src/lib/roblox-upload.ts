import type { RobloxConnection } from "@workspace/db";

export const SUPPORTED_UPLOAD_PROJECT_TYPES = ["shirt", "pants"] as const;
export type SupportedUploadProjectType = (typeof SUPPORTED_UPLOAD_PROJECT_TYPES)[number];

export type RobloxConnectionState = "connected" | "expired" | "disconnected";

export type RobloxUploadStatus = "queued" | "processing" | "completed" | "failed" | "blocked";

const ROBLOX_UPLOAD_TRANSITIONS: Record<RobloxUploadStatus, RobloxUploadStatus[]> = {
  queued: ["processing", "failed", "blocked"],
  processing: ["completed", "failed"],
  completed: [],
  failed: [],
  blocked: [],
};

export function isSupportedUploadProjectType(value: string): value is SupportedUploadProjectType {
  return SUPPORTED_UPLOAD_PROJECT_TYPES.includes(value as SupportedUploadProjectType);
}

export function isRobloxConnectionExpired(connection: Pick<RobloxConnection, "accessTokenExpiresAt">, now = new Date()): boolean {
  if (!connection.accessTokenExpiresAt) return false;
  return connection.accessTokenExpiresAt.getTime() <= now.getTime() + 15_000;
}

export function resolveRobloxConnectionState(connection: Pick<RobloxConnection, "disconnectedAt" | "accessToken" | "refreshToken" | "accessTokenExpiresAt"> | null, now = new Date()): RobloxConnectionState {
  if (!connection || connection.disconnectedAt) return "disconnected";
  if ((!connection.accessToken && !connection.refreshToken) || isRobloxConnectionExpired({ accessTokenExpiresAt: connection.accessTokenExpiresAt }, now)) {
    return "expired";
  }
  return "connected";
}

export function canTransitionRobloxUploadStatus(from: RobloxUploadStatus, to: RobloxUploadStatus): boolean {
  return ROBLOX_UPLOAD_TRANSITIONS[from].includes(to);
}

export function toRobloxItemType(projectType: SupportedUploadProjectType): "classic_shirt" | "classic_pants" {
  return projectType === "shirt" ? "classic_shirt" : "classic_pants";
}

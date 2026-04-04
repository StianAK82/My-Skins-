export type ProjectType = "shirt" | "pants" | string;

export function resolveExportDimensions(projectType: ProjectType): { width: number; height: number } {
  if (projectType === "shirt" || projectType === "pants") {
    return { width: 585, height: 559 };
  }
  return { width: 585, height: 559 };
}

export type RobloxUploadTerminalReason = "not_configured" | "missing_connection" | "activation_pending";

export function deriveRobloxUploadTerminalState(reason: RobloxUploadTerminalReason): { status: "failed" | "blocked"; message: string } {
  if (reason === "not_configured") {
    return { status: "failed", message: "Roblox upload is not configured on this environment." };
  }
  if (reason === "missing_connection") {
    return { status: "failed", message: "No active Roblox OAuth connection." };
  }
  return { status: "blocked", message: "Upload provider integration is activation-ready but publishing endpoint is not enabled." };
}

export function resolveCreatorIdentity(input: {
  profileDisplayName?: string | null;
  userFirstName?: string | null;
  userDisplayName?: string | null;
  profileUsername?: string | null;
  userEmail?: string | null;
}): { displayName: string; username: string | null } {
  return {
    displayName: input.profileDisplayName ?? input.userFirstName ?? input.userDisplayName ?? "Creator",
    username: input.profileUsername ?? input.userEmail ?? null,
  };
}

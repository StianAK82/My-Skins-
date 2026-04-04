export type ProjectType = "shirt" | "pants" | string;
export type ExportLifecycleStatus = "queued" | "processing" | "completed" | "failed";
export type RobloxUploadLifecycleStatus = "queued" | "processing" | "completed" | "failed" | "blocked";

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

export function resolveRobloxUploadBlockedReason(input: {
  configured: boolean;
  hasConnectionToken: boolean;
  activationReady: boolean;
}): RobloxUploadTerminalReason | null {
  if (!input.configured) return "not_configured";
  if (!input.hasConnectionToken) return "missing_connection";
  if (input.activationReady) return "activation_pending";
  return null;
}

export type ExportJobRecord = {
  jobId: string;
  projectId: string;
  format: string;
  status: string;
  createdAt: Date;
  completedAt: Date | null;
  artifactId: string | null;
  artifactUrl: string | null;
  width: number | null;
  height: number | null;
  size: number | null;
};

export function toExportJobResponse(row: ExportJobRecord) {
  return {
    jobId: row.jobId,
    projectId: row.projectId,
    format: row.format,
    status: row.status as ExportLifecycleStatus,
    createdAt: row.createdAt,
    completedAt: row.completedAt,
    artifact: row.artifactId && row.artifactUrl
      ? {
          id: row.artifactId,
          url: row.artifactUrl,
          width: row.width,
          height: row.height,
          size: row.size,
        }
      : null,
  };
}

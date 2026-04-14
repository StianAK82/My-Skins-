import {
  createRobloxUpload,
  getRobloxLogin,
  getRobloxStatus as getRobloxStatusApi,
  getRobloxUpload,
} from "@workspace/api-client-react";

export async function getRobloxStatus() {
  return getRobloxStatusApi();
}

export async function getRobloxLoginUrl() {
  return getRobloxLogin();
}

export async function uploadToRoblox(projectId: string) {
  return createRobloxUpload({ projectId });
}

export async function retryRobloxUpload(uploadJobId: string) {
  const response = await fetch(`/api/roblox/upload/${uploadJobId}/retry`, {
    method: "POST",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to retry Roblox upload job");
  }

  return response.json();
}

export async function getRobloxUploadStatus(uploadJobId: string) {
  return getRobloxUpload(uploadJobId);
}

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

export async function getRobloxUploadStatus(uploadJobId: string) {
  return getRobloxUpload(uploadJobId);
}

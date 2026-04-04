export async function getRobloxStatus() {
  const response = await fetch("/api/roblox/status", {
    method: "GET",
    credentials: "include",
  });
  return response.json();
}

export async function getRobloxLoginUrl() {
  const response = await fetch("/api/roblox/login", {
    method: "GET",
    credentials: "include",
  });
  return response.json();
}

export async function uploadToRoblox(projectId: string) {
  const response = await fetch("/api/roblox/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ projectId }),
  });
  return response.json();
}

export async function getRobloxUploadStatus(uploadJobId: string) {
  const response = await fetch(`/api/roblox/upload/${uploadJobId}`, {
    method: "GET",
    credentials: "include",
  });
  return response.json();
}

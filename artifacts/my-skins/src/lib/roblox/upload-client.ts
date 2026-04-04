export async function uploadToRoblox(projectId: string) {
  const response = await fetch("/api/roblox/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ projectId }),
  });
  return response.json();
}

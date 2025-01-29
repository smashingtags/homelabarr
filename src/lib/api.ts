const API_BASE_URL = 'http://localhost:3001';  // Use the standard port

async function handleResponse(response: Response) {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error occurred' }));
    throw new Error(error.details || error.error || 'Request failed');
  }
  return response.json();
}

export async function getContainers() {
  const response = await fetch(`${API_BASE_URL}/containers`);
  return handleResponse(response);
}

export async function getContainerLogs(containerId: string, tail: number = 100) {
  const response = await fetch(`${API_BASE_URL}/containers/${containerId}/logs?tail=${tail}`);
  return handleResponse(response);
}

export async function startContainer(containerId: string) {
  const response = await fetch(`${API_BASE_URL}/containers/${containerId}/start`, {
    method: 'POST',
  });
  return handleResponse(response);
}

export async function stopContainer(containerId: string) {
  const response = await fetch(`${API_BASE_URL}/containers/${containerId}/stop`, {
    method: 'POST',
  });
  return handleResponse(response);
}

export async function restartContainer(containerId: string) {
  const response = await fetch(`${API_BASE_URL}/containers/${containerId}/restart`, {
    method: 'POST',
  });
  return handleResponse(response);
}

export async function deployApp(appId: string, config: Record<string, string>) {
  const response = await fetch(`${API_BASE_URL}/deploy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      appId,
      config,
    }),
  });
  return handleResponse(response);
}

export async function removeContainer(containerId: string) {
  const response = await fetch(`${API_BASE_URL}/containers/${containerId}`, {
    method: 'DELETE',
  });
  return handleResponse(response);
}

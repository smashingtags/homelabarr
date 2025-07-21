import { DeploymentMode } from '../types';

const API_BASE_URL = '/api';  // Use relative path for API requests

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('homelabarr_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

async function handleResponse(response: Response) {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error occurred' }));
    
    // Handle authentication errors
    if (response.status === 401) {
      // Token expired or invalid, clear auth state
      localStorage.removeItem('homelabarr_token');
      localStorage.removeItem('homelabarr_user');
      window.location.reload(); // Force re-authentication
    }
    
    throw new Error(error.details || error.error || 'Request failed');
  }
  return response.json();
}

export async function getContainers(includeStats = false) {
  const url = includeStats ? `${API_BASE_URL}/containers?stats=true` : `${API_BASE_URL}/containers`;
  const response = await fetch(url, {
    headers: getAuthHeaders()
  });
  return handleResponse(response);
}

export async function getContainerStats(containerId: string) {
  const response = await fetch(`${API_BASE_URL}/containers/${containerId}/stats`, {
    headers: getAuthHeaders()
  });
  return handleResponse(response);
}

export async function getContainerLogs(containerId: string, tail: number = 100) {
  const response = await fetch(`${API_BASE_URL}/containers/${containerId}/logs?tail=${tail}`, {
    headers: getAuthHeaders()
  });
  const data = await handleResponse(response);
  
  // Parse the logs string into the expected format
  if (data.logs) {
    const logLines = data.logs.split('\n').filter((line: string) => line.trim());
    return logLines.map((line: string) => {
      // Try to extract timestamp if present
      const timestampMatch = line.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z)\s+(.*)$/);
      if (timestampMatch) {
        return {
          timestamp: new Date(timestampMatch[1]).toLocaleString(),
          message: timestampMatch[2]
        };
      }
      
      // If no timestamp, use current time
      return {
        timestamp: new Date().toLocaleString(),
        message: line
      };
    });
  }
  
  return [];
}

export async function startContainer(containerId: string) {
  const response = await fetch(`${API_BASE_URL}/containers/${containerId}/start`, {
    method: 'POST',
    headers: getAuthHeaders()
  });
  return handleResponse(response);
}

export async function stopContainer(containerId: string) {
  const response = await fetch(`${API_BASE_URL}/containers/${containerId}/stop`, {
    method: 'POST',
    headers: getAuthHeaders()
  });
  return handleResponse(response);
}

export async function restartContainer(containerId: string) {
  const response = await fetch(`${API_BASE_URL}/containers/${containerId}/restart`, {
    method: 'POST',
    headers: getAuthHeaders()
  });
  return handleResponse(response);
}

export async function deployApp(
  appId: string,
  config: Record<string, string>,
  mode: DeploymentMode
) {
  const response = await fetch(`${API_BASE_URL}/deploy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    },
    body: JSON.stringify({
      appId,
      config,
      mode,
    }),
  });
  return handleResponse(response);
}

export async function removeContainer(containerId: string) {
  const response = await fetch(`${API_BASE_URL}/containers/${containerId}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  return handleResponse(response);
}

export async function checkUsedPorts() {
  const response = await fetch(`${API_BASE_URL}/ports/check`, {
    headers: getAuthHeaders()
  });
  return handleResponse(response);
}

export async function findAvailablePort(startPort: number = 8000, endPort: number = 9000) {
  const response = await fetch(`${API_BASE_URL}/ports/available?start=${startPort}&end=${endPort}`, {
    headers: getAuthHeaders()
  });
  return handleResponse(response);
}

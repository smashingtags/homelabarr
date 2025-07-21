import { AppTemplate } from '../types';

export const defaultPorts: Record<string, Record<string, number>> = {
  plex: {
    web: 32400,
    dlna: 1900,
    gdm1: 32410,
    gdm2: 32412,
    gdm3: 32413,
    gdm4: 32414
  },
  jellyfin: {
    web: 8096,
    https: 8920,
    dlna: 1900
  },
  emby: {
    web: 8096,
    https: 8920
  },
  sonarr: {
    web: 8989
  },
  radarr: {
    web: 7878
  },
  prowlarr: {
    web: 9696
  },
  qbittorrent: {
    web: 8080,
    tcp: 6881,
    udp: 6881
  },
  nzbget: {
    web: 6789
  },
  traefik: {
    web: 80,
    websecure: 443,
    admin: 8080
  },
  authentik: {
    web: 9000,
    websecure: 9443
  }
};

export function getRequiredPorts(template: AppTemplate): string[] {
  const ports = defaultPorts[template.id];
  if (!ports) return [];
  
  return Object.entries(ports).map(([service, port]) => {
    if (service === 'web') return 'Web Interface';
    if (service === 'websecure') return 'HTTPS';
    if (service === 'admin') return 'Admin Interface';
    return `${service.toUpperCase()} (${port})`;
  });
}

export function getDefaultPort(template: AppTemplate, service: string): number | undefined {
  if (!defaultPorts[template.id]) return undefined;
  const port = defaultPorts[template.id][service];
  return port;
}

export function validatePortConflicts(
  template: AppTemplate,
  ports: Record<string, number>
): string[] {
  const errors: string[] = [];
  const usedPorts = new Set<number>();

  Object.entries(ports).forEach(([, port]) => {
    if (usedPorts.has(port)) {
      errors.push(`Port ${port} is already in use by another service`);
    }
    usedPorts.add(port);

    // Check against default ports of other services
    Object.entries(defaultPorts).forEach(([appId, appPorts]) => {
      if (appId !== template.id) {
        Object.values(appPorts).forEach(defaultPort => {
          if (port === defaultPort) {
            errors.push(`Port ${port} conflicts with default port of ${appId}`);
          }
        });
      }
    });
  });

  return errors;
}
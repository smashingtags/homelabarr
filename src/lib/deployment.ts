import { AppTemplate, DeploymentConfig, DeploymentMode } from '../types';
import { getDefaultPort } from './config';
import yaml from 'yaml';

interface DockerComposeService {
  image: string;
  container_name: string;
  restart: string;
  environment: Record<string, string>;
  volumes: string[];
  ports: string[];
  networks?: string[];
  labels?: string[];
}

interface DockerComposeConfig {
  version: string;
  services: {
    [key: string]: DockerComposeService;
  };
  networks?: {
    proxy?: {
      external: boolean;
    };
  };
}

export function generateDockerCompose(
  template: AppTemplate,
  config: Record<string, string>,
  mode: DeploymentMode
): string {
  const deploymentConfig = processTemplate(template, config, mode);
  return generateYaml(template, deploymentConfig);
}

function processTemplate(
  template: AppTemplate,
  config: Record<string, string>,
  mode: DeploymentMode
): DeploymentConfig {
  const ports: Record<string, number> = {};
  const volumes: Record<string, string> = {};
  const environment: Record<string, string> = {};
  const networks: string[] = [];

  // Process ports
  if (mode.type === 'standard' && template.defaultPorts) {
    Object.entries(template.defaultPorts).forEach(([service, port]) => {
      const configPort = config[`${service}_port`];
      ports[service] = configPort ? parseInt(configPort, 10) : getDefaultPort(template, service) || port;
    });
  }

  // Add proxy network for Traefik mode
  if (mode.type === 'traefik') {
    networks.push('proxy');
  }

  // Process volumes from config
  Object.entries(config).forEach(([key, value]) => {
    if (key.toLowerCase().includes('path')) {
      volumes[key] = value;
    }
  });

  // Process environment variables
  Object.entries(config).forEach(([key, value]) => {
    if (!key.toLowerCase().includes('path')) {
      environment[key.toUpperCase()] = value;
    }
  });

  return {
    mode,
    ports,
    volumes,
    environment,
    networks
  };
}

function generateYaml(template: AppTemplate, config: DeploymentConfig): string {
  const compose: DockerComposeConfig = {
    version: '3',
    services: {
      [template.id]: {
        image: `${template.id}:latest`,
        container_name: template.id,
        restart: 'unless-stopped',
        environment: config.environment,
        volumes: Object.entries(config.volumes).map(([key, value]) => `${value}:${key}`),
        ports: Object.entries(config.ports).map(([key, value]) => `${value}:${key}`),
      }
    },
    networks: config.networks.length > 0 ? { proxy: { external: true } } : undefined
  };

  if (config.mode.type === 'traefik') {
    compose.services[template.id].labels = generateTraefikLabels(template, config.environment.DOMAIN, config.mode.useAuthentik);
  }

  return yaml.stringify(compose);
}

function generateTraefikLabels(
  template: AppTemplate,
  domain: string,
  useAuthentik: boolean
): string[] {
  const labels = [
    "traefik.enable=true",
    `traefik.http.routers.${template.id}.rule=Host(\`${template.id}.${domain}\`)`,
    "traefik.http.routers.${template.id}.entrypoints=websecure",
    "traefik.http.routers.${template.id}.tls.certresolver=letsencrypt",
    `traefik.http.services.${template.id}.loadbalancer.server.port=${getDefaultPort(template, 'web')}`
  ];


  if (useAuthentik) {
    labels.push(`traefik.http.routers.${template.id}.middlewares=authentik@docker`);
  }

  return labels;
}
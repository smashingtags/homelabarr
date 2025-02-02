import { LucideIcon } from 'lucide-react';

export interface AppTemplate {
  id: string;
  name: string;
  description: string;
  category: AppCategory;
  logo: LucideIcon;
  configFields: ConfigField[];
  defaultPorts?: Record<string, number>;
  requiredPorts?: string[];
}

export type AppCategory = 
  | 'infrastructure'
  | 'media'
  | 'downloads'
  | 'storage'
  | 'monitoring'
  | 'automation'
  | 'development'
  | 'security'
  | 'productivity'
  | 'communication';

export interface ConfigField {
  name: string;
  label: string;
  type: 'text' | 'password' | 'number' | 'select';
  required: boolean;
  placeholder?: string;
  options?: string[];
  defaultValue?: string;
  advanced?: boolean;
}

export interface DeploymentMode {
  type: 'standard' | 'traefik';
  useAuthentik: boolean;
}

export interface DeploymentConfig {
  mode: DeploymentMode;
  ports: Record<string, number>;
  volumes: Record<string, string>;
  environment: Record<string, string>;
  networks: string[];
}

export interface ContainerStats {
  cpu: number;
  memory: {
    usage: number;
    limit: number;
    percentage: number;
  };
  network: Record<string, {
    rx_bytes: number;
    tx_bytes: number;
  }>;
  uptime: number;
}

export interface DeployedApp {
  id: string;
  name: string;
  status: 'running' | 'stopped' | 'error';
  url?: string;
  deployedAt: string;
  stats?: ContainerStats;
}
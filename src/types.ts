import { LucideIcon } from 'lucide-react';

export interface AppTemplate {
  id: string;
  name: string;
  description: string;
  category: AppCategory;
  logo: LucideIcon;
  deploymentModes: DeploymentModeType[];
  configFields?: ConfigField[];
  defaultPorts?: Record<string, number>;
  requiredPorts?: string[];
  tags?: string[];
  yamlFile?: string;
  sourceDirectory?: 'traefik' | 'authelia' | 'local';
}

export type AppCategory = 
  | 'media'
  | 'downloads'
  | 'monitoring'
  | 'development'
  | 'home-automation'
  | 'backup-storage'
  | 'web-productivity'
  | 'system-utilities'
  | 'gaming-entertainment'
  | 'all-apps';

export type DeploymentModeType = 'traefik' | 'authelia' | 'local';

export interface AppCategoryDefinition {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  color: string;
}

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
  type: DeploymentModeType;
  name: string;
  description: string;
  features: string[];
  icon: LucideIcon;
  yamlPath?: string;
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

// CLI Integration Types
export interface CLIApplication {
  id: string;
  name: string;
  displayName: string;
  category: string;
  description: string;
  image: string;
  ports: Record<string, number>;
  environment: Record<string, string>;
  volumes: string[];
  networks: string[];
  labels: string[];
  filePath: string;
  healthcheck?: any;
  restart: string;
  requiresTraefik: boolean;
  requiresAuthelia: boolean;
}

export interface ApplicationCatalog {
  success: boolean;
  source: 'cli' | 'templates';
  applications?: Record<string, CLIApplication[]>;
  totalApps?: number;
  categories?: string[];
  availableTemplates?: string[];
  count?: number;
  message?: string;
}
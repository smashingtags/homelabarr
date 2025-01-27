import { LucideIcon } from 'lucide-react';

export interface AppTemplate {
  id: string;
  name: string;
  description: string;
  category: AppCategory;
  logo: LucideIcon;
  configFields: ConfigField[];
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
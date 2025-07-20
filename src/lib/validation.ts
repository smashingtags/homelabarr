import { AppTemplate } from '../types';

export function validateConfig(
  template: AppTemplate,
  config: Record<string, string>,
  isAdvancedMode: boolean
): string[] {
  const errors: string[] = [];

  // Check required fields
  template.configFields.forEach(field => {
    if (field.required && (!field.advanced || isAdvancedMode) && !config[field.name]) {
      errors.push(`${field.label} is required`);
    }
  });

  // Validate paths
  Object.entries(config).forEach(([key, value]) => {
    const field = template.configFields.find(f => f.name === key);
    // Skip domain validation for path format
    if (field?.type === 'text' && key.includes('path') && (value.includes('/path/to') || !value.startsWith('/'))) {
      errors.push(`${field.label} must be a valid absolute path`);
    }
  });

  // Validate ports
  Object.entries(config).forEach(([key, value]) => {
    const field = template.configFields.find(f => f.name === key);
    if (field?.type === 'number') {
      const port = parseInt(value, 10);
      if (isNaN(port) || port < 1 || port > 65535) {
        errors.push(`${field.label} must be a valid port number (1-65535)`);
      }
      
      // Warn about privileged ports (below 1024) but don't block them
      if (port < 1024 && port > 0) {
        errors.push(`Warning: Port ${port} is a privileged port and may require elevated permissions`);
      }
    }
  });

  return errors;
}

import { checkUsedPorts } from './api';

// Async validation for port conflicts
export async function validatePortConflicts(
  template: AppTemplate,
  config: Record<string, string>
): Promise<string[]> {
  const errors: string[] = [];
  
  try {
    const { usedPorts } = await checkUsedPorts();
    
    // Check configured ports against used ports
    Object.entries(config).forEach(([key, value]) => {
      const field = template.configFields.find(f => f.name === key);
      if (field?.type === 'number') {
        const port = parseInt(value, 10);
        if (usedPorts.includes(port)) {
          errors.push(`Port ${port} is already in use by another container`);
        }
      }
    });
    
    // Check template default ports
    if (template.defaultPorts) {
      Object.entries(template.defaultPorts).forEach(([portName, port]) => {
        if (usedPorts.includes(port)) {
          errors.push(`Default port ${port} (${portName}) is already in use`);
        }
      });
    }
  } catch (error) {
    console.warn('Could not check port conflicts:', error);
    // Don't block deployment if port check fails
  }
  
  return errors;
}
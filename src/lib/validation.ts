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
      if (isNaN(port) || port < 1024 || port > 65535) {
        errors.push(`${field.label} must be a valid port number (1-65535)`);
      }
      
      // Check for port conflicts
      if (template.defaultPorts && Object.values(template.defaultPorts).includes(port)) {
        errors.push(`Port ${port} conflicts with a default port`);
      }
    }
  });

  return errors;
}
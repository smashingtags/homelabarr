import { AppTemplate } from '../types';

export function validateConfig(template: AppTemplate, config: Record<string, string>): string[] {
  const errors: string[] = [];

  // Check required fields
  template.configFields.forEach(field => {
    if (field.required && !config[field.name]) {
      errors.push(`${field.label} is required`);
    }
  });

  // Validate paths
  Object.entries(config).forEach(([key, value]) => {
    const field = template.configFields.find(f => f.name === key);
    if (field?.type === 'text' && (value.includes('/path/to') || !value.startsWith('/'))) {
      errors.push(`${field.label} must be a valid absolute path`);
    }
  });

  // Validate ports
  Object.entries(config).forEach(([key, value]) => {
    const field = template.configFields.find(f => f.name === key);
    if (field?.type === 'number') {
      const port = parseInt(value);
      if (isNaN(port) || port < 1 || port > 65535) {
        errors.push(`${field.label} must be a valid port number (1-65535)`);
      }
    }
  });

  return errors;
}
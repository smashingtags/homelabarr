import React, { useState } from 'react';
import { AppTemplate, ConfigField, DeploymentMode } from '../types';
import { X, Settings2, ChevronDown, ChevronUp } from 'lucide-react';
import { validateConfig } from '../lib/validation';

interface DeployModalProps {
  app: AppTemplate;
  onClose: () => void;
  onDeploy: (config: Record<string, string>, mode: DeploymentMode) => void;
  loading: boolean;
}

export function DeployModal({ app, onClose, onDeploy, loading }: DeployModalProps) {
  const [config, setConfig] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<string[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [deploymentMode, setDeploymentMode] = useState<DeploymentMode>({
    type: 'standard',
    useAuthentik: false
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate configuration
    const validationErrors = validateConfig(app, config, showAdvanced);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }
    
    setErrors([]);
    onDeploy(config, deploymentMode);
  };

  const handleInputChange = (field: ConfigField, value: string) => {
    setConfig(prev => ({ ...prev, [field.name]: value }));
    setErrors([]);
  };

  const basicFields = app.configFields.filter(field => !field.advanced);
  const advancedFields = app.configFields.filter(field => field.advanced);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Deploy {app.name}</h2>
          <button 
            onClick={onClose} 
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errors.length > 0 && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 rounded-md">
            <h3 className="text-sm font-medium text-red-800 dark:text-red-200 mb-1">
              Please fix the following errors:
            </h3>
            <ul className="list-disc list-inside text-sm text-red-700 dark:text-red-300">
              {errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Deployment Mode Selection */}
          <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
              Deployment Mode
            </h3>
            <div className="space-y-3">
              <label className="flex items-center space-x-3">
                <input
                  type="radio"
                  checked={deploymentMode.type === 'standard'}
                  onChange={() => setDeploymentMode({ type: 'standard', useAuthentik: false })}
                  className="h-4 w-4 text-blue-600"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Standard (Direct Port Mapping)
                </span>
              </label>
              <label className="flex items-center space-x-3">
                <input
                  type="radio"
                  checked={deploymentMode.type === 'traefik'}
                  onChange={() => setDeploymentMode({ type: 'traefik', useAuthentik: false })}
                  className="h-4 w-4 text-blue-600"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Traefik (Reverse Proxy)
                </span>
              </label>
              {deploymentMode.type === 'traefik' && (
                <label className="flex items-center space-x-3 ml-6 mt-2">
                  <input
                    type="checkbox"
                    checked={deploymentMode.useAuthentik}
                    onChange={(e) => setDeploymentMode(prev => ({
                      ...prev,
                      useAuthentik: e.target.checked
                    }))}
                    className="h-4 w-4 text-blue-600 rounded"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Enable Authentik Authentication
                  </span>
                </label>
              )}
            </div>
          </div>

          {/* Basic Configuration Fields */}
          <div className="space-y-4">
            {basicFields.map((field) => (
              <div key={field.name}>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </label>
                {field.type === 'select' ? (
                  <select
                    name={field.name}
                    required={field.required}
                    onChange={(e) => handleInputChange(field, e.target.value)}
                    className="w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="">Select an option</option>
                    {field.options?.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={field.type}
                    name={field.name}
                    placeholder={field.placeholder}
                    required={field.required}
                    defaultValue={field.defaultValue}
                    onChange={(e) => handleInputChange(field, e.target.value)}
                    className="w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                )}
              </div>
            ))}
          </div>

          {/* Advanced Configuration Toggle */}
          {advancedFields.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
              >
                <Settings2 className="w-4 h-4 mr-1" />
                Advanced Configuration
                {showAdvanced ? (
                  <ChevronUp className="w-4 h-4 ml-1" />
                ) : (
                  <ChevronDown className="w-4 h-4 ml-1" />
                )}
              </button>

              {/* Advanced Configuration Fields */}
              {showAdvanced && (
                <div className="mt-4 space-y-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  {advancedFields.map((field) => (
                    <div key={field.name}>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {field.label}
                        {field.required && <span className="text-red-500 ml-1">*</span>}
                      </label>
                      {field.type === 'select' ? (
                        <select
                          name={field.name}
                          required={field.required}
                          onChange={(e) => handleInputChange(field, e.target.value)}
                          className="w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                        >
                          <option value="">Select an option</option>
                          {field.options?.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={field.type}
                          name={field.name}
                          placeholder={field.placeholder}
                          required={field.required}
                          defaultValue={field.defaultValue}
                          onChange={(e) => handleInputChange(field, e.target.value)}
                          className="w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-blue-400 dark:disabled:bg-blue-800"
              disabled={loading}
            >
              {loading ? 'Deploying...' : 'Deploy'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
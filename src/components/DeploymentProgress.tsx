import React from 'react';
import { CheckCircle, Circle, Loader2 } from 'lucide-react';

interface DeploymentStep {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'completed' | 'error';
}

interface DeploymentProgressProps {
  steps: DeploymentStep[];
  currentStep?: string;
}

export function DeploymentProgress({ steps }: DeploymentProgressProps) {
  return (
    <div className="space-y-3">
      {steps.map((step) => (
        <div key={step.id} className="flex items-center space-x-3">
          <div className="flex-shrink-0">
            {step.status === 'completed' && (
              <CheckCircle className="w-5 h-5 text-green-500" />
            )}
            {step.status === 'active' && (
              <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
            )}
            {step.status === 'pending' && (
              <Circle className="w-5 h-5 text-gray-300" />
            )}
            {step.status === 'error' && (
              <Circle className="w-5 h-5 text-red-500" />
            )}
          </div>
          <div className="flex-1">
            <p className={`text-sm font-medium ${
              step.status === 'completed' ? 'text-green-700 dark:text-green-300' :
              step.status === 'active' ? 'text-blue-700 dark:text-blue-300' :
              step.status === 'error' ? 'text-red-700 dark:text-red-300' :
              'text-gray-500 dark:text-gray-400'
            }`}>
              {step.label}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

// Hook for managing deployment progress
export function useDeploymentProgress() {
  const [steps, setSteps] = React.useState<DeploymentStep[]>([
    { id: 'validate', label: 'Validating configuration', status: 'pending' },
    { id: 'template', label: 'Processing template', status: 'pending' },
    { id: 'network', label: 'Setting up networks', status: 'pending' },
    { id: 'image', label: 'Pulling container image', status: 'pending' },
    { id: 'container', label: 'Creating container', status: 'pending' },
    { id: 'start', label: 'Starting container', status: 'pending' },
  ]);

  const updateStep = (stepId: string, status: DeploymentStep['status']) => {
    setSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, status } : step
    ));
  };

  const resetSteps = () => {
    setSteps(prev => prev.map(step => ({ ...step, status: 'pending' })));
  };

  const setActiveStep = (stepId: string) => {
    setSteps(prev => prev.map(step => ({
      ...step,
      status: step.id === stepId ? 'active' : 
              prev.find(s => s.id === stepId && prev.indexOf(s) > prev.indexOf(step)) ? 'pending' :
              step.status === 'active' ? 'completed' : step.status
    })));
  };

  return {
    steps,
    updateStep,
    resetSteps,
    setActiveStep
  };
}
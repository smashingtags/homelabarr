import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle, XCircle, Clock, Loader2, Terminal, AlertCircle } from 'lucide-react';

interface DeploymentStep {
  step: string;
  status: 'started' | 'progress' | 'completed' | 'failed';
  message: string;
  details?: any;
  timestamp?: string;
}

interface DeploymentProgressModalProps {
  deploymentId: string;
  appId: string;
  onComplete?: (success: boolean, summary?: any) => void;
  onClose?: () => void;
  isOpen: boolean;
}

export function DeploymentProgressModal({ 
  deploymentId, 
  appId, 
  onComplete, 
  onClose,
  isOpen
}: DeploymentProgressModalProps) {
  const [steps, setSteps] = useState<DeploymentStep[]>([]);
  const [currentStep, setCurrentStep] = useState<string>('');
  const [isComplete, setIsComplete] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [clientId, setClientId] = useState<string>('');
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Set up Server-Sent Events connection
    const eventSource = new EventSource('/stream/progress');
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log('🔄 Connected to deployment progress stream');
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('📨 Received SSE event:', event.type, data);
      } catch (error) {
        console.error('❌ Failed to parse SSE message:', error);
      }
    };

    // Handle specific events
    eventSource.addEventListener('connected', (event) => {
      const data = JSON.parse(event.data);
      console.log('✅ SSE Connected:', data);
      
      // Subscribe to this specific deployment
      subscribeToDeployment(data.clientId || generateClientId());
    });

    eventSource.addEventListener('deployment-step', (event) => {
      const data = JSON.parse(event.data);
      console.log('🚀 Deployment step:', data);
      
      if (data.deploymentId === deploymentId) {
        handleDeploymentStep(data);
      }
    });

    eventSource.addEventListener('command-output', (event) => {
      const data = JSON.parse(event.data);
      
      if (data.deploymentId === deploymentId) {
        handleCommandOutput(data);
      }
    });

    eventSource.addEventListener('deployment-complete', (event) => {
      const data = JSON.parse(event.data);
      
      if (data.deploymentId === deploymentId) {
        handleDeploymentComplete(data);
      }
    });

    eventSource.addEventListener('error', (event) => {
      const data = JSON.parse(event.data);
      
      if (data.deploymentId === deploymentId) {
        handleError(data);
      }
    });

    eventSource.onerror = (error) => {
      console.error('❌ SSE Error:', error);
      // Will automatically reconnect
    };

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [deploymentId, isOpen]);

  // Auto-scroll logs to bottom
  useEffect(() => {
    if (logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const generateClientId = () => {
    return `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  const subscribeToDeployment = async (cId: string) => {
    setClientId(cId);
    
    try {
      const response = await fetch(`/stream/deployments/${deploymentId}/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ clientId: cId }),
      });

      if (response.ok) {
        console.log('✅ Subscribed to deployment:', deploymentId);
      } else {
        console.error('❌ Failed to subscribe to deployment');
      }
    } catch (error) {
      console.error('❌ Error subscribing to deployment:', error);
    }
  };

  const handleDeploymentStep = (data: any) => {
    const step: DeploymentStep = {
      step: data.step,
      status: data.status,
      message: data.message,
      details: data.details,
      timestamp: data.timestamp
    };

    setSteps(prev => {
      const existingIndex = prev.findIndex(s => s.step === data.step);
      if (existingIndex >= 0) {
        // Update existing step
        const updated = [...prev];
        updated[existingIndex] = step;
        return updated;
      } else {
        // Add new step
        return [...prev, step];
      }
    });

    if (data.status === 'started' || data.status === 'progress') {
      setCurrentStep(data.step);
    }
  };

  const handleCommandOutput = (data: any) => {
    if (data.output && data.output.trim()) {
      setLogs(prev => [...prev, `${data.type === 'stderr' ? '[ERROR]' : '[INFO]'} ${data.output.trim()}`]);
    }
  };

  const handleDeploymentComplete = (data: any) => {
    setIsComplete(true);
    setIsSuccess(data.success);
    setCurrentStep('');
    
    if (onComplete) {
      onComplete(data.success, data.summary);
    }
  };

  const handleError = (data: any) => {
    setError(data.error);
    setIsComplete(true);
    setIsSuccess(false);
    setCurrentStep('');
    
    if (onComplete) {
      onComplete(false, { error: data.error });
    }
  };

  const getStepIcon = (step: DeploymentStep) => {
    switch (step.status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'started':
      case 'progress':
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
      default:
        return <Clock className="h-5 w-5 text-gray-400" />;
    }
  };

  const getOverallStatus = () => {
    if (error) return 'error';
    if (isComplete && isSuccess) return 'success';
    if (isComplete && !isSuccess) return 'failed';
    return 'in-progress';
  };

  if (!isOpen) return null;

  const status = getOverallStatus();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Deploying {appId}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Deployment ID: {deploymentId}
              </p>
            </div>
            
            {/* Overall Status Indicator */}
            <div className="flex items-center space-x-2">
              {status === 'in-progress' && <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />}
              {status === 'success' && <CheckCircle className="h-5 w-5 text-green-500" />}
              {status === 'failed' && <XCircle className="h-5 w-5 text-red-500" />}
              {status === 'error' && <AlertCircle className="h-5 w-5 text-red-500" />}
              
              <span className={`text-sm font-medium ${
                status === 'success' ? 'text-green-700 dark:text-green-300' :
                status === 'failed' || status === 'error' ? 'text-red-700 dark:text-red-300' :
                'text-blue-700 dark:text-blue-300'
              }`}>
                {status === 'in-progress' ? 'Deploying...' :
                 status === 'success' ? 'Completed' :
                 status === 'failed' ? 'Failed' :
                 'Error'}
              </span>
            </div>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="flex-1 overflow-auto p-6">
          <div className="space-y-4">
            {steps.map((step, index) => (
              <div key={step.step} className="flex items-start space-x-3">
                <div className="flex-shrink-0 mt-0.5">
                  {getStepIcon(step)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className={`text-sm font-medium ${
                      step.status === 'completed' ? 'text-green-700 dark:text-green-300' :
                      step.status === 'failed' ? 'text-red-700 dark:text-red-300' :
                      step.status === 'started' || step.status === 'progress' ? 'text-blue-700 dark:text-blue-300' :
                      'text-gray-700 dark:text-gray-300'
                    }`}>
                      {step.message}
                    </h3>
                    {step.timestamp && (
                      <span className="text-xs text-gray-500">
                        {new Date(step.timestamp).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                  {step.details && (
                    <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                      {JSON.stringify(step.details, null, 2)}
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {/* Current Step Indicator */}
            {!isComplete && currentStep && (
              <div className="flex items-center space-x-3 text-blue-600 dark:text-blue-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">
                  Processing {currentStep}...
                </span>
              </div>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-5 w-5 text-red-500" />
                <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                  Deployment Failed
                </h3>
              </div>
              <p className="text-sm text-red-700 dark:text-red-300 mt-2">
                {error}
              </p>
            </div>
          )}
        </div>

        {/* Logs Section */}
        {logs.length > 0 && (
          <div className="border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setShowLogs(!showLogs)}
              className="w-full p-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-between"
            >
              <div className="flex items-center space-x-2">
                <Terminal className="h-4 w-4" />
                <span>Deployment Logs ({logs.length})</span>
              </div>
              <span className={`transform transition-transform ${showLogs ? 'rotate-180' : ''}`}>
                ▼
              </span>
            </button>
            
            {showLogs && (
              <div 
                ref={logsContainerRef}
                className="max-h-48 overflow-auto bg-gray-900 text-green-400 p-4 text-xs font-mono"
              >
                {logs.map((log, index) => (
                  <div key={index} className="whitespace-pre-wrap">
                    {log}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
          {isComplete && (
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg"
            >
              Close
            </button>
          )}
          
          {!isComplete && (
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg"
            >
              Run in Background
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
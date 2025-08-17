import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Shield, 
  Globe, 
  Settings,
  ExternalLink,
  Info
} from 'lucide-react';

interface PrerequisiteCheck {
  name: string;
  description: string;
  status: 'checking' | 'passed' | 'failed' | 'unknown';
  required: boolean;
  icon: React.ElementType;
  helpUrl?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onProceed: () => void;
}

export const EnhancedMountOnboarding: React.FC<Props> = ({ isOpen, onClose, onProceed }) => {
  const [prerequisites, setPrerequisites] = useState<PrerequisiteCheck[]>([
    {
      name: 'Traefik Reverse Proxy',
      description: 'Required for secure domain routing and SSL certificate management',
      status: 'checking',
      required: true,
      icon: Globe,
      helpUrl: 'https://docs.homelabarr.com/installation/traefik'
    },
    {
      name: 'Authelia Authentication',
      description: 'Required for secure access control and user management',
      status: 'checking',
      required: true,
      icon: Shield,
      helpUrl: 'https://docs.homelabarr.com/installation/authelia'
    },
    {
      name: 'Domain Configuration',
      description: 'Valid domain with DNS pointing to your server',
      status: 'unknown',
      required: true,
      icon: Settings,
      helpUrl: 'https://docs.homelabarr.com/setup/domain'
    }
  ]);

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [userAcknowledged, setUserAcknowledged] = useState(false);

  useEffect(() => {
    if (isOpen) {
      checkPrerequisites();
    }
  }, [isOpen]);

  const checkPrerequisites = async () => {
    // Check for Traefik container
    try {
      const response = await fetch('/containers');
      const data = await response.json();
      
      if (data.success && data.containers) {
        const updatedPrereqs = [...prerequisites];
        
        // Check for Traefik
        const traefikFound = data.containers.some((container: any) => 
          container.Names.some((name: string) => name.toLowerCase().includes('traefik'))
        );
        
        const traefikIndex = updatedPrereqs.findIndex(p => p.name.includes('Traefik'));
        if (traefikIndex !== -1) {
          updatedPrereqs[traefikIndex].status = traefikFound ? 'passed' : 'failed';
        }
        
        // Check for Authelia
        const autheliaFound = data.containers.some((container: any) => 
          container.Names.some((name: string) => name.toLowerCase().includes('authelia'))
        );
        
        const autheliaIndex = updatedPrereqs.findIndex(p => p.name.includes('Authelia'));
        if (autheliaIndex !== -1) {
          updatedPrereqs[autheliaIndex].status = autheliaFound ? 'passed' : 'failed';
        }
        
        setPrerequisites(updatedPrereqs);
      }
    } catch (error) {
      console.error('Failed to check prerequisites:', error);
      // Set all to unknown on error
      setPrerequisites(prev => prev.map(p => ({ ...p, status: 'unknown' })));
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'passed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'checking':
        return <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />;
      default:
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
    }
  };

  const allRequiredPassed = prerequisites
    .filter(p => p.required)
    .every(p => p.status === 'passed');

  const hasFailures = prerequisites.some(p => p.status === 'failed');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                <Settings className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Enhanced Cloud Mount Setup
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Prerequisites check for secure deployment
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <XCircle className="w-6 h-6" />
            </button>
          </div>

          {/* Warning Notice */}
          <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-medium text-amber-800 dark:text-amber-300 mb-1">
                  Important Infrastructure Requirements
                </h3>
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  The Enhanced Cloud Mount requires Traefik and Authelia to be properly configured 
                  for secure access. Without these components, your cloud storage will not be accessible 
                  through your domain and will lack proper authentication.
                </p>
              </div>
            </div>
          </div>

          {/* Prerequisites Check */}
          <div className="space-y-4 mb-6">
            <h3 className="font-medium text-gray-900 dark:text-white">
              Infrastructure Prerequisites
            </h3>
            
            {prerequisites.map((prereq, index) => {
              const Icon = prereq.icon;
              return (
                <div key={index} className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Icon className="w-5 h-5 text-gray-500" />
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-gray-900 dark:text-white">
                          {prereq.name}
                        </span>
                        {prereq.required && (
                          <span className="text-xs bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 px-2 py-0.5 rounded">
                            Required
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {prereq.description}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {prereq.helpUrl && (
                      <a
                        href={prereq.helpUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                    {getStatusIcon(prereq.status)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Installation Guide */}
          {hasFailures && (
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-start space-x-3">
                <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-medium text-blue-800 dark:text-blue-300 mb-2">
                    Quick Installation Guide
                  </h3>
                  <div className="text-sm text-blue-700 dark:text-blue-400 space-y-2">
                    <p>To install the required components, run these commands in your HomelabARR CLI:</p>
                    <div className="bg-white dark:bg-gray-800 p-3 rounded border font-mono text-xs">
                      <div>sudo ./traefik/install.sh</div>
                      <div>sudo ./apps/infrastructure/authelia.yml</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Advanced Options */}
          <div className="mb-6">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            >
              <span>Advanced Options</span>
              <svg 
                className={`w-4 h-4 transform transition-transform ${showAdvanced ? 'rotate-180' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {showAdvanced && (
              <div className="mt-3 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <label className="flex items-start space-x-3">
                  <input
                    type="checkbox"
                    checked={userAcknowledged}
                    onChange={(e) => setUserAcknowledged(e.target.checked)}
                    className="mt-1"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      I understand the risks and want to proceed anyway
                    </span>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Deploying without proper infrastructure may result in security vulnerabilities 
                      and inaccessible services. Only check this if you're testing or have alternative 
                      security measures in place.
                    </p>
                  </div>
                </label>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between space-x-4">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
            
            <div className="flex space-x-3">
              <button
                onClick={checkPrerequisites}
                className="px-4 py-2 text-sm font-medium text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900 rounded-md hover:bg-blue-200 dark:hover:bg-blue-800"
              >
                Recheck
              </button>
              
              <button
                onClick={onProceed}
                disabled={!allRequiredPassed && !userAcknowledged}
                className={`px-4 py-2 text-sm font-medium rounded-md ${
                  allRequiredPassed || userAcknowledged
                    ? 'text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500'
                    : 'text-gray-400 bg-gray-100 dark:bg-gray-700 cursor-not-allowed'
                }`}
              >
                {allRequiredPassed ? 'Deploy Enhanced Mount' : 'Deploy Anyway'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
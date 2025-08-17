import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  ExternalLink, 
  Copy, 
  CheckCircle, 
  AlertCircle,
  Loader,
  ArrowRight,
  ArrowLeft,
  Key,
  Globe,
  RefreshCw
} from 'lucide-react';

interface AuthStep {
  id: string;
  title: string;
  description: string;
  component: React.ComponentType<any>;
}

interface Provider {
  id: string;
  name: string;
  icon: string;
  authType: 'oauth' | 'api_key' | 'token';
  description: string;
  setupComplexity: 'easy' | 'medium' | 'hard';
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  containerId: string;
  provider: string;
  onComplete: (credentials: any) => void;
}

const providers: Record<string, Provider> = {
  // Major Cloud Providers
  gdrive: {
    id: 'gdrive',
    name: 'Google Drive',
    icon: '🔵',
    authType: 'oauth',
    description: 'Personal and Google Workspace accounts',
    setupComplexity: 'medium'
  },
  onedrive: {
    id: 'onedrive',
    name: 'Microsoft OneDrive',
    icon: '🔵',
    authType: 'oauth',
    description: 'Personal and Business accounts',
    setupComplexity: 'medium'
  },
  dropbox: {
    id: 'dropbox',
    name: 'Dropbox',
    icon: '🔵',
    authType: 'oauth',
    description: 'Cloud storage with file syncing',
    setupComplexity: 'medium'
  },
  box: {
    id: 'box',
    name: 'Box',
    icon: '🔵',
    authType: 'oauth',
    description: 'Enterprise cloud storage platform',
    setupComplexity: 'medium'
  },
  pcloud: {
    id: 'pcloud',
    name: 'pCloud',
    icon: '🟢',
    authType: 'oauth',
    description: 'European-based cloud storage',
    setupComplexity: 'easy'
  },

  // Enterprise Cloud Providers
  amazon_s3: {
    id: 'amazon_s3',
    name: 'Amazon S3',
    icon: '🟠',
    authType: 'api_key',
    description: 'Amazon Web Services object storage',
    setupComplexity: 'medium'
  },
  google_cloud: {
    id: 'google_cloud',
    name: 'Google Cloud Storage',
    icon: '🔵',
    authType: 'api_key',
    description: 'Google Cloud Platform storage',
    setupComplexity: 'medium'
  },
  azure_blob: {
    id: 'azure_blob',
    name: 'Azure Blob Storage',
    icon: '🔵',
    authType: 'api_key',
    description: 'Microsoft Azure object storage',
    setupComplexity: 'medium'
  },
  azure_files: {
    id: 'azure_files',
    name: 'Azure Files',
    icon: '🔵',
    authType: 'api_key',
    description: 'Microsoft Azure file shares',
    setupComplexity: 'medium'
  },
  backblaze: {
    id: 'backblaze',
    name: 'Backblaze B2',
    icon: '🔴',
    authType: 'api_key',
    description: 'Object storage with S3-compatible API',
    setupComplexity: 'easy'
  },

  // Additional Popular Providers
  mega: {
    id: 'mega',
    name: 'MEGA',
    icon: '🔴',
    authType: 'api_key',
    description: 'Secure cloud storage with encryption',
    setupComplexity: 'easy'
  },
  yandex: {
    id: 'yandex',
    name: 'Yandex Disk',
    icon: '🟡',
    authType: 'oauth',
    description: 'Russian cloud storage service',
    setupComplexity: 'medium'
  },
  jottacloud: {
    id: 'jottacloud',
    name: 'JottaCloud',
    icon: '🟢',
    authType: 'oauth',
    description: 'Norwegian cloud storage service',
    setupComplexity: 'medium'
  },
  koofr: {
    id: 'koofr',
    name: 'Koofr',
    icon: '🟢',
    authType: 'oauth',
    description: 'European cloud storage platform',
    setupComplexity: 'easy'
  },
  seafile: {
    id: 'seafile',
    name: 'Seafile',
    icon: '🔵',
    authType: 'api_key',
    description: 'Self-hosted file sync and share',
    setupComplexity: 'medium'
  },

  // Protocol-based Providers
  webdav: {
    id: 'webdav',
    name: 'WebDAV',
    icon: '🌐',
    authType: 'api_key',
    description: 'Web-based file access protocol',
    setupComplexity: 'easy'
  },
  sftp: {
    id: 'sftp',
    name: 'SFTP',
    icon: '🔒',
    authType: 'api_key',
    description: 'Secure File Transfer Protocol',
    setupComplexity: 'easy'
  },
  ftp: {
    id: 'ftp',
    name: 'FTP',
    icon: '📁',
    authType: 'api_key',
    description: 'File Transfer Protocol',
    setupComplexity: 'easy'
  }
};

// OAuth Setup Component
const OAuthSetup: React.FC<{ provider: Provider; containerId: string; onComplete: (creds: any) => void }> = ({ 
  provider, 
  containerId, 
  onComplete 
}) => {
  const [authUrl, setAuthUrl] = useState<string>('');
  const [authCode, setAuthCode] = useState<string>('');
  const [step, setStep] = useState<'generate' | 'authorize' | 'complete'>('generate');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const generateAuthUrl = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch(`/enhanced-mount/${containerId}/auth/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: provider.id })
      });
      
      const result = await response.json();
      if (result.success) {
        setAuthUrl(result.data.auth_url);
        setStep('authorize');
      } else {
        setError(result.error || 'Failed to generate auth URL');
      }
    } catch (err) {
      setError('Network error - ensure the container is running');
    } finally {
      setLoading(false);
    }
  };

  const completeAuth = async () => {
    if (!authCode.trim()) {
      setError('Please enter the authorization code');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const response = await fetch(`/enhanced-mount/${containerId}/auth/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          provider: provider.id,
          auth_code: authCode.trim()
        })
      });
      
      const result = await response.json();
      if (result.success) {
        setStep('complete');
        onComplete(result.data);
      } else {
        setError(result.error || 'Authentication failed');
      }
    } catch (err) {
      setError('Network error during authentication');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="space-y-6">
      {/* Progress Indicator */}
      <div className="flex items-center justify-center space-x-4">
        <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
          step === 'generate' ? 'bg-blue-600 text-white' : 'bg-green-600 text-white'
        }`}>
          {step === 'generate' ? '1' : <CheckCircle className="w-4 h-4" />}
        </div>
        <div className={`h-0.5 w-12 ${step !== 'generate' ? 'bg-green-600' : 'bg-gray-300'}`} />
        <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
          step === 'authorize' ? 'bg-blue-600 text-white' : 
          step === 'complete' ? 'bg-green-600 text-white' : 'bg-gray-300 text-gray-600'
        }`}>
          {step === 'complete' ? <CheckCircle className="w-4 h-4" /> : '2'}
        </div>
        <div className={`h-0.5 w-12 ${step === 'complete' ? 'bg-green-600' : 'bg-gray-300'}`} />
        <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
          step === 'complete' ? 'bg-green-600 text-white' : 'bg-gray-300 text-gray-600'
        }`}>
          {step === 'complete' ? <CheckCircle className="w-4 h-4" /> : '3'}
        </div>
      </div>

      {/* Step Content */}
      {step === 'generate' && (
        <div className="text-center space-y-4">
          <div className="text-4xl mb-4">{provider.icon}</div>
          <h3 className="text-lg font-medium">Generate Authorization URL</h3>
          <p className="text-gray-600 dark:text-gray-400">
            Click below to generate a secure authorization URL for {provider.name}
          </p>
          <button
            onClick={generateAuthUrl}
            disabled={loading}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? <Loader className="w-4 h-4 mr-2 animate-spin" /> : <Key className="w-4 h-4 mr-2" />}
            Generate Auth URL
          </button>
        </div>
      )}

      {step === 'authorize' && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-center">Authorize with {provider.name}</h3>
          
          {/* Auth URL */}
          <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <label className="block text-sm font-medium mb-2">1. Click this authorization URL:</label>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={authUrl}
                readOnly
                className="flex-1 p-2 text-sm border rounded bg-white dark:bg-gray-800 font-mono"
              />
              <button
                onClick={() => copyToClipboard(authUrl)}
                className="p-2 text-gray-500 hover:text-gray-700"
                title="Copy URL"
              >
                <Copy className="w-4 h-4" />
              </button>
              <a
                href={authUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 text-blue-500 hover:text-blue-700"
                title="Open in new tab"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Auth Code Input */}
          <div className="space-y-2">
            <label className="block text-sm font-medium">2. Paste the authorization code here:</label>
            <textarea
              value={authCode}
              onChange={(e) => setAuthCode(e.target.value)}
              placeholder="Paste the code you received after authorization..."
              className="w-full p-3 border rounded-md dark:bg-gray-800 font-mono text-sm"
              rows={3}
            />
          </div>

          {/* Complete Button */}
          <button
            onClick={completeAuth}
            disabled={loading || !authCode.trim()}
            className="w-full flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? <Loader className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
            Complete Authentication
          </button>
        </div>
      )}

      {step === 'complete' && (
        <div className="text-center space-y-4">
          <CheckCircle className="w-16 h-16 text-green-600 mx-auto" />
          <h3 className="text-lg font-medium text-green-600">Authentication Successful!</h3>
          <p className="text-gray-600 dark:text-gray-400">
            {provider.name} has been successfully configured and is ready to use.
          </p>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
            <span className="text-red-700 dark:text-red-300">{error}</span>
          </div>
        </div>
      )}
    </div>
  );
};

// API Key Setup Component
const ApiKeySetup: React.FC<{ provider: Provider; containerId: string; onComplete: (creds: any) => void }> = ({ 
  provider, 
  containerId, 
  onComplete 
}) => {
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const credentialFields: Record<string, { field: string; label: string; type: string; help: string }[]> = {
    backblaze: [
      { 
        field: 'account_id', 
        label: 'Account ID', 
        type: 'text',
        help: 'Found in your Backblaze B2 account settings'
      },
      { 
        field: 'application_key', 
        label: 'Application Key', 
        type: 'password',
        help: 'Create in Account → App Keys → Create a New App Key'
      },
      { 
        field: 'bucket', 
        label: 'Bucket Name', 
        type: 'text',
        help: 'Create a bucket first, then enter its name here'
      }
    ],
    amazon_s3: [
      {
        field: 'access_key_id',
        label: 'Access Key ID',
        type: 'text',
        help: 'AWS access key from IAM user or service account'
      },
      {
        field: 'secret_access_key',
        label: 'Secret Access Key',
        type: 'password',
        help: 'AWS secret key corresponding to the access key'
      },
      {
        field: 'region',
        label: 'Region',
        type: 'text',
        help: 'AWS region (e.g., us-east-1, eu-west-1)'
      },
      {
        field: 'bucket',
        label: 'Bucket Name',
        type: 'text',
        help: 'S3 bucket name (must be globally unique)'
      }
    ],
    google_cloud: [
      {
        field: 'service_account_file',
        label: 'Service Account JSON',
        type: 'textarea',
        help: 'Upload your Google Cloud service account JSON key file content'
      },
      {
        field: 'project_number',
        label: 'Project Number',
        type: 'text',
        help: 'Google Cloud project number (numeric ID)'
      },
      {
        field: 'bucket',
        label: 'Bucket Name',
        type: 'text',
        help: 'Google Cloud Storage bucket name'
      }
    ],
    azure_blob: [
      {
        field: 'account',
        label: 'Storage Account',
        type: 'text',
        help: 'Azure storage account name'
      },
      {
        field: 'key',
        label: 'Account Key',
        type: 'password',
        help: 'Azure storage account access key'
      },
      {
        field: 'container',
        label: 'Container Name',
        type: 'text',
        help: 'Azure blob container name'
      }
    ],
    azure_files: [
      {
        field: 'account',
        label: 'Storage Account',
        type: 'text',
        help: 'Azure storage account name'
      },
      {
        field: 'key',
        label: 'Account Key',
        type: 'password',
        help: 'Azure storage account access key'
      },
      {
        field: 'share_name',
        label: 'File Share Name',
        type: 'text',
        help: 'Azure Files share name'
      }
    ],
    mega: [
      {
        field: 'user',
        label: 'Email/Username',
        type: 'text',
        help: 'Your MEGA account email or username'
      },
      {
        field: 'pass',
        label: 'Password',
        type: 'password',
        help: 'Your MEGA account password'
      }
    ],
    seafile: [
      {
        field: 'url',
        label: 'Server URL',
        type: 'text',
        help: 'Seafile server URL (e.g., https://seafile.example.com)'
      },
      {
        field: 'user',
        label: 'Username',
        type: 'text',
        help: 'Seafile username or email'
      },
      {
        field: 'pass',
        label: 'Password',
        type: 'password',
        help: 'Seafile account password'
      },
      {
        field: 'library',
        label: 'Library Name',
        type: 'text',
        help: 'Seafile library/repository name'
      }
    ],
    webdav: [
      {
        field: 'url',
        label: 'WebDAV URL',
        type: 'text',
        help: 'WebDAV server URL (e.g., https://webdav.example.com/remote.php/dav/files/username/)'
      },
      {
        field: 'user',
        label: 'Username',
        type: 'text',
        help: 'WebDAV username'
      },
      {
        field: 'pass',
        label: 'Password',
        type: 'password',
        help: 'WebDAV password or app password'
      }
    ],
    sftp: [
      {
        field: 'host',
        label: 'Host',
        type: 'text',
        help: 'SFTP server hostname or IP address'
      },
      {
        field: 'port',
        label: 'Port',
        type: 'text',
        help: 'SFTP port (default: 22)'
      },
      {
        field: 'user',
        label: 'Username',
        type: 'text',
        help: 'SFTP username'
      },
      {
        field: 'pass',
        label: 'Password',
        type: 'password',
        help: 'SFTP password (or leave empty if using key auth)'
      },
      {
        field: 'key_file',
        label: 'Private Key Path',
        type: 'text',
        help: 'Path to SSH private key file (optional)'
      }
    ],
    ftp: [
      {
        field: 'host',
        label: 'Host',
        type: 'text',
        help: 'FTP server hostname or IP address'
      },
      {
        field: 'port',
        label: 'Port',
        type: 'text',
        help: 'FTP port (default: 21)'
      },
      {
        field: 'user',
        label: 'Username',
        type: 'text',
        help: 'FTP username'
      },
      {
        field: 'pass',
        label: 'Password',
        type: 'password',
        help: 'FTP password'
      }
    ]
  };

  const fields = credentialFields[provider.id] || [];

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch(`/enhanced-mount/${containerId}/auth/api-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          provider: provider.id,
          credentials
        })
      });
      
      const result = await response.json();
      if (result.success) {
        onComplete(result.data);
      } else {
        setError(result.error || 'Failed to configure credentials');
      }
    } catch (err) {
      setError('Network error during configuration');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="text-4xl mb-4">{provider.icon}</div>
        <h3 className="text-lg font-medium">Configure {provider.name}</h3>
        <p className="text-gray-600 dark:text-gray-400">
          Enter your API credentials below
        </p>
      </div>

      <div className="space-y-4">
        {fields.map((field) => (
          <div key={field.field}>
            <label className="block text-sm font-medium mb-1">
              {field.label}
            </label>
            {field.type === 'textarea' ? (
              <textarea
                value={credentials[field.field] || ''}
                onChange={(e) => setCredentials(prev => ({
                  ...prev,
                  [field.field]: e.target.value
                }))}
                className="w-full p-3 border rounded-md dark:bg-gray-800 font-mono text-sm"
                placeholder={`Enter your ${field.label.toLowerCase()}`}
                rows={6}
              />
            ) : (
              <input
                type={field.type}
                value={credentials[field.field] || ''}
                onChange={(e) => setCredentials(prev => ({
                  ...prev,
                  [field.field]: e.target.value
                }))}
                className="w-full p-3 border rounded-md dark:bg-gray-800"
                placeholder={`Enter your ${field.label.toLowerCase()}`}
              />
            )}
            <p className="text-xs text-gray-500 mt-1">{field.help}</p>
          </div>
        ))}
      </div>

      <button
        onClick={handleSubmit}
        disabled={loading || !fields.every(f => credentials[f.field]?.trim())}
        className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? <Loader className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
        Configure Provider
      </button>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
            <span className="text-red-700 dark:text-red-300">{error}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export const RcloneAuthWizard: React.FC<Props> = ({ 
  isOpen, 
  onClose, 
  containerId, 
  provider: providerId, 
  onComplete 
}) => {
  const provider = providers[providerId];

  if (!isOpen || !provider) return null;

  const handleComplete = (credentials: any) => {
    onComplete(credentials);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <Shield className="w-6 h-6 text-blue-600" />
              <div>
                <h2 className="text-xl font-semibold">Setup {provider.name}</h2>
                <p className="text-sm text-gray-500">{provider.description}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <span className="sr-only">Close</span>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Auth Component */}
          {provider.authType === 'oauth' ? (
            <OAuthSetup 
              provider={provider} 
              containerId={containerId} 
              onComplete={handleComplete}
            />
          ) : (
            <ApiKeySetup 
              provider={provider} 
              containerId={containerId} 
              onComplete={handleComplete}
            />
          )}
        </div>
      </div>
    </div>
  );
};
import { useState, useEffect } from 'react';
import { Network, RefreshCw, AlertCircle } from 'lucide-react';
import { checkUsedPorts, findAvailablePort } from '../lib/api';

interface PortManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PortManager({ isOpen, onClose }: PortManagerProps) {
  const [usedPorts, setUsedPorts] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestedPort, setSuggestedPort] = useState<number | null>(null);

  const fetchUsedPorts = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { usedPorts: ports } = await checkUsedPorts();
      setUsedPorts(ports);
    } catch (err) {
      setError('Failed to fetch port information');
    } finally {
      setLoading(false);
    }
  };

  const findNextAvailablePort = async () => {
    try {
      const { availablePort } = await findAvailablePort(8000, 9000);
      setSuggestedPort(availablePort);
    } catch (err) {
      setError('No available ports found in range 8000-9000');
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchUsedPorts();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full p-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center">
            <Network className="w-5 h-5 mr-2 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Port Manager</h2>
          </div>
          <button 
            onClick={onClose} 
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          >
            ×
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 rounded-md flex items-center">
            <AlertCircle className="w-4 h-4 text-red-600 mr-2" />
            <span className="text-red-700 dark:text-red-300">{error}</span>
          </div>
        )}

        <div className="space-y-6">
          {/* Used Ports Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Currently Used Ports ({usedPorts.length})
              </h3>
              <button
                onClick={fetchUsedPorts}
                disabled={loading}
                className="flex items-center px-3 py-1 text-sm bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-md hover:bg-blue-200 dark:hover:bg-blue-800 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
            
            {loading ? (
              <div className="text-gray-500 dark:text-gray-400">Loading...</div>
            ) : (
              <div className="grid grid-cols-8 gap-2 max-h-40 overflow-y-auto">
                {usedPorts.map(port => (
                  <span
                    key={port}
                    className="px-2 py-1 text-xs bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded text-center"
                  >
                    {port}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Port Finder Section */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
              Find Available Port
            </h3>
            <div className="flex items-center space-x-3">
              <button
                onClick={findNextAvailablePort}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                Find Next Available Port
              </button>
              {suggestedPort && (
                <div className="flex items-center">
                  <span className="text-gray-600 dark:text-gray-400 mr-2">Suggested:</span>
                  <span className="px-3 py-1 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded font-mono">
                    {suggestedPort}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Port Ranges Info */}
          <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
            <p><strong>Common Port Ranges:</strong></p>
            <p>• System ports: 1-1023 (requires elevated permissions)</p>
            <p>• User ports: 1024-49151 (safe for most applications)</p>
            <p>• Dynamic ports: 49152-65535 (temporary/ephemeral)</p>
          </div>
        </div>
      </div>
    </div>
  );
}
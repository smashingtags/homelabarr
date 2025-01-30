import { useState } from 'react';
import { DeployedApp } from '../types';
import { ContainerControls } from './ContainerControls';
import { ContainerStats } from './ContainerStats';
import { Terminal, ChevronDown, ChevronUp } from 'lucide-react';

interface DeployedAppCardProps {
  app: DeployedApp;
  onViewLogs: () => void;
  onRefresh: () => void;
}

export function DeployedAppCard({ app, onViewLogs, onRefresh }: DeployedAppCardProps) {
  const [showStats, setShowStats] = useState(false);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <button
              onClick={() => setShowStats(!showStats)}
              className="mr-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              title={showStats ? 'Hide Stats' : 'Show Stats'}
            >
              {showStats ? (
                <ChevronUp className="w-5 h-5" />
              ) : (
                <ChevronDown className="w-5 h-5" />
              )}
            </button>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {app.name}
            </h3>
          </div>
          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
            app.status === 'running'
              ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100'
              : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-100'
          }`}>
            {app.status}
          </span>
        </div>

        <div className="space-y-4">
          {app.url && (
            <div>
              <a
                href={app.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
              >
                {app.url}
              </a>
            </div>
          )}

          <div className="text-sm text-gray-500 dark:text-gray-400">
            Deployed: {new Date(app.deployedAt).toLocaleString()}
          </div>

          <div className="flex justify-between items-center pt-4 border-t border-gray-200 dark:border-gray-700">
            <ContainerControls
              containerId={app.id}
              status={app.status}
              onAction={onRefresh}
            />
            <button
              onClick={onViewLogs}
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
              title="View Logs"
            >
              <Terminal className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {showStats && app.stats && (
        <div className="border-t border-gray-200 dark:border-gray-700">
          <ContainerStats stats={app.stats} />
        </div>
      )}
    </div>
  );
}
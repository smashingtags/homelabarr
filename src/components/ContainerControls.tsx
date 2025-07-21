import { useState } from 'react';
import { Play, Square, RefreshCw, Trash2 } from 'lucide-react';
import { startContainer, stopContainer, restartContainer, removeContainer } from '../lib/api';
import { useNotifications } from '../contexts/NotificationContext';

interface ContainerControlsProps {
  containerId: string;
  status: string;
  onAction: () => void;
}

export function ContainerControls({ containerId, status, onAction }: ContainerControlsProps) {

  const handleAction = async (action: () => Promise<void>) => {

    try {
      await action();
      success('Action Completed', successMessage);
      onAction();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      error(`Failed to ${actionName}`, errorMessage);
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="flex space-x-2">
      {status !== 'running' && (
        <button
          onClick={() => handleAction(
            () => startContainer(containerId),
            'start',
            'Container started successfully'
          )}
          disabled={loadingAction === 'start'}
          className="p-1 text-green-600 hover:text-green-800 disabled:opacity-50"
          title="Start"
        >
          <Play className={`w-4 h-4 ${loadingAction === 'start' ? 'animate-pulse' : ''}`} />
        </button>
      )}
      {status === 'running' && (
        <button
          onClick={() => handleAction(
            () => stopContainer(containerId),
            'stop',
            'Container stopped successfully'
          )}
          disabled={loadingAction === 'stop'}
          className="p-1 text-red-600 hover:text-red-800 disabled:opacity-50"
          title="Stop"
        >
          <Square className={`w-4 h-4 ${loadingAction === 'stop' ? 'animate-pulse' : ''}`} />
        </button>
      )}
      <button
        onClick={() => handleAction(
          () => restartContainer(containerId),
          'restart',
          'Container restarted successfully'
        )}
        disabled={loadingAction === 'restart'}
        className="p-1 text-blue-600 hover:text-blue-800 disabled:opacity-50"
        title="Restart"
      >
        <RefreshCw className={`w-4 h-4 ${loadingAction === 'restart' ? 'animate-spin' : ''}`} />
      </button>
      <button
        onClick={() => handleAction(
          () => removeContainer(containerId),
          'remove',
          'Container removed successfully'
        )}
        disabled={loadingAction === 'remove'}
        className="p-1 text-gray-600 hover:text-gray-800 disabled:opacity-50"
        title="Remove"
      >
        <Trash2 className={`w-4 h-4 ${loadingAction === 'remove' ? 'animate-pulse' : ''}`} />
      </button>
    </div>
  );
}
import { Play, Square, RefreshCw, Trash2 } from 'lucide-react';
import { startContainer, stopContainer, restartContainer, removeContainer } from '../lib/api';

interface ContainerControlsProps {
  containerId: string;
  status: string;
  onAction: () => void;
}

export function ContainerControls({ containerId, status, onAction }: ContainerControlsProps) {
  const handleAction = async (action: () => Promise<void>) => {
    try {
      await action();
      onAction();
    } catch (error) {
      console.error('Error performing container action:', error);
    }
  };

  return (
    <div className="flex space-x-2">
      {status !== 'running' && (
        <button
          onClick={() => handleAction(() => startContainer(containerId))}
          className="p-1 text-green-600 hover:text-green-800"
          title="Start"
        >
          <Play className="w-4 h-4" />
        </button>
      )}
      {status === 'running' && (
        <button
          onClick={() => handleAction(() => stopContainer(containerId))}
          className="p-1 text-red-600 hover:text-red-800"
          title="Stop"
        >
          <Square className="w-4 h-4" />
        </button>
      )}
      <button
        onClick={() => handleAction(() => restartContainer(containerId))}
        className="p-1 text-blue-600 hover:text-blue-800"
        title="Restart"
      >
        <RefreshCw className="w-4 h-4" />
      </button>
      <button
        onClick={() => handleAction(() => removeContainer(containerId))}
        className="p-1 text-gray-600 hover:text-gray-800"
        title="Remove"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}
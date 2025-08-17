import { AppTemplate } from '../types';
import { Shield, Network, Monitor } from 'lucide-react';

interface AppCardProps {
  app: AppTemplate;
  onDeploy: (app: AppTemplate) => void;
}

export function AppCard({ app, onDeploy }: AppCardProps) {
  const Icon = app.logo;
  
  // Deployment mode icons and labels
  const deploymentModeInfo = {
    traefik: { icon: Network, label: 'Traefik', color: 'text-green-600 bg-green-50' },
    authelia: { icon: Shield, label: 'Authelia', color: 'text-purple-600 bg-purple-50' },
    local: { icon: Monitor, label: 'Local', color: 'text-blue-600 bg-blue-50' },
    standard: { icon: Monitor, label: 'Standard', color: 'text-gray-600 bg-gray-50' }
  };
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 hover:shadow-lg transition-all duration-200 border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600">
      <div className="flex items-center mb-4">
        <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <Icon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
        </div>
        <h3 className="ml-3 text-lg font-semibold text-gray-900 dark:text-white">{app.name}</h3>
      </div>
      
      <p className="text-gray-600 dark:text-gray-300 mb-4 text-sm leading-relaxed">
        {app.description}
      </p>
      
      {/* Deployment Mode Badges */}
      {app.deploymentModes && app.deploymentModes.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
            Deployment Modes
          </p>
          <div className="flex flex-wrap gap-2">
            {app.deploymentModes.map(mode => {
              const modeInfo = deploymentModeInfo[mode];
              if (!modeInfo) return null;
              
              const ModeIcon = modeInfo.icon;
              return (
                <div
                  key={mode}
                  className={`flex items-center px-2 py-1 rounded-full text-xs font-medium ${modeInfo.color} dark:bg-gray-700 dark:text-gray-300`}
                >
                  <ModeIcon className="w-3 h-3 mr-1" />
                  {modeInfo.label}
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      {/* Category Badge */}
      <div className="mb-4">
        <span className="inline-block px-2 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full capitalize">
          {app.category}
        </span>
      </div>
      
      <button
        onClick={() => onDeploy(app)}
        className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white py-2.5 px-4 rounded-md transition-all duration-200 font-medium shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
      >
        Deploy Application
      </button>
    </div>
  );
}
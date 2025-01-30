import { AppTemplate } from '../types';

interface AppCardProps {
  app: AppTemplate;
  onDeploy: (app: AppTemplate) => void;
}

export function AppCard({ app, onDeploy }: AppCardProps) {
  const Icon = app.logo;
  
  return (
    <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
      <div className="flex items-center mb-4">
        <div className="p-2 bg-blue-50 rounded-lg">
          <Icon className="w-6 h-6 text-blue-600" />
        </div>
        <h3 className="ml-3 text-lg font-semibold text-gray-900">{app.name}</h3>
      </div>
      <p className="text-gray-600 mb-4">{app.description}</p>
      <button
        onClick={() => onDeploy(app)}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
      >
        Deploy
      </button>
    </div>
  );
}
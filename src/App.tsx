import React, { useState, useEffect } from 'react';
import { AppTemplate, AppCategory, DeployedApp } from './types';
import { appTemplates } from './data/templates';
import { AppCard } from './components/AppCard';
import { DeployModal } from './components/DeployModal';
import { LogViewer } from './components/LogViewer';
import { ContainerControls } from './components/ContainerControls';
import { ContainerStats } from './components/ContainerStats';
import { ThemeToggle } from './components/ThemeToggle';
import { HelpModal } from './components/HelpModal';
import { Leaderboard } from './components/Leaderboard';
import { 
  LayoutGrid,
  Network,
  Video,
  Download,
  HardDrive,
  Gauge,
  Home,
  Code,
  Lock,
  FileText,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Terminal,
  HelpCircle,
  Trophy
} from 'lucide-react';
import { deployApp, getContainers } from './lib/api';

const categories: { id: AppCategory | 'leaderboard'; name: string; icon: React.ElementType }[] = [
  { id: 'infrastructure', name: 'Infrastructure', icon: Network },
  { id: 'media', name: 'Media', icon: Video },
  { id: 'downloads', name: 'Downloads', icon: Download },
  { id: 'storage', name: 'Storage', icon: HardDrive },
  { id: 'monitoring', name: 'Monitoring', icon: Gauge },
  { id: 'automation', name: 'Automation', icon: Home },
  { id: 'development', name: 'Development', icon: Code },
  { id: 'security', name: 'Security', icon: Lock },
  { id: 'productivity', name: 'Productivity', icon: FileText },
  { id: 'communication', name: 'Communication', icon: MessageSquare },
  { id: 'leaderboard', name: 'Leaderboard', icon: Trophy }
];

export default function App() {
  const [selectedApp, setSelectedApp] = useState<AppTemplate | null>(null);
  const [deployedApps, setDeployedApps] = useState<DeployedApp[]>([]);
  const [activeCategory, setActiveCategory] = useState<AppCategory | 'all' | 'leaderboard'>('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedContainerLogs, setSelectedContainerLogs] = useState<string | null>(null);
  const [expandedStats, setExpandedStats] = useState<Record<string, boolean>>({});
  const [helpModalOpen, setHelpModalOpen] = useState(false);

  const filteredApps = appTemplates.filter(
    app => activeCategory === 'all' || app.category === activeCategory
  );

  useEffect(() => {
    fetchContainers();
    const interval = setInterval(fetchContainers, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchContainers = async () => {
    try {
      const containers = await getContainers();
      const apps = containers.map((container: any) => ({
        id: container.Id,
        name: container.Names[0].replace('/', ''),
        status: container.State,
        deployedAt: new Date(container.Created * 1000).toISOString(),
        url: `http://localhost:${container.Ports[0]?.PublicPort || ''}`,
        stats: container.stats
      }));
      setDeployedApps(apps);
    } catch (err) {
      setError('Failed to fetch containers');
    }
  };

  const handleDeploy = async (config: Record<string, string>) => {
    if (!selectedApp) return;
    
    setLoading(true);
    setError(null);
    
    try {
      await deployApp(selectedApp.id, config);
      await fetchContainers();
      setSelectedApp(null);
    } catch (err) {
      setError('Failed to deploy application');
    } finally {
      setLoading(false);
    }
  };

  const toggleStats = (containerId: string) => {
    setExpandedStats(prev => ({
      ...prev,
      [containerId]: !prev[containerId]
    }));
  };

  const renderContent = () => {
    if (activeCategory === 'leaderboard') {
      return <Leaderboard deployedApps={deployedApps} />;
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredApps.map(app => (
          <AppCard
            key={app.id}
            app={app}
            onDeploy={() => setSelectedApp(app)}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Homelabarr</h1>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setHelpModalOpen(true)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
              aria-label="Help"
            >
              <HelpCircle className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-4 p-4 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-100 rounded-md">
            {error}
          </div>
        )}

        {/* Category Navigation */}
        <div className="flex flex-wrap gap-4 mb-8">
          <button
            onClick={() => setActiveCategory('all')}
            className={`flex items-center px-4 py-2 rounded-md ${
              activeCategory === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            <LayoutGrid className="w-5 h-5 mr-2" />
            All Apps
          </button>
          {categories.map(category => {
            const Icon = category.icon;
            return (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={`flex items-center px-4 py-2 rounded-md ${
                  activeCategory === category.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <Icon className="w-5 h-5 mr-2" />
                {category.name}
              </button>
            );
          })}
        </div>

        {/* Deployed Apps Section */}
        {deployedApps.length > 0 && activeCategory !== 'leaderboard' && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Deployed Applications
            </h2>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      URL
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Deployed At
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {deployedApps.map(app => (
                    <React.Fragment key={app.id}>
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <button
                              onClick={() => toggleStats(app.id)}
                              className="mr-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                            >
                              {expandedStats[app.id] ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </button>
                            <span className="font-medium text-gray-900 dark:text-white">
                              {app.name}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            app.status === 'running' 
                              ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100'
                              : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-100'
                          }`}>
                            {app.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 dark:text-blue-400">
                          <a href={app.url} target="_blank" rel="noopener noreferrer">
                            {app.url}
                          </a>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {new Date(app.deployedAt).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                          <div className="flex justify-end items-center space-x-2">
                            <ContainerControls
                              containerId={app.id}
                              status={app.status}
                              onAction={fetchContainers}
                            />
                            <button
                              onClick={() => setSelectedContainerLogs(app.id)}
                              className="p-1 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                              title="View Logs"
                            >
                              <Terminal className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expandedStats[app.id] && app.stats && (
                        <tr>
                          <td colSpan={5} className="px-6 py-4">
                            <ContainerStats stats={app.stats} />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        {renderContent()}

        {/* Deploy Modal */}
        {selectedApp && (
          <DeployModal
            app={selectedApp}
            onClose={() => setSelectedApp(null)}
            onDeploy={handleDeploy}
            loading={loading}
          />
        )}

        {/* Logs Modal */}
        {selectedContainerLogs && (
          <LogViewer
            containerId={selectedContainerLogs}
            onClose={() => setSelectedContainerLogs(null)}
          />
        )}

        {/* Help Modal */}
        <HelpModal isOpen={helpModalOpen} onClose={() => setHelpModalOpen(false)} />
      </main>
    </div>
  );
}
import React, { useState, useEffect } from 'react';
import { AppTemplate, AppCategory, DeployedApp } from './types';
import { appTemplates } from './data/templates';
import { AppCard } from './components/AppCard';
import { Search } from 'lucide-react';
import { DeployedAppCard } from './components/DeployedAppCard';
import { DeployModal } from './components/DeployModal';
import { LogViewer } from './components/LogViewer';
import { ThemeToggle } from './components/ThemeToggle';
import { HelpModal } from './components/HelpModal';
import { Leaderboard } from './components/Leaderboard';
import { 
  LayoutGrid,
  Network,
  Box,
  Video,
  Download,
  HardDrive,
  Gauge,
  Home,
  Code,
  Lock,
  FileText,
  MessageSquare,
  HelpCircle,
  Trophy
} from 'lucide-react';
import { deployApp, getContainers } from './lib/api';

const categories: { id: AppCategory | 'leaderboard' | 'deployed'; name: string; icon: React.ElementType }[] = [
  { id: 'deployed', name: 'Deployed Apps', icon: Box },
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
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<AppCategory | 'all' | 'leaderboard' | 'deployed'>('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedContainerLogs, setSelectedContainerLogs] = useState<string | null>(null);
  const [helpModalOpen, setHelpModalOpen] = useState(false);

  const filteredApps = appTemplates.filter(app => 
    (activeCategory === 'all' || app.category === activeCategory) &&
    (searchQuery === '' || 
      app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.description.toLowerCase().includes(searchQuery.toLowerCase()))
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

  const renderContent = () => {
    if (activeCategory === 'leaderboard') {
      return <Leaderboard deployedApps={deployedApps} />;
    }

    if (activeCategory === 'deployed') {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {deployedApps.map(app => (
            <DeployedAppCard
              key={app.id}
              app={app}
              onViewLogs={() => setSelectedContainerLogs(app.id)}
              onRefresh={fetchContainers}
            />
          ))}
        </div>
      );
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 min-h-[calc(100vh-80px)]">
        {error && (
          <div className="mb-4 p-4 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-100 rounded-md">
            {error}
          </div>
        )}

        {/* Search Bar */}
        <div className="relative mb-6">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search applications..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

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
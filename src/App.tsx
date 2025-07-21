import React, { useState, useEffect } from 'react';
import { AppTemplate, AppCategory, DeployedApp, DeploymentMode, ContainerStats } from './types';
import { appTemplates } from './data/templates';
import { AppCard } from './components/AppCard';
import { Search, ArrowUpDown } from 'lucide-react';
import { DeployedAppCard } from './components/DeployedAppCard';
import { DeployModal } from './components/DeployModal';
import { LogViewer } from './components/LogViewer';
import { ThemeToggle } from './components/ThemeToggle';
import { HelpModal } from './components/HelpModal';
import { Leaderboard } from './components/Leaderboard';
import { PortManager } from './components/PortManager';
import { useNotifications } from './contexts/NotificationContext';
import { useLoading } from './hooks/useLoading';
import { useAuth } from './contexts/AuthContext';
import { LoginModal } from './components/LoginModal';
import { UserMenu } from './components/UserMenu';
import { UserSettings } from './components/UserSettings';
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
  Trophy,
  RefreshCw
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
  const [sortField, setSortField] = useState<'name' | 'status' | 'deployedAt' | 'uptime'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [selectedContainerLogs, setSelectedContainerLogs] = useState<string | null>(null);
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [portManagerOpen, setPortManagerOpen] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);

  const { success, error: showError, info } = useNotifications();
  const { loading: deploymentInProgress, withLoading } = useLoading();
  const { isAuthenticated } = useAuth();

  const filteredApps = appTemplates.filter(app =>
    (activeCategory === 'all' || app.category === activeCategory) &&
    (searchQuery === '' ||
      app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  useEffect(() => {
    // Only fetch containers if user is authenticated
    if (!isAuthenticated) {
      return;
    }

    fetchContainers(false); // Fast initial load without stats

    // Set up intervals: fast refresh for basic info, slower for stats
    const basicInterval = setInterval(() => fetchContainers(false), 10000); // Every 10s
    const statsInterval = setInterval(() => {
      if (activeCategory === 'deployed') {
        fetchContainers(true); // Only fetch stats when viewing deployed apps
      }
    }, 30000); // Every 30s

    return () => {
      clearInterval(basicInterval);
      clearInterval(statsInterval);
    };
  }, [activeCategory, isAuthenticated]);

  // Show helpful info when switching to deployed apps
  useEffect(() => {
    if (activeCategory === 'deployed' && deployedApps.length === 0) {
      info('No Deployed Apps', 'Deploy some applications to see them here. Browse the categories above to get started!');
    }
  }, [activeCategory, deployedApps.length]);

  const fetchContainers = async (includeStats = false) => {
    try {

      const containers = await getContainers();
      const apps = containers.map((container: {
        Id: string;
        Names: string[];
        State: 'running' | 'stopped' | 'error';
        Created: number;
        Ports: Array<{ PublicPort?: number }>;
        stats?: ContainerStats;
      }) => ({

        id: container.Id,
        name: container.Names[0].replace('/', ''),
        status: container.State,
        deployedAt: new Date(container.Created * 1000).toISOString(),
        url: `http://localhost:${container.Ports[0]?.PublicPort || ''}`,
        stats: container.stats
      }));
      setDeployedApps(apps);

    } catch (error) {
      console.error('Failed to fetch containers:', error);
      setError('Failed to fetch containers');

    }
  };

  const handleDeploy = async (config: Record<string, string>, mode: DeploymentMode) => {
    if (!selectedApp) return;

    info('Deployment Started', `Deploying ${selectedApp.name}...`);

    await withLoading(
      async () => {
        await deployApp(selectedApp.id, config, mode);
        await fetchContainers();
        return selectedApp.name;
      },
      (appName) => {
        success('Deployment Successful', `${appName} has been deployed successfully!`);
        setSelectedApp(null);
        // Switch to deployed apps view to see the new container
        setActiveCategory('deployed');
      },
      (err) => {
        let errorTitle = 'Deployment Failed';
        let errorMessage = 'Failed to deploy application';

        if (err.message.includes('Port conflict')) {
          errorTitle = 'Port Conflict';
          errorMessage = 'The required ports are already in use. Please stop conflicting containers or choose different ports.';
        } else if (err.message.includes('Template not found')) {
          errorTitle = 'Template Missing';
          errorMessage = 'This application template is not available. Please try a different application.';
        } else if (err.message.includes('Docker not available')) {
          errorTitle = 'Docker Unavailable';
          errorMessage = 'Docker is not running or accessible. Please ensure Docker is started and try again.';
        } else if (err.message.includes('Failed to pull image')) {
          errorTitle = 'Image Pull Failed';
          errorMessage = 'Unable to download the application image. Please check your internet connection.';
        } else {
          errorMessage = err.message;
        }

        showError(errorTitle, errorMessage);
      }
    );
  };

  const sortedDeployedApps = [...deployedApps].sort((a, b) => {
    const direction = sortDirection === 'asc' ? 1 : -1;

    switch (sortField) {
      case 'name':
        return direction * a.name.localeCompare(b.name);
      case 'status':
        return direction * a.status.localeCompare(b.status);
      case 'deployedAt':
        return direction * (new Date(a.deployedAt).getTime() - new Date(b.deployedAt).getTime());
      case 'uptime': {
        const aUptime = a.stats?.uptime || 0;
        const bUptime = b.stats?.uptime || 0;
        return direction * (aUptime - bUptime);
      }
      default:
        return 0;
    }
  });

  const renderContent = () => {
    if (activeCategory === 'leaderboard') {
      return <Leaderboard deployedApps={deployedApps} />;
    }

    if (activeCategory === 'deployed') {
      const handleSort = (field: typeof sortField) => {
        if (sortField === field) {
          setSortDirection((prev: 'asc' | 'desc') => prev === 'asc' ? 'desc' : 'asc');
        } else {
          setSortField(field);
          setSortDirection('asc');
        }
      };

      return (
        <div>
          <div className="mb-4 flex flex-wrap gap-2 justify-between">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleSort('name')}
                className={`flex items-center px-3 py-1.5 rounded-md text-sm ${sortField === 'name'
                  ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                  }`}
              >
                Name
                {sortField === 'name' && (
                  <ArrowUpDown className={`w-4 h-4 ml-1 ${sortDirection === 'desc' ? 'transform rotate-180' : ''
                    }`} />
                )}
              </button>
              <button
                onClick={() => handleSort('status')}
                className={`flex items-center px-3 py-1.5 rounded-md text-sm ${sortField === 'status'
                  ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                  }`}
              >
                Status
                {sortField === 'status' && (
                  <ArrowUpDown className={`w-4 h-4 ml-1 ${sortDirection === 'desc' ? 'transform rotate-180' : ''
                    }`} />
                )}
              </button>
              <button
                onClick={() => handleSort('deployedAt')}
                className={`flex items-center px-3 py-1.5 rounded-md text-sm ${sortField === 'deployedAt'
                  ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                  }`}
              >
                Deployment Date
                {sortField === 'deployedAt' && (
                  <ArrowUpDown className={`w-4 h-4 ml-1 ${sortDirection === 'desc' ? 'transform rotate-180' : ''
                    }`} />
                )}
              </button>
              <button
                onClick={() => handleSort('uptime')}
                className={`flex items-center px-3 py-1.5 rounded-md text-sm ${sortField === 'uptime'
                  ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                  }`}
              >
                Uptime
                {sortField === 'uptime' && (
                  <ArrowUpDown className={`w-4 h-4 ml-1 ${sortDirection === 'desc' ? 'transform rotate-180' : ''
                    }`} />
                )}
              </button>
            </div>
            <button
              onClick={() => {
                info('Refreshing Statistics', 'Updating container statistics...');
                fetchContainers(true);
              }}
              className="flex items-center px-3 py-1.5 rounded-md text-sm bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-800"
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              Refresh Stats
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedDeployedApps.map(app => (
              <DeployedAppCard
                key={app.id}
                app={app}
                onViewLogs={() => setSelectedContainerLogs(app.id)}
                onRefresh={fetchContainers}
              />
            ))}
          </div>
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
              onClick={() => setPortManagerOpen(true)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
              aria-label="Port Manager"
              title="Manage Ports"
            >
              <Network className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            <button
              onClick={() => setHelpModalOpen(true)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
              aria-label="Help"
            >
              <HelpCircle className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            <ThemeToggle />

            {isAuthenticated ? (
              <UserMenu onOpenSettings={() => setSettingsModalOpen(true)} />
            ) : (
              <button
                onClick={() => setLoginModalOpen(true)}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 min-h-[calc(100vh-80px)]">

        {/* Search Bar */}
        <div className="relative mb-6">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search applications..."
            value={searchQuery}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Category Navigation */}
        <div className="flex flex-wrap gap-4 mb-8">
          <button
            onClick={() => setActiveCategory('all')}
            className={`flex items-center px-4 py-2 rounded-md ${activeCategory === 'all'
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
                className={`flex items-center px-4 py-2 rounded-md ${activeCategory === category.id
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
            loading={deploymentInProgress}
          />
        )}

        {/* Logs Modal */}
        {selectedContainerLogs && (
          <LogViewer
            containerId={selectedContainerLogs}
            onClose={() => setSelectedContainerLogs(null)}
          />
        )}

        {/* Port Manager Modal */}
        <PortManager isOpen={portManagerOpen} onClose={() => setPortManagerOpen(false)} />

        {/* Login Modal */}
        <LoginModal isOpen={loginModalOpen} onClose={() => setLoginModalOpen(false)} />

        {/* User Settings Modal */}
        <UserSettings isOpen={settingsModalOpen} onClose={() => setSettingsModalOpen(false)} />

        {/* Help Modal */}
        <HelpModal isOpen={helpModalOpen} onClose={() => setHelpModalOpen(false)} />
      </main>
    </div>
  );
}
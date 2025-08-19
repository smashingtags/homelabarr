import React, { useState, useEffect } from 'react';
import { AppTemplate, AppCategory, DeployedApp, DeploymentMode } from './types';
import { APP_CATEGORIES, categorizedApps, getAllApps, getAppsByCategory, searchApps } from './data/categorized-apps';
import { AppCard } from './components/AppCard';
import { Search, ArrowUpDown } from 'lucide-react';
import { DeployedAppCard } from './components/DeployedAppCard';
import { DeployModal } from './components/DeployModal';
import { LogViewer } from './components/LogViewer';
import { ThemeToggle } from './components/ThemeToggle';
import { HelpModal } from './components/HelpModal';
import { Leaderboard } from './components/Leaderboard';
import { PortManager } from './components/PortManager';
import { EnhancedMountManager } from './components/EnhancedMountManager';
import { EnhancedMountOnboarding } from './components/EnhancedMountOnboarding';
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
import { CLIApplicationBrowser } from './components/CLIApplicationBrowser';

// Generate categories from APP_CATEGORIES plus special views
const categories = [
  { id: 'cli', name: 'HomelabARR CLI', icon: RefreshCw },
  { id: 'deployed', name: 'Deployed Apps', icon: Box },
  ...Object.values(APP_CATEGORIES).map(cat => ({
    id: cat.id as AppCategory | 'all-apps' | 'leaderboard' | 'deployed' | 'cli',
    name: cat.name,
    icon: cat.icon
  })),
  { id: 'leaderboard' as const, name: 'Leaderboard', icon: Trophy }
];

export default function App() {
  const [selectedApp, setSelectedApp] = useState<AppTemplate | null>(null);
  const [deployedApps, setDeployedApps] = useState<DeployedApp[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<AppCategory | 'all-apps' | 'leaderboard' | 'deployed' | 'cli'>('cli');
  const [sortField, setSortField] = useState<'name' | 'status' | 'deployedAt' | 'uptime'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [selectedContainerLogs, setSelectedContainerLogs] = useState<string | null>(null);
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [portManagerOpen, setPortManagerOpen] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [selectedEnhancedMount, setSelectedEnhancedMount] = useState<{ containerId: string; containerName: string } | null>(null);
  const [onboardingModalOpen, setOnboardingModalOpen] = useState(false);
  const [pendingDeployment, setPendingDeployment] = useState<{ app: AppTemplate; config: Record<string, string>; mode: DeploymentMode } | null>(null);

  const { success, error: showError, info } = useNotifications();
  const { loading: deploymentInProgress, withLoading } = useLoading();
  const { isAuthenticated } = useAuth();

  // Get filtered apps based on category and search
  const filteredApps = React.useMemo(() => {
    if (searchQuery.trim()) {
      return searchApps(searchQuery);
    }
    
    if (activeCategory === 'all-apps') {
      return getAllApps();
    }
    
    if (activeCategory === 'cli' || activeCategory === 'deployed' || activeCategory === 'leaderboard') {
      return [];
    }
    
    return getAppsByCategory(activeCategory);
  }, [activeCategory, searchQuery]);

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
      const response = await getContainers(includeStats);
      const containers = response.containers;
      const apps = containers.map((container: any) => ({
        id: container.Id,
        name: container.Names[0].replace('/', ''),
        status: container.State,
        deployedAt: container.Created, // Already an ISO string from backend
        url: `http://localhost:${container.Ports[0]?.PublicPort || ''}`,
        stats: container.stats
      }));
      setDeployedApps(apps);
    } catch (err) {
      showError('Failed to fetch containers', 'Unable to connect to Docker or retrieve container information');
    }
  };

  const handleCLIDeploy = async (appId: string, config: Record<string, string>, mode: DeploymentMode) => {
    info('CLI Deployment Started', `Deploying ${appId} via HomelabARR CLI...`);

    try {
      const result = await deployApp(appId, config, mode);
      
      // Handle streaming deployment
      if (result.source === 'cli-streaming') {
        info('Real-time Deployment', `${appId} deployment started with live progress tracking`);
        return result; // Return the result so CLI browser can handle it
      } else {
        // Handle traditional deployment
        await fetchContainers();
        success('CLI Deployment Successful', `${appId} has been deployed successfully via HomelabARR CLI!`);
        setActiveCategory('deployed');
        return result;
      }
    } catch (err: any) {
      let errorTitle = 'CLI Deployment Failed';
      let errorMessage = 'Failed to deploy application via CLI';

      if (err.message.includes('CLI Bridge not available')) {
        errorTitle = 'CLI Integration Unavailable';
        errorMessage = 'HomelabARR CLI integration is not available. Please ensure the CLI is properly installed.';
      } else if (err.message.includes('Port conflict')) {
        errorTitle = 'Port Conflict';
        errorMessage = 'The required ports are already in use. Please stop conflicting containers or choose different ports.';
      } else if (err.message.includes('Application not found')) {
        errorTitle = 'Application Not Found';
        errorMessage = 'This application is not available in the CLI. Please try a different application.';
      } else if (err.message.includes('Docker not available') || err.message.includes('Docker daemon')) {
        errorTitle = 'Docker Unavailable';
        errorMessage = 'Docker is not running or accessible. Please ensure Docker is started and try again.';
      } else {
        errorMessage = err.message;
      }

      showError(errorTitle, errorMessage);
      throw err; // Re-throw so CLI browser can handle it
    }
  };

  const handleDeploy = async (config: Record<string, string>, mode: DeploymentMode) => {
    if (!selectedApp) return;

    // Check if this is an enhanced mount container and show onboarding if needed
    if (selectedApp.id === 'homelabarr-mount-enhanced') {
      setPendingDeployment({ app: selectedApp, config, mode });
      setOnboardingModalOpen(true);
      setSelectedApp(null);
      return;
    }

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

  const handleOnboardingProceed = async () => {
    setOnboardingModalOpen(false);
    
    if (!pendingDeployment) return;
    
    const { app, config, mode } = pendingDeployment;
    setPendingDeployment(null);
    
    info('Deployment Started', `Deploying ${app.name}...`);

    await withLoading(
      async () => {
        await deployApp(app.id, config, mode);
        await fetchContainers();
        return app.name;
      },
      (appName) => {
        success('Deployment Successful', `${appName} has been deployed successfully!`);
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

  const handleOnboardingCancel = () => {
    setOnboardingModalOpen(false);
    setPendingDeployment(null);
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
      case 'uptime':
        const aUptime = a.stats?.uptime || 0;
        const bUptime = b.stats?.uptime || 0;
        return direction * (aUptime - bUptime);
      default:
        return 0;
    }
  });

  const renderContent = () => {
    if (activeCategory === 'cli') {
      return <CLIApplicationBrowser onDeploy={handleCLIDeploy} />;
    }

    if (activeCategory === 'leaderboard') {
      return <Leaderboard deployedApps={deployedApps} />;
    }

    if (activeCategory === 'deployed') {
      const handleSort = (field: typeof sortField) => {
        if (sortField === field) {
          setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
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
            {sortedDeployedApps.map(app => {
              // Check if this is an enhanced mount container
              const isEnhancedMount = app.name.includes('homelabarr-mount-enhanced') || 
                                    app.name.includes('enhanced-mount') ||
                                    app.name.includes('mount-enhanced');
              
              return (
                <div key={app.id} className="space-y-2">
                  <DeployedAppCard
                    app={app}
                    onViewLogs={() => setSelectedContainerLogs(app.id)}
                    onRefresh={fetchContainers}
                  />
                  {isEnhancedMount && (
                    <button
                      onClick={() => setSelectedEnhancedMount({ 
                        containerId: app.id, 
                        containerName: app.name 
                      })}
                      className="w-full px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      Enhanced Mount Dashboard
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    // Show category header and app count for non-search views
    const currentCategoryInfo = Object.values(APP_CATEGORIES).find(cat => cat.id === activeCategory);
    
    return (
      <div>
        {/* Category Header */}
        {!searchQuery && currentCategoryInfo && (
          <div className="mb-6 p-6 bg-gradient-to-r bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <currentCategoryInfo.icon className="w-8 h-8 text-blue-600 mr-3" />
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    {currentCategoryInfo.name}
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400 mt-1">
                    {currentCategoryInfo.description}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-2xl font-bold text-blue-600">{filteredApps.length}</span>
                <p className="text-sm text-gray-500 dark:text-gray-400">applications</p>
              </div>
            </div>
          </div>
        )}

        {/* Search Results Header */}
        {searchQuery && (
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-blue-900 dark:text-blue-100">
                  Search Results for "{searchQuery}"
                </h2>
                <p className="text-blue-700 dark:text-blue-300 text-sm">
                  Found {filteredApps.length} applications matching your search
                </p>
              </div>
              <button
                onClick={() => setSearchQuery('')}
                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 text-sm font-medium"
              >
                Clear search
              </button>
            </div>
          </div>
        )}

        {/* Apps Grid */}
        {filteredApps.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredApps.map(app => (
              <AppCard
                key={app.id}
                app={app}
                onDeploy={() => setSelectedApp(app)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Search className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {searchQuery ? 'No results found' : 'No applications in this category'}
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              {searchQuery 
                ? `Try different keywords or browse categories above`
                : 'Select a different category to see available applications'
              }
            </p>
          </div>
        )}
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
            placeholder="Lightning-fast search across 160+ apps..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg leading-5 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
          />
          {searchQuery && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {filteredApps.length} results
              </span>
            </div>
          )}
        </div>

        {/* Category Navigation */}
        <div className="flex flex-wrap gap-4 mb-8">
          {categories.map(category => {
            const Icon = category.icon;
            return (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={`flex items-center px-4 py-2 rounded-md transition-colors ${activeCategory === category.id
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
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

        {/* Enhanced Mount Onboarding Modal */}
        <EnhancedMountOnboarding
          isOpen={onboardingModalOpen}
          onClose={handleOnboardingCancel}
          onProceed={handleOnboardingProceed}
        />

        {/* Enhanced Mount Manager Modal */}
        {selectedEnhancedMount && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Enhanced Mount Dashboard
                  </h2>
                  <button
                    onClick={() => setSelectedEnhancedMount(null)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <EnhancedMountManager
                  containerId={selectedEnhancedMount.containerId}
                  containerName={selectedEnhancedMount.containerName}
                />
              </div>
            </div>
          </div>
        )}

        {/* Help Modal */}
        <HelpModal isOpen={helpModalOpen} onClose={() => setHelpModalOpen(false)} />
      </main>
    </div>
  );
}
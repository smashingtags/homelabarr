import React from 'react';
import { Trophy, Clock, Medal } from 'lucide-react';
import { DeployedApp } from '../types';

interface LeaderboardProps {
  deployedApps: DeployedApp[];
}

function getAchievementScore(uptime: number): number {
  const dayInSeconds = 24 * 60 * 60;
  const weekInSeconds = 7 * dayInSeconds;
  const monthInSeconds = 30 * dayInSeconds;
  
  if (uptime >= monthInSeconds) return 100;
  if (uptime >= weekInSeconds) return 75;
  if (uptime >= dayInSeconds) return 50;
  return 25;
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / (24 * 60 * 60));
  const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
  
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h`;
}

const demoApps = [
  { id: '1', name: 'Plex Media Server', uptime: 30 * 24 * 60 * 60 }, // 30 days
  { id: '2', name: 'Nextcloud', uptime: 14 * 24 * 60 * 60 }, // 14 days
  { id: '3', name: 'Traefik', uptime: 7 * 24 * 60 * 60 }, // 7 days
  { id: '4', name: 'Authentik', uptime: 3 * 24 * 60 * 60 }, // 3 days
  { id: '5', name: 'Homepage', uptime: 24 * 60 * 60 }, // 1 day
];

export function Leaderboard({ deployedApps }: LeaderboardProps) {
  const rankedApps = deployedApps.length > 0
    ? [...deployedApps]
        .filter(app => app.stats?.uptime)
        .sort((a, b) => {
          const scoreA = getAchievementScore(a.stats?.uptime || 0);
          const scoreB = getAchievementScore(b.stats?.uptime || 0);
          return scoreB - scoreA || (b.stats?.uptime || 0) - (a.stats?.uptime || 0);
        })
        .slice(0, 5)
    : demoApps.map(app => ({
        id: app.id,
        name: app.name,
        stats: { uptime: app.uptime },
      } as DeployedApp));

  return (
    <div className="space-y-6">
      {/* Main Leaderboard */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <div className="flex items-center mb-6">
          <Trophy className="w-6 h-6 text-yellow-500 mr-2" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Uptime Champions
          </h2>
        </div>

        {deployedApps.length === 0 && (
          <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900 rounded-lg">
            <p className="text-sm text-blue-700 dark:text-blue-200">
              👋 This is a demo leaderboard! Deploy some applications to start earning real achievements.
            </p>
          </div>
        )}
        
        <div className="space-y-4">
          {rankedApps.map((app, index) => {
            const score = getAchievementScore(app.stats?.uptime || 0);
            let medalColor = '';
            let medalSize = 'w-8 h-8';
            
            switch (index) {
              case 0:
                medalColor = 'text-yellow-500'; // Gold
                break;
              case 1:
                medalColor = 'text-gray-400'; // Silver
                medalSize = 'w-7 h-7';
                break;
              case 2:
                medalColor = 'text-amber-600'; // Bronze
                medalSize = 'w-6 h-6';
                break;
              default:
                medalColor = 'text-gray-500';
                medalSize = 'w-5 h-5';
            }

            return (
              <div
                key={app.id}
                className={`flex items-center justify-between p-4 ${
                  index === 0 
                    ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800'
                    : 'bg-gray-50 dark:bg-gray-700'
                } rounded-lg transition-all hover:scale-[1.01]`}
              >
                <div className="flex items-center space-x-4">
                  <div className={`flex items-center justify-center ${medalSize}`}>
                    <Medal className={`${medalColor}`} />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {app.name}
                    </div>
                    <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                      <Clock className="w-4 h-4 mr-1" />
                      {formatUptime(app.stats?.uptime || 0)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    {score} points
                  </div>
                  {index === 0 && (
                    <Trophy className="w-4 h-4 text-yellow-500" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Achievement Levels */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Achievement Levels
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <Medal className="w-5 h-5 text-yellow-500" />
              <span className="font-medium text-gray-900 dark:text-white">Gold</span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              30+ days uptime (100 points)
            </p>
          </div>
          <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <Medal className="w-5 h-5 text-gray-400" />
              <span className="font-medium text-gray-900 dark:text-white">Silver</span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              7+ days uptime (75 points)
            </p>
          </div>
          <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <Medal className="w-5 h-5 text-amber-600" />
              <span className="font-medium text-gray-900 dark:text-white">Bronze</span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              24+ hours uptime (50 points)
            </p>
          </div>
          <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <Medal className="w-5 h-5 text-gray-500" />
              <span className="font-medium text-gray-900 dark:text-white">Starting</span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Up to 24 hours (25 points)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
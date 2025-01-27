import React from 'react';
import { Cpu, HardDrive, Network, Clock, Trophy } from 'lucide-react';

interface ContainerStatsProps {
  stats: {
    cpu: number;
    memory: {
      usage: number;
      limit: number;
      percentage: number;
    };
    network: Record<string, {
      rx_bytes: number;
      tx_bytes: number;
    }>;
    uptime: number; // in seconds
  };
}

function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;
  
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / (24 * 60 * 60));
  const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((seconds % (60 * 60)) / 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function calculateUptimeAchievement(uptime: number): {
  level: string;
  progress: number;
  nextGoal: number;
} {
  const levels = [
    { name: 'Bronze', threshold: 24 * 60 * 60 }, // 1 day
    { name: 'Silver', threshold: 7 * 24 * 60 * 60 }, // 1 week
    { name: 'Gold', threshold: 30 * 24 * 60 * 60 }, // 30 days
    { name: 'Platinum', threshold: 90 * 24 * 60 * 60 }, // 90 days
    { name: 'Diamond', threshold: 365 * 24 * 60 * 60 }, // 1 year
  ];

  for (let i = 0; i < levels.length; i++) {
    if (uptime < levels[i].threshold) {
      const previousThreshold = i > 0 ? levels[i - 1].threshold : 0;
      const progress = ((uptime - previousThreshold) / (levels[i].threshold - previousThreshold)) * 100;
      return {
        level: i > 0 ? levels[i - 1].name : 'Starting',
        progress: Math.min(progress, 100),
        nextGoal: levels[i].threshold,
      };
    }
  }

  return {
    level: 'Diamond',
    progress: 100,
    nextGoal: levels[levels.length - 1].threshold,
  };
}

export function ContainerStats({ stats }: ContainerStatsProps) {
  const totalNetwork = Object.values(stats.network).reduce(
    (acc, { rx_bytes, tx_bytes }) => ({
      rx: acc.rx + rx_bytes,
      tx: acc.tx + tx_bytes,
    }),
    { rx: 0, tx: 0 }
  );

  const achievement = calculateUptimeAchievement(stats.uptime);

  return (
    <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* CPU Usage */}
        <div className="flex items-center space-x-2">
          <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
            <Cpu className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">CPU</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">{stats.cpu.toFixed(1)}%</div>
          </div>
        </div>

        {/* Memory Usage */}
        <div className="flex items-center space-x-2">
          <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
            <HardDrive className="w-4 h-4 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Memory</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {stats.memory.percentage.toFixed(1)}%
              <span className="text-xs ml-1">
                ({formatBytes(stats.memory.usage)} / {formatBytes(stats.memory.limit)})
              </span>
            </div>
          </div>
        </div>

        {/* Network Usage */}
        <div className="flex items-center space-x-2">
          <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
            <Network className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Network</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              <span className="text-green-500">↓</span> {formatBytes(totalNetwork.rx)}{' '}
              <span className="text-red-500">↑</span> {formatBytes(totalNetwork.tx)}
            </div>
          </div>
        </div>

        {/* Uptime */}
        <div className="flex items-center space-x-2">
          <div className="p-2 bg-yellow-100 dark:bg-yellow-900 rounded-lg">
            <Clock className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
          </div>
          <div>
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Uptime</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {formatUptime(stats.uptime)}
            </div>
          </div>
        </div>
      </div>

      {/* Uptime Achievement */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
        <div className="flex items-center space-x-2 mb-2">
          <Trophy className="w-4 h-4 text-yellow-500" />
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
            Uptime Achievement: {achievement.level}
          </span>
        </div>
        <div className="relative">
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-yellow-500 transition-all duration-500"
              style={{ width: `${achievement.progress}%` }}
            />
          </div>
          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {achievement.level !== 'Diamond' && (
              <>Next goal: {formatUptime(achievement.nextGoal)}</>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
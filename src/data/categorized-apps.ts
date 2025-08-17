import { AppTemplate } from '../types';
import { 
  Video, 
  Radio,
  Network,
  Lock,
  Download,
  Tv2,
  Rss,
  BookOpenCheck,
  Gauge,
  FileSearch,
  Scan,
  Home,
  MessageSquarePlus,
  GitBranch,
  Key,
  Activity,
  FileText,
  RefreshCw,
  Image,
  Calendar,
  NotebookPen,
  Mail,
  Headphones,
  Library,
  Files,
  Container as ContainerIcon,
  ScrollText,
  LayoutDashboard,
  MonitorSmartphone,
  AppWindow,
  Book,
  Link,
  LineChart,
  Bell,
  BarChart2,
  Shield,
  Zap,
  Eye,
  Database,
  Server,
  Wifi,
  Code2,
  Archive,
  Globe,
  Cloud,
  HardDrive,
  Settings,
  PlayCircle,
  Download as DownloadIcon,
  Monitor,
  Wrench,
  Gamepad2,
  Film,
  Music as MusicIcon,
  Search as SearchIcon,
  Users,
  Smartphone,
  Router
} from 'lucide-react';

// Industry-Standard Category Definitions
export const APP_CATEGORIES = {
  MEDIA: {
    id: 'media',
    name: '🎬 Media & Entertainment', 
    description: 'Media servers, management tools, and entertainment applications',
    icon: Video,
    color: 'from-purple-500 to-pink-500'
  },
  DOWNLOADS: {
    id: 'downloads',
    name: '📥 Downloads & Automation',
    description: 'Download clients, indexers, and automation tools',
    icon: DownloadIcon,
    color: 'from-blue-500 to-cyan-500'
  },
  MONITORING: {
    id: 'monitoring', 
    name: '📊 Monitoring & Analytics',
    description: 'System monitoring, analytics, and observability tools',
    icon: LineChart,
    color: 'from-green-500 to-emerald-500'
  },
  DEVELOPMENT: {
    id: 'development',
    name: '🛠️ Development & Tools',
    description: 'Code editors, development tools, and programming utilities',
    icon: Code2,
    color: 'from-indigo-500 to-purple-500'
  },
  HOME_AUTOMATION: {
    id: 'home-automation',
    name: '🏠 Home Automation & IoT',
    description: 'Smart home, network tools, and IoT applications',
    icon: Home,
    color: 'from-orange-500 to-red-500'
  },
  BACKUP_STORAGE: {
    id: 'backup-storage',
    name: '💾 Backup & Storage',
    description: 'Backup solutions, file management, and cloud storage',
    icon: Archive,
    color: 'from-gray-500 to-slate-500'
  },
  WEB_PRODUCTIVITY: {
    id: 'web-productivity',
    name: '🌐 Web Services & Productivity',
    description: 'Dashboards, communication, and productivity tools',
    icon: Globe,
    color: 'from-teal-500 to-cyan-500'
  },
  SYSTEM_UTILITIES: {
    id: 'system-utilities',
    name: '🔧 System & Utilities',
    description: 'Container management, system tools, and utilities',
    icon: Settings,
    color: 'from-yellow-500 to-orange-500'
  },
  GAMING_ENTERTAINMENT: {
    id: 'gaming-entertainment',
    name: '🎮 Gaming & Entertainment',
    description: 'Game servers, streaming tools, and entertainment',
    icon: Gamepad2,
    color: 'from-pink-500 to-purple-500'
  },
  ALL_APPS: {
    id: 'all-apps',
    name: '📱 All Apps',
    description: 'Complete list of all available applications',
    icon: SearchIcon,
    color: 'from-slate-500 to-gray-500'
  }
} as const;

// Comprehensive App Categorization
export const categorizedApps: Record<string, AppTemplate[]> = {
  // 🎬 Media & Entertainment
  [APP_CATEGORIES.MEDIA.id]: [
    // Media Servers
    { id: 'plex', name: 'Plex', description: 'Premium media server platform', category: 'media', logo: Video, deploymentModes: ['traefik', 'authelia', 'local'] },
    { id: 'jellyfin', name: 'Jellyfin', description: 'Free media server software', category: 'media', logo: Video, deploymentModes: ['traefik', 'authelia', 'local'] },
    { id: 'emby', name: 'Emby', description: 'Personal media server', category: 'media', logo: Video, deploymentModes: ['traefik', 'authelia', 'local'] },
    { id: 'mstream', name: 'mStream', description: 'Personal music streaming server', category: 'media', logo: MusicIcon, deploymentModes: ['traefik', 'authelia', 'local'] },
    { id: 'dim', name: 'Dim', description: 'Self-hosted media manager', category: 'media', logo: Video, deploymentModes: ['traefik', 'authelia'] },
    
    // Media Management  
    { id: 'sonarr', name: 'Sonarr', description: 'TV series management and automation', category: 'media', logo: Tv2, deploymentModes: ['traefik', 'authelia', 'local'] },
    { id: 'radarr', name: 'Radarr', description: 'Movie collection manager', category: 'media', logo: Film, deploymentModes: ['traefik', 'authelia', 'local'] },
    { id: 'lidarr', name: 'Lidarr', description: 'Music collection manager', category: 'media', logo: MusicIcon, deploymentModes: ['traefik', 'authelia', 'local'] },
    { id: 'readarr', name: 'Readarr', description: 'Ebook and audiobook collection manager', category: 'media', logo: Book, deploymentModes: ['traefik', 'authelia', 'local'] },
    { id: 'bazarr', name: 'Bazarr', description: 'Subtitle management for Sonarr and Radarr', category: 'media', logo: FileText, deploymentModes: ['traefik', 'authelia', 'local'] },
    { id: 'prowlarr', name: 'Prowlarr', description: 'Indexer manager for *arr applications', category: 'media', logo: SearchIcon, deploymentModes: ['traefik', 'authelia', 'local'] },
    
    // Media Tools
    { id: 'tautulli', name: 'Tautulli', description: 'Plex monitoring and analytics', category: 'media', logo: BarChart2, deploymentModes: ['traefik', 'authelia', 'local'] },
    { id: 'kometa', name: 'Kometa', description: 'Plex metadata and collection manager', category: 'media', logo: Library, deploymentModes: ['traefik', 'authelia', 'local'] },
    { id: 'overseerr', name: 'Overseerr', description: 'Request management for Plex', category: 'media', logo: MessageSquarePlus, deploymentModes: ['local'] },
    { id: 'petio', name: 'Petio', description: 'Request and discovery platform', category: 'media', logo: SearchIcon, deploymentModes: ['traefik', 'authelia', 'local'] },
    { id: 'conreq', name: 'Conreq', description: 'Content requesting platform', category: 'media', logo: MessageSquarePlus, deploymentModes: ['traefik', 'authelia', 'local'] },
    { id: 'gaps', name: 'Gaps', description: 'Find missing movies in Plex library', category: 'media', logo: SearchIcon, deploymentModes: ['traefik', 'authelia', 'local'] },
    { id: 'embystats', name: 'EmbyStat', description: 'Statistics for Emby server', category: 'media', logo: BarChart2, deploymentModes: ['traefik', 'authelia', 'local'] },
    
    // Media Utilities
    { id: 'calibre-web', name: 'Calibre-Web', description: 'Web-based ebook reader and manager', category: 'media', logo: Book, deploymentModes: ['traefik', 'authelia', 'local'] },
    { id: 'komga', name: 'Komga', description: 'Comics and manga server', category: 'media', logo: Book, deploymentModes: ['traefik', 'authelia', 'local'] },
    { id: 'lazylibrarian', name: 'LazyLibrarian', description: 'Ebook and audiobook manager', category: 'media', logo: Book, deploymentModes: ['traefik', 'authelia', 'local'] },
    { id: 'xteve', name: 'xTeVe', description: 'IPTV and DVR proxy', category: 'media', logo: Tv2, deploymentModes: ['traefik', 'authelia', 'local'] }
  ],

  // 📥 Downloads & Automation
  [APP_CATEGORIES.DOWNLOADS.id]: [
    // Download Clients
    { id: 'qbittorrent', name: 'qBittorrent', description: 'Feature-rich BitTorrent client', category: 'downloads', logo: DownloadIcon, deploymentModes: ['traefik', 'authelia', 'local'] },
    { id: 'sabnzbd', name: 'SABnzbd', description: 'Usenet download client', category: 'downloads', logo: DownloadIcon, deploymentModes: ['traefik', 'authelia', 'local'] },
    { id: 'nzbget', name: 'NZBGet', description: 'Efficient usenet downloader', category: 'downloads', logo: DownloadIcon, deploymentModes: ['traefik', 'authelia', 'local'] },
    { id: 'deluge', name: 'Deluge', description: 'Lightweight BitTorrent client', category: 'downloads', logo: DownloadIcon, deploymentModes: ['traefik', 'authelia', 'local'] },
    { id: 'aria', name: 'Aria2', description: 'Lightweight multi-protocol download utility', category: 'downloads', logo: DownloadIcon, deploymentModes: ['traefik', 'authelia', 'local'] },
    
    // Indexers & Search
    { id: 'jackett', name: 'Jackett', description: 'API support for torrent trackers', category: 'downloads', logo: SearchIcon, deploymentModes: ['traefik', 'authelia', 'local'] },
    { id: 'nzbhydra', name: 'NZBHydra2', description: 'Usenet meta search', category: 'downloads', logo: SearchIcon, deploymentModes: ['traefik', 'authelia', 'local'] },
    { id: 'flaresolverr', name: 'FlareSolverr', description: 'Cloudflare proxy for Jackett', category: 'downloads', logo: Shield, deploymentModes: ['traefik', 'authelia', 'local'] },
    
    // Media Download Tools
    { id: 'youtubedl-material', name: 'YouTube-DL Material', description: 'YouTube downloader with web interface', category: 'downloads', logo: Video, deploymentModes: ['traefik', 'authelia', 'local'] },
    { id: 'tubesync', name: 'TubeSync', description: 'YouTube channel synchronization', category: 'downloads', logo: Video, deploymentModes: ['traefik', 'authelia', 'local'] },
    { id: 'alltube', name: 'AllTube', description: 'Web interface for youtube-dl', category: 'downloads', logo: Video, deploymentModes: ['local'] },
    { id: 'deemix', name: 'Deemix', description: 'Deezer music downloader', category: 'downloads', logo: MusicIcon, deploymentModes: ['traefik', 'authelia', 'local'] },
    
    // Transfer & Sync
    { id: 'davos', name: 'Davos', description: 'FTP automation and management', category: 'downloads', logo: RefreshCw, deploymentModes: ['traefik', 'authelia', 'local'] },
    { id: 'filezilla', name: 'FileZilla', description: 'FTP client with web interface', category: 'downloads', logo: Files, deploymentModes: ['traefik', 'authelia', 'local'] },
    { id: 'sync', name: 'Sync', description: 'File synchronization tool', category: 'downloads', logo: RefreshCw, deploymentModes: ['local'] }
  ],

  // 📊 Monitoring & Analytics
  [APP_CATEGORIES.MONITORING.id]: [
    // System Monitoring
    { id: 'grafana', name: 'Grafana', description: 'Analytics and monitoring dashboards', category: 'monitoring', logo: LineChart, deploymentModes: ['traefik', 'authelia'] },
    { id: 'prometheus', name: 'Prometheus', description: 'Systems monitoring and alerting toolkit', category: 'monitoring', logo: BarChart2, deploymentModes: ['traefik', 'authelia'] },
    { id: 'netdata', name: 'Netdata', description: 'Real-time performance monitoring', category: 'monitoring', logo: Activity, deploymentModes: ['traefik', 'authelia', 'local'] },
    { id: 'glances', name: 'Glances', description: 'System monitoring tool', category: 'monitoring', logo: Eye, deploymentModes: ['local'] },
    { id: 'vnstat', name: 'vnStat', description: 'Network statistics monitor', category: 'monitoring', logo: Network, deploymentModes: ['traefik', 'authelia', 'local'] },
    
    // Application Monitoring
    { id: 'uptime-kuma', name: 'Uptime Kuma', description: 'Self-hosted monitoring tool', category: 'monitoring', logo: Activity, deploymentModes: ['traefik', 'authelia', 'local'] },
    { id: 'statping', name: 'Statping', description: 'Status page and monitoring', category: 'monitoring', logo: Activity, deploymentModes: ['traefik', 'authelia', 'local'] },
    { id: 'dozzle', name: 'Dozzle', description: 'Real-time Docker log viewer', category: 'monitoring', logo: ScrollText, deploymentModes: ['traefik', 'authelia', 'local'] },
    
    // Notifications & Alerts
    { id: 'gotify', name: 'Gotify', description: 'Self-hosted push notification server', category: 'monitoring', logo: Bell, deploymentModes: ['local'] },
    { id: 'notifiarr', name: 'Notifiarr', description: 'Unified notification platform', category: 'monitoring', logo: Bell, deploymentModes: ['traefik', 'authelia', 'local'] },
    { id: 'diun', name: 'Diun', description: 'Docker image update notifications', category: 'monitoring', logo: Bell, deploymentModes: ['traefik', 'authelia', 'local'] }
  ],

  // 🛠️ Development & Tools  
  [APP_CATEGORIES.DEVELOPMENT.id]: [
    // Code Editors & IDEs
    { id: 'code-server', name: 'Code Server', description: 'VS Code in the browser', category: 'development', logo: Code2, deploymentModes: ['traefik', 'authelia', 'local'] },
    { id: 'cloud9', name: 'Cloud9', description: 'Cloud-based IDE', category: 'development', logo: Code2, deploymentModes: ['traefik', 'authelia', 'local'] },
    { id: 'coder', name: 'Coder', description: 'Self-hosted development environments', category: 'development', logo: Code2, deploymentModes: ['traefik', 'authelia'] },
    
    // Databases
    { id: 'mariadb', name: 'MariaDB', description: 'Open source relational database', category: 'development', logo: Database, deploymentModes: ['traefik', 'authelia', 'local'] },
    { id: 'cloudbeaver', name: 'CloudBeaver', description: 'Web-based database manager', category: 'development', logo: Database, deploymentModes: ['traefik', 'authelia', 'local'] },
    { id: 'netbox', name: 'NetBox', description: 'IP address management (IPAM)', category: 'development', logo: Network, deploymentModes: ['local'] },
    
    // File Management
    { id: 'cloudcmd', name: 'Cloud Commander', description: 'Web-based file manager', category: 'development', logo: Files, deploymentModes: ['traefik', 'authelia', 'local'] },
    { id: 'krusader', name: 'Krusader', description: 'Twin-panel file manager', category: 'development', logo: Files, deploymentModes: ['traefik', 'authelia', 'local'] },
    
    // Remote Access
    { id: 'guacamole', name: 'Apache Guacamole', description: 'Clientless remote desktop gateway', category: 'development', logo: MonitorSmartphone, deploymentModes: ['traefik', 'authelia', 'local'] },
    { id: 'remmina', name: 'Remmina', description: 'Remote desktop client', category: 'development', logo: MonitorSmartphone, deploymentModes: ['traefik', 'authelia', 'local'] }
  ],

  // 🏠 Home Automation & IoT
  [APP_CATEGORIES.HOME_AUTOMATION.id]: [
    // Smart Home Platforms
    { id: 'homeassistant', name: 'Home Assistant', description: 'Open source home automation', category: 'home-automation', logo: Home, deploymentModes: ['local'] },
    { id: 'iobroker', name: 'ioBroker', description: 'IoT platform and smart home automation', category: 'home-automation', logo: Home, deploymentModes: ['local'] },
    
    // Network Services  
    { id: 'pihole', name: 'Pi-hole', description: 'Network-wide ad blocker', category: 'home-automation', logo: Shield, deploymentModes: ['traefik', 'authelia', 'local'] },
    { id: 'unbound', name: 'Unbound', description: 'Recursive DNS resolver', category: 'home-automation', logo: Network, deploymentModes: ['traefik', 'authelia', 'local'] },
    { id: 'cloudflared', name: 'Cloudflared', description: 'Cloudflare Tunnel client', category: 'home-automation', logo: Cloud, deploymentModes: ['traefik', 'authelia', 'local'] },
    { id: 'unifi-controller', name: 'UniFi Controller', description: 'Ubiquiti network management', category: 'home-automation', logo: Wifi, deploymentModes: ['traefik', 'authelia', 'local'] },
    
    // VPN & Security
    { id: 'wireguard', name: 'WireGuard', description: 'Fast and secure VPN', category: 'home-automation', logo: Shield, deploymentModes: ['traefik', 'authelia', 'local'] },
    { id: 'wg-easy', name: 'WG Easy', description: 'Simple WireGuard VPN management', category: 'home-automation', logo: Shield, deploymentModes: ['traefik', 'authelia', 'local'] },
    { id: 'fail2ban', name: 'Fail2ban', description: 'Intrusion prevention system', category: 'home-automation', logo: Shield, deploymentModes: ['traefik', 'authelia', 'local'] },
    { id: 'gluetun', name: 'Gluetun', description: 'VPN client for Docker containers', category: 'home-automation', logo: Shield, deploymentModes: ['traefik', 'authelia', 'local'] },
    
    // DNS & Network Tools
    { id: 'cloudflare-ddns', name: 'Cloudflare DDNS', description: 'Dynamic DNS for Cloudflare', category: 'home-automation', logo: Cloud, deploymentModes: ['traefik', 'authelia', 'local'] },
    { id: 'whoogle', name: 'Whoogle', description: 'Privacy-focused Google search proxy', category: 'home-automation', logo: SearchIcon, deploymentModes: ['traefik', 'authelia', 'local'] }
  ],

  // 💾 Backup & Storage
  [APP_CATEGORIES.BACKUP_STORAGE.id]: [
    // Backup Solutions
    { id: 'duplicati', name: 'Duplicati', description: 'Backup software with encryption', category: 'backup-storage', logo: Archive, deploymentModes: ['traefik', 'authelia', 'local'] },
    { id: 'restic', name: 'Restic', description: 'Fast, secure backup solution', category: 'backup-storage', logo: Archive, deploymentModes: ['traefik', 'authelia', 'local'] },
    { id: 'rsnapshot', name: 'rsnapshot', description: 'Filesystem snapshot utility', category: 'backup-storage', logo: Archive, deploymentModes: ['traefik', 'authelia', 'local'] },
    
    // Cloud Storage & File Sharing
    { id: 'nextcloud', name: 'Nextcloud', description: 'Self-hosted cloud storage and collaboration', category: 'backup-storage', logo: Cloud, deploymentModes: ['traefik', 'authelia', 'local'] },
    { id: 'filerun', name: 'FileRun', description: 'Self-hosted file manager and sharing', category: 'backup-storage', logo: Files, deploymentModes: ['traefik', 'authelia'] },
    { id: 'projectsend', name: 'ProjectSend', description: 'Self-hosted file sharing', category: 'backup-storage', logo: Files, deploymentModes: ['traefik', 'authelia', 'local'] },
    
    // Mount & Storage Tools
    { id: 'mount-enhanced', name: 'Mount Enhanced', description: 'Advanced cloud storage mounting', category: 'backup-storage', logo: HardDrive, deploymentModes: ['traefik', 'authelia', 'local'] },
    { id: 'mount', name: 'Mount', description: 'Cloud storage mounting solution', category: 'backup-storage', logo: HardDrive, deploymentModes: ['traefik', 'authelia', 'local'] },
    { id: 'rclone-gui', name: 'Rclone GUI', description: 'Web interface for Rclone', category: 'backup-storage', logo: Cloud, deploymentModes: ['traefik', 'authelia', 'local'] }
  ],

  // 🌐 Web Services & Productivity
  [APP_CATEGORIES.WEB_PRODUCTIVITY.id]: [
    // Dashboards
    { id: 'homepage', name: 'Homepage', description: 'Modern dashboard for your homelab', category: 'web-productivity', logo: LayoutDashboard, deploymentModes: ['traefik', 'authelia', 'local'] },
    { id: 'heimdall', name: 'Heimdall', description: 'Application dashboard and launcher', category: 'web-productivity', logo: AppWindow, deploymentModes: ['traefik', 'authelia', 'local'] },
    { id: 'organizr', name: 'Organizr', description: 'Unified homepage for services', category: 'web-productivity', logo: LayoutDashboard, deploymentModes: ['traefik', 'authelia', 'local'] },
    { id: 'dashy', name: 'Dashy', description: 'Feature-rich dashboard', category: 'web-productivity', logo: LayoutDashboard, deploymentModes: ['traefik', 'authelia', 'local'] },
    { id: 'fenrus', name: 'Fenrus', description: 'Simple modern dashboard', category: 'web-productivity', logo: LayoutDashboard, deploymentModes: ['traefik', 'authelia', 'local'] },
    
    // Communication & Social
    { id: 'discord', name: 'Discord', description: 'Discord client in browser', category: 'web-productivity', logo: MessageSquarePlus, deploymentModes: ['local'] },
    { id: 'signal', name: 'Signal', description: 'Signal messenger client', category: 'web-productivity', logo: MessageSquarePlus, deploymentModes: ['local'] },
    { id: 'telegram', name: 'Telegram', description: 'Telegram client', category: 'web-productivity', logo: MessageSquarePlus, deploymentModes: ['local'] },
    { id: 'teamspeak', name: 'TeamSpeak', description: 'Voice communication server', category: 'web-productivity', logo: MessageSquarePlus, deploymentModes: ['traefik', 'authelia', 'local'] },
    
    // Content Management
    { id: 'wordpress', name: 'WordPress', description: 'Popular content management system', category: 'web-productivity', logo: Globe, deploymentModes: ['traefik', 'authelia', 'local'] },
    { id: 'wiki', name: 'Wiki.js', description: 'Modern wiki engine', category: 'web-productivity', logo: Book, deploymentModes: ['traefik', 'authelia', 'local'] },
    { id: 'joplin-server', name: 'Joplin Server', description: 'Note-taking server', category: 'web-productivity', logo: NotebookPen, deploymentModes: ['traefik', 'authelia', 'local'] },
    
    // RSS & News
    { id: 'freshrss', name: 'FreshRSS', description: 'Self-hosted RSS feed aggregator', category: 'web-productivity', logo: Rss, deploymentModes: ['local'] },
    
    // Utilities
    { id: 'bitwarden', name: 'Bitwarden', description: 'Password manager', category: 'web-productivity', logo: Key, deploymentModes: ['traefik', 'authelia', 'local'] },
    { id: 'librespeed', name: 'LibreSpeed', description: 'Self-hosted speedtest', category: 'web-productivity', logo: Zap, deploymentModes: ['local'] },
    { id: 'recipes', name: 'Recipes', description: 'Recipe management system', category: 'web-productivity', logo: Book, deploymentModes: ['local'] }
  ],

  // 🔧 System & Utilities
  [APP_CATEGORIES.SYSTEM_UTILITIES.id]: [
    // Container Management
    { id: 'portainer', name: 'Portainer', description: 'Docker container management GUI', category: 'system-utilities', logo: ContainerIcon, deploymentModes: ['traefik', 'authelia', 'local'] },
    { id: 'yacht', name: 'Yacht', description: 'Container management web interface', category: 'system-utilities', logo: ContainerIcon, deploymentModes: ['traefik', 'authelia', 'local'] },
    { id: 'watchtower', name: 'Watchtower', description: 'Automatic Docker container updates', category: 'system-utilities', logo: RefreshCw, deploymentModes: ['traefik', 'authelia', 'local'] },
    
    // System Tools
    { id: 'autoscan', name: 'Autoscan', description: 'Plex library scanner', category: 'system-utilities', logo: Scan, deploymentModes: ['traefik', 'authelia', 'local'] },
    { id: 'recyclarr', name: 'Recyclarr', description: 'TRaSH guides automation for *arr apps', category: 'system-utilities', logo: RefreshCw, deploymentModes: ['traefik', 'authelia', 'local'] },
    { id: 'olivetin', name: 'OliveTin', description: 'Web interface for shell commands', category: 'system-utilities', logo: Settings, deploymentModes: ['local'] },
    
    // Proxy & Network
    { id: 'traefik', name: 'Traefik', description: 'Modern reverse proxy', category: 'system-utilities', logo: Network, deploymentModes: ['traefik'] },
    { id: 'socket-proxy', name: 'Socket Proxy', description: 'Docker socket proxy', category: 'system-utilities', logo: Network, deploymentModes: ['traefik', 'authelia'] },
    
    // Utilities
    { id: 'sui', name: 'SUI', description: 'Simple startpage', category: 'system-utilities', logo: Home, deploymentModes: ['traefik', 'authelia', 'local'] },
    { id: 'endlessh', name: 'Endlessh', description: 'SSH honeypot', category: 'system-utilities', logo: Shield, deploymentModes: ['traefik', 'authelia', 'local'] },
    { id: 'dockupdater', name: 'Dockupdater', description: 'Docker container updater', category: 'system-utilities', logo: RefreshCw, deploymentModes: ['traefik', 'authelia'] }
  ],

  // 🎮 Gaming & Entertainment
  [APP_CATEGORIES.GAMING_ENTERTAINMENT.id]: [
    // Gaming
    { id: 'steam', name: 'Steam', description: 'Steam gaming platform', category: 'gaming-entertainment', logo: Gamepad2, deploymentModes: ['local'] },
    { id: 'crewlink', name: 'CrewLink', description: 'Among Us proximity voice chat', category: 'gaming-entertainment', logo: Gamepad2, deploymentModes: ['local'] },
    
    // Entertainment Tools
    { id: 'moviematch', name: 'MovieMatch', description: 'Movie recommendation and voting', category: 'gaming-entertainment', logo: Film, deploymentModes: ['traefik', 'authelia', 'local'] },
    { id: 'nowshowing', name: 'NowShowing', description: 'Plex dashboard for displays', category: 'gaming-entertainment', logo: Monitor, deploymentModes: ['traefik', 'authelia', 'local'] },
    { id: 'koel', name: 'Koel', description: 'Personal music streaming server', category: 'gaming-entertainment', logo: MusicIcon, deploymentModes: ['traefik', 'authelia', 'local'] },
    { id: 'bliss', name: 'Bliss', description: 'Music library organizer', category: 'gaming-entertainment', logo: MusicIcon, deploymentModes: ['local'] },
    
    // Virtual Desktops
    { id: 'webtop', name: 'Webtop', description: 'Linux desktop in browser', category: 'gaming-entertainment', logo: Monitor, deploymentModes: ['local'] },
    { id: 'kasmdesktop', name: 'Kasm Desktop', description: 'Virtual desktop infrastructure', category: 'gaming-entertainment', logo: Monitor, deploymentModes: ['local'] },
    { id: 'chrome', name: 'Chrome', description: 'Chrome browser in container', category: 'gaming-entertainment', logo: Globe, deploymentModes: ['local'] },
    { id: 'firefox', name: 'Firefox', description: 'Firefox browser in container', category: 'gaming-entertainment', logo: Globe, deploymentModes: ['local'] },
    { id: 'vlc', name: 'VLC', description: 'VLC media player in browser', category: 'gaming-entertainment', logo: PlayCircle, deploymentModes: ['local'] },
    
    // Media Processing
    { id: 'handbrake', name: 'HandBrake', description: 'Video transcoding tool', category: 'gaming-entertainment', logo: Video, deploymentModes: ['local'] },
    { id: 'makemkv', name: 'MakeMKV', description: 'DVD/Blu-ray ripping tool', category: 'gaming-entertainment', logo: Video, deploymentModes: ['local'] },
    { id: 'tdarr', name: 'Tdarr', description: 'Distributed media transcoding', category: 'gaming-entertainment', logo: Video, deploymentModes: ['local'] },
    { id: 'unmanic', name: 'Unmanic', description: 'Library optimisation tool', category: 'gaming-entertainment', logo: Video, deploymentModes: ['local'] }
  ]
};

// Helper function to get all apps across all categories
export const getAllApps = (): AppTemplate[] => {
  const allApps: AppTemplate[] = [];
  Object.values(categorizedApps).forEach(categoryApps => {
    allApps.push(...categoryApps);
  });
  return allApps;
};

// Helper function to get apps by category
export const getAppsByCategory = (categoryId: string): AppTemplate[] => {
  return categorizedApps[categoryId] || [];
};

// Helper function to search apps across all categories
export const searchApps = (query: string): AppTemplate[] => {
  const allApps = getAllApps();
  const lowercaseQuery = query.toLowerCase();
  
  return allApps.filter(app => 
    app.name.toLowerCase().includes(lowercaseQuery) ||
    app.description.toLowerCase().includes(lowercaseQuery) ||
    app.category.toLowerCase().includes(lowercaseQuery)
  );
};

export default categorizedApps;
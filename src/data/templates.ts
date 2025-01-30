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
  MessageCircle,
  Users,
  Webhook,
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
  Activity as ActivityIcon,
  Network as NetworkIcon
} from 'lucide-react';

export const appTemplates: AppTemplate[] = [
  // Infrastructure
  {
    id: 'traefik',
    name: 'Traefik',
    description: 'Modern reverse proxy and load balancer',
    category: 'infrastructure',
    logo: Network,
    defaultPorts: {
      web: 80,
      websecure: 443,
      admin: 8080
    },
    requiredPorts: ['web', 'websecure', 'admin'],
    configFields: [
      {
        name: 'domain',
        label: 'Domain',
        type: 'text',
        required: true,
        placeholder: 'example.com'
      },
      {
        name: 'email',
        label: 'Email (for Let\'s Encrypt)',
        type: 'text',
        required: true
      },
      {
        name: 'dashboard_port',
        label: 'Dashboard Port',
        type: 'number',
        required: true,
        defaultValue: '8080'
      }
    ]
  },
  {
    id: 'homepage',
    name: 'Homepage',
    description: 'Modern and clean dashboard for your homelab',
    category: 'infrastructure',
    logo: Home,
    defaultPorts: {
      web: 3000
    },
    requiredPorts: ['web'],
    configFields: [
      {
        name: 'domain',
        label: 'Domain',
        type: 'text',
        required: true,
        placeholder: 'example.com'
      }
    ]
  },
  {
    id: 'fenrus',
    name: 'Fenrus',
    description: 'Simple and modern dashboard',
    category: 'infrastructure',
    logo: LayoutDashboard,
    defaultPorts: {
      web: 3000
    },
    requiredPorts: ['web'],
    configFields: [
      {
        name: 'domain',
        label: 'Domain',
        type: 'text',
        required: true,
        placeholder: 'example.com'
      }
    ]
  },
  {
    id: 'heimdall',
    name: 'Heimdall',
    description: 'Application dashboard and launcher',
    category: 'infrastructure',
    logo: AppWindow,
    configFields: [
      {
        name: 'domain',
        label: 'Domain',
        type: 'text',
        required: true,
        placeholder: 'example.com'
      }
    ]
  },

  // Security
  {
    id: 'authelia',
    name: 'Authelia',
    description: 'Full-featured authentication server',
    category: 'security',
    logo: Lock,
    defaultPorts: {
      web: 9091
    },
    requiredPorts: ['web'],
    configFields: [
      {
        name: 'domain',
        label: 'Domain',
        type: 'text',
        required: true,
        placeholder: 'example.com'
      }
    ]
  },
  {
    id: 'authentik',
    name: 'Authentik',
    description: 'Identity provider & access management',
    category: 'security',
    logo: Lock,
    defaultPorts: {
      web: 9000,
      websecure: 9443
    },
    requiredPorts: ['web', 'websecure'],
    configFields: [
      {
        name: 'domain',
        label: 'Domain',
        type: 'text',
        required: true,
        placeholder: 'example.com'
      },
      {
        name: 'admin_email',
        label: 'Admin Email',
        type: 'text',
        required: true
      },
      {
        name: 'admin_password',
        label: 'Admin Password',
        type: 'password',
        required: true
      }
    ]
  },
  {
    id: 'vaultwarden',
    name: 'Vaultwarden',
    description: 'Lightweight Bitwarden server',
    category: 'security',
    logo: Key,
    configFields: [
      {
        name: 'domain',
        label: 'Domain',
        type: 'text',
        required: true,
        placeholder: 'example.com'
      },
      {
        name: 'admin_token',
        label: 'Admin Token',
        type: 'password',
        required: true
      }
    ]
  },

  // Monitoring
  {
    id: 'dozzle',
    name: 'Dozzle',
    description: 'Real-time Docker log viewer',
    category: 'monitoring',
    logo: ScrollText,
    configFields: [
      {
        name: 'domain',
        label: 'Domain',
        type: 'text',
        required: true,
        placeholder: 'example.com'
      }
    ]
  },
  {
    id: 'glances',
    name: 'Glances',
    description: 'System monitoring tool',
    category: 'monitoring',
    logo: MonitorSmartphone,
    configFields: [
      {
        name: 'domain',
        label: 'Domain',
        type: 'text',
        required: true,
        placeholder: 'example.com'
      }
    ]
  },
  {
    id: 'netdata',
    name: 'Netdata',
    description: 'Real-time performance monitoring',
    category: 'monitoring',
    logo: LineChart,
    configFields: [
      {
        name: 'domain',
        label: 'Domain',
        type: 'text',
        required: true,
        placeholder: 'example.com'
      }
    ]
  },
  {
    id: 'tautulli',
    name: 'Tautulli',
    description: 'Plex Media Server monitoring',
    category: 'monitoring',
    logo: BarChart2,
    configFields: [
      {
        name: 'domain',
        label: 'Domain',
        type: 'text',
        required: true,
        placeholder: 'example.com'
      },
      {
        name: 'plex_logs',
        label: 'Plex Logs Path',
        type: 'text',
        required: true,
        placeholder: '/path/to/plex/logs'
      }
    ]
  },
  {
    id: 'vnstat',
    name: 'vnStat',
    description: 'Network traffic monitor',
    category: 'monitoring',
    logo: NetworkIcon,
    configFields: [
      {
        name: 'domain',
        label: 'Domain',
        type: 'text',
        required: true,
        placeholder: 'example.com'
      }
    ]
  },
  {
    id: 'uptime-kuma',
    name: 'Uptime Kuma',
    description: 'Self-hosted uptime monitoring tool',
    category: 'monitoring',
    logo: Activity,
    configFields: [
      {
        name: 'domain',
        label: 'Domain',
        type: 'text',
        required: true,
        placeholder: 'example.com'
      }
    ]
  },
  {
    id: 'grafana',
    name: 'Grafana',
    description: 'Analytics and monitoring',
    category: 'monitoring',
    logo: Gauge,
    configFields: [
      {
        name: 'domain',
        label: 'Domain',
        type: 'text',
        required: true,
        placeholder: 'example.com'
      },
      {
        name: 'admin_password',
        label: 'Admin Password',
        type: 'password',
        required: true
      }
    ]
  },

  // Media
  {
    id: 'audiobookshelf',
    name: 'Audiobookshelf',
    description: 'Self-hosted audiobook server',
    category: 'media',
    logo: Headphones,
    configFields: [
      {
        name: 'domain',
        label: 'Domain',
        type: 'text',
        required: true,
        placeholder: 'example.com'
      },
      {
        name: 'audiobooks_path',
        label: 'Audiobooks Path',
        type: 'text',
        required: true,
        placeholder: '/path/to/audiobooks'
      },
      {
        name: 'metadata_path',
        label: 'Metadata Path',
        type: 'text',
        required: true,
        placeholder: '/path/to/metadata'
      }
    ]
  },
  {
    id: 'calibre-web',
    name: 'Calibre Web',
    description: 'Web app for accessing your Calibre library',
    category: 'media',
    logo: Library,
    configFields: [
      {
        name: 'domain',
        label: 'Domain',
        type: 'text',
        required: true,
        placeholder: 'example.com'
      },
      {
        name: 'books_path',
        label: 'Books Path',
        type: 'text',
        required: true,
        placeholder: '/path/to/books'
      }
    ]
  },
  {
    id: 'kometa',
    name: 'Kometa',
    description: 'Modern manga server and reader',
    category: 'media',
    logo: Book,
    configFields: [
      {
        name: 'domain',
        label: 'Domain',
        type: 'text',
        required: true,
        placeholder: 'example.com'
      }
    ]
  },
  {
    id: 'plex',
    name: 'Plex',
    description: 'Stream your media anywhere',
    category: 'media',
    logo: Video,
    defaultPorts: {
      web: 32400,
      dlna: 1900,
      gdm1: 32410,
      gdm2: 32412,
      gdm3: 32413,
      gdm4: 32414
    },
    requiredPorts: ['web', 'dlna', 'gdm1', 'gdm2', 'gdm3', 'gdm4'],
    configFields: [
      {
        name: 'domain',
        label: 'Domain',
        type: 'text',
        required: true,
        placeholder: 'example.com'
      },
      {
        name: 'claim_token',
        label: 'Plex Claim Token',
        type: 'text',
        required: true
      },
      {
        name: 'media_path',
        label: 'Media Library Path',
        type: 'text',
        required: true,
        placeholder: '/path/to/media'
      }
    ]
  },
  {
    id: 'jellyfin',
    name: 'Jellyfin',
    description: 'Open source media system',
    category: 'media',
    logo: Radio,
    defaultPorts: {
      web: 8096,
      https: 8920,
      dlna: 1900
    },
    requiredPorts: ['web', 'https', 'dlna'],
    configFields: [
      {
        name: 'domain',
        label: 'Domain',
        type: 'text',
        required: true,
        placeholder: 'example.com'
      },
      {
        name: 'media_path',
        label: 'Media Library Path',
        type: 'text',
        required: true,
        placeholder: '/path/to/media'
      }
    ]
  },
  {
    id: 'emby',
    name: 'Emby',
    description: 'Personal media server',
    category: 'media',
    logo: Tv2,
    defaultPorts: {
      web: 8096,
      https: 8920
    },
    requiredPorts: ['web', 'https'],
    configFields: [
      {
        name: 'domain',
        label: 'Domain',
        type: 'text',
        required: true,
        placeholder: 'example.com'
      },
      {
        name: 'media_path',
        label: 'Media Library Path',
        type: 'text',
        required: true,
        placeholder: '/path/to/media'
      }
    ]
  },
  {
    id: 'overseerr',
    name: 'Overseerr',
    description: 'Request management for Plex',
    category: 'media',
    logo: MessageSquarePlus,
    configFields: [
      {
        name: 'domain',
        label: 'Domain',
        type: 'text',
        required: true,
        placeholder: 'example.com'
      }
    ]
  },

  // Downloads
  {
    id: 'qbittorrent',
    name: 'qBittorrent',
    description: 'Feature-rich torrent client',
    category: 'downloads',
    logo: Download,
    defaultPorts: {
      web: 8080,
      tcp: 6881,
      udp: 6881
    },
    requiredPorts: ['web', 'tcp', 'udp'],
    configFields: [
      {
        name: 'domain',
        label: 'Domain',
        type: 'text',
        required: true,
        placeholder: 'example.com'
      },
      {
        name: 'webui_port',
        label: 'WebUI Port',
        type: 'number',
        required: true,
        defaultValue: '8080'
      },
      {
        name: 'downloads_path',
        label: 'Downloads Path',
        type: 'text',
        required: true,
        placeholder: '/path/to/downloads'
      }
    ]
  },
  {
    id: 'nzbget',
    name: 'NZBGet',
    description: 'Efficient Usenet downloader',
    category: 'downloads',
    logo: Download,
    defaultPorts: {
      web: 6789
    },
    requiredPorts: ['web'],
    configFields: [
      {
        name: 'domain',
        label: 'Domain',
        type: 'text',
        required: true,
        placeholder: 'example.com'
      },
      {
        name: 'downloads_path',
        label: 'Downloads Path',
        type: 'text',
        required: true,
        placeholder: '/path/to/downloads'
      },
      {
        name: 'control_password',
        label: 'Control Password',
        type: 'password',
        required: true
      }
    ]
  },

  // Development
  {
    id: 'cloudcmd',
    name: 'Cloud Commander',
    description: 'Web file manager',
    category: 'development',
    logo: Files,
    configFields: [
      {
        name: 'domain',
        label: 'Domain',
        type: 'text',
        required: true,
        placeholder: 'example.com'
      },
      {
        name: 'files_path',
        label: 'Files Path',
        type: 'text',
        required: true,
        placeholder: '/path/to/files'
      }
    ]
  },
  {
    id: 'dockge',
    name: 'Dockge',
    description: 'Docker compose stack manager',
    category: 'development',
    logo: ContainerIcon,
    configFields: [
      {
        name: 'domain',
        label: 'Domain',
        type: 'text',
        required: true,
        placeholder: 'example.com'
      },
      {
        name: 'stacks_path',
        label: 'Stacks Path',
        type: 'text',
        required: true,
        placeholder: '/path/to/stacks'
      }
    ]
  },
  {
    id: 'guacamole',
    name: 'Apache Guacamole',
    description: 'Clientless remote desktop gateway',
    category: 'development',
    logo: MonitorSmartphone,
    configFields: [
      {
        name: 'domain',
        label: 'Domain',
        type: 'text',
        required: true,
        placeholder: 'example.com'
      },
      {
        name: 'mysql_password',
        label: 'MySQL Password',
        type: 'password',
        required: true
      }
    ]
  },
  {
    id: 'it-tools',
    name: 'IT Tools',
    description: 'Collection of handy tools for developers',
    category: 'development',
    logo: ActivityIcon,
    configFields: [
      {
        name: 'domain',
        label: 'Domain',
        type: 'text',
        required: true,
        placeholder: 'example.com'
      }
    ]
  },
  {
    id: 'yacht',
    name: 'Yacht',
    description: 'Container management UI',
    category: 'development',
    logo: ContainerIcon,
    configFields: [
      {
        name: 'domain',
        label: 'Domain',
        type: 'text',
        required: true,
        placeholder: 'example.com'
      },
      {
        name: 'admin_email',
        label: 'Admin Email',
        type: 'text',
        required: true
      },
      {
        name: 'admin_password',
        label: 'Admin Password',
        type: 'password',
        required: true
      }
    ]
  },
  {
    id: 'gitea',
    name: 'Gitea',
    description: 'Lightweight self-hosted Git service',
    category: 'development',
    logo: GitBranch,
    defaultPorts: {
      web: 3000,
      ssh: 22
    },
    requiredPorts: ['web', 'ssh'],
    configFields: [
      {
        name: 'domain',
        label: 'Domain',
        type: 'text',
        required: true,
        placeholder: 'example.com'
      },
      {
        name: 'db_password',
        label: 'Database Password',
        type: 'password',
        required: true
      }
    ]
  },

  // Storage
  {
    id: 'linkwarden',
    name: 'Linkwarden',
    description: 'Self-hosted bookmark manager',
    category: 'storage',
    logo: Link,
    configFields: [
      {
        name: 'domain',
        label: 'Domain',
        type: 'text',
        required: true,
        placeholder: 'example.com'
      },
      {
        name: 'db_user',
        label: 'Database User',
        type: 'text',
        required: true
      },
      {
        name: 'db_password',
        label: 'Database Password',
        type: 'password',
        required: true
      },
      {
        name: 'auth_secret',
        label: 'Auth Secret',
        type: 'password',
        required: true
      }
    ]
  },
  {
    id: 'syncthing',
    name: 'Syncthing',
    description: 'Continuous file synchronization',
    category: 'storage',
    logo: RefreshCw,
    configFields: [
      {
        name: 'domain',
        label: 'Domain',
        type: 'text',
        required: true,
        placeholder: 'example.com'
      },
      {
        name: 'data_path',
        label: 'Data Path',
        type: 'text',
        required: true,
        placeholder: '/path/to/data'
      }
    ]
  },
  {
    id: 'paperless',
    name: 'Paperless-ngx',
    description: 'Document management system',
    category: 'storage',
    logo: FileText,
    configFields: [
      {
        name: 'domain',
        label: 'Domain',
        type: 'text',
        required: true,
        placeholder: 'example.com'
      },
      {
        name: 'secret_key',
        label: 'Secret Key',
        type: 'password',
        required: true
      },
      {
        name: 'admin_user',
        label: 'Admin Username',
        type: 'text',
        required: true
      },
      {
        name: 'admin_password',
        label: 'Admin Password',
        type: 'password',
        required: true
      }
    ]
  },
  {
    id: 'immich',
    name: 'Immich',
    description: 'Self-hosted photo and video backup solution',
    category: 'storage',
    logo: Image,
    configFields: [
      {
        name: 'domain',
        label: 'Domain',
        type: 'text',
        required: true,
        placeholder: 'example.com'
      },
      {
        name: 'db_password',
        label: 'Database Password',
        type: 'password',
        required: true
      }
    ]
  },

  // Automation
  {
    id: 'notifiarr',
    name: 'Notifiarr',
    description: 'Notification and request management',
    category: 'automation',
    logo: Bell,
    configFields: [
      {
        name: 'domain',
        label: 'Domain',
        type: 'text',
        required: true,
        placeholder: 'example.com'
      },
      {
        name: 'api_key',
        label: 'API Key',
        type: 'password',
        required: true
      }
    ]
  },
  {
    id: 'sonarr',
    name: 'Sonarr',
    description: 'TV series management',
    category: 'automation',
    logo: Rss,
    defaultPorts: {
      web: 8989
    },
    requiredPorts: ['web'],
    configFields: [
      {
        name: 'domain',
        label: 'Domain',
        type: 'text',
        required: true,
        placeholder: 'example.com'
      },
      {
        name: 'tv_path',
        label: 'TV Shows Path',
        type: 'text',
        required: true,
        placeholder: '/path/to/tv'
      },
      {
        name: 'downloads_path',
        label: 'Downloads Path',
        type: 'text',
        required: true,
        placeholder: '/path/to/downloads'
      }
    ]
  },
  {
    id: 'radarr',
    name: 'Radarr',
    description: 'Movie collection manager',
    category: 'automation',
    logo: BookOpenCheck,
    defaultPorts: {
      web: 7878
    },
    requiredPorts: ['web'],
    configFields: [
      {
        name: 'domain',
        label: 'Domain',
        type: 'text',
        required: true,
        placeholder: 'example.com'
      },
      {
        name: 'movies_path',
        label: 'Movies Path',
        type: 'text',
        required: true,
        placeholder: '/path/to/movies'
      },
      {
        name: 'downloads_path',
        label: 'Downloads Path',
        type: 'text',
        required: true,
        placeholder: '/path/to/downloads'
      }
    ]
  },
  {
    id: 'prowlarr',
    name: 'Prowlarr',
    description: 'Indexer manager/proxy',
    category: 'automation',
    logo: FileSearch,
    defaultPorts: {
      web: 9696
    },
    requiredPorts: ['web'],
    configFields: [
      {
        name: 'domain',
        label: 'Domain',
        type: 'text',
        required: true,
        placeholder: 'example.com'
      },
      {
        name: 'config_path',
        label: 'Config Path',
        type: 'text',
        required: true,
        placeholder: '/path/to/prowlarr/config'
      }
    ]
  },
  {
    id: 'autoscan',
    name: 'Autoscan',
    description: 'Media file system events monitor',
    category: 'automation',
    logo: Scan,
    configFields: [
      {
        name: 'domain',
        label: 'Domain',
        type: 'text',
        required: true,
        placeholder: 'example.com'
      },
      {
        name: 'config_path',
        label: 'Config Path',
        type: 'text',
        required: true,
        placeholder: '/path/to/autoscan/config'
      },
      {
        name: 'plex_url',
        label: 'Plex URL',
        type: 'text',
        required: true,
        placeholder: 'http://plex:32400'
      },
      {
        name: 'plex_token',
        label: 'Plex Token',
        type: 'password',
        required: true
      }
    ]
  },

  // Productivity
  {
    id: 'nextcloud',
    name: 'Nextcloud',
    description: 'Self-hosted productivity platform with files, calendar, and more',
    category: 'productivity',
    logo: Calendar,
    defaultPorts: {
      web: 80,
      websecure: 443
    },
    requiredPorts: ['web', 'websecure'],
    configFields: [
      {
        name: 'domain',
        label: 'Domain',
        type: 'text',
        required: true,
        placeholder: 'example.com'
      },
      {
        name: 'admin_user',
        label: 'Admin Username',
        type: 'text',
        required: true
      },
      {
        name: 'admin_password',
        label: 'Admin Password',
        type: 'password',
        required: true
      },
      {
        name: 'data_path',
        label: 'Data Path',
        type: 'text',
        required: true,
        placeholder: '/path/to/data'
      }
    ]
  },
  {
    id: 'joplin',
    name: 'Joplin Server',
    description: 'Your self-hosted note-taking and to-do application',
    category: 'productivity',
    logo: NotebookPen,
    configFields: [
      {
        name: 'domain',
        label: 'Domain',
        type: 'text',
        required: true,
        placeholder: 'example.com'
      },
      {
        name: 'admin_password',
        label: 'Admin Password',
        type: 'password',
        required: true
      }
    ]
  },

  // Communication
  {
    id: 'mailcow',
    name: 'Mailcow',
    description: 'Complete email server solution with antispam and webmail',
    category: 'communication',
    logo: Mail,
    defaultPorts: {
      web: 443,
      smtp: 25,
      smtps: 465,
      submission: 587,
      imaps: 993
    },
    requiredPorts: ['web', 'smtp', 'smtps', 'submission', 'imaps'],
    configFields: [
      {
        name: 'domain',
        label: 'Domain',
        type: 'text',
        required: true,
        placeholder: 'example.com'
      },
      {
        name: 'admin_password',
        label: 'Admin Password',
        type: 'password',
        required: true
      }
    ]
  },
  {
    id: 'rocketchat',
    name: 'Rocket.Chat',
    description: 'Team chat solution with video conferencing and file sharing',
    category: 'communication',
    logo: MessageCircle,
    defaultPorts: {
      web: 3000
    },
    requiredPorts: ['web'],
    configFields: [
      {
        name: 'domain',
        label: 'Domain',
        type: 'text',
        required: true,
        placeholder: 'example.com'
      },
      {
        name: 'admin_email',
        label: 'Admin Email',
        type: 'text',
        required: true
      },
      {
        name: 'admin_password',
        label: 'Admin Password',
        type: 'password',
        required: true
      }
    ]
  },
  {
    id: 'mattermost',
    name: 'Mattermost',
    description: 'Open source platform for secure collaboration',
    category: 'communication',
    logo: Users,
    defaultPorts: {
      web: 8065
    },
    requiredPorts: ['web'],
    configFields: [
      {
        name: 'domain',
        label: 'Domain',
        type: 'text',
        required: true,
        placeholder: 'example.com'
      },
      {
        name: 'admin_password',
        label: 'Admin Password',
        type: 'password',
        required: true
      }
    ]
  },
  {
    id: 'matrix',
    name: 'Matrix Synapse',
    description: 'Decentralized communication server',
    category: 'communication',
    logo: Webhook,
    defaultPorts: {
      web: 8008,
      federation: 8448
    },
    requiredPorts: ['web', 'federation'],
    configFields: [
      {
        name: 'domain',
        label: 'Domain',
        type: 'text',
        required: true,
        placeholder: 'example.com'
      },
      {
        name: 'admin_password',
        label: 'Admin Password',
        type: 'password',
        required: true
      }
    ]
  }
];
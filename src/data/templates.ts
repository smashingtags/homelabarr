import { AppTemplate } from '../types';
import { 
  Container, 
  Shield, 
  Video, 
  Radio,
  MonitorCheck,
  CloudCog,
  Network,
  Lock,
  Database,
  Download,
  Tv2,
  Rss,
  BookOpenCheck,
  HardDrive,
  Gauge,
  FileSearch,
  Search,
  Scan,
  Home,
  MessageSquarePlus,
  GitBranch,
  Key,
  Activity,
  FileText,
  RefreshCw,
  Image,
  ChevronDown,
  ChevronUp,
  Terminal,
  Calendar,
  NotebookPen,
  Mail,
  MessageCircle,
  Users,
  Webhook
} from 'lucide-react';

export const appTemplates: AppTemplate[] = [
  // Infrastructure
  {
    id: 'traefik',
    name: 'Traefik',
    description: 'Modern reverse proxy and load balancer',
    category: 'infrastructure',
    logo: Network,
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
    id: 'authentik',
    name: 'Authentik',
    description: 'Identity provider & access management',
    category: 'security',
    logo: Lock,
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
    id: 'plex',
    name: 'Plex',
    description: 'Stream your media anywhere',
    category: 'media',
    logo: Video,
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
    id: 'gitea',
    name: 'Gitea',
    description: 'Lightweight self-hosted Git service',
    category: 'development',
    logo: GitBranch,
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
    id: 'sonarr',
    name: 'Sonarr',
    description: 'TV series management',
    category: 'automation',
    logo: Rss,
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
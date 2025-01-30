import { X, HelpCircle } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HelpModal({ isOpen, onClose }: HelpModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <HelpCircle className="w-6 h-6 text-blue-600 dark:text-blue-400 mr-2" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Help & Documentation</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="flex-1 overflow-auto p-6">
          <div className="prose dark:prose-invert max-w-none">
            <h3>Quick Start Guide</h3>
            <ol>
              <li>Browse available applications in the categories above</li>
              <li>Click "Deploy" on your chosen application</li>
              <li>Fill in the required configuration</li>
              <li>Click "Deploy" to start the container</li>
            </ol>

            <h3>Managing Applications</h3>
            <ul>
              <li><strong>Start/Stop:</strong> Use the play/stop buttons</li>
              <li><strong>Restart:</strong> Click the refresh button</li>
              <li><strong>Remove:</strong> Click the trash button</li>
              <li><strong>Logs:</strong> Click the terminal button</li>
              <li><strong>Stats:</strong> Click the expand button</li>
            </ul>

            <h3>Application Categories</h3>
            <ul>
              <li><strong>Infrastructure:</strong> Core services like Traefik and Homepage</li>
              <li><strong>Security:</strong> Authentication and password management</li>
              <li><strong>Media:</strong> Streaming servers and media management</li>
              <li><strong>Downloads:</strong> Torrent and Usenet clients</li>
              <li><strong>Storage:</strong> File synchronization and document management</li>
              <li><strong>Monitoring:</strong> System and service monitoring</li>
              <li><strong>Automation:</strong> Media automation tools</li>
              <li><strong>Development:</strong> Development tools and services</li>
              <li><strong>Productivity:</strong> Notes and collaboration tools</li>
              <li><strong>Communication:</strong> Chat and email servers</li>
            </ul>

            <h3>Troubleshooting</h3>
            <h4>Common Issues</h4>
            <ul>
              <li><strong>Container won't start:</strong> Check logs for errors</li>
              <li><strong>Network issues:</strong> Verify Traefik configuration</li>
              <li><strong>Permission errors:</strong> Check volume permissions</li>
            </ul>

            <h3>Security Best Practices</h3>
            <ul>
              <li>Use strong passwords for all services</li>
              <li>Keep containers updated regularly</li>
              <li>Enable authentication for sensitive services</li>
              <li>Use SSL/TLS encryption</li>
              <li>Regular backups of important data</li>
            </ul>

            <h3>Need More Help?</h3>
            <p>
              For detailed documentation, please refer to the{' '}
              <a
                href="https://github.com/yourusername/homelabarr/blob/main/HELP.md"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                full documentation
              </a>
              .
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
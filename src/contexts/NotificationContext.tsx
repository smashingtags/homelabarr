import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface NotificationContextType {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id'>) => void;
  removeNotification: (id: string) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = useCallback((notification: Omit<Notification, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newNotification = { ...notification, id };

    setNotifications(prev => [...prev, newNotification]);

    // Auto-remove after duration (default 5 seconds)
    const duration = notification.duration ?? 5000;
    if (duration > 0) {
      setTimeout(() => {
        removeNotification(id);
      }, duration);
    }
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const success = useCallback((title: string, message?: string) => {
    addNotification({ type: 'success', title, message });
  }, [addNotification]);

  const error = useCallback((title: string, message?: string) => {
    addNotification({ type: 'error', title, message, duration: 8000 });
  }, [addNotification]);

  const warning = useCallback((title: string, message?: string) => {
    addNotification({ type: 'warning', title, message, duration: 6000 });
  }, [addNotification]);

  const info = useCallback((title: string, message?: string) => {
    addNotification({ type: 'info', title, message });
  }, [addNotification]);

  return (
    <NotificationContext.Provider value={{
      notifications,
      addNotification,
      removeNotification,
      success,
      error,
      warning,
      info
    }}>
      {children}
      <NotificationContainer />
    </NotificationContext.Provider>
  );
}

function NotificationContainer() {
  const { notifications, removeNotification } = useNotifications();

  const getIcon = (type: NotificationType) => {
    switch (type) {
      case 'success': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error': return <XCircle className="w-5 h-5 text-red-500" />;
      case 'warning': return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      case 'info': return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  const getStyles = (type: NotificationType) => {
    switch (type) {
      case 'success': return 'bg-green-50 dark:bg-green-900/50 border-green-200 dark:border-green-800';
      case 'error': return 'bg-red-50 dark:bg-red-900/50 border-red-200 dark:border-red-800';
      case 'warning': return 'bg-yellow-50 dark:bg-yellow-900/50 border-yellow-200 dark:border-yellow-800';
      case 'info': return 'bg-blue-50 dark:bg-blue-900/50 border-blue-200 dark:border-blue-800';
    }
  };

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`p-4 rounded-lg border shadow-lg animate-in slide-in-from-right-full ${getStyles(notification.type)}`}
        >
          <div className="flex items-start">
            <div className="flex-shrink-0">
              {getIcon(notification.type)}
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {notification.title}
              </h3>
              {notification.message && (
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                  {notification.message}
                </p>
              )}
              {notification.action && (
                <button
                  onClick={notification.action.onClick}
                  className="mt-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {notification.action.label}
                </button>
              )}
            </div>
            <button
              onClick={() => removeNotification(notification.id)}
              className="ml-4 flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
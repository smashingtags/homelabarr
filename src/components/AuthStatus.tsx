// import React from 'react'; // Not needed with new JSX transform
import { Shield, ShieldOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export function AuthStatus() {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    return (
      <div className="flex items-center px-3 py-1 bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-200 rounded-full text-xs">
        <ShieldOff className="w-3 h-3 mr-1" />
        Not Authenticated
      </div>
    );
  }

  return (
    <div className="flex items-center px-3 py-1 bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200 rounded-full text-xs">
      <Shield className="w-3 h-3 mr-1" />
      Authenticated as {user?.username}
    </div>
  );
}
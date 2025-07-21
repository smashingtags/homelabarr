import { useState, useCallback } from 'react';

export function useLoading(initialState = false) {
  const [loading, setLoading] = useState(initialState);

  const withLoading = useCallback(async <T>(
    asyncFn: () => Promise<T>,
    onSuccess?: (result: T) => void,
    onError?: (error: Error) => void
  ): Promise<T | undefined> => {
    setLoading(true);
    try {
      const result = await asyncFn();
      onSuccess?.(result);
      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      onError?.(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    setLoading,
    withLoading
  };
}
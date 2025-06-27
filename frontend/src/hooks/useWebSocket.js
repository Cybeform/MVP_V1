import { useEffect, useRef, useCallback } from 'react';
import { websocketService } from '../utils/api';

const useWebSocket = (userId, onMessage) => {
  const listenerKeyRef = useRef(null);

  const connect = useCallback(() => {
    if (userId && !listenerKeyRef.current) {
      const listenerKey = `hook_${Date.now()}_${Math.random()}`;
      listenerKeyRef.current = listenerKey;
      
      websocketService.connect(userId);
      websocketService.addListener(listenerKey, onMessage);
    }
  }, [userId, onMessage]);

  const disconnect = useCallback(() => {
    if (listenerKeyRef.current) {
      websocketService.removeListener(listenerKeyRef.current);
      listenerKeyRef.current = null;
    }
  }, []);

  const send = useCallback((message) => {
    websocketService.send(message);
  }, []);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return { send, disconnect };
};

export default useWebSocket; 
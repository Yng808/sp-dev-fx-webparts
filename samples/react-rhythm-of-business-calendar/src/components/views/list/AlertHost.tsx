import React, { useEffect, useState } from 'react';

// Alert bus logic
export type AlertType = 'success' | 'danger' | 'warning' | 'info';
export type AlertPayload = { message: string; type: AlertType };

type Listener = (payload: AlertPayload) => void;
const listeners = new Set<Listener>();

export function showAlert(message: string, type: AlertType = 'success') {
  listeners.forEach(listener => listener({ message, type }));
}

export function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
// Alert Host Component 
export const AlertHost: React.FC = () => {
  const [alert, setAlert] = useState<AlertPayload | null>(null);

  useEffect(() => {
    const unsubscribe = subscribe(payload => {
      setAlert(payload);
      setTimeout(() => setAlert(null), 3000);
    });
    return unsubscribe;
  }, []);

  if (!alert) return null;

  return (
    <div
      className={`alert alert-${alert.type} position-fixed top-0 end-0 m-3`}
      style={{ zIndex: 9999 }}
      role="alert"
    >
      {alert.message}
    </div>
  );
};

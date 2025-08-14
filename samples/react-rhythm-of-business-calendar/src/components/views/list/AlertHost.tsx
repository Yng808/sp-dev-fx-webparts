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
    });
    return unsubscribe;
  }, []);

  if (!alert) return null;

  return (
    <div
      className={`alert alert-${alert.type} position-fixed start-50 translate-middle-x m-3 d-flex justify-content-between align-items-center`}
      style={{ zIndex: 9999, minWidth: '300px', top: '80px', border: '2px solid #000', color: '#000' }}
      role="alert"
    >
      <h6>{alert.message}</h6>
      <button type="button" className="btn-close ms-3" aria-label="Close" onClick={() => setAlert(null)}/>
    </div>
  );
};

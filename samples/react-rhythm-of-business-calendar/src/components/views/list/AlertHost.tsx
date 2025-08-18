import React, { useEffect, useState } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import styles from './EventDetailsList.module.scss';

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
        <div className={`alert alert-${alert.type} position-fixed top-50 start-50 translate-middle m-3 d-flex justify-content-between align-items-center ${styles.alertButton}`} role="alert">
            <h6>{alert.message}</h6>
            <button type="button" className="btn-close ms-3" aria-label="Close" onClick={() => setAlert(null)}/>
        </div>
    );
};
// Confirm Dialog
export const ConfirmDialog: React.FC<{show: boolean; message: string; onConfirm: () => void; onCancel: () => void;}> = ({ show, message, onConfirm, onCancel }) => {
    if (!show) return null;

    return (
        <div className={`alert alert-warning position-fixed top-50 start-50 translate-middle m-3 d-flex flex-column justify-content-between align-items-center ${styles.alertButton}`} role="alert">
            <h6>{message}</h6>
            <div className="mt-2">
                <button type="button" className="btn btn-danger me-2" onClick={onConfirm}>Yes</button>
                <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
            </div>
        </div>
    );
};

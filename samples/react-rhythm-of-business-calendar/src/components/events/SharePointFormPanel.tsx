import * as React from 'react';
import { FC, useEffect } from 'react';

interface ISharePointFormPanelProps {
    isOpen: boolean;
    onDismiss: () => void;
    siteUrl: string;
    listId: string;
    itemId?: number;
    mode: 'new' | 'edit' | 'display';
    onSaved?: () => void;
}

export const SharePointFormPanel: FC<ISharePointFormPanelProps> = ({ isOpen, onDismiss, siteUrl, listId,  itemId, mode, onSaved }) => {
    useEffect(() => {
        if (!isOpen) return;

        let url = `${siteUrl}/_layouts/15/listform.aspx?ListId={${listId}}`;

        switch (mode) {
            case 'new':
                url += '&PageType=8'; // New item
                break;
            case 'edit':
                url += `&PageType=6&ID=${itemId}`; // Edit item
                break;
            case 'display':
                url += `&PageType=4&ID=${itemId}`; // Display item
                break;
        }

        const width = 1000;
        const height = 800;
        const left = Math.max(0, (window.screen.width - width) / 2);
        const top = Math.max(0, (window.screen.height - height) / 2);
        
        const popup = window.open(
            url,
            'SharePointForm',
            `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=yes,toolbar=no,menubar=no,location=no`
        );

        if (!popup) {
            console.error('Popup blocked. Please allow popups for this site.');
            alert('Please allow popups to open the SharePoint form.');
            onDismiss();
            return;
        }

        const interval = setInterval(() => {
            if (popup.closed) {
                clearInterval(interval);
                if (onSaved) {
                    onSaved();
                }
                onDismiss();
            }
        }, 500);

        return () => {
            clearInterval(interval);
            if (popup && !popup.closed) {
                popup.close();
            }
        };
    }, [isOpen, siteUrl, listId, itemId, mode, onSaved, onDismiss]);

    return null;
};
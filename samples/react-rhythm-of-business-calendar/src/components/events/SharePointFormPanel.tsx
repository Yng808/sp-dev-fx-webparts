import * as React from 'react';
import { FC, useEffect, useState } from 'react';
import { Panel, PanelType, Spinner, SpinnerSize } from '@fluentui/react';

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
    const [formUrl, setFormUrl] = useState<string>('');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!isOpen) {
            setFormUrl('');
            setIsLoading(true);
            return;
        }

        try {
        const allowedOrigin = window.location.origin;
        const targetOrigin = new URL(siteUrl).origin;

        if (targetOrigin !== allowedOrigin) {
            console.error("Blocked cross-origin form load:", siteUrl);
            setIsLoading(false);
            setFormUrl('');
            return;
        }

        let url = `${siteUrl}/_layouts/15/listform.aspx?ListId={${listId}}`;

        switch (mode) {
            case 'new':
                url += '&PageType=8'; // New item
                break;
            case 'edit':
                if (!itemId) return;
                url += `&PageType=6&ID=${itemId}`; // Edit item
                break;
            case 'display':
                if (!itemId) return;
                url += `&PageType=4&ID=${itemId}`; // Display item
                break;
        }

        url += '&pa=1'; // Power Apps custom

        setIsLoading(true);
        setFormUrl(url);

    } catch (err) {
        console.error("Invalid siteUrl format:", siteUrl);
        setIsLoading(false);
        setFormUrl('');
    }
    }, [isOpen, siteUrl, listId, itemId, mode]);

    const handleDismiss = () => {
        if (onSaved) { onSaved(); }
        onDismiss();
    };

    return (
        <Panel isOpen={isOpen} onDismiss={handleDismiss} type={PanelType.large} isLightDismiss={false} closeButtonAriaLabel="Close">
        {isLoading ? (
            <div style={{ padding: '20px', textAlign: 'center' }}>
                <Spinner size={SpinnerSize.large} label="Loading form..." />
            </div>
        ) : (
            <>
                <iframe 
                src={formUrl} 
                onLoad={() => setIsLoading(false)}
                sandbox="allow-scripts allow-same-origin allow-forms"
                referrerPolicy="no-referrer"
                style={{ width: '100%', height: 'calc(100vh - 150px)', border: 'none', display: 'block' }} 
                title="SharePoint Form"/>
            </>
        )}
        </Panel>
    );
};
import * as React from 'react';
import { FC, useEffect, useState } from 'react';
import { Panel, PanelType, MessageBar, MessageBarType, Spinner, SpinnerSize } from '@fluentui/react';

interface ISharePointFormPanelProps {
  isOpen: boolean;
  onDismiss: () => void;
  siteUrl: string;
  listId: string;
  itemId?: number;
  mode: 'new' | 'edit' | 'display';
  onSaved?: () => void;
}

export const SharePointFormPanel: FC<ISharePointFormPanelProps> = ({
  isOpen,
  onDismiss,
  siteUrl,
  listId,
  itemId,
  mode,
  onSaved
}) => {
  const [formUrl, setFormUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

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

    url += '&pa=1'; // Power Apps custom

    setFormUrl(url);
    setIsLoading(false);
  }, [isOpen, siteUrl, listId, itemId, mode]);

  const handleDismiss = () => {
    if (onSaved) {
      onSaved();
    }
    onDismiss();
  };

  const getHeaderText = () => {
    switch (mode) {
      case 'new':
        return 'New Item';
      case 'edit':
        return 'Edit Item';
      case 'display':
        return 'View Item';
      default:
        return 'Item';
    }
  };

  return (
    <Panel
      isOpen={isOpen}
      onDismiss={handleDismiss}
      type={PanelType.large}
      headerText={getHeaderText()}
      isLightDismiss={false}
      closeButtonAriaLabel="Close"
    >
      {isLoading ? (
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <Spinner size={SpinnerSize.large} label="Loading form..." />
        </div>
      ) : (
        <>
          <MessageBar messageBarType={MessageBarType.info} styles={{ root: { marginBottom: 10 } }}>
            This is the native SharePoint form for the external list.
            Click "Save" in the form to save changes, then close this panel.
          </MessageBar>
          
          <iframe
            src={formUrl}
            style={{
              width: '100%',
              height: 'calc(100vh - 150px)',
              border: 'none',
              display: 'block'
            }}
            title="SharePoint Form"
          />
        </>
      )}
    </Panel>
  );
};
import * as React from 'react';
import { FC, useState, useEffect, useCallback } from 'react';
import { Panel, PanelType, PrimaryButton, DefaultButton, TextField, Checkbox, Stack, MessageBar, MessageBarType, Separator, IconButton, DetailsList, DetailsListLayoutMode, SelectionMode, IColumn, ConstrainMode, CommandBar, ICommandBarItemProps } from 'office-ui-fabric-react';
import { ExternalListConfig } from 'model';

interface IExternalListsSettingsProps {
    isOpen: boolean;
    onDismiss: () => void;
    configs: ExternalListConfig[];
    onSave: (config: ExternalListConfig) => Promise<void>;
    onDelete: (configId: number) => Promise<void>;
    onRefresh: () => Promise<void>;
}

export const ExternalListsSettings: FC<IExternalListsSettingsProps> = ({ isOpen, onDismiss, configs, onSave, onDelete, onRefresh }) => {
    const [selectedConfig, setSelectedConfig] = useState<ExternalListConfig | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    useEffect(() => {
        if (!isOpen) {
        setSelectedConfig(null);
        setIsEditing(false);
        setErrorMessage('');
        setSuccessMessage('');
        }
    }, [isOpen]);

    const handleNew = useCallback(() => {
        const newConfig: ExternalListConfig = {
            id: '',
            siteUrl: '',
            listId: '',
            listTitle: '',
            viewId: '',
            titleField: 'Title',
            eventDate: 'EventDate',       
            endDate: 'EndDate',         
            categoryField: '',
            enabled: true
        };
        setSelectedConfig(newConfig);
        setIsEditing(true);
    }, [configs.length]);

    const handleEdit = useCallback((config: ExternalListConfig) => {
        setSelectedConfig({ ...config });
        setIsEditing(true);
    }, []);

    const handleDelete = useCallback(async (config: ExternalListConfig) => {
        if (!config.id) return;
        if (window.confirm('Delete this configuration?')) {
            try {
                setIsSaving(true);
                await onDelete(Number(config.id));
                await onRefresh();
            } finally {
                setIsSaving(false);
            }
        }
    }, [onDelete, onRefresh]);

    const updateConfig = useCallback((patch: Partial<ExternalListConfig>) => {
        setSelectedConfig(c => c ? { ...c, ...patch } : c);
    }, []);

    const handleSave = useCallback(async () => {
        if (!selectedConfig) return;

        if (!selectedConfig.siteUrl || !selectedConfig.listId || !selectedConfig.titleField || !selectedConfig.eventDate) {
            setErrorMessage('Required fields are missing');
            return;
        }

        try {
            setIsSaving(true);
            await onSave(selectedConfig);
            await onRefresh();
            setIsEditing(false);
            setSelectedConfig(null);
            setSuccessMessage('Configuration saved');
        } catch (e: any) {
            setErrorMessage(e.message || 'Save failed');
        } finally {
            setIsSaving(false);
        }
    }, [selectedConfig, onSave, onRefresh]);

    const columns: IColumn[] = [
        { key: 'listTitle', name: 'List', minWidth: 200, onRender: (i: ExternalListConfig) => i.listTitle || i.listId },
        { key: 'siteUrl', name: 'Site', minWidth: 250, onRender: (i: ExternalListConfig) => i.siteUrl },
        { key: 'enabled', name: 'Enabled', minWidth: 70, onRender: (i: ExternalListConfig) => <Checkbox checked={i.enabled} disabled /> },
        { key: 'actions', name: '', minWidth: 80, onRender: (i: ExternalListConfig) => (
            <Stack horizontal tokens={{ childrenGap: 4 }}>
                <IconButton iconProps={{ iconName: 'Edit' }} onClick={() => handleEdit(i)} />
                <IconButton iconProps={{ iconName: 'Delete' }} onClick={() => handleDelete(i)} />
            </Stack>
        )
        }
    ];

    const commandBarItems: ICommandBarItemProps[] = [
        { key: 'new', text: 'New', iconProps: { iconName: 'Add' }, onClick: handleNew },
        { key: 'refresh', text: 'Refresh', iconProps: { iconName: 'Refresh' }, onClick: onRefresh }
    ];

    return (
        <Panel isOpen={isOpen} onDismiss={onDismiss} type={PanelType.large} headerText="External Lists Configuration">
            <Stack tokens={{ childrenGap: 12 }}>
                {errorMessage && <MessageBar messageBarType={MessageBarType.error}>{errorMessage}</MessageBar>}
                {successMessage && <MessageBar messageBarType={MessageBarType.success}>{successMessage}</MessageBar>}

                {!isEditing && (
                <>
                    <CommandBar items={commandBarItems} />
                    <DetailsList items={configs} columns={columns} selectionMode={SelectionMode.none} layoutMode={DetailsListLayoutMode.justified} constrainMode={ConstrainMode.unconstrained}/>
                </>
                )}

                {isEditing && selectedConfig && (
                <>
                    <TextField label="Site URL" value={selectedConfig.siteUrl} onChange={(_, v) => updateConfig({ siteUrl: v || '' })} />
                    <TextField label="List ID" value={selectedConfig.listId} onChange={(_, v) => updateConfig({ listId: v || '' })} />
                    <TextField label="List Title" value={selectedConfig.listTitle} onChange={(_, v) => updateConfig({ listTitle: v || '' })} />

                    <Separator />

                    <TextField label="Title Field" value={selectedConfig.titleField} onChange={(_, v) => updateConfig({ titleField: v || '' })} />
                    <TextField label="Start Date Field" value={selectedConfig.eventDate} onChange={(_, v) => updateConfig({ eventDate: v || '' })} />
                    <TextField label="End Date Field" value={selectedConfig.endDate} onChange={(_, v) => updateConfig({ endDate: v || '' })} />
                    <TextField label="Category Field" value={selectedConfig.categoryField} onChange={(_, v) => updateConfig({ categoryField: v || '' })} />

                    <Separator />

                    <Checkbox label="Enabled" checked={selectedConfig.enabled} onChange={(_, v) => updateConfig({ enabled: !!v })} />

                    <Stack horizontal tokens={{ childrenGap: 8 }}>
                        <PrimaryButton text="Save" onClick={handleSave} disabled={isSaving} />
                        <DefaultButton text="Cancel" onClick={() => setIsEditing(false)} />
                    </Stack>
                </>
                )}
            </Stack>
        </Panel>
    );
};
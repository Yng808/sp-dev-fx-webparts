import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { Checkbox, DefaultButton, IconButton, MessageBar, MessageBarType, Panel, PanelType, PrimaryButton, Spinner, Stack, Text, TextField } from '@fluentui/react';
import { SPHttpClient, SPHttpClientResponse } from '@microsoft/sp-http';
import { sp } from '@pnp/sp';
import { IDropdownOption } from 'office-ui-fabric-react/lib/components/Dropdown';
import { useSpfxContext } from 'services';
import { ExternalListsConfigList_Title } from '../../schema/lists/ExternalListsConfigList';
import { Defaults } from '../../schema/Defaults';
import AsyncDropdown from '../../webparts/rhythmOfBusinessCalendar/components/PropertyPaneAsyncDropdown';

interface IProps {
    isOpen: boolean;
    onDismiss: () => void;
    onSaved: () => Promise<void> | void;
}

interface IConfigRow {
    clientId: string;
    id?: number;
    title: string;
    siteUrl: string;
    listId: string;
    refinerValueId?: string;
    viewId?: string;
    titleField: string;
    eventDate: string;
    endDate?: string;
    approvalStatus?: string;
    locationField?: string;
    enabled: boolean;
    dateOnly: boolean;
}

interface IListSummary {
    Id: string;
    Title: string;
    Hidden?: boolean;
}

interface IViewSummary {
    Id: string;
    Title: string;
    Hidden?: boolean;
    PersonalView?: boolean;
    ServerRelativeUrl?: string;
}

interface IFieldSummary {
    InternalName: string;
    Title: string;
    TypeAsString: string;
    ReadOnlyField?: boolean;
    Hidden?: boolean;
    OutputType?: number;
}

const gridTemplateColumns = '160px 90px 90px 280px 180px 180px 160px 150px 150px 150px 150px 150px 44px';

const createRow = (): IConfigRow => ({
    clientId: `external-list-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: '',
    enabled: true,
    dateOnly: true,
    siteUrl: '',
    listId: '',
    viewId: '',
    refinerValueId: '',
    approvalStatus: '',
    titleField: '',
    eventDate: '',
    endDate: '',
    locationField: ''
});

const normalizeSiteUrl = (rawValue?: string, allowedOrigin?: string): string => {
    const value = (rawValue || '').trim();

    if (!value) { return ''; }

    try {
        const url = new URL(value);

        if (allowedOrigin && url.origin.toLowerCase() !== allowedOrigin.toLowerCase()) {
            return '';
        }

        let pathname = url.pathname.replace(/\/$/, '');
        const lowerPath = pathname.toLowerCase();
        const splitTokens = ['/lists/', '/pages/', '/sitepages/', '/_layouts/'];

        for (const token of splitTokens) {
            const index = lowerPath.indexOf(token);
            if (index >= 0) {
                pathname = pathname.substring(0, index);
                break;
            }
        }

        return `${url.origin}${pathname}`.replace(/\/$/, '');
    } catch {
        return '';
    }
};

const toFieldOptions = ( fields: IFieldSummary[], filter: (field: IFieldSummary) => boolean, includeBlank = false ): IDropdownOption[] => {
    const options = fields
        .filter(filter)
        .map(field => ({
            key: field.InternalName,
            text: field.Title || field.InternalName,
            title: field.Title && field.Title !== field.InternalName
                ? `${field.Title} (${field.InternalName})`
                : field.InternalName
        }) as IDropdownOption);

    return includeBlank ? [{ key: '', text: '(none)' }, ...options] : options;
};

const ExternalListsManagerPanel: FC<IProps> = ({ isOpen, onDismiss, onSaved }) => {
    const spfxContext = useSpfxContext();
    const webUrl = spfxContext.pageContext.web.absoluteUrl;
    const webOrigin = new URL(webUrl).origin;
    const spHttpClient = spfxContext.spHttpClient;

    const [rows, setRows] = useState<IConfigRow[]>([]);
    const [originalRows, setOriginalRows] = useState<IConfigRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string>();

    const listItemsEndpoint = useMemo(
        () => `${webUrl}/_api/web/lists/getbytitle('${ExternalListsConfigList_Title.replace(/'/g, "''")}')/items`,
        [webUrl]
    );
    const refinerValuesEndpoint = useMemo(
        () => `${webUrl}/_api/web/lists/getbytitle('${Defaults.ListTitles.RefinerValues.replace(/'/g, "''")}')/items`,
        [webUrl]
    );

    const withCacheBust = useCallback((url: string): string => {
        const separator = url.includes('?') ? '&' : '?';
        return `${url}${separator}_robts=${Date.now()}`;
    }, []);

    const readJson = useCallback(async (response: SPHttpClientResponse): Promise<any> => {
        if (!response.ok) {
            let details = response.statusText || '';

            try {
                const data = await response.json();
                details = data?.error?.message?.value || data?.error?.message || details;
            } catch {
                try {
                    details = await response.text();
                } catch {
                    // ignore
                }
            }

            throw new Error(`HTTP ${response.status}: ${details}`);
        }

        return response.json();
    }, []);

    const updateRow = useCallback((clientId: string, updater: (row: IConfigRow) => IConfigRow) => {
        setRows(currentRows => currentRows.map(row => row.clientId === clientId ? updater(row) : row));
    }, []);

    const loadRows = useCallback(async () => {
        setLoading(true);
        setError(undefined);

        try {
            const response = await spHttpClient.get(
                withCacheBust(
                    `${listItemsEndpoint}?$select=Id,Title,IsEnabled,IsDateOnly,SiteUrl,ListId,ViewId,RefinerValueId,ApprovalStatus,TitleField,EventDate,EndDate,LocationField&$orderby=Id`
                ),
                SPHttpClient.configurations.v1
            );
            const data = await readJson(response);
            const nextRows: IConfigRow[] = (data.value || []).map((item: any) => ({
                clientId: `external-list-${item.Id}`,
                id: item.Id,
                title: item.Title || '',
                enabled: item.IsEnabled === true || item.IsEnabled === 1 || String(item.IsEnabled).toLowerCase() === 'yes',
                dateOnly: item.IsDateOnly === true || item.IsDateOnly === 1 || String(item.IsDateOnly).toLowerCase() === 'yes',
                siteUrl: item.SiteUrl || '',
                listId: item.ListId || '',
                viewId: item.ViewId || '',
                refinerValueId: item.RefinerValueId ? String(item.RefinerValueId) : '',
                approvalStatus: item.ApprovalStatus || '',
                titleField: item.TitleField || '',
                eventDate: item.EventDate || '',
                endDate: item.EndDate || '',
                locationField: item.LocationField || ''
            }));

            setRows(nextRows);
            setOriginalRows(nextRows);
        } catch (loadError) {
            console.error(loadError);
            setError((loadError as Error).message || 'Failed to load external lists.');
        } finally {
            setLoading(false);
        }
    }, [listItemsEndpoint, readJson, spHttpClient, withCacheBust]);

    useEffect(() => {
        if (isOpen) {
            loadRows().catch(console.error);
        }
    }, [isOpen, loadRows]);

    const loadListOptions = useCallback(async (siteUrl?: string): Promise<IDropdownOption[]> => {
        const normalized = normalizeSiteUrl(siteUrl, webOrigin);
        if (!normalized) {
            return [];
        }

        const response = await spHttpClient.get(
            withCacheBust(
                `${normalized}/_api/web/lists?$select=Id,Title,Hidden,IsCatalog&$filter=Hidden eq false and IsCatalog eq false&$orderby=Title`
            ),
            SPHttpClient.configurations.v1
        );
        const data = await readJson(response);

        return (data.value || [])
            .filter((list: IListSummary) => !list.Hidden)
            .map((list: IListSummary) => ({
                key: list.Id,
                text: list.Title,
                title: `${list.Title} (${list.Id})`
            }) as IDropdownOption);
    }, [readJson, spHttpClient, webOrigin, withCacheBust]);

    const loadViewOptions = useCallback(async (siteUrl: string, listId: string): Promise<IDropdownOption[]> => {
        if (!listId) {
            return [{ key: '', text: '' }];
        }

        const response = await spHttpClient.get(
            withCacheBust(
                `${normalizeSiteUrl(siteUrl, webOrigin)}/_api/web/lists(guid'${listId}')/views?$select=Id,Title,Hidden,PersonalView,ServerRelativeUrl&$filter=Hidden eq false and PersonalView eq false&$orderby=Title`
            ),
            SPHttpClient.configurations.v1
        );
        const data = await readJson(response);
        const options: IDropdownOption[] = [{ key: '', text: '' }];

        (data.value || [])
            .filter((view: IViewSummary) => !view.Hidden && !view.PersonalView)
            .filter((view: IViewSummary) => !(view.ServerRelativeUrl || '').toLowerCase().endsWith('/calendar.aspx'))
            .forEach((view: IViewSummary) => {
                options.push({
                    key: view.Id,
                    text: view.Title,
                    title: `${view.Title} (${view.Id})`
                });
            });

        return options;
    }, [readJson, spHttpClient, withCacheBust, webOrigin]);

    const loadFieldOptions = useCallback(async (siteUrl: string, listId: string): Promise<IFieldSummary[]> => {
        if (!listId) {
            return [];
        }

        const response = await spHttpClient.get(
            withCacheBust(
                `${normalizeSiteUrl(siteUrl, webOrigin)}/_api/web/lists(guid'${listId}')/fields?$select=InternalName,Title,ReadOnlyField,TypeAsString,Hidden,OutputType&$filter=Hidden eq false&$orderby=Title`
            ),
            SPHttpClient.configurations.v1
        );
        const data = await readJson(response);
        return data.value || [];
    }, [readJson, spHttpClient, webOrigin, withCacheBust]);

    const loadRefinerValueOptions = useCallback(async (): Promise<IDropdownOption[]> => {
        const response = await spHttpClient.get(
            withCacheBust(
                `${refinerValuesEndpoint}?$select=Id,Title,Archived&$filter=Archived ne 1&$orderby=Title`
            ),
            SPHttpClient.configurations.v1
        );
        const data = await readJson(response);

        return (data.value || []).map((item: { Id: number; Title?: string }) => ({
            key: String(item.Id),
            text: item.Title || String(item.Id),
            title: `${item.Title || item.Id} (${item.Id})`
        }) as IDropdownOption);
    }, [readJson, refinerValuesEndpoint, spHttpClient, withCacheBust]);

    const validateRows = useCallback((): string | undefined => {
        const invalidRow = rows.find(row =>
            !(row.title || '').trim() ||
            !normalizeSiteUrl(row.siteUrl, webOrigin) ||
            !row.listId ||
            !(row.refinerValueId || '').trim() ||
            !row.titleField ||
            !row.eventDate ||
            !row.endDate
        );

        if (!invalidRow) {
            return undefined;
        }

        return `Each row needs a config Title, same-tenant Site URL, List, Refiner Value, Event Title, Start Date, and End Date before saving.`;
    }, [rows, webOrigin]);

    const persistRow = useCallback(async (row: IConfigRow): Promise<void> => {
        const payload = {
            Title: (row.title || '').trim(),
            IsEnabled: row.enabled,
            IsDateOnly: row.dateOnly,
            SiteUrl: normalizeSiteUrl(row.siteUrl, webOrigin),
            ListId: row.listId,
            ViewId: row.viewId || null,
            RefinerValueId: (row.refinerValueId || '').trim(),
            ApprovalStatus: row.approvalStatus || '',
            TitleField: row.titleField,
            EventDate: row.eventDate,
            EndDate: row.endDate || '',
            LocationField: row.locationField || ''
        };

        const items = sp.web.lists.getByTitle(ExternalListsConfigList_Title).items;

        if (row.id) {
            await items.getById(row.id).update(payload, '*');
            return;
        }

        await items.add(payload);
    }, [webOrigin]);

    const deleteRowItem = useCallback(async (id: number): Promise<void> => {
        await sp.web.lists.getByTitle(ExternalListsConfigList_Title).items.getById(id).delete();
    }, []);

    const handleSave = useCallback(async () => {
        const validationError = validateRows();
        if (validationError) {
            setError(validationError);
            return;
        }

        setSaving(true);
        setError(undefined);

        try {
            for (let index = 0; index < rows.length; index++) {
                const row = rows[index];
                try {
                    await persistRow(row);
                } catch (rowError) {
                    throw new Error(`Row ${index + 1} (${row.listId || row.siteUrl || 'new row'}): ${(rowError as Error).message}`);
                }
            }

            const deletedIds = originalRows
                .filter(originalRow => originalRow.id && !rows.some(currentRow => currentRow.id === originalRow.id))
                .map(row => row.id as number);

            for (const id of deletedIds) {
                await deleteRowItem(id);
            }

            await loadRows();
            await onSaved();
            onDismiss();
        } catch (saveError) {
            console.error(saveError);
            setError((saveError as Error).message || 'Failed to save external lists.');
        } finally {
            setSaving(false);
        }
    }, [deleteRowItem, loadRows, onDismiss, onSaved, originalRows, persistRow, rows, validateRows]);

    const headerCell = (label: string) => (
        <Text variant="smallPlus" styles={{ root: { fontWeight: 600 } }}>{label}</Text>
    );

    return (
        <Panel
            isOpen={isOpen}
            onDismiss={onDismiss}
            type={PanelType.custom}
            customWidth="95vw"
            isLightDismiss={false}
            closeButtonAriaLabel="Close"
            headerText="Manage External Lists"
            onRenderFooterContent={() => (
                <Stack horizontal tokens={{ childrenGap: 8 }}>
                    <PrimaryButton text="Save" onClick={handleSave} disabled={saving || loading} />
                    <DefaultButton text="Cancel" onClick={onDismiss} disabled={saving} />
                </Stack>
            )}
            isFooterAtBottom
        >
            <Stack tokens={{ childrenGap: 12 }}>
                <Text>
                    Select the site, list, view, and fields here. Changes are saved to the{' '}
                    <strong>{ExternalListsConfigList_Title}</strong> list for this calendar.
                </Text>

                {error && <MessageBar messageBarType={MessageBarType.error}>{error}</MessageBar>}

                <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
                    <Text variant="mediumPlus">External Lists Confiugration</Text>
                    <DefaultButton
                        text="Add row"
                        iconProps={{ iconName: 'Add' }}
                        onClick={() => setRows(currentRows => [...currentRows, createRow()])}
                        disabled={loading || saving}
                    />
                </Stack>

                {loading ? (
                    <Spinner label="Loading external lists..." />
                ) : (
                    <div style={{ overflowX: 'auto', paddingBottom: 8 }}>
                        <div style={{ minWidth: 1936 }}>
                            <div
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns,
                                    gap: 8,
                                    alignItems: 'center',
                                    marginBottom: 8,
                                    paddingBottom: 8,
                                    borderBottom: '1px solid #ddd'
                                }}
                            >
                                {headerCell('Title')}
                                {headerCell('Show in Calendar')}
                                {headerCell('Date Only')}
                                {headerCell('Site URL')}
                                {headerCell('List')}
                                {headerCell('View')}
                                {headerCell('Refiner Value')}
                                {headerCell('Approval Status')}
                                {headerCell('Event Title')}
                                {headerCell('Start Date')}
                                {headerCell('End Date')}
                                {headerCell('Location')}
                                <span />
                            </div>

                            {rows.length === 0 && (
                                <Text styles={{ root: { color: '#666' } }}>
                                    No external lists configured yet.
                                </Text>
                            )}

                            {rows.map(row => (
                                <div
                                    key={row.clientId}
                                style={{
                                        display: 'grid',
                                        gridTemplateColumns,
                                        gap: 8,
                                        alignItems: 'center',
                                        marginBottom: 8
                                    }}
                                >
                                    <TextField
                                        value={row.title}
                                        onChange={(_, value) => updateRow(row.clientId, currentRow => ({
                                            ...currentRow,
                                            title: value || ''
                                        }))}
                                    />
                                    <Checkbox
                                        checked={row.enabled}
                                        onChange={(_, checked) => updateRow(row.clientId, currentRow => ({
                                            ...currentRow,
                                            enabled: !!checked
                                        }))}
                                    />
                                    <Checkbox
                                        checked={row.dateOnly}
                                        onChange={(_, checked) => updateRow(row.clientId, currentRow => ({
                                            ...currentRow,
                                            dateOnly: !!checked
                                        }))}
                                    />
                                    <TextField
                                        value={row.siteUrl}
                                        onChange={(_, value) => updateRow(row.clientId, currentRow => ({
                                            ...currentRow,
                                            siteUrl: value || '',
                                            listId: '',
                                            refinerValueId: '',
                                            viewId: '',
                                            titleField: '',
                                            eventDate: '',
                                            endDate: '',
                                            approvalStatus: '',
                                            locationField: ''
                                        }))}
                                    />
                                    <AsyncDropdown
                                        key={`${row.clientId}-list-${row.siteUrl}`}
                                        selectedKey={row.listId}
                                        stateKey={normalizeSiteUrl(row.siteUrl, webOrigin)}
                                        disabled={!normalizeSiteUrl(row.siteUrl, webOrigin)}
                                        loadOptions={() => loadListOptions(row.siteUrl)}
                                        onChange={(option?: IDropdownOption) => updateRow(row.clientId, currentRow => ({
                                            ...currentRow,
                                            listId: String(option?.key || ''),
                                            viewId: '',
                                            titleField: '',
                                            eventDate: '',
                                            endDate: '',
                                            approvalStatus: '',
                                            locationField: ''
                                        }))}
                                        onError={message => setError(message || undefined)}
                                    />
                                    <AsyncDropdown
                                        key={`${row.clientId}-view-${row.listId}`}
                                        selectedKey={row.viewId}
                                        stateKey={row.listId}
                                        disabled={!row.listId}
                                        loadOptions={() => loadViewOptions(row.siteUrl, row.listId)}
                                        onChange={(option?: IDropdownOption) => updateRow(row.clientId, currentRow => ({
                                            ...currentRow,
                                            viewId: option?.key ? String(option.key) : ''
                                        }))}
                                        onError={message => setError(message || undefined)}
                                    />
                                    <AsyncDropdown
                                        key={`${row.clientId}-refinerValue`}
                                        selectedKey={row.refinerValueId}
                                        stateKey="refiner-values"
                                        disabled={false}
                                        loadOptions={loadRefinerValueOptions}
                                        onChange={(option?: IDropdownOption) => updateRow(row.clientId, currentRow => ({
                                            ...currentRow,
                                            refinerValueId: option?.key ? String(option.key) : ''
                                        }))}
                                        onError={message => setError(message || undefined)}
                                    />
                                    <AsyncDropdown
                                        key={`${row.clientId}-approval-${row.listId}`}
                                        selectedKey={row.approvalStatus || undefined}
                                        stateKey={row.listId}
                                        disabled={!row.listId}
                                        loadOptions={() => loadFieldOptions(row.siteUrl, row.listId).then(fields =>
                                            toFieldOptions(fields, field => !field.Hidden, true)
                                        )}
                                        onChange={(option?: IDropdownOption) => updateRow(row.clientId, currentRow => ({
                                            ...currentRow,
                                            approvalStatus: option?.key ? String(option.key) : ''
                                        }))}
                                        onError={message => setError(message || undefined)}
                                    />
                                    <AsyncDropdown
                                        key={`${row.clientId}-title-${row.listId}`}
                                        selectedKey={row.titleField}
                                        stateKey={row.listId}
                                        disabled={!row.listId}
                                        loadOptions={() => loadFieldOptions(row.siteUrl, row.listId).then(fields =>
                                            toFieldOptions(fields, field =>
                                                field.TypeAsString === 'Calculated' ||
                                                (!field.ReadOnlyField && ['Text', 'Choice', 'Lookup', 'User', 'File'].includes(field.TypeAsString))
                                            )
                                        )}
                                        onChange={(option?: IDropdownOption) => updateRow(row.clientId, currentRow => ({
                                            ...currentRow,
                                            titleField: option?.key ? String(option.key) : ''
                                        }))}
                                        onError={message => setError(message || undefined)}
                                    />
                                    <AsyncDropdown
                                        key={`${row.clientId}-eventDate-${row.listId}`}
                                        selectedKey={row.eventDate}
                                        stateKey={row.listId}
                                        disabled={!row.listId}
                                        loadOptions={() => loadFieldOptions(row.siteUrl, row.listId).then(fields =>
                                            toFieldOptions(fields, field =>
                                                field.TypeAsString === 'DateTime' ||
                                                (field.TypeAsString === 'Calculated' && field.OutputType === 4)
                                            )
                                        )}
                                        onChange={(option?: IDropdownOption) => updateRow(row.clientId, currentRow => ({
                                            ...currentRow,
                                            eventDate: option?.key ? String(option.key) : ''
                                        }))}
                                        onError={message => setError(message || undefined)}
                                    />
                                    <AsyncDropdown
                                        key={`${row.clientId}-endDate-${row.listId}`}
                                        selectedKey={row.endDate}
                                        stateKey={row.listId}
                                        disabled={!row.listId}
                                        loadOptions={() => loadFieldOptions(row.siteUrl, row.listId).then(fields =>
                                            toFieldOptions(fields, field =>
                                                field.TypeAsString === 'DateTime' ||
                                                (field.TypeAsString === 'Calculated' && field.OutputType === 4)
                                            )
                                        )}
                                        onChange={(option?: IDropdownOption) => updateRow(row.clientId, currentRow => ({
                                            ...currentRow,
                                            endDate: option?.key ? String(option.key) : ''
                                        }))}
                                        onError={message => setError(message || undefined)}
                                    />
                                    <AsyncDropdown
                                        key={`${row.clientId}-location-${row.listId}`}
                                        selectedKey={row.locationField || undefined}
                                        stateKey={row.listId}
                                        disabled={!row.listId}
                                        loadOptions={() => loadFieldOptions(row.siteUrl, row.listId).then(fields =>
                                            toFieldOptions(fields, field =>
                                                field.TypeAsString === 'Calculated' ||
                                                (!field.ReadOnlyField && ['Text', 'Choice', 'Lookup', 'User', 'Note'].includes(field.TypeAsString)),
                                                true
                                            )
                                        )}
                                        onChange={(option?: IDropdownOption) => updateRow(row.clientId, currentRow => ({
                                            ...currentRow,
                                            locationField: option?.key ? String(option.key) : ''
                                        }))}
                                        onError={message => setError(message || undefined)}
                                    />
                                    <IconButton
                                        iconProps={{ iconName: 'Delete' }}
                                        title="Delete row"
                                        ariaLabel="Delete row"
                                        onClick={() => setRows(currentRows => currentRows.filter(currentRow => currentRow.clientId !== row.clientId))}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </Stack>
        </Panel>
    );
};

export default ExternalListsManagerPanel;

import { SPHttpClient, SPHttpClientResponse } from '@microsoft/sp-http';
import { ExternalListConfig } from 'model';
import { Event } from 'model/Event';
import moment from 'moment-timezone';

export interface IExternalListItem {
    Id: number;
    [key: string]: any;
}

export class ExternalListDataService {
    constructor( private readonly spHttpClient: SPHttpClient, private readonly currentWebUrl: string ) {}

    public async loadEventsFromExternalLists(configs: ExternalListConfig[]): Promise<Event[]> {
        const enabledConfigs = configs.filter(c => c.enabled);
        if (enabledConfigs.length === 0) { return []; }

        const results = await Promise.all(enabledConfigs.map(c => this.loadEventsFromExternalList(c)));
        return results.flat();
    }

    public async loadEventsFromExternalList(config: ExternalListConfig): Promise<Event[]> {
        const items = await this._fetchListItems(config);
        return items.map(item => this._mapItemToEvent(item, config));
    }

    private async _fetchListItems(config: ExternalListConfig): Promise<IExternalListItem[]> {
        const siteUrl = this._normalizeSiteUrl(config.siteUrl);
 
        if (config.viewId) { return await this._fetchListItemsUsingView(config, siteUrl); }

        const selectFields = this._buildSelectFields(config);

        let apiUrl =
        `${siteUrl}/_api/web/lists(guid'${config.listId}')/items` +
        `?$select=${selectFields}`;

        if (config.eventDate) {
            apiUrl += `&$orderby=${config.eventDate}`;
        }

        apiUrl += `&$top=5000`;

        const response: SPHttpClientResponse = await this.spHttpClient.get(apiUrl, SPHttpClient.configurations.v1);

        if (!response.ok) {
            const responseText = await response.text();
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        
        if (data.value && data.value.length > 0) {
            console.log('First item:', data.value[0]);
        }
        
        return data.value || [];
    }

    private async _fetchListItemsUsingView(config: ExternalListConfig, siteUrl: string): Promise<IExternalListItem[]> {
        const viewEndpoint = `${siteUrl}/_api/web/lists(guid'${config.listId}')/views(guid'${config.viewId}')`;
        
        const viewResponse: SPHttpClientResponse = await this.spHttpClient.get(viewEndpoint, SPHttpClient.configurations.v1);

        if (!viewResponse.ok) {
            console.warn(`Failed to fetch view, falling back to all items: ${viewResponse.statusText}`);
            return await this._fetchAllItems(config, siteUrl);
        }

        const viewData = await viewResponse.json();
        const viewQuery = viewData.ViewQuery || '';

        const oDataFilter = this._camlToODataFilter(viewQuery);
        
        if (!oDataFilter) {
            console.warn(`Complex CAML query detected, falling back to all items for "${config.listTitle}"`);
            return await this._fetchAllItems(config, siteUrl);
        }

        const selectFields = this._buildSelectFields(config);
        
        let apiUrl =
            `${siteUrl}/_api/web/lists(guid'${config.listId}')/items` +
            `?$select=${selectFields}` +
            `&$filter=${encodeURIComponent(oDataFilter)}`;

        if (config.eventDate) {
            apiUrl += `&$orderby=${config.eventDate}`;
        }

        apiUrl += `&$top=5000`;

        const response: SPHttpClientResponse = await this.spHttpClient.get(
            apiUrl,
            SPHttpClient.configurations.v1
        );

        if (!response.ok) {
            console.error(`Failed to fetch filtered items: ${response.statusText}`);
            throw new Error(`Failed to fetch items using view filter: ${response.statusText}`);
        }

        const data = await response.json();
        const items = data.value || [];
        return items;
    }

    private async _fetchAllItems(config: ExternalListConfig, siteUrl: string): Promise<IExternalListItem[]> {
        const selectFields = this._buildSelectFields(config);

        let apiUrl =
            `${siteUrl}/_api/web/lists(guid'${config.listId}')/items` +
            `?$select=${selectFields}`;

        if (config.eventDate) {
            apiUrl += `&$orderby=${config.eventDate}`;
        }

        apiUrl += `&$top=5000`;

        const response: SPHttpClientResponse = await this.spHttpClient.get(
            apiUrl,
            SPHttpClient.configurations.v1
        );

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        return data.value || [];
    }

    private _camlToODataFilter(caml: string): string | null {
        if (!caml || caml.trim() === '') {
            return null;
        }

        // Extract simple equality filters
        // Example: <Eq><FieldRef Name="Status" /><Value Type="Text">Approved</Value></Eq>
        const eqMatch = caml.match(/<Eq>\s*<FieldRef Name="([^"]+)"\s*\/>\s*<Value Type="[^"]*">([^<]+)<\/Value>\s*<\/Eq>/i);
        if (eqMatch) {
            const fieldName = eqMatch[1];
            const fieldValue = eqMatch[2];
            return `${fieldName} eq '${fieldValue}'`;
        }

        // Extract simple date comparisons
        // Example: <Geq><FieldRef Name="EventDate" /><Value Type="DateTime"><Today /></Value></Geq>
        const todayMatch = caml.match(/<(Geq|Leq|Gt|Lt)>\s*<FieldRef Name="([^"]+)"\s*\/>\s*<Value Type="DateTime"><Today\s*\/><\/Value>\s*<\/(Geq|Leq|Gt|Lt)>/i);
        if (todayMatch) {
            const operator = todayMatch[1].toLowerCase();
            const fieldName = todayMatch[2];
            const today = new Date().toISOString();
            
            const odataOp = {
                'geq': 'ge',
                'leq': 'le',
                'gt': 'gt',
                'lt': 'lt'
            }[operator];
            
            return `${fieldName} ${odataOp} datetime'${today}'`;
        }
    return null;
    }

    private _buildSelectFields(config: ExternalListConfig): string {
        const fields: string[] = ['Id', config.titleField];

        if (config.eventDate) {
            fields.push(config.eventDate);
        } else {
            console.log(`   eventDate: UNDEFINED (NOT ADDING)`);
        }

        if (config.endDate) {
            fields.push(config.endDate);
        } else {
            console.log(`   endDate: UNDEFINED (NOT ADDING)`);
        }

        if (config.categoryField) {
            fields.push(config.categoryField);
        } else {
            console.log(`   categoryField: UNDEFINED (NOT ADDING)`);
        }

        const result = fields.join(','); 
        return result;
    }

    private _mapItemToEvent(item: IExternalListItem, config: ExternalListConfig): Event {
        const event = new Event();
        
        (event as any).isExternal = true;
        (event as any).externalSourceListId = config.listId;
        (event as any).externalSourceSiteUrl = config.siteUrl;
        (event as any).externalItemId = item.Id;
        (event as any).readOnly = true;
        event.title = this._getValue(item, config.titleField) || '';

        let startValue = null;
        let endValue = null;

        if (config.eventDate) {
            startValue = this._getValue(item, config.eventDate);
            if (startValue) {
                event.start = moment(startValue);
            }
        }

        if (config.endDate) {
            endValue = this._getValue(item, config.endDate);
            if (endValue) {
                event.end = moment(endValue);
            }
        }
 
        if (!event.start || !event.start.isValid()) {
            event.start = moment();
        }

        if (!event.end || !event.end.isValid()) {
            event.end = moment(event.start);
        }

        const isAllDayEvent = this._isAllDayEventValue(startValue);
        
        if (isAllDayEvent) {
            event.isAllDay = true;
            event.start = event.start.startOf('day');
            event.end = event.end.startOf('day');
        }

        return event;
    }

    private _isAllDayEventValue(value: any): boolean {
        if (!value) {
            return false;
        }

        if (typeof value === 'string') {
            if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
                return true;
            }
        }

        return false;
    }

    private _getValue(item: IExternalListItem, field: string): any {
        if (!field || !item) {
            return null;
        }

        const value = item[field];

        if (value === null || value === undefined) {
            return null;
        }

        if (Array.isArray(value)) {
            return value.map(v => v?.Title ?? v).join(', ');
        }

        if (typeof value === 'object' && value.Title) {
            return value.Title;
        }

        return value;
    }

    private _normalizeSiteUrl(siteUrl?: string): string {
        if (!siteUrl || typeof siteUrl !== 'string') {
            return this.currentWebUrl;
        }

        if (siteUrl.startsWith('/')) {
            const url = new URL(this.currentWebUrl);
            return `${url.protocol}//${url.host}${siteUrl}`;
        }

        return siteUrl;
    }
}
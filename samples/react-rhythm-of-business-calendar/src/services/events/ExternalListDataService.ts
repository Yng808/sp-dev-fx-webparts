import { SPHttpClient, SPHttpClientResponse } from '@microsoft/sp-http';
import { ExternalListConfig } from 'model';
import { Event } from 'model/Event';
import { RefinerValue, Refiner } from 'model';
import { Color } from 'common';
import { ITimeZoneService } from "common/services";
import moment from 'moment-timezone';

export interface IExternalListItem {
    Id: number;
    [key: string]: any;
}

export class ExternalListDataService {

    private readonly _colorPalette: Color[] = [
        Color.parse('#F4CCCC'), // 1 Red
        Color.parse('#FCE5CD'), // 2 Orange
        Color.parse('#FFF2CC'), // 3 Yellow
        Color.parse('#D9EAD3'), // 4 Green
        Color.parse('#D0E0E3'), // 5 Teal
        Color.parse('#CFE2F3'), // 6 Blue
        Color.parse('#D9D2E9'), // 7 Purple
        Color.parse('#EAD1DC'), // 8 Pink
        Color.parse('#E6E6E6'), // 9 Gray
        Color.parse('#D0D0D0'), // 10 Neutral Gray
    ];

    private readonly _externalRefinerValues = new Map<string, RefinerValue>();

    private _externalRefiner: Refiner | undefined;

    private _ensureExternalRefiner(): Refiner {
        if (this._externalRefiner) {
            return this._externalRefiner;
        }

        this._externalRefiner = new Refiner();
        this._externalRefiner.title = "External Sources";
        this._externalRefiner.enableColors = true;
        
        return this._externalRefiner;
    }

    constructor( private readonly spHttpClient: SPHttpClient, private readonly currentWebUrl: string, private readonly timeZoneService: ITimeZoneService ) {}

    public async loadEventsFromExternalLists(configs: ExternalListConfig[]): Promise<Event[]> {
        const enabledConfigs = configs.filter(c => c.enabled);
        if (enabledConfigs.length === 0) { return []; }

        const results = await Promise.all(enabledConfigs.map(c => this.loadEventsFromExternalList(c)));
        return results.flat();
    }

    public async loadEventsFromExternalList(config: ExternalListConfig): Promise<Event[]> {
        const items = await this._fetchListItems(config);
        const events = items.map(item => this._mapItemToEvent(item, config));
        const refinerValue = this._getOrCreateRefinerValue(config);
        events.forEach(e => {e.refinerValues.add(refinerValue);});
        return events;
    }

    private _getOrCreateRefinerValue(config: ExternalListConfig): RefinerValue {
        const cacheKey = config.listId;

        if (this._externalRefinerValues.has(cacheKey)) {
            return this._externalRefinerValues.get(cacheKey)!;
        }

        const externalRefiner = this._ensureExternalRefiner();
        const listTitle = config.listTitle || 'External';
        
        const existingValues = externalRefiner.values.get();
        let refinerValue = existingValues.find(rv => rv.title === listTitle);

        if (!refinerValue) {
            refinerValue = new RefinerValue();
            refinerValue.title = listTitle;
            refinerValue.color = this._getColorForSortOrder(config.sortOrder);
            refinerValue.refiner.set(externalRefiner);
            externalRefiner.values.add(refinerValue);
        }

        this._externalRefinerValues.set(cacheKey, refinerValue);

        return refinerValue;
    }


    private _getColorForSortOrder(sortOrder?: number): Color {
        if (!sortOrder || sortOrder <= 0) {
            return this._colorPalette[0];
        }

        const index = (sortOrder - 1) % this._colorPalette.length;
        return this._colorPalette[index];
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
        const siteTimeZone = this.timeZoneService.siteTimeZone;
        (event as any).isExternal = true;
        (event as any).externalSourceListId = config.listId;
        (event as any).externalSourceSiteUrl = config.siteUrl;
        (event as any).externalItemId = item.Id;
        (event as any).readOnly = true;
        event.title = this._getValue(item, config.titleField) || '';

        const startValue = config.eventDate ? this._getValue(item, config.eventDate) : null;
        const endValue = config.endDate ? this._getValue(item, config.endDate) : null;

        if (startValue) {
            const startMoment = moment.tz(startValue, siteTimeZone.momentId);

            const isMidnight =
                startMoment.hours() === 0 &&
                startMoment.minutes() === 0 &&
                startMoment.seconds() === 0;

            if (isMidnight) {
                event.isAllDay = true;
                event.start = startMoment.clone().startOf('day');

                if (endValue) {
                    const endMoment = moment.tz(endValue, siteTimeZone.momentId);
                    event.end = endMoment.clone().startOf('day');
                } else {
                    event.end = event.start.clone().add(1, 'day');
                }
            }
        }
 
        if (!event.start || !event.start.isValid()) {
            event.start = moment().tz(siteTimeZone.momentId);
        }

        if (!event.end || !event.end.isValid()) {
            event.end = event.isAllDay ? event.start.clone().add(1, 'day') : event.start.clone().add(1, 'hour');
        }

        return event;
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
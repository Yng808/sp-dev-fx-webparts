import { SPHttpClient, SPHttpClientResponse } from '@microsoft/sp-http';
import { ExternalListConfig } from 'model';
import { Event } from 'model/Event';
import { RefinerValue, Refiner } from 'model';
import { Color, Entity } from 'common';
import { ITimeZoneService } from "common/services";
import moment from 'moment-timezone';

export interface IExternalListItem {
    Id: number;
    [key: string]: any;
}

export class ExternalListDataService {

    private readonly _externalRefinerValues = new Map<string, RefinerValue>();

    constructor( private readonly spHttpClient: SPHttpClient, private readonly currentWebUrl: string, private readonly timeZoneService: ITimeZoneService ) {}

    public async loadEventsFromExternalLists(configs: ExternalListConfig[]): Promise<Event[]> {
        const enabledConfigs = configs.filter(c => c.enabled);
        if (enabledConfigs.length === 0) { return []; }

        // Rebuild the external refiner cache for each refresh so title/color edits are reflected.
        this._externalRefinerValues.clear();

        const tasks = enabledConfigs.map(config => async () => {
            try {
            return await this.loadEventsFromExternalList(config);
            } catch (error) {
                console.warn('Failed to load external list:', error);
                return [];
            }
        });

        const results = await this._runWithConcurrency(tasks, 5);
        return results.flat();
    }

    public async loadEventsFromExternalList(config: ExternalListConfig): Promise<Event[]> {
        const items = await this._fetchListItems(config);
        const events = items.map(item => this._mapItemToEvent(item, config));
        const refinerValue = this._getOrCreateRefinerValue(config);
        events.forEach(e => {e.refinerValues.add(refinerValue);});
        return events;
    }

    private async _runWithConcurrency<T>(tasks: (() => Promise<T>)[], limit: number ): Promise<T[]> {
        const results = new Array<T>(tasks.length);
        const executing = new Map<number, Promise<void>>();

        for (let i = 0; i < tasks.length; i++) {
            const promise = tasks[i]().then(result => {
                results[i] = result;
            }).finally(() => {
                executing.delete(i);
            });

            executing.set(i, promise);

            if (executing.size >= limit) {
                await Promise.race(executing.values());
            }
        }

        await Promise.all(executing.values());
        return results;
    }

    private _typeRefiner: Refiner | undefined;

    public setTypeRefiner(refiner: Refiner): void {
        this._typeRefiner = refiner;
    }

    private _parseColor(value?: string): Color {
        if (value && /^#([0-9A-F]{3}){1,2}$/i.test(value.trim())) {
            try {
                return Color.parse(value.trim());
            } catch { 
                console.warn("Invalid color value:", value);
            }
        }
        
        return Color.parse('#3A86C6');
    }

    private _getOrCreateRefinerValue(config: ExternalListConfig): RefinerValue {
        const cacheKey = config.id || `${config.listId}:${config.viewId || ''}:${config.listTitle || ''}`;

        const cached = this._externalRefinerValues.get(cacheKey);
        if (cached) {
            if ((cached as any).__external === true) {
                cached.title = config.listTitle || "External";
                cached.color = this._parseColor(config.color);
            }
            return cached;
        }

        if (!this._typeRefiner) {
            throw new Error("Refiner has not been initialized.");
        }

        const typeRefiner = this._typeRefiner;
        const listTitle = (config.listTitle || "External").trim().toLowerCase();

        const allValues = typeRefiner.values.get().filter(Entity.NotDeletedFilter);

        // First try to find an external-generated value already tied to this specific external config row.
        let refinerValue = allValues.find(
            (rv: RefinerValue) => (rv as any).__external === true && (rv as any).__externalConfigId === config.id
        );

        // Otherwise, match by title, but only to active values. Inactive values should
        // stay hidden and should not be rebound to external events on refresh.
        if (!refinerValue) {
            refinerValue = allValues.find(
                (rv: RefinerValue) => rv.isActive && (rv.title || "").trim().toLowerCase() === listTitle
            );
        }

        if (!refinerValue) {
            refinerValue = new RefinerValue();
            refinerValue.title = config.listTitle || "External";
            refinerValue.order = allValues.length;
            (refinerValue as any).__external = true;
            (refinerValue as any).__externalConfigId = config.id;
            (refinerValue as any).__externalListId = config.listId;
            refinerValue.refiner.set(typeRefiner);
            typeRefiner.values.add(refinerValue);
            refinerValue.isActive = true;
            refinerValue.color = this._parseColor(config.color);
        } else if ((refinerValue as any).__external === true) {
            // Keep external-generated values in sync with external config title and color.
            refinerValue.isActive = true;
            (refinerValue as any).__externalListId = config.listId;
            if ((refinerValue as any).__externalConfigId === config.id) {
                refinerValue.title = config.listTitle || "External";
            }
            refinerValue.color = this._parseColor(config.color);
        }

        this._externalRefinerValues.set(cacheKey, refinerValue);

        return refinerValue;
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
            // const responseText = await response.text();
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        
        return data.value || [];
    }

    private async _fetchListItemsUsingView(config: ExternalListConfig, siteUrl: string): Promise<IExternalListItem[]> {
        const viewEndpoint = `${siteUrl}/_api/web/lists(guid'${config.listId}')/views(guid'${config.viewId}')?$select=ViewQuery`;

        const viewResponse: SPHttpClientResponse = await this.spHttpClient.get(viewEndpoint, SPHttpClient.configurations.v1);

        if (!viewResponse.ok) {
            console.warn(`Failed to fetch view, falling back to all items: ${viewResponse.statusText}`);
            return await this._fetchAllItems(config, siteUrl);
        }

        const viewData = await viewResponse.json();
        const viewQuery: string = viewData.ViewQuery || '';

        const selectFields = this._buildSelectFields(config);
        const viewFields = selectFields.split(',')
            .map(f => `<FieldRef Name="${f.trim()}"/>`)
            .join('');

        const viewXml = `<View><Query>${viewQuery}</Query><ViewFields>${viewFields}</ViewFields><RowLimit>5000</RowLimit></View>`;

        const getItemsEndpoint = `${siteUrl}/_api/web/lists(guid'${config.listId}')/GetItems`;

        const postResponse: SPHttpClientResponse = await this.spHttpClient.post(
            getItemsEndpoint,
            SPHttpClient.configurations.v1,
            {
                body: JSON.stringify({
                    query: {
                        ViewXml: viewXml
                    }
                })
            }
        );

        if (!postResponse.ok) {
            const errorText = await postResponse.text();
            console.error(`GetItems failed: ${errorText}`);
            console.warn(`Falling back to all items for "${config.listTitle}"`);
            return await this._fetchAllItems(config, siteUrl);
        }

        const data = await postResponse.json();
        return data.value || data?.d?.results || [];
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

        const allItems: IExternalListItem[] = [];
        let nextUrl: string | undefined = apiUrl;

        while (nextUrl) {

        const response: SPHttpClientResponse = await this.spHttpClient.get(
            nextUrl,
            SPHttpClient.configurations.v1
        );

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.value) {
            allItems.push(...data.value);
        }

        nextUrl = data['@odata.nextLink'];
        }

        return allItems;
    }

    private _buildSelectFields(config: ExternalListConfig): string {
        const fields: string[] = ['Id', config.titleField];

        if (config.eventDate) {
            fields.push(config.eventDate);
        }  // else { console.log(`eventDate: UNDEFINED (NOT ADDING)`); }

        if (config.endDate) {
            fields.push(config.endDate);
        }  // else { console.log(`endDate: UNDEFINED (NOT ADDING)`); }

        if (config.approvalStatus) {
            fields.push(config.approvalStatus);
        } // else { console.log(`approvalStatus: UNDEFINED (NOT ADDING)`);}

        if (config.locationField) {
            fields.push(config.locationField);
        } // else { console.log(`locationField: UNDEFINED (NOT ADDING)`);}

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

        const rawTitle = this._getValue(item, config.titleField) || '';
        const approvalStatusValue = config.approvalStatus ? this._getValue(item, config.approvalStatus) : null;
        const statusString = approvalStatusValue !== null ? String(approvalStatusValue).trim() : '';
        const firstLetter = statusString.length > 0 ? statusString.charAt(0).toUpperCase() : '';
        event.title = firstLetter ? `(${firstLetter}) ${rawTitle}`: rawTitle;

        if (config.locationField) {
            const locationValue = this._getValue(item, config.locationField);
            event.location = locationValue || '';
        }

        const startValue = config.eventDate ? this._getValue(item, config.eventDate) : null;
        const endValue = config.endDate ? this._getValue(item, config.endDate) : null;

        if (startValue) {
            const startMoment = this._parseSharePointDate(startValue, siteTimeZone.momentId, config.dateOnly);
            const endMoment = endValue ? this._parseSharePointDate(endValue, siteTimeZone.momentId, config.dateOnly) : null;

            if (config.dateOnly) {
                event.isAllDay = true;
                event.start = startMoment;
                event.end = endMoment ?? startMoment.clone().add(1, 'day');
            } else {
            const isStartMidnight = startMoment.hours() === 0 && startMoment.minutes() === 0 && startMoment.seconds() === 0;
            const isEndMidnight = endMoment && endMoment.hours() === 0 && endMoment.minutes() === 0 && endMoment.seconds() === 0;

            const isSingleDayDuration = endMoment && endMoment.diff(startMoment, 'days') === 1;

            const shouldBeAllDay = isStartMidnight && (!endMoment || isEndMidnight || isSingleDayDuration);

            if (shouldBeAllDay) {
                event.isAllDay = true;
                event.start = startMoment.clone().startOf('day');
                event.end = endMoment ? endMoment.clone().startOf('day') : startMoment.clone().add(1, 'day');
            } else {
                event.isAllDay = false;
                event.start = startMoment;
                event.end = endMoment ?? startMoment.clone().add(1, 'hour');
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

    private _parseSharePointDate(value: string, timeZoneId: string, dateOnly?: boolean): moment.Moment {
        if (!value) return null;

        if (dateOnly) {
            const datePart = value.substring(0, 10);
            return moment.tz(datePart, 'YYYY-MM-DD', timeZoneId).startOf('day');
        }

        const converted = moment.utc(value).tz(timeZoneId);

        if (converted.hours() === 0 && converted.minutes() === 0 && converted.seconds() === 0) {
            return converted.clone().startOf('day');
        }

        return converted;
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
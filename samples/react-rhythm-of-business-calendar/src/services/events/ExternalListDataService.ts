import { SPHttpClient, SPHttpClientResponse } from '@microsoft/sp-http';
import { ExternalListConfig } from 'model';
import { Event } from 'model/Event';
import moment from 'moment-timezone';

export interface IExternalListItem {
  Id: number;
  [key: string]: any;
}

export class ExternalListDataService {
  constructor(
    private readonly spHttpClient: SPHttpClient,
    private readonly currentWebUrl: string
  ) {}

  public async loadEventsFromExternalLists(configs: ExternalListConfig[]): Promise<Event[]> {
    const enabledConfigs = configs.filter(c => c.enabled);
    if (enabledConfigs.length === 0) {
      return [];
    }

    const results = await Promise.all(
      enabledConfigs.map(c => this.loadEventsFromExternalList(c))
    );

    return results.flat();
  }

  public async loadEventsFromExternalList(config: ExternalListConfig): Promise<Event[]> {
    const items = await this._fetchListItems(config);
    console.log(`Fetched ${items.length} items`);
    
    return items.map(item => this._mapItemToEvent(item, config));
  }

  private async _fetchListItems(config: ExternalListConfig): Promise<IExternalListItem[]> {
    const siteUrl = this._normalizeSiteUrl(config.siteUrl);
    const selectFields = this._buildSelectFields(config);

    let apiUrl =
      `${siteUrl}/_api/web/lists(guid'${config.listId}')/items` +
      `?$select=${selectFields}`;

    if (config.eventDate) {
      apiUrl += `&$orderby=${config.eventDate}`;
    }

    apiUrl += `&$top=5000`;

    console.log(' API URL:', apiUrl);

    const response: SPHttpClientResponse = await this.spHttpClient.get(
      apiUrl,
      SPHttpClient.configurations.v1
    );

    if (!response.ok) {
      // console.error('API Error:', response.status, response.statusText);
      const responseText = await response.text();
      // console.error('Response body:', responseText);
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Loaded items:', data.value?.length || 0);
    
    if (data.value && data.value.length > 0) {
      console.log('First item:', data.value[0]);
    }
    
    return data.value || [];
  }

  private _buildSelectFields(config: ExternalListConfig): string {
    const fields: string[] = ['Id', config.titleField];

    // console.log(` Building select fields:`);
    // console.log(`   titleField: "${config.titleField}" → added`);

    // Only add date fields if they're defined
    if (config.eventDate) {
      // console.log(`   eventDate: "${config.eventDate}" → ADDING`);
      fields.push(config.eventDate);
    } else {
      console.log(`   eventDate: UNDEFINED (NOT ADDING)`);
    }

    if (config.endDate) {
      // console.log(`   endDate: "${config.endDate}" → ADDING`);
      fields.push(config.endDate);
    } else {
      console.log(`   endDate: UNDEFINED (NOT ADDING)`);
    }

    if (config.categoryField) {
      // console.log(`   categoryField: "${config.categoryField}" → ADDING`);
      fields.push(config.categoryField);
    } else {
      console.log(`   categoryField: UNDEFINED (NOT ADDING)`);
    }

    const result = fields.join(',');
    // console.log(`   Final select: "${result}"`);

    return result;
  }

  private _mapItemToEvent(item: IExternalListItem, config: ExternalListConfig): Event {
    const event = new Event();
    
    // Mark this as an external event
    (event as any).isExternal = true;
    (event as any).externalSourceListId = config.listId;
    (event as any).externalSourceSiteUrl = config.siteUrl;

    event.title = this._getValue(item, config.titleField) || '';

    // Get start and end values
    let startValue = null;
    let endValue = null;

    if (config.eventDate) {
      startValue = this._getValue(item, config.eventDate);
      // console.log(`Event "${event.title}": startValue = "${startValue}"`);
      if (startValue) {
        event.start = moment(startValue);
      }
    }

    if (config.endDate) {
      endValue = this._getValue(item, config.endDate);
      // console.log(`Event "${event.title}": endValue = "${endValue}"`);
      if (endValue) {
        event.end = moment(endValue);
      }
    }

    // Ensure start and end are valid
    if (!event.start || !event.start.isValid()) {
      event.start = moment();
    }

    if (!event.end || !event.end.isValid()) {
      event.end = moment(event.start);
    }

    // Detect if this is an all-day event
    const isAllDayEvent = this._isAllDayEventValue(startValue);
    
    if (isAllDayEvent) {
      event.isAllDay = true;
      event.start = event.start.startOf('day');
      event.end = event.end.startOf('day');
    }

    // console.log(`Created event: "${event.title}" (${event.start.format('YYYY-MM-DD')} to ${event.end.format('YYYY-MM-DD')})`);

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
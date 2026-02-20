export interface ExternalListConfig {
    id: string;
    siteUrl: string;
    listId: string;
    listTitle?: string;
    viewId?: string;
    titleField: string;
    eventDate: string;
    endDate?: string;
    categoryField?: string;
    enabled: boolean;
    dateOnly: boolean;
    sortOrder?: number;
}

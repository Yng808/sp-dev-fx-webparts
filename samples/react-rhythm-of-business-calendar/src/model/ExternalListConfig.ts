export interface ExternalListConfig {
    id: string;
    title?: string;
    enabled: boolean;
    dateOnly: boolean;
    siteUrl: string;
    listId: string;
    viewId?: string;
    refinerValueId?: string;
    approvalStatus?: string;
    titleField: string;
    eventDate: string;
    endDate: string;
    locationField?: string;
}
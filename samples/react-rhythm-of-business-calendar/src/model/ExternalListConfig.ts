export interface ExternalListConfig {
    id: string;
    enabled: boolean;
    dateOnly: boolean;
    siteUrl: string;
    listId: string;
    viewId?: string;
    listTitle?: string;
    color: string;
    approvalStatus?: string;
    titleField: string;
    eventDate: string;
    endDate: string;
    locationField?: string;
}
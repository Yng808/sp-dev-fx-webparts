export interface ExternalListConfig {
    id: string;
    siteUrl: string;
    listId: string;
    listTitle?: string;
    viewId?: string;
    titleField: string;
    eventDate: string;
    endDate: string;
    approvalStatus?: string;
    enabled: boolean;
    dateOnly: boolean;
    color: string;
}

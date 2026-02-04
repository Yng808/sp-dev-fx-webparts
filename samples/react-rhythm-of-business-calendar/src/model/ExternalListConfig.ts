export interface ExternalListConfig {
  id: string;
  siteUrl: string;
  listId: string;
  listTitle?: string;
  viewId?: string;
  titleField: string;
  startDateField: string;
  endDateField?: string;
  categoryField?: string;
  enabled: boolean;
}

import { IListDefinition, ListTemplateType, FieldType } from "common/sharepoint";

export const ExternalListsConfigList_Title = "External Lists Configuration";

export interface IExternalListsConfig {
    Id: number;
    Title: string;
    IsEnabled: boolean;
    IsDateOnly?: boolean;
    SiteUrl: string;
    ListId: string;
    ViewId?: string;
    ListTitle?: string;
    Color?: string;
    ApprovalStatus?: string;
    TitleField: string;
    EventDate: string;
    EndDate: string;
    LocationField?: string;
}

const ExternalListsConfigList: IListDefinition = {
    title: ExternalListsConfigList_Title,
    description: "Stores configuration for external SharePoint lists to display in the calendar",
    template: ListTemplateType.GenericList,
    dependencies: [],
    siteFields: [],
    fields: [
        { name: "IsEnabled", displayName: "Show in Calendar", type: FieldType.Boolean, required: true, default: "Yes" },
        { name: "IsDateOnly", displayName: "Date Only", type: FieldType.Boolean, required: false, default: "Yes" },
        { name: "SiteUrl", displayName: "Site URL", type: FieldType.Text, required: true },
        { name: "ListId", displayName: "List ID", type: FieldType.Text, required: true },
        { name: "ViewId", displayName: "View ID", type: FieldType.Text, required: false }, 
        { name: "ListTitle", displayName: "Refiner Value Title", type: FieldType.Text, required: false },
        { name: "Color", displayName: "Color", type: FieldType.Text, required: false },
        { name: "ApprovalStatus", displayName: "Approval Status", type: FieldType.Text, required: false },
        { name: "TitleField", displayName: "Title Field", type: FieldType.Text, required: true },
        { name: "EventDate", displayName: "Start Date", type: FieldType.Text, required: true },
        { name: "EndDate", displayName: "End Date", type: FieldType.Text, required: true },
        { name: "LocationField", displayName: "Location", type: FieldType.Text, required: false }
    ],
    views: []
};

export default ExternalListsConfigList;
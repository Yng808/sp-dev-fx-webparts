import { IListDefinition, ListTemplateType, FieldType, IBooleanFieldDefinition, ITextFieldDefinition } from "common/sharepoint";

export const ExternalListsConfigList_Title = "External Lists Configuration";

export interface IExternalListsConfig {
    Id: number;
    Title: string;
    IsEnabled: boolean;
    IsDateOnly?: boolean;
    SiteUrl: string;
    ListId: string;
    ViewId?: string;
    RefinerValueId?: string;
    ApprovalStatus?: string;
    TitleField: string;
    EventDate: string;
    EndDate: string;
    LocationField?: string;
}

export const Field_IsEnabled: IBooleanFieldDefinition = { 
    name: "IsEnabled", 
    displayName: "Show in Calendar", 
    type: FieldType.Boolean, 
    required: true, 
    default: "Yes" 
};

export const Field_IsDateOnly: IBooleanFieldDefinition = { 
    name: "IsDateOnly", 
    displayName: "Date Only", 
    type: FieldType.Boolean, 
    required: false, 
    default: "Yes" 
};

export const Field_SiteUrl: ITextFieldDefinition = { 
    name: "SiteUrl", 
    displayName: "Site URL", 
    type: FieldType.Text, 
    required: true 
};

export const Field_ListId: ITextFieldDefinition = { 
    name: "ListId", 
    displayName: "List ID", 
    type: FieldType.Text, 
    required: true 
};

export const Field_ViewId: ITextFieldDefinition = { 
    name: "ViewId", 
    displayName: "View ID", 
    type: FieldType.Text, 
    required: false 
};

export const Field_ListTitle: ITextFieldDefinition = { 
    name: "ListTitle", 
    displayName: "Refiner Value Title", 
    type: FieldType.Text, 
    required: false 
};

export const Field_Color: ITextFieldDefinition = { 
    name: "Color", 
    displayName: "Color", 
    type: FieldType.Text, 
    required: false 
};

export const Field_RefinerValueId: ITextFieldDefinition = { 
    name: "RefinerValueId", 
    displayName: "Refiner Value ID", 
    type: FieldType.Text, 
    required: false 
};

export const Field_ApprovalStatus: ITextFieldDefinition = { 
    name: "ApprovalStatus", 
    displayName: "Approval Status", 
    type: FieldType.Text, 
    required: false 
};

export const Field_TitleField: ITextFieldDefinition = { 
    name: "TitleField", 
    displayName: "Title Field", 
    type: FieldType.Text, 
    required: true 
};

export const Field_EventDate: ITextFieldDefinition = { 
    name: "EventDate", 
    displayName: "Start Date", 
    type: FieldType.Text, 
    required: true 
};

export const Field_EndDate: ITextFieldDefinition = { 
    name: "EndDate", 
    displayName: "End Date", 
    type: FieldType.Text, 
    required: true 
};

export const Field_LocationField: ITextFieldDefinition = { 
    name: "LocationField", 
    displayName: "Location", 
    type: FieldType.Text, 
    required: false 
};

const ExternalListsConfigList: IListDefinition = {
    title: ExternalListsConfigList_Title,
    description: "Stores configuration for external SharePoint lists to display in the calendar",
    template: ListTemplateType.GenericList,
    dependencies: [],
    siteFields: [],
    fields: [
        Field_IsEnabled,
        Field_IsDateOnly,
        Field_SiteUrl,
        Field_ListId,
        Field_ViewId,
        Field_RefinerValueId,
        Field_ApprovalStatus,
        Field_TitleField,
        Field_EventDate,
        Field_EndDate,
        Field_LocationField
    ],
    views: []
};

export default ExternalListsConfigList;
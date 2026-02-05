import { IListDefinition, IViewDefinition, ListTemplateType, FieldType } from "common/sharepoint";

export const ExternalListsConfigList_Title = "External Lists Configuration";

export interface IExternalListsConfig {
  Id: number;
  Title: string;
  SiteUrl: string;
  ListId: string;
  ListTitle?: string;
  ViewId?: string;
  ViewTitle?: string;
  TitleField: string;
  EventDate: string;
  EndDate?: string;
  CategoryField?: string;
  LocationField?: string;
  DescriptionField?: string;
  IsEnabled: boolean;
  SortOrder?: number;
  AdvancedConfig?: string;
  Author?: { Title: string };
  Editor?: { Title: string };
  Created?: string;
  Modified?: string;
}

const ExternalListsConfigList: IListDefinition = {
  title: ExternalListsConfigList_Title,
  description: "Stores configuration for external SharePoint lists to display in the calendar",
  template: ListTemplateType.GenericList,
  dependencies: [],
  siteFields: [],
  fields: [
    {
      name: "SiteUrl",
      displayName: "Site URL",
      type: FieldType.Text,
      required: true
    },
    {
      name: "ListId",
      displayName: "List ID (GUID)",
      type: FieldType.Text,
      required: true
    },
    {
      name: "ListTitle",
      displayName: "List Title",
      type: FieldType.Text,
      required: false
    },
    {
      name: "ViewId",
      displayName: "View ID (GUID)",
      type: FieldType.Text,
      required: false
    },
    {
      name: "ViewTitle",
      displayName: "View Title",
      type: FieldType.Text,
      required: false
    },
    {
      name: "TitleField",
      displayName: "Title Field Internal Name",
      type: FieldType.Text,
      required: true
    },
    {
      name: "EventDate",
      displayName: "Start Date Field Internal Name",
      type: FieldType.Text,
      required: true
    },
    {
      name: "EndDate",
      displayName: "End Date Field Internal Name",
      type: FieldType.Text,
      required: false
    },
    {
      name: "CategoryField",
      displayName: "Category Field Internal Name",
      type: FieldType.Text,
      required: false
    },
    {
      name: "LocationField",
      displayName: "Location Field Internal Name",
      type: FieldType.Text,
      required: false
    },
    {
      name: "DescriptionField",
      displayName: "Description Field Internal Name",
      type: FieldType.Text,
      required: false
    },
    {
      name: "IsEnabled",
      displayName: "Is Enabled",
      type: FieldType.Boolean,
      required: true,
      default: "Yes"
    },
    {
      name: "SortOrder",
      displayName: "Sort Order",
      type: FieldType.Number,
      required: false,
      min: 0 
    },
    {
      name: "AdvancedConfig",
      displayName: "Advanced Configuration (JSON)",
      type: FieldType.Text,  
      required: false,
      richText: false  
    }
  ],
  views: [
    <IViewDefinition>{
      title: "All Items",
      default: true,
      rowLimit: 100,
      paged: true,
      query: '',
      fields: [
        "LinkTitle",
        "SiteUrl",
        "ListTitle",
        "TitleField",
        "EventDate",
        "EndDate",
        "CategoryField",
        "IsEnabled",
        "SortOrder",
        "Modified"
      ]
    },
    <IViewDefinition>{
      title: "Active Lists",
      default: false,
      rowLimit: 100,
      paged: true,
      query: '<Where><Eq><FieldRef Name="IsEnabled"/><Value Type="Boolean">1</Value></Eq></Where><OrderBy><FieldRef Name="SortOrder"/></OrderBy>',
      fields: [
        "LinkTitle",
        "SiteUrl",
        "ListTitle",
        "TitleField",
        "EventDate",
        "EndDate",
        "CategoryField",
        "SortOrder"
      ]
    }
  ]
};

export default ExternalListsConfigList;
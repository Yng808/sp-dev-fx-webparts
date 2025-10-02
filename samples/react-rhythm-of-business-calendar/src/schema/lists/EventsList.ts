import { DateTimeFieldFormatType } from "@pnp/sp/fields";
import { IListDefinition, FieldType, IViewDefinition, includeStandardViewFields, ITextFieldDefinition, IBooleanFieldDefinition, IUserFieldDefinition, ILookupFieldDefinition, IDateTimeFieldDefinition, ListTemplateType, ITitleFieldDefinition, IRecurrenceFieldDefinition, IIntegerFieldDefinition, IGuidFieldDefinition, RoleOperation, RoleType, IChoiceFieldDefinition } from "common/sharepoint";
import { EventModerationStatus } from "model";
import { Defaults } from "../Defaults";
import { RefinerValuesList } from "./RefinerValuesList";

const Field_Title: ITitleFieldDefinition = {
    type: FieldType.Text,
    name: 'Title',
    required: true
};

const Field_Description: ITextFieldDefinition = {
    type: FieldType.Text,
    name: 'Description',
    multi: true
};

const Field_Location: ITextFieldDefinition = {
    type: FieldType.Text,
    name: 'Location'
};

const Field_EventDate: IDateTimeFieldDefinition = {
    type: FieldType.DateTime,
    name: 'EventDate',
    displayName: 'Start Time',
    required: true,
    dateTimeFormat: DateTimeFieldFormatType.DateTime
};

const Field_EndDate: IDateTimeFieldDefinition = {
    type: FieldType.DateTime,
    name: 'EndDate',
    displayName: 'End Time',
    required: true,
    dateTimeFormat: DateTimeFieldFormatType.DateTime
};

const Field_fAllDayEvent: IBooleanFieldDefinition = {
    type: FieldType.Boolean,
    name: 'fAllDayEvent',
    displayName: 'All Day Event',
    default: 'No'
};

const Field_fRecurrence: IRecurrenceFieldDefinition = {
    type: FieldType.Recurrence,
    name: 'fRecurrence',
    displayName: 'Recurrence'
};

const Field_EventType: IIntegerFieldDefinition = {
    type: FieldType.Integer,
    name: 'EventType',
    displayName: 'Event Type'
};

const Field_UID: IGuidFieldDefinition = {
    type: FieldType.Guid,
    name: 'UID'
};

const Field_RecurrenceID: IDateTimeFieldDefinition = {
    type: FieldType.DateTime,
    name: 'RecurrenceID',
    displayName: 'Recurrence ID',
    dateTimeFormat: DateTimeFieldFormatType.DateTime
};

const Field_MasterSeriesItemID: IIntegerFieldDefinition = {
    type: FieldType.Integer,
    name: 'MasterSeriesItemID'
};

const Field_RecurrenceData: ITextFieldDefinition = {
    type: FieldType.Text,
    name: 'RecurrenceData',
    multi: true
};

const Field_Duration: IIntegerFieldDefinition = {
    type: FieldType.Integer,
    name: 'Duration'
};

const Field_RefinerValues: ILookupFieldDefinition = {
    type: FieldType.Lookup,
    name: 'RefinerValues',
    displayName: 'Refiner Values',
    required: false,
    multi: true,
    lookupListTitle: RefinerValuesList.title,
    showField: RefinerValuesList.field_Value.name
};

const Field_Contacts: IUserFieldDefinition = {
    type: FieldType.User,
    name: 'Contacts',
    userSelectionMode: "PeopleOnly",
    multi: true
};

const Field_Confidential: IBooleanFieldDefinition = {
    type: FieldType.Boolean,
    name: 'IsConfidential',
    displayName: 'Is Confidential',
    default: 'No'
};

const Field_RestrictedToAccounts: IUserFieldDefinition = {
    type: FieldType.User,
    name: 'RestrictedToAccounts',
    displayName: 'Restricted To Accounts',
    userSelectionMode: "PeopleAndGroups",
    multi: true
};

const Field_ModerationStatus: IChoiceFieldDefinition = {
    type: FieldType.Choice,
    name: 'ModerationStatus',
    displayName: 'Moderation Status',
    choices: EventModerationStatus.all.map(s => s.name),
    default: EventModerationStatus.Pending.name
};

const Field_Moderator: IUserFieldDefinition = {
    type: FieldType.User,
    name: 'Moderator',
    userSelectionMode: "PeopleOnly",
    required: false
};

const Field_ModerationTimestamp: IDateTimeFieldDefinition = {
    type: FieldType.DateTime,
    name: 'ModerationTimestamp',
    displayName: 'Moderation Timestamp',
    required: false,
    dateTimeFormat: DateTimeFieldFormatType.DateTime
};

const Field_ModerationMessage: ITextFieldDefinition = {
    type: FieldType.Text,
    name: 'ModerationMessage',
    displayName: 'Moderation Message',
    multi: true,
    required: false
};

const Field_COMDecision: IChoiceFieldDefinition = {
    type: FieldType.Choice,
    name: 'comDecision',
    displayName: 'COM Decision',
    choices: ['Undecided', 'Tentative', 'Hold', 'Accept'], // Customize these options
    default: 'Undecided',
    required: false
};

const Field_ReadAheadDueDate: IDateTimeFieldDefinition = {
    type: FieldType.DateTime,
    name: 'ReadAheadDueDate',
    displayName: 'Read Ahead Due Date',
    required: false,
    dateTimeFormat: DateTimeFieldFormatType.DateTime
};

const Field_RequestStatus: IChoiceFieldDefinition = {
    type: FieldType.Choice,
    name: 'RequestStatus',
    choices: ['New', 'Approved', 'Cancelled'],
    default: 'New'
};

const Field_DVPayGrade: IChoiceFieldDefinition = {
    type: FieldType.Choice,
    name: 'DVPayGrade',
    choices: ['O-6', 'O-7', 'O-8', 'O-9', 'O-10', 'GS-15', 'SES-1', 'SES-2', 'SES-3', 'SES-4'],
    default: ''
};

const Field_DVRank: ITextFieldDefinition = {
    type: FieldType.Text,
    name: 'DVRank'
};

const Field_DVFirstName: ITextFieldDefinition = {
    type: FieldType.Text,
    name: 'DVFirstName'
};

const Field_DVSurname: ITextFieldDefinition = {
    type: FieldType.Text,
    name: 'DVSurname'
};

const Field_JDIRVisiting: ITextFieldDefinition = {
    type: FieldType.Text,
    name: 'JDIRVisiting'
};

const Field_DVVisiting: ITextFieldDefinition = {
    type: FieldType.Text,
    name: 'DVVisiting'
};

const Field_RequestorRank: ITextFieldDefinition = {
    type: FieldType.Text,
    name: 'RequestorRank'
};

const Field_RequestorFirstName: ITextFieldDefinition = {
    type: FieldType.Text,
    name: 'RequestorFirstName'
};

const Field_RequestorLastName: ITextFieldDefinition = {
    type: FieldType.Text,
    name: 'RequestorLastName'
};

const Field_RequestorOffice: ITextFieldDefinition = {
    type: FieldType.Text,
    name: 'RequestorOffice'
};

const Field_RequestorDutyPhone: ITextFieldDefinition = {
    type: FieldType.Text,
    name: 'RequestorDutyPhone'
};

const Field_RequestorCellPhone: ITextFieldDefinition = {
    type: FieldType.Text,
    name: 'RequestorCellPhone'
};

const Field_RequestorEmail: ITextFieldDefinition = {
    type: FieldType.Text,
    name: 'RequestorEmail'
};

const Field_ParkingStalls: ILookupFieldDefinition = {
    type: FieldType.Lookup,
    name: 'ParkingStalls',
    lookupListTitle: 'DVParkingStalls',
    showField: 'ID'
};

const Field_ParkingStallName: ITextFieldDefinition = {
    type: FieldType.Text,
    name: 'ParkingStallName'
};

const Field_GroupID: IIntegerFieldDefinition = {
    type: FieldType.Integer,
    name: 'GroupID'
};

const View_AllEvents: IViewDefinition = {
    title: "All RoB Events",
    rowLimit: 600,
    paged: true,
    default: false,
    fields: includeStandardViewFields(
        Field_Description,
        Field_Location,
        Field_EventDate,
        Field_EndDate,
        Field_fAllDayEvent,
        Field_fRecurrence,
        Field_EventType,
        Field_UID,
        Field_RecurrenceID,
        Field_MasterSeriesItemID,
        Field_RecurrenceData,
        Field_Duration,
        Field_RefinerValues,
        Field_Contacts,
        Field_Confidential,
        Field_RestrictedToAccounts,
        Field_ModerationStatus,
        Field_Moderator,
        Field_ModerationTimestamp,
        Field_ModerationMessage,
        Field_COMDecision,
        Field_ReadAheadDueDate,
        Field_RequestStatus,
        Field_DVPayGrade,
        Field_DVRank,
        Field_DVFirstName,
        Field_DVSurname,
        Field_JDIRVisiting,
        Field_DVVisiting,
        Field_RequestorRank,
        Field_RequestorFirstName,
        Field_RequestorLastName,
        Field_RequestorOffice,
        Field_RequestorDutyPhone,
        Field_RequestorCellPhone,
        Field_RequestorEmail,
        Field_ParkingStalls,
        Field_ParkingStallName,
        Field_GroupID
    ),
    // need to sort by ID ascending in order to ensure the series master is loaded before any exceptions to the series
    query: `
        <OrderBy>
            <FieldRef Name="ID" Ascending="TRUE"/>
        </OrderBy>
    `
};

export interface IEventsListDefinition extends IListDefinition {
    view_AllEvents: IViewDefinition;
}

export const EventsList: IEventsListDefinition = {
    title: Defaults.ListTitles.Events,
    description: '',
    template: ListTemplateType.EventsList,
    dependencies: [RefinerValuesList],
    permissions: {
        copyRoleAssignments: false,
        userRoles: [
            { operation: RoleOperation.Add, roleType: RoleType.Administrator, userType: 'ownerGroup' },
            { operation: RoleOperation.Add, roleType: RoleType.Administrator, userType: 'memberGroup' },
            { operation: RoleOperation.Add, roleType: RoleType.Reader, userType: 'visitorGroup' }
        ]
    },
    fields: [
        Field_Title,
        Field_Description,
        Field_Location,
        Field_EventDate,
        Field_EndDate,
        Field_fAllDayEvent,
        Field_fRecurrence,
        Field_EventType,
        Field_UID,
        Field_RecurrenceID,
        Field_MasterSeriesItemID,
        Field_RecurrenceData,
        Field_Duration,
        Field_RefinerValues,
        Field_Contacts,
        Field_Confidential,
        Field_RestrictedToAccounts,
        Field_ModerationStatus,
        Field_Moderator,
        Field_ModerationTimestamp,
        Field_ModerationMessage,
        Field_COMDecision,
        Field_ReadAheadDueDate,
        Field_RequestStatus,
        Field_DVPayGrade,
        Field_DVRank,
        Field_DVFirstName,
        Field_DVSurname,
        Field_JDIRVisiting,
        Field_DVVisiting,
        Field_RequestorRank,
        Field_RequestorFirstName,
        Field_RequestorLastName,
        Field_RequestorOffice,
        Field_RequestorDutyPhone,
        Field_RequestorCellPhone,
        Field_RequestorEmail,
        Field_ParkingStalls,
        Field_ParkingStallName,
        Field_GroupID
    ],
    views: [
        View_AllEvents
    ],
    view_AllEvents: View_AllEvents
};
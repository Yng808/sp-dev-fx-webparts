import { IListDefinition, FieldType, IViewDefinition, includeStandardViewFields, ITitleFieldDefinition, ITextFieldDefinition, IChoiceFieldDefinition, INumberFieldDefinition, IDateTimeFieldDefinition, ListTemplateType, RoleOperation, RoleType } from "common/sharepoint";
import { DateTimeFieldFormatType } from "@pnp/sp/fields";

const Field_Title: ITitleFieldDefinition = {
    type: FieldType.Text,
    name: 'Title'
};

const Field_AssignedID: INumberFieldDefinition = {
    type: FieldType.Number,
    name: 'AssignedID',
    displayName: 'AssignedID'
};

const Field_Status: IChoiceFieldDefinition = {
    type: FieldType.Choice,
    name: 'Status',
    choices: []
};

const Field_StartDate: IDateTimeFieldDefinition = {
    type: FieldType.DateTime,
    name: 'StartDate',
    displayName: 'StartDate',
    dateTimeFormat: DateTimeFieldFormatType.DateTime
};

const Field_EndDate: IDateTimeFieldDefinition = {
    type: FieldType.DateTime,
    name: 'EndDate',
    displayName: 'EndDate',
    dateTimeFormat: DateTimeFieldFormatType.DateTime
};

const Field_ParkingAssignment: ITextFieldDefinition = {
    type: FieldType.Text,
    name: 'ParkingAssignment',
    displayName: 'Parking Assignment'
};

const Field_ParkingDropdown: ITextFieldDefinition = {
    type: FieldType.Text,
    name: 'ParkingDropdown',
    displayName: 'ParkingDropdown'
};

const View_AllParkingStalls: IViewDefinition = {
    title: "All Parking Stalls",
    rowLimit: 250,
    paged: true,
    default: true,
    fields: includeStandardViewFields(
        Field_AssignedID,
        Field_Status,
        Field_StartDate,
        Field_EndDate,
        Field_ParkingAssignment,
        Field_ParkingDropdown
    )
};

export interface IDVParkingStallsListDefinition extends IListDefinition {
    field_ParkingAssignment: ITextFieldDefinition;
    view_AllParkingStalls: IViewDefinition;
}

export const DVParkingStallsList: IDVParkingStallsListDefinition = {
    title: 'DVParkingStalls',
    description: '',
    template: ListTemplateType.GenericList,
    permissions: {
        copyRoleAssignments: false,
        userRoles: [
            { operation: RoleOperation.Add, roleType: RoleType.Administrator, userType: 'ownerGroup' },
            { operation: RoleOperation.Add, roleType: RoleType.Reader, userType: 'memberGroup' },
            { operation: RoleOperation.Add, roleType: RoleType.Reader, userType: 'visitorGroup' }
        ]
    },
    fields: [
        Field_Title,
        Field_AssignedID,
        Field_Status,
        Field_StartDate,
        Field_EndDate,
        Field_ParkingAssignment,
        Field_ParkingDropdown
    ],
    views: [
        View_AllParkingStalls
    ],
    field_ParkingAssignment: Field_ParkingAssignment,
    view_AllParkingStalls: View_AllParkingStalls
};
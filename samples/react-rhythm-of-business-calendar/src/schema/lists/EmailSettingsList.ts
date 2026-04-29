import { IListDefinition, FieldType, IViewDefinition, includeStandardViewFields, ITitleFieldDefinition, ITextFieldDefinition, ListTemplateType, RoleOperation, RoleType } from "common/sharepoint";

const Field_Title: ITitleFieldDefinition = {
    type: FieldType.Text,
    name: 'Title'
};

const Field_Value: ITextFieldDefinition = {
    type: FieldType.Text,
    name: 'Value',
    multi: true
};

const View_AllSettings: IViewDefinition = {
    title: "All Items",
    rowLimit: 50,
    paged: true,
    default: true,
    fields: includeStandardViewFields(
        Field_Value
    )
};

export interface IEmailSettingsListDefinition extends IListDefinition {
    field_Value: ITextFieldDefinition;
    view_AllSettings: IViewDefinition;
}

export const EmailSettingsList: IEmailSettingsListDefinition = {
    title: 'EmailSettings',
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
        Field_Value
    ],
    listItems: [
        { Title: 'SUBJECT_PREFIX', Value: '' },
        { Title: 'PHONE', Value: '' },
        { Title: 'EMAIL', Value: '' },
        { Title: 'SIGNATURE', Value: '' }
    ],
    views: [
        View_AllSettings
    ],
    field_Value: Field_Value,
    view_AllSettings: View_AllSettings
};
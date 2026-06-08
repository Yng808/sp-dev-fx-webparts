import { AddListFieldUpgradeAction, AddOrUpdateViewUpgradeAction, DeleteListFieldUpgradeAction, IElementDefinitions, IListDefinition, buildLiveSchema } from "common/sharepoint";
import { ConfigurationList, Field_ShowRunTests, IEventsListDefinition, EventsList, RefinersList, RefinerValuesList, ApproversList, IRefinersListDefinition, IRefinerValuesListDefinition,IApproversListDefinition,ExternalListsConfigList, Field_Color, Field_ListTitle, Field_RefinerValueId, Field_EditableByAdminsOnly, Field_IsDefault } from "./lists";

export const CurrentSchemaVersion: number = 1.2;

export interface IRhythmOfBusinessCalendarSchema extends IElementDefinitions {
    configurationList: IListDefinition;
    eventsList: IEventsListDefinition;
    refinersList: IRefinersListDefinition;
    refinerValuesList: IRefinerValuesListDefinition;
    approversList: IApproversListDefinition;
    externalListsConfigList: IListDefinition;
}

class AddShowRunTestsFieldUpgradeAction extends AddListFieldUpgradeAction {
    constructor() {
        super(ConfigurationList, Field_ShowRunTests);
    }
}

class AddExternalListRefinerValueIdFieldUpgradeAction extends AddListFieldUpgradeAction {
    constructor() {
        super(ExternalListsConfigList, Field_RefinerValueId);
    }
}

class DeleteExternalListListTitleFieldUpgradeAction extends DeleteListFieldUpgradeAction {
    constructor() {
        super(ExternalListsConfigList, Field_ListTitle);
    }
}

class DeleteExternalListColorFieldUpgradeAction extends DeleteListFieldUpgradeAction {
    constructor() {
        super(ExternalListsConfigList, Field_Color);
    }
}

class AddEditableByAdminsOnlyFieldUpgradeAction extends AddListFieldUpgradeAction {
    constructor() {
        super(RefinersList, Field_EditableByAdminsOnly);
    }
}

class AddRefinerValueIsDefaultFieldUpgradeAction extends AddListFieldUpgradeAction {
    constructor() {
        super(RefinerValuesList, Field_IsDefault);
    }
}

class UpdateAllRefinersViewUpgradeAction extends AddOrUpdateViewUpgradeAction {
    constructor() {
        super(RefinersList, RefinersList.view_AllRefiners);
    }
}

class UpdateAllRefinerValuesViewUpgradeAction extends AddOrUpdateViewUpgradeAction {
    constructor() {
        super(RefinerValuesList, RefinerValuesList.view_AllRefinerValues);
    }
}

export const RhythmOfBusinessCalendarSchema = buildLiveSchema<IRhythmOfBusinessCalendarSchema>({
    version: CurrentSchemaVersion,
    lists: [
        ConfigurationList,
        EventsList,
        RefinersList,
        RefinerValuesList,
        ApproversList,
        ExternalListsConfigList
    ],
    upgrades: [
        {
            fromVersion: 1.0,
            toVersion: 1.1,
            actions: [
                new AddShowRunTestsFieldUpgradeAction(),
                new AddExternalListRefinerValueIdFieldUpgradeAction(),
                new DeleteExternalListListTitleFieldUpgradeAction(),
                new DeleteExternalListColorFieldUpgradeAction()
            ]
        },
        {
            fromVersion: 1.1,
            toVersion: 1.2,
            actions: [
                new AddEditableByAdminsOnlyFieldUpgradeAction(),
                new AddRefinerValueIsDefaultFieldUpgradeAction(),
                new UpdateAllRefinersViewUpgradeAction(),
                new UpdateAllRefinerValuesViewUpgradeAction()
            ]
        }
    ],
    configurationList: ConfigurationList,
    eventsList: EventsList,
    refinersList: RefinersList,
    refinerValuesList: RefinerValuesList,
    approversList: ApproversList,
    externalListsConfigList: ExternalListsConfigList
});

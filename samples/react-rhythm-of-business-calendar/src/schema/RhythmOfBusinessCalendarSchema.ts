import { AddListFieldUpgradeAction, DeleteListFieldUpgradeAction, IElementDefinitions, IListDefinition, buildLiveSchema } from "common/sharepoint";
import { ConfigurationList, Field_ShowRunTests, IEventsListDefinition, EventsList, RefinersList, RefinerValuesList, ApproversList, IRefinersListDefinition, IRefinerValuesListDefinition,IApproversListDefinition,ExternalListsConfigList, Field_Color, Field_ListTitle, Field_RefinerValueId } from "./lists";

export const CurrentSchemaVersion: number = 1.1;

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
        }
    ],
    configurationList: ConfigurationList,
    eventsList: EventsList,
    refinersList: RefinersList,
    refinerValuesList: RefinerValuesList,
    approversList: ApproversList,
    externalListsConfigList: ExternalListsConfigList
});
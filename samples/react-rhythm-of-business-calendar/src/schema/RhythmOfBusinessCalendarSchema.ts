import { AddListFieldUpgradeAction, IElementDefinitions, IListDefinition, buildLiveSchema } from "common/sharepoint";
import { ConfigurationList, Field_ShowRunTests, IEventsListDefinition, EventsList, RefinersList, RefinerValuesList, ApproversList, IRefinersListDefinition, IRefinerValuesListDefinition,IApproversListDefinition,ExternalListsConfigList } from "./lists";

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
                new AddShowRunTestsFieldUpgradeAction()
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
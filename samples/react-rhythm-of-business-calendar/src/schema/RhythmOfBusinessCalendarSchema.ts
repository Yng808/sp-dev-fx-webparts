import { IElementDefinitions, IListDefinition, buildLiveSchema } from "common/sharepoint";
import { ConfigurationList, IEventsListDefinition, EventsList, RefinersList, RefinerValuesList, ApproversList, IRefinersListDefinition, IRefinerValuesListDefinition, IApproversListDefinition, DVParkingStallsList, IDVParkingStallsListDefinition, EmailSettingsList, IEmailSettingsListDefinition } from "./lists";

export const CurrentSchemaVersion: number = 1.0;

export interface IRhythmOfBusinessCalendarSchema extends IElementDefinitions {
    configurationList: IListDefinition;
    eventsList: IEventsListDefinition;
    refinersList: IRefinersListDefinition;
    refinerValuesList: IRefinerValuesListDefinition;
    approversList: IApproversListDefinition;
    dvParkingStallsList: IDVParkingStallsListDefinition;
    emailSettingsList: IEmailSettingsListDefinition;
}

export const RhythmOfBusinessCalendarSchema = buildLiveSchema<IRhythmOfBusinessCalendarSchema>({
    version: CurrentSchemaVersion,
    lists: [
        ConfigurationList,
        EventsList,
        RefinersList,
        RefinerValuesList,
        ApproversList,
        DVParkingStallsList,
        EmailSettingsList
    ],
    upgrades: [
    ],
    configurationList: ConfigurationList,
    eventsList: EventsList,
    refinersList: RefinersList,
    refinerValuesList: RefinerValuesList,
    approversList: ApproversList,
    dvParkingStallsList: DVParkingStallsList,
    emailSettingsList: EmailSettingsList
});
import { ErrorHandler } from "common";
import { PagedViewLoader, IListItemResult, SPField, IUpdateListItem, ErrorDiagnosis } from "common/sharepoint";
import { ISharePointService, ILiveUpdateService, ITimeZoneService } from "common/services";
import { IRhythmOfBusinessCalendarSchema } from "schema";
import { EmailSetting } from "model/EmailSetting";

interface IEmailSettingListItemResult extends IListItemResult {
    Value: SPField.Query_TextMultiLine;
}

interface IEmailSettingUpdateListItem extends IUpdateListItem {
    Value: SPField.Update_TextMultiLine;
}

const toEmailSetting = async (row: IEmailSettingListItemResult, entity: EmailSetting): Promise<void> => {
    entity.title = row.Title;
    entity.value = row.Value ?? '';
};

const toUpdateListItem = (entity: EmailSetting): IEmailSettingUpdateListItem => {
    return {
        Title: entity.title,
        Value: entity.value
    };
};

export class EmailSettingLoader extends PagedViewLoader<EmailSetting> {
    constructor(schema: IRhythmOfBusinessCalendarSchema, timezones: ITimeZoneService, spo: ISharePointService, liveUpdate: ILiveUpdateService) {
        super({ ctor: EmailSetting, view: schema.emailSettingsList.view_AllSettings, timezones, spo, liveUpdate, fastLoad: { useCache: true } });
    }

    protected readonly toEntity = (
        row: IEmailSettingListItemResult,
        entity: EmailSetting
    ) => toEmailSetting(row, entity);

    protected readonly updateListItem = toUpdateListItem;

    protected readonly diagnosePersistError = (error: any) => ErrorHandler.is_412_PRECONDITION_FAILED(error) ? ErrorDiagnosis.Propogate : ErrorDiagnosis.Critical;
}

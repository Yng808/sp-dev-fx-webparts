import { ExternalListConfig } from "model";
import { ISharePointService } from "common/services";
import { IListItemResult, CamlQuery } from "common/sharepoint";
import ExternalListsConfigList from "../../schema/lists/ExternalListsConfigList";

export class ExternalListsLoader {
    private _cachedConfigs: ExternalListConfig[] = [];

    constructor( private readonly spo: ISharePointService ) {}

    public async loadExternalListConfigs(): Promise<ExternalListConfig[]> {
        const configs = await this._load(true);
        this._cachedConfigs = configs;
        return configs;
    }

    public async loadAllExternalListConfigs(): Promise<ExternalListConfig[]> {
        const configs = await this._load(false);
        this._cachedConfigs = configs; 
        return configs;
    }

    public getCachedConfigs(): ExternalListConfig[] {
        return this._cachedConfigs;
    }

    private async _load(enabledOnly: boolean): Promise<ExternalListConfig[]> {
        const query = enabledOnly ? new CamlQuery(CamlQuery.where(CamlQuery.eq("IsEnabled", "1", "Boolean"))) : CamlQuery.none;

        return this.spo.listItems<IListItemResult, ExternalListConfig>(
        ExternalListsConfigList,
        500,
        [
            "ID",
            "Title",
            "SiteUrl",
            "ListId",
            "RefinerValueId",
            "ViewId",
            "TitleField",
            "EventDate",
            "EndDate",
            "ApprovalStatus",
            "LocationField",
            "IsEnabled",
            "IsDateOnly"
        ],
        query,
        row => this._mapItemToConfig(row)
        );
    }

    private _mapItemToConfig(row: IListItemResult): ExternalListConfig {
        const r = row as any;

        return {
        id: String(row.ID),
        title: r.Title,
        siteUrl: r.SiteUrl,
        listId: r.ListId,
        refinerValueId: r.RefinerValueId ? String(r.RefinerValueId) : undefined,
        viewId: r.ViewId,
        titleField: r.TitleField,
        eventDate: r.EventDate,
        endDate: r.EndDate, 
        approvalStatus: r.ApprovalStatus,
        locationField: r.LocationField,
        enabled: String(r.IsEnabled).toLowerCase() === "yes",
        dateOnly: r.IsDateOnly === true || r.IsDateOnly === 1 || String(r.IsDateOnly).toLowerCase() === 'yes'
        } as ExternalListConfig;
    }
}

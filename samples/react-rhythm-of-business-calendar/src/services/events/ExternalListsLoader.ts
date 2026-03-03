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
        const query: CamlQuery | undefined = enabledOnly
        ? ({
            ViewXml: `
                <View>
                <Query>
                    <Where>
                    <Eq>
                        <FieldRef Name="IsEnabled" />
                        <Value Type="Boolean">1</Value>
                    </Eq>
                    </Where>
                </Query>
                </View>
            `
            } as unknown as CamlQuery)
        : undefined;

        const items = await this.spo.listItems<IListItemResult, ExternalListConfig>(
        ExternalListsConfigList,
        500,
        [
            "ID",
            "SiteUrl",
            "ListId",
            "ListTitle",
            "ViewId",
            "TitleField",
            "EventDate",
            "EndDate",
            "ApprovalStatus",
            "LocationField",
            "IsEnabled",
            "IsDateOnly",
            "Color"
        ],
        query,
        row => this._mapItemToConfig(row)
        );

        return items
    }

    private _mapItemToConfig(row: IListItemResult): ExternalListConfig {
        const r = row as any;

        const config: ExternalListConfig = {
        id: String(row.ID),
        siteUrl: r.SiteUrl,
        listId: r.ListId,
        listTitle: r.ListTitle,
        viewId: r.ViewId,
        titleField: r.TitleField,
        eventDate: r.EventDate,
        endDate: r.EndDate, 
        approvalStatus: r.ApprovalStatus,
        locationField: r.LocationField,
        enabled: String(r.IsEnabled).toLowerCase() === "yes",
        dateOnly: r.IsDateOnly === true || r.IsDateOnly === 1 || String(r.IsDateOnly).toLowerCase() === 'yes',
        color: r.Color
        } as ExternalListConfig;

        return config;
    }
}

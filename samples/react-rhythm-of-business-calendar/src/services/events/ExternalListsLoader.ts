import { ExternalListConfig } from "model";
import { ISharePointService } from "common/services";
import { IListItemResult, CamlQuery } from "common/sharepoint";
import ExternalListsConfigList from "../../schema/lists/ExternalListsConfigList";

export class ExternalListsLoader {
  constructor(
    private readonly spo: ISharePointService
  ) {}

  public async loadExternalListConfigs(): Promise<ExternalListConfig[]> {
    return this._load(true);
  }

  public async loadAllExternalListConfigs(): Promise<ExternalListConfig[]> {
    return this._load(false);
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
        "CategoryField",
        "IsEnabled",
        "SortOrder"
      ],
      query,
      row => this._mapItemToConfig(row)
    );

    return items.sort(
      (a, b) => ((a as any).sortOrder ?? 0) - ((b as any).sortOrder ?? 0)
    );
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
      categoryField: r.CategoryField,
      enabled: !!r.IsEnabled,
      sortOrder: r.SortOrder ?? 0
    } as ExternalListConfig;

    return config;
  }
}

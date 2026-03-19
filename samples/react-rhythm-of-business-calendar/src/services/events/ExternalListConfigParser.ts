import { ExternalListConfig } from "model";

const DEFAULT_EXTERNAL_COLOR = "#3A86C6";

const toOptionalString = (value: unknown): string | undefined => {
    if (value === null || value === undefined) {
        return undefined;
    }

    const result = String(value).trim();
    return result ? result : undefined;
};

const toBoolean = (value: unknown, defaultValue: boolean): boolean => {
    if (typeof value === "boolean") {
        return value;
    }

    if (typeof value === "number") {
        return value === 1;
    }

    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        if (["true", "1", "yes"].includes(normalized)) {
            return true;
        }

        if (["false", "0", "no"].includes(normalized)) {
            return false;
        }
    }

    return defaultValue;
};

const normalizeConfig = (value: any, index: number): ExternalListConfig | undefined => {
    if (!value || typeof value !== "object") {
        return undefined;
    }

    const siteUrl = toOptionalString(value.siteUrl);
    const listId = toOptionalString(value.listId);
    const titleField = toOptionalString(value.titleField);
    const eventDate = toOptionalString(value.eventDate);
    const endDate = toOptionalString(value.endDate) || eventDate;

    if (!siteUrl || !listId || !titleField || !eventDate || !endDate) {
        return undefined;
    }

    return {
        id: toOptionalString(value.id) || `webpart-${index + 1}`,
        enabled: toBoolean(value.enabled, true),
        dateOnly: toBoolean(value.dateOnly, true),
        siteUrl,
        listId,
        viewId: toOptionalString(value.viewId),
        listTitle: toOptionalString(value.listTitle),
        color: toOptionalString(value.color) || DEFAULT_EXTERNAL_COLOR,
        approvalStatus: toOptionalString(value.approvalStatus),
        titleField,
        eventDate,
        endDate,
        locationField: toOptionalString(value.locationField)
    };
};

const buildKey = (config: ExternalListConfig): string => {
    const normalize = (value?: string) => (value || "").trim().toLowerCase();
    return [
        normalize(config.siteUrl),
        normalize(config.listId),
        normalize(config.viewId),
        normalize(config.titleField),
        normalize(config.eventDate),
        normalize(config.endDate)
    ].join("|");
};

export const parseExternalListConfigs = (value?: string | any[]): ExternalListConfig[] => {
    if (!value) {
        return [];
    }

    try {
        const parsed = Array.isArray(value) ? value : JSON.parse(value);
        if (!Array.isArray(parsed)) {
            return [];
        }

        return parsed
            .map((entry, index) => normalizeConfig(entry, index))
            .filter((entry): entry is ExternalListConfig => !!entry);
    } catch (error) {
        console.warn("Unable to parse external list configuration JSON.", error);
        return [];
    }
};

export const serializeExternalListConfigs = (configs: ExternalListConfig[]): string =>
    JSON.stringify(configs, null, 2);

export const mergeExternalListConfigs = (...sets: ExternalListConfig[][]): ExternalListConfig[] => {
    const merged = new Map<string, ExternalListConfig>();

    sets.flat().forEach(config => {
        merged.set(buildKey(config), config);
    });

    return Array.from(merged.values());
};

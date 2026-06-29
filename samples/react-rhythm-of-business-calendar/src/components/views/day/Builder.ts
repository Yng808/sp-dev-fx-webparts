import { Moment } from "moment-timezone";
import { EventOccurrence } from "model";

interface IExternalEventIdentity {
    isExternal?: boolean;
    externalSourceSiteUrl?: string;
    externalSourceListId?: string;
    externalItemId?: number;
}

export const keyForOccurrence = (occurrence: EventOccurrence): string => {
    const event = occurrence.event as typeof occurrence.event & IExternalEventIdentity;
    const hasExternalIdentity =
        event.isExternal &&
        event.externalSourceSiteUrl &&
        event.externalSourceListId &&
        event.externalItemId !== undefined;
    const eventKey = hasExternalIdentity
        ? `external-${event.externalSourceSiteUrl}-${event.externalSourceListId}-${event.externalItemId}`
        : occurrence.event.key;

    return `${eventKey}-${occurrence.start.valueOf()}-${occurrence.end.valueOf()}`;
};

export class DayInfo {
    public readonly occurrences: EventOccurrence[] = [];

    constructor(public readonly date: Moment) {}

    public include(occurrence: EventOccurrence) {
        const occurrenceTimeZone = occurrence.start.tz();
        const dayStart = this.date.clone().startOf('day').tz(occurrenceTimeZone, true);
        const nextDayStart = dayStart.clone().add(1, 'day');

        const overlapsDay =
            occurrence.start.isBefore(nextDayStart) &&
            occurrence.end.isAfter(dayStart);

        // New all-day events can temporarily use the same timestamp for start and end.
        const isZeroDurationAllDayEventStartingThisDay =
            occurrence.isAllDay &&
            occurrence.start.isSame(occurrence.end) &&
            occurrence.start.isSame(dayStart, 'day');

        const event = occurrence.event as typeof occurrence.event & IExternalEventIdentity;
        const endsOnInclusiveExternalDate =
            event.isExternal &&
            occurrence.isAllDay &&
            occurrence.end.isSame(dayStart, 'day');

        if (
            overlapsDay ||
            isZeroDurationAllDayEventStartingThisDay ||
            endsOnInclusiveExternalDate
        ) {
            this.occurrences.push(occurrence);
        }
    }
}

export class Builder {
    public static build(
        cccurrences: readonly EventOccurrence[],
        anchorDate: Moment
    ): DayInfo {
        const dayInfo = new DayInfo(anchorDate);

        // Sort occurrences by start time
        const sortedOccurrences = [...cccurrences].sort(EventOccurrence.StartAscComparer);

        // Include occurrences in the DayInfo
        sortedOccurrences.forEach((occurrence) => dayInfo.include(occurrence));

        return dayInfo;
    }
}

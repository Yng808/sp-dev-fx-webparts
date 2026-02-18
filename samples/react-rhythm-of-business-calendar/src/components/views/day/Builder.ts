import { Moment } from "moment-timezone";
import { EventOccurrence } from "model";

export class DayInfo {
    public readonly occurrences: EventOccurrence[] = [];

    constructor(public readonly date: Moment) {}

    public include(occurrence: EventOccurrence) {
        const dayStart = this.date.clone().startOf('day');
        const dayEnd = this.date.clone().endOf('day');
        if (
            occurrence.start.isBefore(dayEnd) &&
            occurrence.end.isAfter(dayStart)
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

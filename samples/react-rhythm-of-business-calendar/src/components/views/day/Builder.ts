import { Moment } from "moment-timezone";
import { EventOccurrence } from "model";

export class DayInfo {
    public readonly occurrences: EventOccurrence[] = [];

    constructor(public readonly date: Moment) {}

    public include(occurrence: EventOccurrence) {
        const occurrenceTimeZone = occurrence.start.tz();
        const dayStart = this.date.clone().startOf('day').tz(occurrenceTimeZone, true);
        const dayEnd = this.date.clone().endOf('day').tz(occurrenceTimeZone, true);
    
        // FIX: For all-day events ending at midnight, check if end equals the start of this day
        const endsAtMidnightThisDay = 
        occurrence.isAllDay && occurrence.end.hours() === 0 && occurrence.end.minutes() === 0 && occurrence.end.seconds() === 0 && occurrence.end.isSame(dayStart, 'day');

        // Check if the event overlaps with the current day
        if (
            (occurrence.start.isBefore(dayEnd) && occurrence.end.isAfter(dayStart)) || // Event spans into this day
            occurrence.start.isSame(dayStart, 'day') || // Event starts on this day
            endsAtMidnightThisDay // ✅ All-day event ending at midnight of this day
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

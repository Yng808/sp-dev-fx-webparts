import { sumBy } from "lodash";
import { Moment } from "moment-timezone";
import { MomentRange } from "common";
import { EventOccurrence } from 'model';

export class ItemInfo {
    constructor(
        public readonly duration: number,
    ) {
    }
}

export class ShimItemInfo extends ItemInfo {
}

export class EventItemInfo extends ItemInfo {
    constructor(
        duration: number,
        public readonly startsInWeek: boolean,
        public readonly endsInWeek: boolean,
        public readonly cccurrence: EventOccurrence
    ) {
        super(duration);
    }

    public get title() { return this.cccurrence.title; }
    public get isPendingApproval() { return this.cccurrence.isPendingApproval; }
    public get isRejected() { return this.cccurrence.isRejected; }
    public get tag() { return this.cccurrence.tag; }
    public get color() { return this.cccurrence.color; }
    public get isRecurring() { return this.cccurrence.isRecurring; }
    public get isConfidential() { return this.cccurrence.isConfidential; }
}

export class ContentRowInfo {
    public readonly items: ItemInfo[];

    constructor(
        private readonly _startDate: Moment,
        private readonly _endDate: Moment
    ) {

        this.items = [];
    }

    private _dateInOccurrenceTimeZone(date: Moment, occurrence: EventOccurrence): Moment {
        const timezone = occurrence.start?.tz?.() || occurrence.end?.tz?.() || date?.tz?.();
        const normalizedDate = date.clone();

        if (timezone) {
            normalizedDate.tz(timezone, true);
        }

        return normalizedDate;
    }

    public canInclude(cccurrence: EventOccurrence): boolean {
        const startDate = this._dateInOccurrenceTimeZone(this._startDate, cccurrence);
        const startsInWeek = cccurrence.start.isSameOrAfter(startDate);
        const startPosition = startsInWeek ? cccurrence.start.day() : 0;
        return this.lastUsedPosition() <= startPosition;
    }

    public include(cccurrence: EventOccurrence): void {
        const weekStart = this._dateInOccurrenceTimeZone(this._startDate, cccurrence).startOf('day');
        const weekEnd = this._dateInOccurrenceTimeZone(this._endDate, cccurrence).endOf('day');
        // Check if the event overlaps with the current week
        if (
            cccurrence.start.valueOf() < weekEnd.valueOf() && // Event starts before the week ends
            cccurrence.end.valueOf() >= weekStart.valueOf()   // Event ends at or after the week starts (>= to include events ending exactly at midnight on weekStart)
        ) {
            const { start, end } = cccurrence;
            // Determine the exact positions for the event within the weekly range
            const startPosition = start.isBefore(weekStart) ? 0 : start.diff(weekStart, 'days');
            const endPosition = end.isAfter(weekEnd) ? 7 : end.diff(weekStart, 'days') + 1;
            const duration = Math.max(1, endPosition - startPosition);

            const shimDuration = Math.max(0, startPosition - this.lastUsedPosition());
            if (shimDuration > 0) {
                this.items.push(new ShimItemInfo(shimDuration));
            }

            const item = new EventItemInfo(duration, start.isSameOrAfter(weekStart, 'day'), end.isSameOrBefore(weekEnd, 'day'), cccurrence);
            this.items.push(item);
        }
    }    

    private lastUsedPosition(): number {
        return sumBy(this.items, (item) => item.duration);
    }
}

export class Builder {
    public static dateRange(anchorDate: Moment): MomentRange {
        const start = anchorDate.clone().startOf('week');
        const end = anchorDate.clone().endOf('week');
        return { start, end };
    }

    public static build(cccurrences: readonly EventOccurrence[], anchorDate: Moment): ContentRowInfo[] {
        const contentRows: ContentRowInfo[] = [];

        const { start, end } = Builder.dateRange(anchorDate);
    
        // Adjust the weekly range to account for the event's timezone
        const filteredEventOccurrences = cccurrences.filter(cccurrence => {
            const timezone = cccurrence.start?.tz?.() || cccurrence.end?.tz?.() || start?.tz?.();
            const weekStart = start.clone();
            const weekEnd = end.clone();

            if (timezone) {
                weekStart.tz(timezone, true);
                weekEnd.tz(timezone, true);
            }
    
            return (
                cccurrence.start.valueOf() < weekEnd.valueOf() &&
                cccurrence.end.valueOf() >= weekStart.valueOf()
            );
        });

        const sortedEventOccurrences = [...filteredEventOccurrences].sort(EventOccurrence.StartAscComparer);

        for (const cccurrence of sortedEventOccurrences) {
            let availableRow = contentRows.find(row => row.canInclude(cccurrence));

            if (!availableRow) {
                availableRow = new ContentRowInfo(start, end);
                contentRows.push(availableRow);
            }

            availableRow.include(cccurrence);
        }

        return contentRows;
    }
}
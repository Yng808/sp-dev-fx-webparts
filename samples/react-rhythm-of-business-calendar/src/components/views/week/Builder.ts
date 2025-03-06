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

    public canInclude(cccurrence: EventOccurrence): boolean {
        const startsInWeek = cccurrence.start.isSameOrAfter(this._startDate);
        const startPosition = startsInWeek ? cccurrence.start.day() : 0;
        return this.lastUsedPosition() <= startPosition;
    }

    public include(cccurrence: EventOccurrence): void {
        const occurrenceTimeZone = cccurrence.start.tz();
        const weekStart = this._startDate.clone().startOf('day').tz(occurrenceTimeZone, true); // Adjusted to start of the week
        const weekEnd = this._endDate.clone().endOf('day').tz(occurrenceTimeZone, true);       // Adjusted to end of the week 
        // Check if the event overlaps with the current week
        if (
            cccurrence.end.isAfter(weekStart, 'second') && // Ends after the start of the week
            cccurrence.start.isBefore(weekEnd, 'second')   // Starts before the end of the week
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
            const occurrenceTimeZone = cccurrence.start.tz(); // Get the timezone of the event
            const weekStart = start.clone().tz(occurrenceTimeZone, true); // Start of the week in the event's timezone
            const weekEnd = end.clone().tz(occurrenceTimeZone, true);     // End of the week in the event's timezone
    
            return (
                cccurrence.end.isAfter(weekStart, 'second') && // Event ends after the start of the week
                cccurrence.start.isBefore(weekEnd, 'second')   // Event starts before the end of the week
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
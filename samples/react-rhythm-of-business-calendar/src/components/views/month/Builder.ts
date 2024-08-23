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
    public get start() { return this.cccurrence.start; }
    public get isAllDay() { return this.cccurrence.isAllDay; }
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

    public include(cccurrence: EventOccurrence) {
        const { start, end } = cccurrence;
        const cccurrenceTimezone = cccurrence.start.tz();

        const startDateInCccurrenceTimezone = this._startDate.clone().tz(cccurrenceTimezone, true);
        const endDateInCccurrenceTimezone = this._endDate.clone().tz(cccurrenceTimezone, true);

        const startsInWeek = start.isSameOrAfter(this._startDate);
        const endsInWeek = end.isSameOrBefore(endDateInCccurrenceTimezone);
        const startPosition = startsInWeek ? start.day() : 0;
        const endPosition = endsInWeek ? end.day() + 1 : 7;
        const duration = endPosition - startPosition;
        
        // console.log('inside contentRowInfo include');
        // console.log('inside contentRowInfo Event:', cccurrence.title);
        // console.log('inside contentRowInfo Start Position:', startPosition);
        // console.log('inside contentRowInfo End Position:', endPosition);
        // console.log('inside contentRowInfo Duration:', duration);
        // console.log('inside contentRowInfo startsInWeek:', startsInWeek);
        // console.log('inside contentRowInfo endsInWeek:', endsInWeek);
        // console.log('inside contentRowInfo this.startdate:', this._startDate);
        // console.log('inside contentRowInfo startDateInCccurrenceTimezone:', startDateInCccurrenceTimezone);
        // console.log('inside contentRowInfo start', start);        
        // console.log('inside contentRowInfo this.endDate:', this._endDate);
        // console.log('inside contentRowInfo endDateInCccurrenceTimezone:', endDateInCccurrenceTimezone);
        // console.log('inside contentRowInfo end',end);
        // console.log('inside contentRowInfo contentRowInfo occurence:', cccurrence); 

        
            const shimDuration = startPosition - this.lastUsedPosition();
            if (shimDuration > 0) {
                this.items.push(new ShimItemInfo(shimDuration));
            }
    
            const item = new EventItemInfo(duration, startsInWeek, endsInWeek, cccurrence);
            this.items.push(item);
           
            //('end contentRowInfo include');
    }

    private lastUsedPosition(): number {
        return sumBy(this.items, item => item.duration);
    }
}

export class WeekInfo {
    public readonly contentRows: ContentRowInfo[] = [];

    constructor(
        public readonly start: Moment,
        public readonly end: Moment
    ) {
    }

    public include(cccurrence: EventOccurrence) {
        //console.log('Processing Event:', cccurrence.title, 'Start:', cccurrence.start.format(), 'End:', cccurrence.end.format());
        const cccurrenceTimezone = cccurrence.start.tz();
        const thisStartUtc = this.start.clone().tz(cccurrenceTimezone, true); // Should retain the exact date and time.
        const thisEndUtc = this.end.clone().tz(cccurrenceTimezone, true);
        const range2Utc = new MomentRange();
        range2Utc.start = thisStartUtc;
        range2Utc.end = thisEndUtc;

        // console.log('inside weekinfo include');
        // console.log('inside weekinfo include cccurrence',cccurrence);
        // console.log('inside weekinfo this.start:', this.start);
        // console.log('inside weekinfo thisStartUTC:', thisStartUtc);
        // console.log('inside weekinfo this.end:', this.end);
        // console.log('inside weekinfo thisEndUtc:', thisEndUtc);
        // console.log('inside weekinfo momentrange.overlaps:', MomentRange.overlaps(cccurrence, range2Utc, 'second'));

        if (MomentRange.overlaps(cccurrence, range2Utc, 'second')) {
            
            
                let availableRow = this.contentRows.find(row => row.canInclude(cccurrence));
    
                if (!availableRow) {
                    availableRow = new ContentRowInfo(this.start, this.end);
                    this.contentRows.push(availableRow);
                }
    
                availableRow.include(cccurrence);
            
        }

        //console.log('end of weekinfo include');
    }
}

export class Builder {
    public static dateRange(anchorDate: Moment): MomentRange {
        const start = anchorDate.clone().startOf('month').startOf('week');
        const end = anchorDate.clone().endOf('month').endOf('week');
        console.log("Start (from Builder): ", start);
        console.log("End (from Builder): ", end);
        return { start, end };
    }

    public static build(cccurrences: readonly EventOccurrence[], anchorDate: Moment): WeekInfo[] {
        // console.log('inside builder build');
        // console.log('inside builder cccurrences:', cccurrences);
        const weeks = this._createWeeks(anchorDate);
        this._fillWeeksWithEvents(weeks, cccurrences);
        //console.log('end builder build');
        return weeks;
    }

    private static _createWeeks(anchorDate: Moment): WeekInfo[] {
        const weeks: WeekInfo[] = [];

        const { start, end } = Builder.dateRange(anchorDate);
        const date = start;

        do {
            const weekStart = date.clone();
            const weekEnd = date.clone().endOf('week');
            weeks.push(new WeekInfo(weekStart, weekEnd));
            date.add(1, 'week');
        } while (date.isBefore(end));

        return weeks;
    }

    private static _fillWeeksWithEvents(weeks: WeekInfo[], cccurrences: readonly EventOccurrence[]) {
        const sortedEventOccurrences = [...cccurrences].sort(EventOccurrence.StartAscComparer);
        //console.log('sortedEventOccurrences', sortedEventOccurrences);
        for (const week of weeks) {
           // console.log('inside for loop of fill weeks with events');
            //console.log('week:',week);
            sortedEventOccurrences.forEach(occurrence => 
                {

                    week.include(occurrence)
                    //console.log('fill weeks occurrence:', occurrence);
                });
            //console.log('end of loop fill weeks with events');
        }
    }
}
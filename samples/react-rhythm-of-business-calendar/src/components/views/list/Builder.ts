import { Moment } from 'moment-timezone';
import { MomentRange } from 'common';

export class Builder {
    public static dateRange(anchorDate: Moment): MomentRange {
        // Start date: 2 years before the anchor date
        const start = anchorDate.clone().subtract(2, 'years').startOf('day');

        // End date: 2 year after the anchor date
        const end = anchorDate.clone().add(2, 'year').endOf('day');

        console.log("Start (from Builder reports): ", start);
        console.log("End (from Builder reports): ", end);

        return { start, end };
    }
}
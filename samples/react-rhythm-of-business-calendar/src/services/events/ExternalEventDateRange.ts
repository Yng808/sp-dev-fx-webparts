import { Moment } from 'moment-timezone';

export interface IExternalEventDateRange {
    start: Moment;
    end: Moment;
}

export const normalizeInclusiveDateOnlyRange = (
    start: Moment,
    inclusiveEnd?: Moment
): IExternalEventDateRange => {
    const normalizedStart = start.clone().startOf('day');
    const normalizedInclusiveEnd =
        inclusiveEnd?.isValid() && inclusiveEnd.isSameOrAfter(normalizedStart, 'day')
            ? inclusiveEnd.clone().startOf('day')
            : normalizedStart.clone();

    return {
        start: normalizedStart,
        end: normalizedInclusiveEnd.add(1, 'day')
    };
};

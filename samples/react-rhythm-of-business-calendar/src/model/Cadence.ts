import { min, Moment } from "moment-timezone";
import { MomentRange } from "common";
import { DailyRecurrence, MonthlyRecurrence, RecurDay, RecurPattern, RecurPatternOption, Recurrence, RecurUntilType, RecurWeekOfMonth, WeeklyRecurrence, YearlyRecurrence } from "./Recurrence";

const isWeekend = (date: Moment): boolean =>
    date.day() === 0 || date.day() === 6

const thisOrPreviousWeekday = (date: Moment): void => {
    while (isWeekend(date))
        date.subtract(1, 'day');
}

const thisOrNextWeekday = (date: Moment): void => {
    while (isWeekend(date))
        date.add(1, 'day');
}

const thisOrPreviousWeekendDay = (date: Moment): void => {
    while (!isWeekend(date))
        date.subtract(1, 'day');
}

const thisOrNextWeekendDay = (date: Moment): void => {
    while (!isWeekend(date))
        date.add(1, 'day');
}

const gotoDateByRecurDay = (current: Moment, weekOf: RecurWeekOfMonth, recurDay: RecurDay) => {
    console.log('cadence line 29', recurDay, weekOf);
    console.log('cadence line 30', current);
    switch (recurDay) {
        case RecurDay.day: {
            if (weekOf === RecurWeekOfMonth.last)
                current.endOf('month');
            else
                current.date(weekOf + 1);

            break;
        }
        case RecurDay.weekday: {
            if (weekOf === RecurWeekOfMonth.last) {
                current.endOf('month');
                thisOrPreviousWeekday(current);
            } else {
                current.startOf('month');
                thisOrNextWeekday(current);

                for (let i = 0; i < weekOf; i++) {
                    current.add(1, 'day');
                    thisOrNextWeekday(current);
                }
            }

            break;
        }
        case RecurDay.weekend: {
            if (weekOf === RecurWeekOfMonth.last) {
                current.endOf('month');
                thisOrPreviousWeekendDay(current);
            } else {
                current.startOf('month');
                thisOrNextWeekendDay(current);

                for (let i = 0; i < weekOf; i++) {
                    current.add(1, 'day');
                    thisOrNextWeekendDay(current);
                }
            }

            break;
        }
        default: {
            console.log('cadence line 72', weekOf);

            if (weekOf === RecurWeekOfMonth.last) {
                current.add(1, 'month');
            }

            const month = current.month();
            console.log('cadence line 74', month)
            current.startOf('month');
            //console.log('cadence line 76', current.startOf('month'));
            current.day(recurDay); // sets the date to be the specified day of the week within the current Sunday-Saturday week
            //console.log('cadence line 78', current.day(recurDay));
            console.log('cadence line 79', current.month);
            console.log('cadence line 80', month);
            console.log('cadence line 87', current.clone().utc().format());
            console.log('cadence line 88', current.format('MMM'));
            if (current.month() < month || (current.format('MMM') === 'Dec' && month === 0)) {
                current.add(1, 'week'); // if that moved the date backwards to the previous month, add a week to move forward to the current month
            }


            current.add(weekOf === RecurWeekOfMonth.last ? -1 : weekOf, 'weeks');


        }
    }
}

interface ICadenceGenerator {
    generate(start: Moment): Generator<Moment, undefined, Moment>;
}

class DailyCadenceGenerator implements ICadenceGenerator {
    constructor(
        private readonly _daily: DailyRecurrence,
    ) { }

    public *generate(start: Moment): Generator<Moment, undefined> {
        const { every } = this._daily;
        const weekdaysOnly = false;
        const current = start.clone();
        //console.log("WeekdaysOnly:", weekdaysOnly);
        //console.log("Every:", );
        while (true) {
            if (weekdaysOnly) {
                if (current.day() === 0)
                    current.add(1, 'day'); // Sunday, add 1 day

                if (current.day() === 6)
                    current.add(2, 'days'); // Saturday, add 2 days
            }

            yield current.clone();

            //console.log("Yielding date:", current.format('YYYY-MM-DD'));

            current.add(weekdaysOnly ? 1 : every, 'days');
            //console.log("Adding days, new date:", current.format('YYYY-MM-DD'));
        }
    }
}

class WeeklyCadenceGenerator implements ICadenceGenerator {
    constructor(
        private readonly _weekly: WeeklyRecurrence,
    ) { }

    public *generate(start: Moment): Generator<Moment, undefined> {
        const { days, every } = this._weekly;
        const current = start.clone();

        let d = current.weekday();

        while (true) {
            do {
                if (days[d]) {
                    yield current.clone();
                }
                console.log("execution returned after yield");
                current.add(1, 'day');
                d++;
            } while (d < days.length);

            d = 0;
            current.add(every - 1, 'weeks');
        }
    }
}

class MonthlyByDateCadenceGenerator implements ICadenceGenerator {
    constructor(
        private readonly _monthly: MonthlyRecurrence,
    ) { }

    public *generate(start: Moment): Generator<Moment, undefined> {
        const { byDate: { date }, every } = this._monthly;
        const current = start.clone();

        if (date < current.date())
            current.add(every, 'months');

        while (true) {
            const monthTemp = current.month();

            current.date(date);

            if (current.month() > monthTemp) {
                current.startOf('month').subtract(1, 'day');
            }

            yield current.clone();

            current.add(every, 'months');
        }
    }
}

class MonthlyByDayCadenceGenerator implements ICadenceGenerator {
    constructor(
        private readonly _monthly: MonthlyRecurrence,
    ) { }

    public *generate(start: Moment): Generator<Moment, undefined> {
        const { byDay: { day, weekOf }, every } = this._monthly;
        const current = start.clone();
        console.log('cadence line 178', current, weekOf, day, this._monthly);

        while (true) {
            gotoDateByRecurDay(current, weekOf, day);
            console.log('cadence line 192', current);
            if (current.isSameOrAfter(start))
               // yield current.clone();
                 yield current.clone().set({
                    hour: start.hour(),
                    minute: start.minute()
                }); 

            console.log('cadence line 192', current.add(every, 'months'));

        }
    }
}

class YearlyByDateCadenceGenerator implements ICadenceGenerator {
    constructor(
        private readonly _yearly: YearlyRecurrence,
    ) { }

    public *generate(start: Moment): Generator<Moment, undefined> {
        const { byDate: { date }, month, every } = this._yearly;
        const current = start.clone();

        if (month < current.month() || (month === current.month() && date < current.date()))
            current.add(every, 'years');

        while (true) {
            current.month(month);
            current.date(date);

            if (current.month() > month) {
                current.startOf('month').subtract(1, 'day');
            }

            yield current.clone();

            current.add(every, 'years');
        }
    }
}

class YearlyByDayCadenceGenerator implements ICadenceGenerator {
    constructor(
        private readonly _yearly: YearlyRecurrence,
    ) { }

    public *generate(start: Moment): Generator<Moment, undefined> {
        const { byDay: { day, weekOf }, month, every } = this._yearly;
        const current = start.clone();

        while (true) {
            current.month(month);

            gotoDateByRecurDay(current, weekOf, day);

            if (current.isSameOrAfter(start))
                yield current.clone();

            current.add(every, 'years');
        }
    }
}

export class Cadence {
    constructor(
        private readonly _start: Moment,
        private readonly _recurrence: Recurrence
    ) { }

    public *generate(range?: MomentRange): Generator<Moment, undefined> {
        range ||= { start: this._start?.clone(), end: this._start?.clone().add(3, 'years') };

        if (!range.start?.isValid() || !range.end?.isValid())
            return;

        const { until } = this._recurrence;

        console.log('cadence line 261', this._start);

        const generator = this._createGenerator();
        const dates = generator.generate(this._start);
        console.log('cadence line 262', dates);
        let count = 0;

        const end = (until.type === RecurUntilType.date && until.date?.isValid())
            ? min(range.end, until.date)
            : range.end;

        do {
            const { done, value: date } = dates.next();

            if (done || !date.isValid() || date.isAfter(end, 'day'))

                break;

            if (date.isSameOrAfter(range.start, 'day'))
                yield date;

            count++;
        } while (until.type !== RecurUntilType.count || count < until.count);
    }

    private _createGenerator(): ICadenceGenerator {
        const { pattern, daily, weekly, monthly, yearly } = this._recurrence;

        switch (pattern) {
            case RecurPattern.daily:
                return new DailyCadenceGenerator(daily);
            case RecurPattern.weekly:
                return new WeeklyCadenceGenerator(weekly);
            case RecurPattern.monthly:
                if (monthly.option === RecurPatternOption.byDate)
                    return new MonthlyByDateCadenceGenerator(monthly);
                else if (monthly.option === RecurPatternOption.byDay)
                    return new MonthlyByDayCadenceGenerator(monthly);
                break;
            case RecurPattern.yearly:
                if (yearly.option === RecurPatternOption.byDate)
                    return new YearlyByDateCadenceGenerator(yearly);
                else if (yearly.option === RecurPatternOption.byDay)
                    return new YearlyByDayCadenceGenerator(yearly);
                break;
        }
    }
}
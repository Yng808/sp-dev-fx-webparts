import { Event, Recurrence, RecurDay, RecurPattern, RecurPatternOption, RecurUntilType, RecurWeekOfMonth } from "model";

export const eventTestCases = (anchorDate: any) =>  ({
    nonreccuring: [
        {
            name: "TEST #1 - Single Day (1 Hour)",
            build: () => {
                const event = new Event();
                event.title = "TEST #1 - Single Day (1 Hour)";
                event.start = anchorDate.clone().hour(10).minute(0);    // 10:00 AM (start time)
                event.end = anchorDate.clone().hour(11).minute(0);      // 11:00 AM (end time, +1 hour duration)
                event.isAllDay = false;
                return event;
            }
        },
        {
            name: "TEST #2 - All Day",
            build: () => {
                const event = new Event();
                event.title = "TEST #2 - All Day";
                event.start = anchorDate.clone().startOf("day");
                event.end = anchorDate.clone().startOf("day"); 
                event.isAllDay = true;
                return event;
            }
        },
        {
            name: "TEST #3 - Cross Day Event",
            build: () => {
                const event = new Event();
                event.title = "TEST #3 - Cross Day Event";
                event.start = anchorDate.clone().hour(22).minute(0);            // 10:00 PM (start late evening)
                event.end = anchorDate.clone().add(1, "day").hour(2).minute(0); // 2:00 AM next day (crosses midnight)
                event.isAllDay = false;
                return event;
            }
        },
        {
            name: "TEST #4 - Edge Time Values",
            build: () => {
                const event = new Event();
                event.title = "TEST #4 - Edge Time Values";
                event.start = anchorDate.clone().hour(0).minute(0);     // 12:00 AM (midnight boundary)
                event.end = anchorDate.clone().hour(12).minute(55);     // 12:55 PM (noon + max UI minute boundary)
                event.isAllDay = false;
                return event;
            }
        },
        {
            name: "TEST #5 - Ends At Midnight Boundary",
            build: () => {
                const event = new Event();
                event.title = "TEST #5 - Ends At Midnight Boundary";
                event.start = anchorDate.clone().hour(20).minute(0);          // 8:00 PM
                event.end = anchorDate.clone().add(1, "day").hour(0).minute(0);  // 12:00 AM next day
                event.isAllDay = false;
                return event;
            }
        }
    ],
    daily: [
        {
            name: "TEST #6 - Daily Every 1 Day",
            build: () => {
                const event = new Event();
                event.title = "TEST #6 - Daily Every 1 Day";
                event.start = anchorDate.clone().hour(9).minute(0);
                event.end = anchorDate.clone().hour(10).minute(0);
                event.isAllDay = false;

                const recurrence = new Recurrence();
                recurrence.pattern = RecurPattern.daily;        // pattern
                recurrence.daily.every = 1;                     // daily config
                recurrence.daily.weekdaysOnly = false;          // does not skip weekends
                recurrence.until.type = RecurUntilType.count;   // until config
                recurrence.until.count = 5;
                recurrence.setDefaultsForDate(event.start);
                event.isRecurring = true;
                event.recurrence = recurrence;

                return event;
            }
        },
        {
            name: "TEST #7 - Daily Weekdays Only",
            build: () => {
                const event = new Event();
                event.title = "TEST #7 - Daily Weekdays Only";
                event.start = anchorDate.clone().hour(9).minute(0);
                event.end = anchorDate.clone().hour(10).minute(0);

                const recurrence = new Recurrence();
                recurrence.pattern = RecurPattern.daily;
                recurrence.daily.every = 1;
                recurrence.daily.weekdaysOnly = true;
                recurrence.until.type = RecurUntilType.count;
                recurrence.until.count = 5;

                recurrence.setDefaultsForDate(event.start);
                event.isRecurring = true;
                event.recurrence = recurrence;

                return event;
            }
        },
        {
            name: "TEST #8 - Daily Every 3 Days",
            build: () => {
                const event = new Event();
                event.title = "TEST #8 - Daily Every 3 Days";
                event.start = anchorDate.clone().hour(9).minute(0);
                event.end = anchorDate.clone().hour(10).minute(0);

                const recurrence = new Recurrence();
                recurrence.pattern = RecurPattern.daily;
                recurrence.daily.every = 3;
                recurrence.daily.weekdaysOnly = false;
                recurrence.until.type = RecurUntilType.count;
                recurrence.until.count = 5;

                recurrence.setDefaultsForDate(event.start);
                event.isRecurring = true;
                event.recurrence = recurrence;

                return event;
            }
        },
        {
            name: "TEST #9 - Daily Until Date",
            build: () => {
                const event = new Event();
                event.title = "TEST #9 - Daily Until Date";
                event.start = anchorDate.clone().hour(9).minute(0);
                event.end = anchorDate.clone().hour(10).minute(0);

                const recurrence = new Recurrence();
                recurrence.pattern = RecurPattern.daily;
                recurrence.daily.every = 1;
                recurrence.daily.weekdaysOnly = false;
                recurrence.until.type = RecurUntilType.date;
                recurrence.until.date = anchorDate.clone().add(10, 'days');

                recurrence.setDefaultsForDate(event.start);
                event.isRecurring = true;
                event.recurrence = recurrence;

                return event;
            }
        }
    ],
    weekly: [
        {
            name: "TEST #10 - Weekly Monday",
            build: () => {
                const event = new Event();
                event.title = "TEST #10 - Weekly Monday";
                event.start = anchorDate.clone().day(RecurDay.monday).hour(9).minute(0);
                event.end = anchorDate.clone().day(RecurDay.monday).hour(10).minute(0);
                event.isAllDay = false;

                const recurrence = new Recurrence();
                recurrence.pattern = RecurPattern.weekly;
                recurrence.weekly.every = 1;
                recurrence.weekly.days[RecurDay.monday] = true;
                recurrence.until.type = RecurUntilType.count;
                recurrence.until.count = 8;
                recurrence.setDefaultsForDate(event.start);
                recurrence.weekly.days.fill(false);
                recurrence.weekly.days[RecurDay.monday] = true;
                event.isRecurring = true;
                event.recurrence = recurrence;

                return event;
            }
        },
        {
            name: "TEST #11 - Weekly Multi (Mon + Wed)",
            build: () => {
                const event = new Event();
                event.title = "TEST #11 - Weekly Multi (Mon + Wed)";
                event.start = anchorDate.clone().day(RecurDay.monday).hour(11).minute(0);
                event.end = anchorDate.clone().day(RecurDay.monday).hour(12).minute(0);
                event.isAllDay = false;

                const recurrence = new Recurrence();
                recurrence.pattern = RecurPattern.weekly;
                recurrence.weekly.every = 1;
                recurrence.until.type = RecurUntilType.count;
                recurrence.until.count = 8;
                recurrence.setDefaultsForDate(event.start);
                recurrence.weekly.days.fill(false);
                recurrence.weekly.days[RecurDay.monday] = true;
                recurrence.weekly.days[RecurDay.wednesday] = true;
                event.isRecurring = true;
                event.recurrence = recurrence;

                return event;
            }
        },
        {
            name: "TEST #12 - Weekly Multi (Mon-Thu)",
            build: () => {
                const event = new Event();
                event.title = "TEST #12 - Weekly Multi (Mon-Thu)";
                event.start = anchorDate.clone().day(RecurDay.monday).hour(9).minute(0);
                event.end = anchorDate.clone().day(RecurDay.monday).hour(10).minute(0);
                event.isAllDay = false;

                const recurrence = new Recurrence();
                recurrence.pattern = RecurPattern.weekly;
                recurrence.weekly.every = 1;
                recurrence.until.type = RecurUntilType.count;
                recurrence.until.count = 6;
                recurrence.setDefaultsForDate(event.start);
                recurrence.weekly.days.fill(false);
                recurrence.weekly.days[RecurDay.monday] = true;
                recurrence.weekly.days[RecurDay.tuesday] = true;
                recurrence.weekly.days[RecurDay.wednesday] = true;
                recurrence.weekly.days[RecurDay.thursday] = true;

                event.isRecurring = true;
                event.recurrence = recurrence;

                return event;
            }
        },
        {
            name: "TEST #13 - All Day Weekly",
            build: () => {
                const event = new Event();
                event.title = "TEST #13 - All Day Weekly";
                event.start = anchorDate.clone().day(RecurDay.monday).startOf("day");
                event.end = anchorDate.clone().day(RecurDay.monday).startOf("day");
                event.isAllDay = true;

                const recurrence = new Recurrence();
                recurrence.pattern = RecurPattern.weekly;
                recurrence.weekly.every = 1;
                recurrence.until.type = RecurUntilType.count;
                recurrence.until.count = 8;
                recurrence.setDefaultsForDate(event.start);
                recurrence.weekly.days.fill(false);
                recurrence.weekly.days[RecurDay.monday] = true;
                event.isRecurring = true;
                event.recurrence = recurrence;

                return event;
            }
        },
        {
            name: "TEST #14 - Multi-Year Weekly",
            build: () => {
                const event = new Event();
                event.title = "TEST #14 - Multi-Year Weekly";
                event.start = anchorDate.clone().day(RecurDay.monday).hour(8).minute(0);
                event.end = anchorDate.clone().day(RecurDay.monday).hour(9).minute(0);
                event.isAllDay = false;

                const recurrence = new Recurrence();
                recurrence.pattern = RecurPattern.weekly;
                recurrence.weekly.every = 1;
                recurrence.until.type = RecurUntilType.date;
                recurrence.until.date = anchorDate.clone().add(3, "years");
                recurrence.setDefaultsForDate(event.start);
                recurrence.weekly.days.fill(false);
                recurrence.weekly.days[RecurDay.monday] = true;
                event.isRecurring = true;
                event.recurrence = recurrence;

                return event;
            }
        }
    ],
    monthly: [
        {
            name: "TEST #15 - Monthly Date (Day 15)",
            build: () => {
                const event = new Event();
                event.title = "TEST #15 - Monthly Date (Day 15)";
                event.start = anchorDate.clone().date(15).hour(9).minute(0);
                event.end = anchorDate.clone().date(15).hour(10).minute(0);
                event.isAllDay = false;

                const recurrence = new Recurrence();
                recurrence.pattern = RecurPattern.monthly;
                recurrence.monthly.option = RecurPatternOption.byDate;
                recurrence.monthly.every = 1;
                recurrence.monthly.byDate.date = 15;
                recurrence.until.type = RecurUntilType.count;
                recurrence.until.count = 8;
                recurrence.setDefaultsForDate(event.start);
                event.isRecurring = true;
                event.recurrence = recurrence;

                return event;
            }
        },
        {
            name: "TEST #16 - Last Day Of Month",
            build: () => {
                const event = new Event();
                event.title = "TEST #16 - Last Day Of Month";
                event.start = anchorDate.clone().month(0).date(31).hour(9).minute(0);
                event.end = anchorDate.clone().month(0).date(31).hour(10).minute(0);
                event.isAllDay = false;

                const recurrence = new Recurrence();
                recurrence.pattern = RecurPattern.monthly;
                recurrence.monthly.option = RecurPatternOption.byDate;
                recurrence.monthly.every = 1;
                recurrence.monthly.byDate.date = 31;
                recurrence.until.type = RecurUntilType.count;
                recurrence.until.count = 12;
                recurrence.setDefaultsForDate(event.start);
                event.isRecurring = true;
                event.recurrence = recurrence;

                return event;
            }
        },
        {
            name: "TEST #17 - Monthly First Monday",
            build: () => {
                const event = new Event();
                event.title = "TEST #17 - Monthly First Monday";
                event.start = anchorDate.clone().startOf("month").day(1).hour(9).minute(0);
                event.end = anchorDate.clone().startOf("month").day(1).hour(10).minute(0);
                event.isAllDay = false;

                const recurrence = new Recurrence();
                recurrence.pattern = RecurPattern.monthly;
                recurrence.monthly.option = RecurPatternOption.byDay;
                recurrence.monthly.every = 1;
                recurrence.monthly.byDay.weekOf = RecurWeekOfMonth.first;
                recurrence.monthly.byDay.day = RecurDay.monday;
                recurrence.until.type = RecurUntilType.count;
                recurrence.until.count = 8;
                recurrence.setDefaultsForDate(event.start);
                event.isRecurring = true;
                event.recurrence = recurrence;

                return event;
            }
        },
        {
            name: "TEST #18 - Monthly Second Tuesday",
            build: () => {
                const event = new Event();
                event.title = "TEST #18 - Monthly Second Tuesday";
                event.start = anchorDate.clone().startOf("month").day(2).add(1, "week").hour(9).minute(0);
                event.end = anchorDate.clone().startOf("month").day(2).add(1, "week").hour(10).minute(0);
                event.isAllDay = false;

                const recurrence = new Recurrence();
                recurrence.pattern = RecurPattern.monthly;
                recurrence.monthly.option = RecurPatternOption.byDay;
                recurrence.monthly.every = 1;
                recurrence.monthly.byDay.weekOf = RecurWeekOfMonth.second;
                recurrence.monthly.byDay.day = RecurDay.tuesday;
                recurrence.until.type = RecurUntilType.count;
                recurrence.until.count = 8;
                recurrence.setDefaultsForDate(event.start);
                event.isRecurring = true;
                event.recurrence = recurrence;

                return event;
            }
        },
        {
            name: "TEST #19 - Monthly Third Wednesday",
            build: () => {
                const event = new Event();
                event.title = "TEST #19 - Monthly Third Wednesday";
                event.start = anchorDate.clone().startOf("month").day(3).add(2, "weeks").hour(9).minute(0);
                event.end = anchorDate.clone().startOf("month").day(3).add(2, "weeks").hour(10).minute(0);
                event.isAllDay = false;

                const recurrence = new Recurrence();
                recurrence.pattern = RecurPattern.monthly;
                recurrence.monthly.option = RecurPatternOption.byDay;
                recurrence.monthly.every = 1;
                recurrence.monthly.byDay.weekOf = RecurWeekOfMonth.third;
                recurrence.monthly.byDay.day = RecurDay.wednesday;
                recurrence.until.type = RecurUntilType.count;
                recurrence.until.count = 8;
                recurrence.setDefaultsForDate(event.start);
                event.isRecurring = true;
                event.recurrence = recurrence;

                return event;
            }
        },
        {
            name: "TEST #20 - Monthly Fourth Thursday",
            build: () => {
                const event = new Event();
                event.title = "TEST #20 - Monthly Fourth Thursday";
                event.start = anchorDate.clone().startOf("month").day(4).add(3, "weeks").hour(9).minute(0);
                event.end = anchorDate.clone().startOf("month").day(4).add(3, "weeks").hour(10).minute(0);
                event.isAllDay = false;

                const recurrence = new Recurrence();
                recurrence.pattern = RecurPattern.monthly;
                recurrence.monthly.option = RecurPatternOption.byDay;
                recurrence.monthly.every = 1;
                recurrence.monthly.byDay.weekOf = RecurWeekOfMonth.fourth;
                recurrence.monthly.byDay.day = RecurDay.thursday;
                recurrence.until.type = RecurUntilType.count;
                recurrence.until.count = 8;
                recurrence.setDefaultsForDate(event.start);
                event.isRecurring = true;
                event.recurrence = recurrence;

                return event;
            }
        },
        {
            name: "TEST #21 - Monthly Last Friday",
            build: () => {
                const event = new Event();
                event.title = "TEST #21 - Monthly Last Friday";
                event.start = anchorDate.clone().endOf("month").day(5).hour(9).minute(0);
                event.end = anchorDate.clone().endOf("month").day(5).hour(10).minute(0);
                event.isAllDay = false;

                const recurrence = new Recurrence();
                recurrence.pattern = RecurPattern.monthly;
                recurrence.monthly.option = RecurPatternOption.byDay;
                recurrence.monthly.every = 1;
                recurrence.monthly.byDay.weekOf = RecurWeekOfMonth.last;
                recurrence.monthly.byDay.day = RecurDay.friday;
                recurrence.until.type = RecurUntilType.count;
                recurrence.until.count = 8;
                recurrence.setDefaultsForDate(event.start);
                event.isRecurring = true;
                event.recurrence = recurrence;

                return event;
            }
        },
        {
            name: "TEST #22 - Monthly First Tuesday",
            build: () => {
                const event = new Event();
                event.title = "TEST #22 - Monthly First Tuesday";
                event.start = anchorDate.clone().startOf("month").day(2).hour(11).minute(0);
                event.end = anchorDate.clone().startOf("month").day(2).hour(12).minute(0);
                event.isAllDay = false;

                const recurrence = new Recurrence();
                recurrence.pattern = RecurPattern.monthly;
                recurrence.monthly.option = RecurPatternOption.byDay;
                recurrence.monthly.every = 1;
                recurrence.monthly.byDay.weekOf = RecurWeekOfMonth.first;
                recurrence.monthly.byDay.day = RecurDay.tuesday;
                recurrence.until.type = RecurUntilType.count;
                recurrence.until.count = 8;
                recurrence.setDefaultsForDate(event.start);
                event.isRecurring = true;
                event.recurrence = recurrence;

                return event;
            }
        },
        {
            name: "TEST #23 - Monthly First Wednesday",
            build: () => {
                const event = new Event();
                event.title = "TEST #23 - Monthly First Wednesday";
                event.start = anchorDate.clone().startOf("month").day(3).hour(11).minute(0);
                event.end = anchorDate.clone().startOf("month").day(3).hour(12).minute(0);
                event.isAllDay = false;

                const recurrence = new Recurrence();
                recurrence.pattern = RecurPattern.monthly;
                recurrence.monthly.option = RecurPatternOption.byDay;
                recurrence.monthly.every = 1;
                recurrence.monthly.byDay.weekOf = RecurWeekOfMonth.first;
                recurrence.monthly.byDay.day = RecurDay.wednesday;
                recurrence.until.type = RecurUntilType.count;
                recurrence.until.count = 8;
                recurrence.setDefaultsForDate(event.start);
                event.isRecurring = true;
                event.recurrence = recurrence;

                return event;
            }
        },
        {
            name: "TEST #24 - Stress Monthly First Monday",
            build: () => {
                const event = new Event();
                event.title = "TEST #24 - Stress Monthly First Monday";
                event.start = anchorDate.clone().startOf("month").day(1).hour(7).minute(0);
                event.end = anchorDate.clone().startOf("month").day(1).hour(8).minute(0);
                event.isAllDay = false;

                const recurrence = new Recurrence();
                recurrence.pattern = RecurPattern.monthly;
                recurrence.monthly.option = RecurPatternOption.byDay;
                recurrence.monthly.every = 1;
                recurrence.monthly.byDay.weekOf = RecurWeekOfMonth.first;
                recurrence.monthly.byDay.day = RecurDay.monday;
                recurrence.until.type = RecurUntilType.count;
                recurrence.until.count = 60;
                recurrence.setDefaultsForDate(event.start);
                event.isRecurring = true;
                event.recurrence = recurrence;

                return event;
            }
        },
        {
            name: "TEST #25 - Monthly First Monday Until Date",
            build: () => {
                const event = new Event();
                event.title = "TEST #25 - Monthly First Monday Until Date";
                event.start = anchorDate.clone().startOf("month").day(1).hour(13).minute(0);
                event.end = anchorDate.clone().startOf("month").day(1).hour(14).minute(0);
                event.isAllDay = false;

                const recurrence = new Recurrence();
                recurrence.pattern = RecurPattern.monthly;
                recurrence.monthly.option = RecurPatternOption.byDay;
                recurrence.monthly.every = 1;
                recurrence.monthly.byDay.weekOf = RecurWeekOfMonth.first;
                recurrence.monthly.byDay.day = RecurDay.monday;
                recurrence.until.type = RecurUntilType.date;
                recurrence.until.date = anchorDate.clone().add(18, "months");
                recurrence.setDefaultsForDate(event.start);
                event.isRecurring = true;
                event.recurrence = recurrence;

                return event;
            }
        }
    ],
    yearly: [
        {
            name: "TEST #26 - Yearly Date (March 10)",
            build: () => {
                const event = new Event();
                event.title = "TEST #26 - Yearly Date (March 10)";
                event.start = anchorDate.clone().month(2).date(10).hour(9).minute(0);
                event.end = anchorDate.clone().month(2).date(10).hour(10).minute(0);
                event.isAllDay = false;

                const recurrence = new Recurrence();
                recurrence.pattern = RecurPattern.yearly;
                recurrence.yearly.option = RecurPatternOption.byDate;
                recurrence.yearly.every = 1;
                recurrence.yearly.month = 2;
                recurrence.yearly.byDate.date = 10;
                recurrence.until.type = RecurUntilType.count;
                recurrence.until.count = 5;
                recurrence.setDefaultsForDate(event.start);
                event.isRecurring = true;
                event.recurrence = recurrence;

                return event;
            }
        },
        {
            name: "TEST #27 - Yearly First Monday Of March",
            build: () => {
                const event = new Event();
                event.title = "TEST #27 - Yearly First Monday Of March";
                event.start = anchorDate.clone().month(2).startOf("month").day(1).hour(10).minute(0);
                event.end = anchorDate.clone().month(2).startOf("month").day(1).hour(11).minute(0);
                event.isAllDay = false;

                const recurrence = new Recurrence();
                recurrence.pattern = RecurPattern.yearly;
                recurrence.yearly.option = RecurPatternOption.byDay;
                recurrence.yearly.every = 1;
                recurrence.yearly.month = 2;
                recurrence.yearly.byDay.weekOf = RecurWeekOfMonth.first;
                recurrence.yearly.byDay.day = RecurDay.monday;
                recurrence.until.type = RecurUntilType.count;
                recurrence.until.count = 5;
                recurrence.setDefaultsForDate(event.start);
                event.isRecurring = true;
                event.recurrence = recurrence;

                return event;
            }
        }
    ]
});
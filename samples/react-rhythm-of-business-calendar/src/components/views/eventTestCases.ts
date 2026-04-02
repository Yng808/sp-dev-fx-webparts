import { Event, Recurrence, RecurPattern, RecurUntilType } from "model";

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
                event.start = anchorDate.clone().startOf("day");    // 12:00 AM (start of day) 
                event.end = anchorDate.clone().startOf("day");      // 12:00 AM (same day, all-day flag controls duration)
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
                event.end = anchorDate.clone().add(1, "day").startOf("day");  // 12:00 AM next day
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
            name: "TEST #7 - Daily Weekdays Only", // NEED TO CLARIFY
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

        }
    ],
    monthly: [
        {  

        }
    ],
    yearly: [
        {

        }
    ]
});
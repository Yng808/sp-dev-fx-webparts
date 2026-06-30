jest.mock('model', () => ({
    EventOccurrence: {
        StartAscComparer: (a, b) => a.start.diff(b.start)
    }
}));

const moment = require('moment-timezone');
const { Builder, keyForOccurrence } = require('./Builder');

const timeZone = 'Pacific/Honolulu';

const occurrence = (start, end, isAllDay = false) => ({
    event: { key: `${start}-${end}` },
    start: moment.tz(start, timeZone),
    end: moment.tz(end, timeZone),
    isAllDay
});

describe('Day view Builder', () => {
    const selectedDay = moment.tz('2026-06-28 12:00', timeZone);

    it('excludes an event that ends exactly when the selected day begins', () => {
        const endingAtMidnight = occurrence(
            '2026-06-27 00:00',
            '2026-06-28 00:00',
            true
        );

        expect(Builder.build([endingAtMidnight], selectedDay).occurrences).toEqual([]);
    });

    it('includes an event that continues into the selected day', () => {
        const continuingIntoDay = occurrence(
            '2026-06-27 23:00',
            '2026-06-28 01:00'
        );

        expect(Builder.build([continuingIntoDay], selectedDay).occurrences).toEqual([
            continuingIntoDay
        ]);
    });

    it('includes an event that starts during the selected day', () => {
        const startingDuringDay = occurrence(
            '2026-06-28 10:00',
            '2026-06-28 11:00'
        );

        expect(Builder.build([startingDuringDay], selectedDay).occurrences).toEqual([
            startingDuringDay
        ]);
    });

    it('keeps zero-duration all-day placeholders on their start day only', () => {
        const allDayPlaceholder = occurrence(
            '2026-06-28 00:00',
            '2026-06-28 00:00',
            true
        );

        expect(Builder.build([allDayPlaceholder], selectedDay).occurrences).toEqual([
            allDayPlaceholder
        ]);
        expect(
            Builder.build(
                [allDayPlaceholder],
                selectedDay.clone().add(1, 'day')
            ).occurrences
        ).toEqual([]);
    });

    it('includes every day in an inclusive external date-only range', () => {
        const externalEvent = {
            event: {
                key: 'external-event',
                isExternal: true,
                externalConfigId: 'config-a',
                externalSourceSiteUrl: 'https://example.sharepoint.com/sites/calendar',
                externalSourceListId: 'list-a',
                externalItemId: 1
            },
            start: moment.tz('2026-05-30 00:00', timeZone),
            end: moment.tz('2026-06-01 00:00', timeZone),
            isAllDay: true
        };

        ['2026-05-30', '2026-05-31', '2026-06-01'].forEach(day => {
            expect(
                Builder.build(
                    [externalEvent],
                    moment.tz(`${day} 12:00`, timeZone)
                ).occurrences
            ).toEqual([externalEvent]);
        });
        expect(
            Builder.build(
                [externalEvent],
                moment.tz('2026-06-02 12:00', timeZone)
            ).occurrences
        ).toEqual([]);
    });
});

describe('keyForOccurrence', () => {
    it('distinguishes external events that share a date and default numeric ID', () => {
        const start = moment.tz('2026-06-28 10:00', timeZone);
        const end = start.clone().add(1, 'hour');
        const first = {
            event: {
                id: 0,
                key: 'external-event-a',
                isExternal: true,
                externalConfigId: 'config-a',
                externalSourceSiteUrl: 'https://example.sharepoint.com/sites/calendar',
                externalSourceListId: 'list-a',
                externalItemId: 1
            },
            start,
            end
        };
        const second = {
            event: {
                id: 0,
                key: 'external-event-b',
                isExternal: true,
                externalConfigId: 'config-a',
                externalSourceSiteUrl: 'https://example.sharepoint.com/sites/calendar',
                externalSourceListId: 'list-a',
                externalItemId: 2
            },
            start: start.clone(),
            end: end.clone()
        };

        expect(keyForOccurrence(first)).not.toBe(keyForOccurrence(second));
    });

    it('keeps distinct external items separate when their titles and dates match', () => {
        const start = moment.tz('2026-06-28 10:00', timeZone);
        const end = start.clone().add(1, 'hour');
        const externalIdentity = {
            id: 0,
            isExternal: true,
            externalConfigId: 'config-a',
            externalSourceSiteUrl: 'https://example.sharepoint.com/sites/calendar',
            externalSourceListId: 'list-a'
        };
        const first = {
            event: {
                ...externalIdentity,
                key: 'first-object-key',
                externalItemId: 1
            },
            start,
            end,
            isAllDay: false
        };
        const second = {
            event: {
                ...externalIdentity,
                key: 'second-object-key',
                externalItemId: 2
            },
            start: start.clone(),
            end: end.clone(),
            isAllDay: false
        };

        expect(keyForOccurrence(first)).not.toBe(keyForOccurrence(second));
        expect(
            Builder.build(
                [first, second],
                moment.tz('2026-06-28 12:00', timeZone)
            ).occurrences
        ).toEqual([first, second]);
    });

    it('distinguishes the same external item returned by different configurations', () => {
        const start = moment.tz('2026-06-28 10:00', timeZone);
        const end = start.clone().add(1, 'hour');
        const externalIdentity = {
            id: 0,
            isExternal: true,
            externalSourceSiteUrl: 'https://example.sharepoint.com/sites/calendar',
            externalSourceListId: 'list-a',
            externalItemId: 1
        };
        const first = {
            event: {
                ...externalIdentity,
                key: 'first-object-key',
                externalConfigId: 'config-a'
            },
            start,
            end
        };
        const second = {
            event: {
                ...externalIdentity,
                key: 'second-object-key',
                externalConfigId: 'config-b'
            },
            start: start.clone(),
            end: end.clone()
        };

        expect(keyForOccurrence(first)).not.toBe(keyForOccurrence(second));
    });

    it('distinguishes separate occurrences of the same recurring event', () => {
        const event = { id: 42, key: 'event-42' };
        const first = {
            event,
            start: moment.tz('2026-06-28 10:00', timeZone),
            end: moment.tz('2026-06-28 11:00', timeZone)
        };
        const second = {
            event,
            start: moment.tz('2026-06-29 10:00', timeZone),
            end: moment.tz('2026-06-29 11:00', timeZone)
        };

        expect(keyForOccurrence(first)).not.toBe(keyForOccurrence(second));
    });
});

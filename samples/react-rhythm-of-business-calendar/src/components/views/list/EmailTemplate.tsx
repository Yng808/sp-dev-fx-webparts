import { EventOccurrence } from 'model';
import moment from 'moment';

interface EmailContent {
  to: string;
  subject: string;
  body: string;
}

function formatDateRange(dates: (EventOccurrence | moment.Moment)[]): string {
    if (!dates.length) return '';
    let moments: moment.Moment[];

    if (moment.isMoment(dates[0])) {
        moments = dates as moment.Moment[];
    } else {
        moments = (dates as EventOccurrence[]).flatMap(ev => [ev.start, ev.end]);
    }
    const startDate = moment.min(moments).format('DD MMM, YYYY');
    const endDate = moment.max(moments).format('DD MMM, YYYY');
    return startDate === endDate ? startDate : `${startDate} - ${endDate}`;
}

function buildSubject(dvPayGrade: string, dvSurname: string, dateRange: string, status: string): string {
    return `Base Parking Request for ${dvPayGrade} ${dvSurname} on ${dateRange}: ${status}`;
}

function formatLine(ev: EventOccurrence, stallName: string) {
    const date = ev.start.format('DD MMM, YYYY');
    const time = `${ev.start.format('HHmm')}-${ev.end.format('HHmm')}`;

    let label: string;
    if (ev.requestStatus === 'Cancelled') {
        label = 'Cancelled';
    } else if (ev.parkingStalls === -1) {
        label = 'Unavailable';
    } else {
        label = stallName || 'Unknown Stall';
    }

    return `${date} ${time} ${label}`;
}

function getChangedFields(original: EventOccurrence, updated: Record<string, string>) {
    const changes: { label: string; before: string; after: string }[] = [];

    const fieldLabels: Record<string, string> = {
        dvPayGrade: "DV Pay Grade",
        dvRank: "DV Rank",
        dvFirstName: "DV First Name",
        dvSurname: "DV Last Name",
        jdirVisiting: "DV Visiting JDIR/Office",
        dvVisiting: "Is DV Visiting Bridge",
        requestorRank: "Requestor Rank",
        requestorFirstName: "Requestor First Name",
        requestorLastName: "Requestor Last Name",
        requestorOffice: "Requestor Office",
        requestorDutyPhone: "Requestor Duty Phone",
        requestorCellPhone: "Requestor Cell Phone",
        requestorEmail: "Requestor Email"
    };

    for (const key in updated) {
        const before = (original as any)[key] ?? "";
        const after = updated[key as keyof typeof updated] ?? "";
        if (before !== after) {
        changes.push({ label: fieldLabels[key], before, after });
        }
    }

    return changes;
}

// Multi OR Single: Snapshot of the group's current state
export function snapshotGroupEmail(events: EventOccurrence[], parkingMap: { [id: number]: string } ): EmailContent {
    const sorted = [...events].sort((a, b) => a.start.diff(b.start));
    const first = sorted[0];

    const lines = sorted.map(ev => {
        const stallName =
        ev.parkingStalls === -1
            ? 'Unavailable'
            : parkingMap[ev.parkingStalls as number] ?? String(ev.parkingStalls ?? '');
        return formatLine(ev, stallName);
    });

    return {
        to: first.requestorEmail,
        subject: `Base Parking Request for ${first.dvPayGrade} ${first.dvSurname} on ${formatDateRange(sorted)}`,
        body: `Aloha ${first.requestorRank} ${first.requestorLastName},

        This email is to inform you of the status of your request:

        ${lines.join('\n')}

        Mahalo!

        USINDOPACOM Protocol
        Email: indopacom.hmsmith.pcj0.mbx.j01-protocol@us.navy.mil
        COMM: (808)-477-7747`
        };
}

// Multi OR Single: Parking Assignment
export function assignGroupEmail(events: EventOccurrence[], parkingMap: { [id: number]: string }): EmailContent {
    const sorted = [...events].sort((a, b) => a.start.diff(b.start));
    const lines = sorted.map(ev => {
        const date = ev.start.format('DD MMM, YYYY');
        const timeRange = `${ev.start.format('HHmm')}-${ev.end.format('HHmm')}`;
        const stallName = parkingMap[ev.parkingStalls ?? -1] || 'Unknown Stall';
        return `${date} ${timeRange} - ${stallName}`;
    });

    const first = sorted[0];
    return {
        to: first.requestorEmail,
        subject: buildSubject(first.dvPayGrade, first.dvSurname, formatDateRange(sorted), 'Parking Assigned'),
        body: `Aloha ${first.requestorRank} ${first.requestorLastName},

        Your base parking request has been approved for the following:

        ${lines.join('\n')}

        Mahalo!

        USINDOPACOM Protocol
        Email: indopacom.hmsmith.pcj0.mbx.j01-protocol@us.navy.mil
        COMM: (808)-477-7747`
    };
}

// Multi OR Single: No Parking Available
export function noParkingAvailableEmail(events: EventOccurrence[]): EmailContent {
    if (!events.length) return { to: '', subject: '', body: '' };
    const first = events[0];
    return {
        to: first.requestorEmail,
        subject: buildSubject(first.dvPayGrade, first.dvSurname, formatDateRange(events), 'No Parking Available'),
        body: `Aloha ${first.requestorRank} ${first.requestorLastName},
        
        Unfortunately, there is no parking available for the following date(s): ${formatDateRange(events)}

        Mahalo!
        
        USINDOPACOM Protocol
        Email: indopacom.hmsmith.pcj0.mbx.j01-protocol@us.navy.mil
        COMM: (808)-477-7747`
    };
}

export function fieldsChangedEmail(original: EventOccurrence, updated: Record<string, string>, groupEvents: EventOccurrence[]) {
    const changes = getChangedFields(original, updated);
    if (!changes.length) return null;

    const sorted = [...groupEvents].sort((a, b) => a.start.diff(b.start));
    const first = sorted[0];

    const changesText = changes.map(c => `${c.label}\nPreviously: ${c.before || "N/A"}\nNow: ${c.after || "N/A"}\n`).join("\n");

    return {
        to: first.requestorEmail,
        subject: `Base Parking Request for ${first.dvPayGrade} ${first.dvSurname} on ${formatDateRange(sorted)}: Updated`,
        body: `Aloha ${first.requestorRank} ${first.requestorLastName},

        This email is to inform you of the change(s) to your request:

        ${changesText}

        Mahalo!
        
        USINDOPACOM Protocol
        Email: indopacom.hmsmith.pcj0.mbx.j01-protocol@us.navy.mil
        COMM: (808)-477-7747`
    };
}
// Multi OR Single: Date(s) Changed
export function datesChangedEmail(previousEvents: EventOccurrence[], updatedEvents: EventOccurrence[], parkingMap: { [id: number]: string } = {}): EmailContent {
    const prevSorted = [...previousEvents].sort((a, b) => a.start.diff(b.start));
    const nextSorted = [...updatedEvents].sort((a, b) => a.start.diff(b.start));

    const first = (nextSorted[0] || prevSorted[0]);
 
    const prevCancelled = nextSorted.filter(ev => ev.requestStatus === 'Cancelled');
    const prevRange = prevCancelled.length ? formatDateRange(prevCancelled) : 'None';
 
    const activeEvents = nextSorted.filter(ev => ev.requestStatus !== 'Cancelled');
    const newRange = activeEvents.length ? formatDateRange(activeEvents) : 'None';

    const subjectEvents = activeEvents.length ? activeEvents : nextSorted;

    return {
        to: first.requestorEmail,
        subject: buildSubject(first.dvPayGrade, first.dvSurname, formatDateRange(subjectEvents), 'Date Changed'),
        body: `Aloha ${first.requestorRank} ${first.requestorLastName},

        This email is to inform you that your base parking request dates have been updated.

        Previous Date(s):
        ${prevRange}

        New Date(s):
        ${newRange}

        Mahalo!
        
        USINDOPACOM Protocol
        Email: indopacom.hmsmith.pcj0.mbx.j01-protocol@us.navy.mil
        COMM: (808)-477-7747`
    };
}

// Multi OR Single: Cancel
export function cancelGroupEmail(events: EventOccurrence[]): EmailContent {
    if (!events.length) throw new Error('No events provided.');

    // Sort by start date
    const sorted = [...events].sort((a, b) => a.start.diff(b.start));

    // Format each event's date and time
    const formattedDates = sorted.map(ev => {
        const date = ev.start.format('DD MMM, YYYY');
        const timeRange = `${ev.start.format('HHmm')}-${ev.end.format('HHmm')}`;
        return `${date} ${timeRange}`;
    });

    const first = sorted[0];
    return {
        to: first.requestorEmail,
        subject: buildSubject(first.dvPayGrade, first.dvSurname, formatDateRange(sorted), 'Cancelled'),
        body: `Aloha ${first.requestorRank} ${first.requestorLastName},

        This email is to inform you that the base parking request for the following dates has been cancelled:

        ${formattedDates.join('\n')}

        Mahalo!
        
        USINDOPACOM Protocol
        Email: indopacom.hmsmith.pcj0.mbx.j01-protocol@us.navy.mil
        COMM: (808)-477-7747`
    };
}

// Single: Time Changed
export function timeChangedEmail(event: EventOccurrence, newStart: moment.Moment, newEnd: moment.Moment, parkingName?: string): EmailContent {
    return {
        to: event.requestorEmail,
        subject: buildSubject(event.dvPayGrade, event.dvSurname, formatDateRange([newStart, newEnd]), 'Time Changed'),
        body: `Aloha ${event.requestorRank} ${event.requestorLastName},

        This email is to inform you that your base parking request scheduled for ${newStart.format('DD MMM, YYYY')} at ${newStart.format('HHmm')}-${newEnd.format('HHmm')} has been updated to the new time: ${newStart.format('HHmm')}-${newEnd.format('HHmm')}.

        Assigned Parking: ${parkingName || 'N/A'}

        Mahalo!
        
        USINDOPACOM Protocol
        Email: indopacom.hmsmith.pcj0.mbx.j01-protocol@us.navy.mil
        COMM: (808)-477-7747`
    };
}

// Single: Cancel
export function cancelEventEmail(event: EventOccurrence): EmailContent {
    return {
        to: event.requestorEmail,
        subject: buildSubject(event.dvPayGrade, event.dvSurname, formatDateRange([event.start, event.end]), 'Cancelled'),
        body: `Aloha ${event.requestorRank} ${event.requestorLastName},

        This email is to inform you that the base parking request for ${event.start.format('DD MMM, YYYY')} ${event.start.format('HHmm')}-${event.end.format('HHmm')} has been cancelled.

        Mahalo!

        USINDOPACOM Protocol
        Email: indopacom.hmsmith.pcj0.mbx.j01-protocol@us.navy.mil
        COMM: (808)-477-7747`
    };
}
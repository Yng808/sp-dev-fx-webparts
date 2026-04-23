import { EventOccurrence } from 'model';
import moment from 'moment';

interface EmailContent {
    to: string;
    subject: string;
    body: string;
}

let EMAIL_SUBJECT_PREFIX = '';
export let EMAIL_PHONE = '';
let EMAIL_EMAIL = '';
let EMAIL_SIGNATURE = '';

export const applyEmailSettings = (settings: Record<string, string>) => {
    EMAIL_SUBJECT_PREFIX = settings.SUBJECT_PREFIX || EMAIL_SUBJECT_PREFIX;
    EMAIL_PHONE = settings.PHONE || EMAIL_PHONE;
    EMAIL_EMAIL = settings.EMAIL || EMAIL_EMAIL;
    EMAIL_SIGNATURE = settings.SIGNATURE || EMAIL_SIGNATURE;
};

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

function buildSubject(dvRank: string, dvSurname: string, dateRange: string, status: string): string {
    return `${EMAIL_SUBJECT_PREFIX} ${dvRank} ${dvSurname} on ${dateRange}: ${status}`;
}

function formatLine(ev: EventOccurrence, stallName: string) {
    const date = ev.start.format('DD MMM');
    const time = `${ev.start.format('HHmm')}-${ev.end.format('HHmm')}`;

    let label: string;
    if (ev.requestStatus === 'Cancelled') {
        label = 'Cancelled';
    } else if (ev.parkingStalls === -1) {
        label = 'Unavailable';
    } else {
        label = stallName || 'Unknown Stall';
    }

    return `~ ${date} - ${time} - ${label}`;
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
        if (Object.prototype.hasOwnProperty.call(updated, key)) {
            const before = (original as any)[key] ?? "";
            const after = updated[key as keyof typeof updated] ?? "";

            if (before !== after) {
                changes.push({ label: fieldLabels[key], before, after });
            }
        }
    }

    return changes;
}

// Multi OR Single: Snapshot of the group's current state
export function snapshotGroupEmail(events: EventOccurrence[], parkingMap: { [id: number]: string } ): EmailContent {
    const sorted = [...events].sort((a, b) => a.start.diff(b.start));
    const first = sorted[0];

    const lines = sorted.map(ev => {
        const stallName = ev.parkingStalls === -1 ? 'Unavailable': ev.parkingStallName || 'Unknown Stall';
        return formatLine(ev, stallName);
    });

    return {
        to: first.requestorEmail,
        subject: `${EMAIL_SUBJECT_PREFIX} ${first.dvRank} ${first.dvSurname} on ${formatDateRange(sorted)}`,
        body: `Aloha ${first.requestorRank} ${first.requestorLastName},

        This email is to inform you of the status of your request:

        ${lines.join('\n')}
        ${EMAIL_SIGNATURE}`
    };
}

// Multi OR Single: Parking Assignment
export function assignGroupEmail(events: EventOccurrence[], parkingMap: { [id: number]: string }, timeChangeNotice?: string, dateChangeNotice?: string): EmailContent {
    const sorted = [...events].sort((a, b) => a.start.diff(b.start));
    const lines = sorted.map(ev => {
        const date = ev.start.format('DD MMM');
        const timeRange = `${ev.start.format('HHmm')}-${ev.end.format('HHmm')}`;
        const stallName = parkingMap[ev.parkingStalls ?? -1] || 'Unknown Stall';
        return `~ ${date} - ${timeRange} - ${stallName}`;
    });

    const first = sorted[0];
    return {
        to: first.requestorEmail,
        subject: buildSubject(first.dvRank, first.dvSurname, formatDateRange(sorted), 'Parking Assigned'),
        body: `Aloha ${first.requestorRank} ${first.requestorLastName},

        ${dateChangeNotice ? `${dateChangeNotice}\n\n` : ''}${timeChangeNotice ? `${timeChangeNotice}\n\n` : ''}The following DV Parking has been assigned to ${first.dvRank} ${first.dvSurname}:

        ${lines.join('\n')}
 
        Map(s) attached for your use & dissemination.
        
        PLEASE ensure your DV DOES NOT park in another stall if there is another vehicle in stall and call us at ${EMAIL_PHONE}.
        
        Please submit any changes or cancellations to ${EMAIL_EMAIL}.
        ${EMAIL_SIGNATURE}`
    };
}

// Multi OR Single: No Parking Available
export function noParkingAvailableEmail(events: EventOccurrence[]): EmailContent {
    if (!events.length) return { to: '', subject: '', body: '' };
    const first = events[0];
    return {
        to: first.requestorEmail,
        subject: buildSubject(first.dvRank, first.dvSurname, formatDateRange(events), 'No Parking Available'),
        body: `Aloha ${first.requestorRank} ${first.requestorLastName},
        
        Unfortunately, there is no parking available for the following date(s): ${formatDateRange(events)}
        ${EMAIL_SIGNATURE}`
    };
}

export function fieldsChangedEmail(original: EventOccurrence, updated: Record<string, string>, groupEvents: EventOccurrence[]) {
    const changes = getChangedFields(original, updated);
    if (!changes.length) return null;

    const sorted = [...groupEvents].sort((a, b) => a.start.diff(b.start));
    const first = sorted[0];

    const changesText = changes.map(c => `${c.label}\nPreviously: ${c.before || "N/A"}\nNow: ${c.after || "N/A"}\n`).join("\n").trim();

    const rank = updated.dvRank?.trim() || first.dvRank;
    const surname = updated.dvSurname?.trim() || first.dvSurname;
    const requestorRank = updated.requestorRank?.trim() || first.requestorRank;
    const requestorLastName = updated.requestorLastName?.trim() || first.requestorLastName;

    return {
        to: first.requestorEmail,
        subject: `${EMAIL_SUBJECT_PREFIX} ${rank} ${surname} on ${formatDateRange(sorted)}: Updated`,
        body: `Aloha ${requestorRank} ${requestorLastName},

        This email is to inform you of the change(s) to your request:

        ${changesText}
        ${EMAIL_SIGNATURE}`
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
        subject: buildSubject(first.dvRank, first.dvSurname, formatDateRange(subjectEvents), 'Date Changed'),
        body: `Aloha ${first.requestorRank} ${first.requestorLastName},

        This email is to inform you that your base parking request dates have been updated.

        Previous Date(s):
        ${prevRange}

        New Date(s):
        ${newRange}
        ${EMAIL_SIGNATURE}`
    };
}

export function buildDateChangeNotice(prevRange: string, newRange: string): string {
    return `This email is to inform you that your base parking request dates have been updated.

    Previous Date(s):
    ${prevRange}

    New Date(s):
    ${newRange}`;
}

// Multi OR Single: Cancel
export function cancelGroupEmail(events: EventOccurrence[]): EmailContent {
    if (!events.length) throw new Error('No events provided.');

    // Sort by start date
    const sorted = [...events].sort((a, b) => a.start.diff(b.start));

    // Format each event's date and time
    const formattedDates = sorted.map(ev => {
        const date = ev.start.format('DD MMM');
        const timeRange = `${ev.start.format('HHmm')}-${ev.end.format('HHmm')}`;
        return `~ ${date} - ${timeRange}`;
    });

    const first = sorted[0];
    return {
        to: first.requestorEmail,
        subject: buildSubject(first.dvRank, first.dvSurname, formatDateRange(sorted), 'Cancelled'),
        body: `Aloha ${first.requestorRank} ${first.requestorLastName},

        This email is to inform you that the base parking request for the following dates has been cancelled:

        ${formattedDates.join('\n')}
        ${EMAIL_SIGNATURE}`
    };
}

// Single: Time Changed
export function timeChangedEmail(event: EventOccurrence, newStart: moment.Moment, newEnd: moment.Moment, parkingName?: string): EmailContent {
    return {
        to: event.requestorEmail,
        subject: buildSubject(event.dvRank, event.dvSurname, formatDateRange([newStart, newEnd]), 'Time Changed'),
        body: `Aloha ${event.requestorRank} ${event.requestorLastName},

        This email is to inform you that your base parking request scheduled for ${newStart.format('DD MMM, YYYY')} at ${newStart.format('HHmm')}-${newEnd.format('HHmm')} has been updated to the new time: ${newStart.format('HHmm')}-${newEnd.format('HHmm')}.

        Assigned Parking: ${parkingName || 'N/A'}
        ${EMAIL_SIGNATURE}`
    };
}

export function buildTimeChangeNotice(ev: EventOccurrence, newStart: moment.Moment, newEnd: moment.Moment): string {
    return `This email is to inform you that your base parking request scheduled for ${ev.start.format('DD MMM, YYYY')} at ${ev.start.format('HHmm')}-${ev.end.format('HHmm')} has been updated to the new time: ${newStart.format('HHmm')}-${newEnd.format('HHmm')}.`;
}

// Single: Cancel
export function cancelEventEmail(event: EventOccurrence): EmailContent {
    return {
        to: event.requestorEmail,
        subject: buildSubject(event.dvRank, event.dvSurname, formatDateRange([event.start, event.end]), 'Cancelled'),
        body: `Aloha ${event.requestorRank} ${event.requestorLastName},

        This email is to inform you that the base parking request for ${event.start.format('DD MMM, YYYY')} - ${event.start.format('HHmm')}-${event.end.format('HHmm')} has been cancelled.
        ${EMAIL_SIGNATURE}`
    };
}
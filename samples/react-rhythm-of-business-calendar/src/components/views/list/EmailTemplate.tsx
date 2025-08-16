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

// Multi OR Single: Date(s) Changed
export function datesChangedEmail(event: EventOccurrence, newStart: moment.Moment, newEnd: moment.Moment): EmailContent {
    return {
        to: event.requestorEmail,
        subject: buildSubject(event.dvPayGrade, event.dvSurname, formatDateRange([newStart, newEnd]), 'Date Changed'),
        body: `Aloha ${event.requestorRank} ${event.requestorLastName},

        This email is to inform you that your base parking request dates have been updated.

        New Dates: ${newStart.format('DD MMM, YYYY')} - ${newEnd.format('DD MMM, YYYY')}

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
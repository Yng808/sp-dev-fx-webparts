import { EventOccurrence } from 'model';
import moment from 'moment';

interface EmailContent {
  to: string;
  subject: string;
  body: string;
}

// Multi: Parking Assignment
export function assignGroupEmail(events: EventOccurrence[], parkingMap: { [id: number]: string }): EmailContent {
    const sorted = [...events].sort((a, b) => a.start.diff(b.start));
    const lines = sorted.map(ev => {
        const date = ev.start.format('DD MMM, YYYY');
        const timeRange = `${ev.start.format('HHmm')}-${ev.end.format('HHmm')}`;
        const stallName = parkingMap[ev.parkingStalls ?? -1] || 'Unknown Stall';
        return `${date} ${timeRange} - ${stallName}`;
    });

    const first = sorted[0];
    const fullName = `${first.requestorRank} ${first.requestorLastName}`;
    return {
        to: first.requestorEmail,
        subject: `Base Parking Request: Parking Assigned`,
        body: `Aloha ${fullName},

        Your base parking request has been approved for the following:

        ${lines.join('\n')}

        Mahalo!

        USINDOPACOM Protocol
        Email: indopacom.hmsmith.pcj0.mbx.j01-protocol@us.navy.mil
        COMM: (808)-477-7747`
    };
}

// Single: Parking Assignment
export function assignParkingEmail(event: EventOccurrence, parkingName?: string): EmailContent {
    const formattedDate = event.start.format('DD MMM, YYYY');
    const formattedTimeRange = `${event.start.format('HHmm')}-${event.end.format('HHmm')}`;

    return {
        to: event.requestorEmail,
        subject: `Base Parking Request: Parking Assigned`,
        body: `Aloha ${event.requestorRank} ${event.requestorLastName},

        Your base parking request for ${formattedDate} from ${formattedTimeRange} has been approved.

        Assigned Parking Stall: ${parkingName || 'N/A'}

        Mahalo!
        
        USINDOPACOM Protocol
        Email: indopacom.hmsmith.pcj0.mbx.j01-protocol@us.navy.mil
        COMM: (808)-477-7747`
    };
}

// Multi or Single: No Parking Available
export function noParkingAvailableEmail(events: EventOccurrence[]) {
    if (!events || events.length === 0) {
        return { to: '', subject: '', body: '' };
    }

    const fullName = `${events[0].requestorRank} ${events[0].requestorLastName}`;

    const startDate = moment.min(events.map(ev => moment(ev.start))).format('DD MMM, YYYY');
    const endDate = moment.max(events.map(ev => moment(ev.end))).format('DD MMM, YYYY');

    return {
        to: events[0].requestorEmail,
        subject: `Base Parking Request: No Parking Available`,
        body: `Aloha ${fullName},
        
        Unfortunately, there is no parking available for the following date(s): ${startDate} - ${endDate}

        Mahalo!
        
        USINDOPACOM Protocol
        Email: indopacom.hmsmith.pcj0.mbx.j01-protocol@us.navy.mil
        COMM: (808)-477-7747`
    };
}

// Multi: Date(s) Changed
export function datesChangedEmail(event: EventOccurrence, newStart: moment.Moment, newEnd: moment.Moment): EmailContent {
    return {
        to: event.requestorEmail,
        subject: `Base Parking Request: Date Changed`,
        body: `Aloha ${event.requestorRank} ${event.requestorLastName},

        This email is to inform you that your base parking request dates have been updated.

        New Dates: ${newStart.format('DD MMM, YYYY')} - ${newEnd.format('DD MMM, YYYY')}

        Mahalo!
        
        USINDOPACOM Protocol
        Email: indopacom.hmsmith.pcj0.mbx.j01-protocol@us.navy.mil
        COMM: (808)-477-7747`
    };
}

// Multi: Cancel
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
    const to = first.requestorEmail;
    const fullName = `${first.requestorRank} ${first.requestorLastName}`;

    return {
        to,
        subject: `Base Parking Request: Cancelled`,
        body: `Aloha ${fullName},

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
    const formattedDate = newStart.format('DD MMM, YYYY');
    const formattedTimeRange = `${newStart.format('HHmm')}-${newEnd.format('HHmm')}`;

    return {
        to: event.requestorEmail,
        subject: `Base Parking Request: Time Changed`,
        body: `Aloha ${event.requestorRank} ${event.requestorLastName},

        This email is to inform you that your base parking request scheduled for ${formattedDate} has been updated to the new time: ${formattedTimeRange}.

        Assigned Parking: ${parkingName}

        Mahalo!
        
        USINDOPACOM Protocol
        Email: indopacom.hmsmith.pcj0.mbx.j01-protocol@us.navy.mil
        COMM: (808)-477-7747`
    };
}

// Single: Cancel
export function cancelEventEmail(event: EventOccurrence): EmailContent {
    const formattedDate = event.start.format('DD MMM, YYYY');
    const formattedTimeRange = `${event.start.format('HHmm')}-${event.end.format('HHmm')}`;

    return {
        to: event.requestorEmail,
        subject: `Base Parking Request: Cancelled`,
        body: `Aloha ${event.requestorRank} ${event.requestorLastName},

        This email is to inform you that the base parking request for ${formattedDate} ${formattedTimeRange} has been cancelled.

        Mahalo!

        USINDOPACOM Protocol
        Email: indopacom.hmsmith.pcj0.mbx.j01-protocol@us.navy.mil
        COMM: (808)-477-7747`
    };
}
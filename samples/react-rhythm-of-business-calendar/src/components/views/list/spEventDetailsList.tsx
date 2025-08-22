import moment from "moment";
import { IDropdownOption } from '@fluentui/react';
import { EventOccurrence } from 'model';
import { Event } from 'model';

export interface ParkingSpot {
    id: number;
    parking: string;
}

export interface OccupiedStall {
    parkingId: number;
    rank: string;
    surname: string;
    start: string;
    end: string;
}

// #1 Parking data -----------------------------------------------------------------------------------------------------

// Gets all parking stalls from SharePoint
export const fetchParkingStalls = async (siteUrl: string): Promise<ParkingSpot[]> => {
    const parkingResponse = await fetch(
        `${siteUrl}/_api/web/lists/getbytitle('DVParkingStalls')/items?$select=ID,ParkingAssignment,Available&$filter=Available eq 'Yes'`,
        {
            method: "GET",
            headers: {
                Accept: "application/json;odata=verbose",
            },
        }
    );

    if (!parkingResponse.ok) {
        throw new Error(`Failed to fetch spots: ${parkingResponse.statusText}`);
    }

    const allParkingData = await parkingResponse.json();
    return allParkingData.d.results.map((item: any) => ({
        id: item.ID,
        parking: item.ParkingAssignment,
    }));
};

// Gets already booked stalls for a date range
export const fetchBookedParkingForEvent = async (siteUrl: string, eventStart: moment.Moment, eventEnd: moment.Moment, ignoreEventIds: number[] = []): Promise<Set<number>> => {
    const bookedParkingResponse = await fetch(
        `${siteUrl}/_api/web/lists/getbytitle('Rob Calendar Events2')/items` +
        `?$select=ID,ParkingStallsId,EventDate,EndDate` +
        `&$filter=RequestStatus eq 'Approved' and ` +
        `(EndDate gt datetime'${eventStart.toISOString()}' and EventDate lt datetime'${eventEnd.toISOString()}')`,
        {
            method: "GET",
            headers: {
                Accept: "application/json;odata=verbose",
            },
        }
    );

    if (!bookedParkingResponse.ok) {
        throw new Error(`Failed to fetch booked parking for event: ${bookedParkingResponse.statusText}`);
    }

    const bookedData = await bookedParkingResponse.json();
    return new Set<number>(
        bookedData.d.results.filter((item: any) => !ignoreEventIds.includes(item.ID)).map((item: any) => item.ParkingStallsId).filter((id: number | null) => id != null) as number[]
    );
};

// Removes booked stalls from the full list
export const filterAvailableParking = (allParking: ParkingSpot[], bookedParkingIds: Set<number>): ParkingSpot[] => {
    return allParking.filter((parkingSpot: ParkingSpot) => !bookedParkingIds.has(parkingSpot.id));
};

// Converts available stalls to IDropdownOption[] for UI dropdowns
export const formatParkingOptions = (availableParking: ParkingSpot[]): IDropdownOption[] => {
    return availableParking.map((parkingSpot: ParkingSpot) => ({
        key: parkingSpot.id,  // Set the id as the key
        text: parkingSpot.parking // Set the parking name as the text
    }));
};

// Returns details (payGrade, surname) for occupied stalls in a date range
export const fetchOccupiedParkingDetails = async (
    siteUrl: string,
    eventStart: moment.Moment,
    eventEnd: moment.Moment
): Promise<OccupiedStall[]> => {
    const response = await fetch(
        `${siteUrl}/_api/web/lists/getbytitle('Rob Calendar Events2')/items` +
        `?$select=ParkingStallsId,DVRank,DVSurname,EventDate,EndDate` +
        `&$filter=RequestStatus eq 'Approved' and ` +
        `(EndDate gt datetime'${eventStart.toISOString()}' and EventDate lt datetime'${eventEnd.toISOString()}')`,
        {
            method: "GET",
            headers: {
                Accept: "application/json;odata=verbose",
            },
        }
    );

    if (!response.ok) {
        throw new Error(`Failed to fetch occupied parking details: ${response.statusText}`);
    }

    const data = await response.json();

    return data.d.results.map((item: any) => ({
        parkingId: item.ParkingStallsId,
        rank: item.DVRank,
        surname: item.DVSurname,
        start: item.EventDate,
        end: item.EndDate
    }));
};

// #2 Event data ------------------------------------------------------------------------------------------------------

// Converts SharePoint item to EventOccurrence model
export const mapSharePointItemToEventOccurrence = (item: any): EventOccurrence => {
    const event = new Event(undefined, undefined, undefined, undefined, item.ID);

    const mapping: Record<string, keyof Event> = {
        ParkingStallsId: "parkingStalls", RequestStatus: "requestStatus", DVPayGrade: "dvPayGrade", DVRank: "dvRank", DVFirstName: "dvFirstName", DVSurname: "dvSurname", JDIRVisiting: "jdirVisiting", DVVisiting: "dvVisiting", RequestorRank: "requestorRank", RequestorFirstName: "requestorFirstName", RequestorLastName: "requestorLastName", RequestorOffice: "requestorOffice", RequestorDutyPhone: "requestorDutyPhone", RequestorCellPhone: "requestorCellPhone", RequestorEmail: "requestorEmail", GroupID: "groupID", Editor: "editor"
    };

    for (const [spKey, eventProp] of Object.entries(mapping)) {
        (event as any)[eventProp] = item[spKey] ?? '';
    }

    const start = moment(item.EventDate);
    const end = moment(item.EndDate);

    return new EventOccurrence(event, start, end);
};

// Fetches a single event by ID
export const fetchEventOccurrenceById = async (siteUrl: string, eventId: number): Promise<EventOccurrence> => {
    const res = await fetch(
        `${siteUrl}/_api/web/lists/getbytitle('Rob Calendar Events2')/items(${eventId})`,
        {
            method: "GET",
            headers: { Accept: "application/json;odata=verbose" }
        }
    );

    if (!res.ok) throw new Error(`Failed to fetch event: ${res.statusText}`);

    const json = await res.json();
    return mapSharePointItemToEventOccurrence(json.d);
};

// #3 Emails ----------------------------------------------------------------------------------------------------------

// Opens a prefilled Outlook Web compose window
export function composeEmailInBrowser(to: string, subject: string, body: string) {
  const url = `https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(
    to
  )}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.open(url, '_blank');
};

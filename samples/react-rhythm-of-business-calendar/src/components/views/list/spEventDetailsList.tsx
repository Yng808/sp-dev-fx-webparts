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
    payGrade: string;
    surname: string;
}

// #1 loadAvailableParkingForAllEvents ------------------------------------------------------------------------------------

// Fetch all parking stalls
export const fetchParkingStalls = async (siteUrl: string): Promise<ParkingSpot[]> => {
    const parkingResponse = await fetch(
        `${siteUrl}/_api/web/lists/getbytitle('DVParkingStalls')/items?$select=ID,ParkingAssignment`,
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

// Fetch bookings for a specific group
export const fetchBookingsForGroup = async (siteUrl: string, groupID: number) => {
    const bookingsResponse = await fetch(
        `${siteUrl}/_api/web/lists/getbytitle('Rob Calendar Events2')/items` +
        `?$select=ParkingStallsId,EventDate,EndDate,RequestStatus,GroupID` +
        `&$filter=GroupID eq ${groupID}`,
        {
            method: "GET",
            headers: {
                Accept: "application/json;odata=verbose",
            },
        }
    );

    if (!bookingsResponse.ok) {
        throw new Error(`Failed to fetch bookings: ${bookingsResponse.statusText}`);
    }

    return bookingsResponse.json();
};

// Fetch booked parking for a given event date range
export const fetchBookedParkingForEvent = async (siteUrl: string, eventStart: moment.Moment, eventEnd: moment.Moment, ignoreEventId?: number) => {
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
        bookedData.d.results.filter((item: any) => item.ID !== ignoreEventId).map((item: any) => item.ParkingStallsId).filter((id: number | null) => id != null) as number[]
    );
};

// Filter available parking by excluding booked spots
export const filterAvailableParking = (allParking: ParkingSpot[], bookedParkingIds: Set<number>): ParkingSpot[] => {
    return allParking.filter((parkingSpot: ParkingSpot) => !bookedParkingIds.has(parkingSpot.id));
};

// Format the available parking into IDropdownOption format
export const formatParkingOptions = (availableParking: ParkingSpot[]): IDropdownOption[] => {
    return availableParking.map((parkingSpot: ParkingSpot) => ({
        key: parkingSpot.id,  // Set the id as the key
        text: parkingSpot.parking // Set the parking name as the text
    }));
};

// #2 getEventIdsByGroupId ------------------------------------------------------------------------------------------------

// Fetch all events that match the specified GroupID
export const fetchFromSharePoint = async (siteUrl: string, listName: string, query: string): Promise<any> => {
    try {
        const response = await fetch(
            `${siteUrl}/_api/web/lists/getbytitle('${listName}')/items?${query}`,
            {
                method: 'GET',
                headers: {
                    Accept: 'application/json;odata=verbose',
                },
            }
        );

        if (!response.ok) {
            throw new Error(`Failed to fetch data from ${listName}: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Error fetching data from SharePoint:', error);
        throw error;  // Rethrow so calling functions can handle the error as needed
    }
};

// #3 get Occupied Parking Details ----------------------------------------------------------------------------------------

// Fetch PayGrade and LastName of occupied
export const fetchOccupiedParkingDetails = async (
    siteUrl: string,
    eventStart: moment.Moment,
    eventEnd: moment.Moment
): Promise<OccupiedStall[]> => {
    const response = await fetch(
        `${siteUrl}/_api/web/lists/getbytitle('Rob Calendar Events2')/items` +
        `?$select=ParkingStallsId,DVPayGrade,DVSurname,EventDate,EndDate` +
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
        payGrade: item.DVPayGrade,
        surname: item.DVSurname
    }));
};

// #4 Edit Button ---------------------------------------------------------------------------------------------------------

export const mapSharePointItemToEventOccurrence = (item: any): EventOccurrence => {
    const event = new Event(undefined, undefined, undefined, undefined, item.ID);

    const mapping: Record<string, keyof Event> = {
        ParkingStallsId: "parkingStalls", RequestStatus: "requestStatus", DVPayGrade: "dvPayGrade", DVRank: "dvRank", DVFirstName: "dvFirstName", DVSurname: "dvSurname", JDIRVisiting: "jdirVisiting", DVVisiting: "dvVisiting", RequestorRank: "requestorRank", RequestorFirstName: "requestorFirstName", RequestorLastName: "requestorLastName", RequestorOffice: "requestorOffice", RequestorDutyPhone: "requestorDutyPhone", RequestorCellPhone: "requestorCellPhone", RequestorEmail: "requestorEmail", GroupID: "groupID"
    };

    for (const [spKey, eventProp] of Object.entries(mapping)) {
        (event as any)[eventProp] = item[spKey] ?? '';
    }

    const start = moment(item.EventDate);
    const end = moment(item.EndDate);

    return new EventOccurrence(event, start, end);
};

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


// #5 Emails --------------------------------------------------------------------------------------------------------------

export function composeEmailInBrowser(to: string, subject: string, body: string) {
  const url = `https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(
    to
  )}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.open(url, '_blank');
}

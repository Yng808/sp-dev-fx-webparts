import React, { FC, useState, useEffect } from 'react';
import { Event, EventOccurrence, IEvent } from 'model';
import { useTimeZoneService } from 'services';
import moment from 'moment';
//import * as XLSX from 'xlsx';
//import { saveAs } from 'file-saver';
import 'bootstrap/dist/css/bootstrap.min.css';
//import { FilterConfigContext } from 'components/shared/FilterConfigContext';
import styles from './EventDetailsList.module.scss';
import { sp } from '@pnp/sp';
import { IDropdownOption } from '@fluentui/react';
import { fetchParkingStalls, fetchBookingsForGroup, fetchBookedParkingForEvent, filterAvailableParking, formatParkingOptions, fetchFromSharePoint } from './spEventDetailsList';

interface EventDetailsListProps {
  cccurrences: readonly EventOccurrence[];
}

interface ParkingSpot {
  id: number;
  parking: string;
}

const EventDetailsList: FC<EventDetailsListProps> = ({ cccurrences }) => {
    const [filteredEvents, setFilteredEvents] = useState<EventOccurrence[]>([...cccurrences]);
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [requestStatusFilter, setRequestStatusFilter] = useState<string>('New');
    const [isPanelOpen, setIsPanelOpen] = useState<boolean>(false);
    const [groupIDToDisplay, setGroupIDToDisplay] = useState<number>(0);
    const [parkingStallsOptions, setParkingStallsOptions] = useState<IDropdownOption[]>([]);
    const [parkingStallsOptionsEach, setParkingStallsOptionsEach] = useState<{ [key: number]: IDropdownOption[] }>({});
    const [loadingSpots, setLoadingSpots] = useState<boolean>(false);
    const [parkingMap, setParkingMap] = useState<{ [id: number]: string }>({});
    const timeZoneService = useTimeZoneService();
    const siteTimeZone = timeZoneService.siteTimeZone;
    //const { showOPR, showAttendee, showReadAheadDueDate, showDecisionBrief, showLocation } = useContext(FilterConfigContext);
    const predefinedStatuses = ['New', 'Approved', 'Cancelled', 'Denied'];
    const [selectedParkingStall, setSelectedParkingStall] = useState<string>(''); 
    const [individualSelections, setIndividualSelections] = useState<{ [key: string]: number }>({});
    const [panelParkingLoading, setPanelParkingLoading] = useState(false);
    const [isEditPanelOpen, setIsEditPanelOpen] = useState(false);
    const [editGroupID, setEditGroupID] = useState<number | null>(null);
    const [editFields, setEditFields] = useState({ dvPayGrade: '', dvRank: '', dvFirstName: '', dvSurname: '', jdirVisiting: '', dvVisiting: '', requestorRank: '', requestorFirstName: '', requestorLastName: '', requestorOffice: '', requestorDutyPhone: '', requestorCellPhone: '', requestorEmail: ''});
    const [isReassignPanelOpen, setIsReassignPanelOpen] = useState(false);
    const [eventToReassign, setEventToReassign] = useState<EventOccurrence | null>(null);
    const [reassignStart, setReassignStart] = useState('');
    const [reassignEnd, setReassignEnd] = useState('');
    const [isChangeDatesPanelOpen, setIsChangeDatesPanelOpen] = useState(false);
    const [groupToChangeDates, setGroupToChangeDates] = useState<number | null>(null);
    const [changeStartDate, setChangeStartDate] = useState('');
    const [changeEndDate, setChangeEndDate] = useState('');


    useEffect(() => {
        let filtered = [...cccurrences]; // Create a mutable copy of the readonly array

        if (startDate || endDate) {
            // set the start date filter to the start of the day and set the timezone properly
            const start = startDate ? moment(startDate).startOf('day').tz(siteTimeZone.momentId, true) : null;
            // set the end date filter to the end of the day and set the timezone properly
            const end = endDate ? moment(endDate).endOf('day').tz(siteTimeZone.momentId, true) : null;

            filtered = filtered.filter(event => {
                const eventStart = moment(event.start);
                const eventEnd = moment(event.end);
        
                // Case 1: Both start and end are provided
                if (start && end) {
                    return (
                        eventStart.isBetween(start, end, null, '[]') ||   // Event starts within range
                        eventEnd.isBetween(start, end, null, '[]') ||     // Event ends within range
                        (eventStart.isBefore(start) && eventEnd.isAfter(end)) // Event overlaps the entire range
                    );
                }
        
                // Case 2: Only start date is provided (open-ended range from start)
                if (start) {
                    return eventEnd.isSameOrAfter(start); // Event ends on or after the start date
                }
        
                // Case 3: Only end date is provided (open-ended range up to end)
                if (end) {
                    return eventStart.isSameOrBefore(end); // Event starts on or before the end date
                }
        
                return true; // If no dates are provided, include the event
            });
        }

        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(event => {
                return ( 
                    `${event.dvRank} ${event.dvFirstName} ${event.dvSurname}`.toLowerCase().includes(query) ||
                    `${event.requestorRank} ${event.requestorFirstName} ${event.requestorLastName} ${event.requestorCellPhone}`.toLowerCase().includes(query) ||  
                    event.requestStatus.toLowerCase().includes(query) || 
                    event.start.format('MM/DD/YYYY').includes(query) || 
                    event.end.format('MM/DD/YYYY').includes(query)
                );
            });
        }

        if (requestStatusFilter) {
            filtered = filtered.filter(event => event.requestStatus === requestStatusFilter);
        }

        // Sort the filtered events by start date
        filtered.sort((a, b) => {
        const groupComparison = a.groupID - b.groupID; 
        if (groupComparison !== 0) return groupComparison;
        return moment(a.start).diff(moment(b.start)); // secondary sort
        });


        setFilteredEvents(filtered);
        //console.log('filtered events', filteredEvents);
    }, [startDate, endDate, searchQuery, cccurrences, requestStatusFilter]);

    useEffect(() => {
        if (groupIDToDisplay !== 0) {
            loadAvailableParkingForAllEvents(groupIDToDisplay); 
        }
    }, [groupIDToDisplay]);
    // exclude Island 1, 2, 3 AND Unavailable from being options when loading 
    useEffect(() => {
    if (parkingStallsOptions.length > 0 && !selectedParkingStall) {
        const excludedIds = [35, 46, 47, -1];
        const firstAvailable = parkingStallsOptions.find(
        opt => !excludedIds.includes(Number(opt.key))
        );
        if (firstAvailable) {
        setSelectedParkingStall(firstAvailable.key.toString());
        }
    }
    }, [parkingStallsOptions]);
    // exclude Island 1, 2, 3 AND Unavailable from being options when loading 
    useEffect(() => {
    const excludedIds = [35, 46, 47, -1];

    Object.entries(parkingStallsOptionsEach).forEach(([eventId, options]) => {
        const alreadySelected = individualSelections[Number(eventId)];
        if (!alreadySelected && options.length > 0) {
        const firstAvailable = options.find(opt => !excludedIds.includes(Number(opt.key)));
        if (firstAvailable) {
            setIndividualSelections(prev => ({
            ...prev,
            [Number(eventId)]: Number(firstAvailable.key),
            }));
        }
        }
    });
    }, [parkingStallsOptionsEach]);

    useEffect(() => {
        const fetchParkingNames = async () => {
            const web = await sp.web.get();
            const siteUrl = web.Url;
            const stalls = await fetchParkingStalls(siteUrl);
            const map: { [id: number]: string } = {};
            stalls.forEach(stall => {
                map[stall.id] = stall.parking;
            });
            setParkingMap(map);
        };
        fetchParkingNames();
    }, []);

    const resetFilters = () => { setStartDate(''); setEndDate(''); setSearchQuery(''); setRequestStatusFilter(''); };
    // Assignment panel
    const openPanel = async (groupID: number) => {
        setGroupIDToDisplay(groupID); 
        setIsPanelOpen(true);
        setParkingStallsOptions([]); 
        setParkingStallsOptionsEach([]);
        setPanelParkingLoading(true);

        await loadAvailableParkingForAllEvents(groupID);
        
        setPanelParkingLoading(false);
    };
    // Re-assignment panel
    const openReassignPanel = (event: EventOccurrence) => {
        setEventToReassign(event);
        setReassignStart(event.start.format('HH:mm'));
        setReassignEnd(event.end.format('HH:mm'));
        setIsReassignPanelOpen(true);
    };

    const closePanel = () => {
        setIsPanelOpen(false); 
        setParkingStallsOptions([]);
        setParkingStallsOptionsEach([]);
    }
    // Edit panel
    const openEditPanel = (groupID: number, event: EventOccurrence) => {
        console.log('openEditPanel called with:', { groupID, event });
        setEditGroupID(groupID);
        setEditFields({
            dvPayGrade: event.dvPayGrade ?? '', dvRank: event.dvRank ?? '', dvFirstName: event.dvFirstName ?? '', dvSurname: event.dvSurname ?? '', jdirVisiting: event.jdirVisiting ?? '', dvVisiting: event.dvVisiting ?? '', requestorRank: event.requestorRank ?? '', requestorFirstName: event.requestorFirstName ?? '', requestorLastName: event.requestorLastName ?? '', requestorOffice: event.requestorOffice ?? '', requestorDutyPhone: event.requestorDutyPhone ?? '', requestorCellPhone: event.requestorCellPhone ?? '', requestorEmail: event.requestorEmail ?? '' });
        setIsEditPanelOpen(true);
    };

    
    // const handleExportToExcel = () => {
    //     // Prepare data for Excel
    //     const data = filteredEvents.map(event => ({
    //         Type: event.getRefinerValuesForRefinerId(1).map(rv => rv.title).join(', '),
    //         Title: event.title,
    //         DecisionBrief: event.getRefinerValuesForRefinerName('Decision Brief').map(rv => rv.title).join(', '),
    //         ReadAheadDueDate: event.readAheadDueDate ? event.readAheadDueDate.format('MM/DD/YYYY') : '-',
    //         EventDate: moment(event.start).format('MM/DD/YYYY HH:mm') + ' - ' + moment(event.end).format('MM/DD/YYYY HH:mm'),
    //         IPCOPR: event.getRefinerValuesForRefinerName('IPC OPR').map(rv => rv.title).join(', '),
    //         IPCAttendee: event.getRefinerValuesForRefinerName('IPC Attendee').map(rv => rv.title).join(', '),
    //         Description: event.description || '',
    //     }));

    //     // Create a new workbook
    //     const workbook = XLSX.utils.book_new();

    //     // Convert data to a worksheet
    //     const worksheet = XLSX.utils.json_to_sheet(data);

    //     // Append worksheet to workbook
    //     XLSX.utils.book_append_sheet(workbook, worksheet, 'Events');

    //     // Generate a binary string for the workbook
    //     const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });

    //     // Save the Excel file
    //     const blob = new Blob([excelBuffer], { type: 'application/octet-stream' });
    //     saveAs(blob, 'Events.xlsx');

    // };

    // Handle the apply to ALL events button
    const loadAvailableParkingForAllEvents = async (groupID: number) => {
        setLoadingSpots(true);
        try {
            const web = await sp.web.get();
            const siteUrl = web.Url;

            // STEP 1: Fetch all parking stalls
            const allParking = await fetchParkingStalls(siteUrl);
            // STEP 2: Fetch events for the group
            const bookingsData = await fetchBookingsForGroup(siteUrl, groupID);

            type GroupEvent = { start: moment.Moment; end: moment.Moment };

            const groupEvents: GroupEvent[] = bookingsData.d.results.map((ev: any) => ({
            start: moment(ev.EventDate),
            end: moment(ev.EndDate),
            }));

            // STEP 3: Determine full range across all events
            const groupStart = moment.min(groupEvents.map(ev => ev.start));
            const groupEnd = moment.max(groupEvents.map(ev => ev.end));

            // STEP 4: Fetch all booked parking across entire date range
            const bookedParkingIds = await fetchBookedParkingForEvent(siteUrl, groupStart, groupEnd);
            const allBookedParkingIds = new Set(bookedParkingIds);

            // STEP 5: Filter out booked parking stalls
            const availableParking = filterAvailableParking(allParking, allBookedParkingIds);

            // STEP 6: If no real parking, load per-event availability
            if (availableParking.length === 0) {
                const events = filteredEvents.filter(event => event.groupID === groupID);
                for (const event of events) {
                    await loadAvailableParking(event);
                }
            }

            // STEP 7: Always include "Unavailable" in the dropdown
            availableParking.push({
                id: -1,
                parking: "Unavailable",
            });

            const finalOptions = formatParkingOptions(availableParking);

            // STEP 8: Update state
            setParkingStallsOptions(finalOptions);

        } catch (error) {
            console.error("Error determining available parking:", error);
        } finally {
            setLoadingSpots(false);
        }
    };

    const getEventIdsByGroupId = async (groupID: number): Promise<number[]> => {
        try {
            const web = await sp.web.get();
            const siteUrl = web.Url;

            // Fetch the data for events by groupID
            const query = `$filter=GroupID eq ${groupID}&$select=ID`;
            const data = await fetchFromSharePoint(siteUrl, 'Rob Calendar Events2', query);

            // Directly map the results to extract event IDs
            return data.d.results.map((item: any) => item.ID); 
        } catch (error) {
            console.error('Error fetching event IDs by group ID:', error);
            return [];  // Return an empty array in case of error
        }
    };

    const handleAssignToAllEvents = async () => {
        setLoadingSpots(true);

        try {
            // Only filter the events based on the groupIDToDisplay to update the correct events
            const eventsToUpdate = filteredEvents.filter(event => event.groupID === Number(groupIDToDisplay));

            if (eventsToUpdate.length === 0) {
                alert(`No events found for Group ID ${groupIDToDisplay}.`);
                setLoadingSpots(false);
                return;
            }

            for (const event of eventsToUpdate) {
                const selectedStall = individualSelections[event.groupID] !== undefined 
                    ? Number(individualSelections[event.groupID])  
                    : Number(selectedParkingStall);  

                if (selectedStall !== undefined && selectedStall !== null && !isNaN(selectedStall)) {
                    await updateEventsInDatabase({
                        ...event,
                        parkingStalls: selectedStall, 
                        requestStatus: 'Approved',
                        groupID: event.groupID,
                    });
                } else {
                    alert(`Please select a parking stall for group ${event.groupID}`);
                    setLoadingSpots(false);
                    return;
                }
            }

            alert('Parking has been assigned to all events in the group.');
            setIsPanelOpen(false);
        } catch (error) {
            console.error('Error updating events:', error);
            alert('There was an error assigning parking to the events.');
        } finally {
            setLoadingSpots(false);
        }
    };

    const updateEventsInDatabase = async (event: Partial<IEvent>) => {
        try {
            // Get all event IDs with the given groupID
            const itemIds = await getEventIdsByGroupId(event.groupID);
    
            if (itemIds.length === 0) {
                alert('No items found with the given groupID or items may have been deleted.');
                return;
            }
    
            // Loop through all event IDs and update each one
            for (const itemId of itemIds) {
                // Check if the parking stall is valid and proceed with the update
                if (event.parkingStalls) {
                    await sp.web.lists.getByTitle('Rob Calendar Events2').items.getById(itemId).update({
                        ParkingStallsId: event.parkingStalls, 
                        RequestStatus: event.requestStatus, 
                    });
                } else {
                    alert('Please select a valid parking stall.');
                    break; // Stop the loop if parking stall is not valid
                }
            }
    
            // alert('All events updated successfully!');
        } catch (error) {
            console.error('Error updating events in database:', error);
            alert('There was an error updating the events.');
        }
    };

    // Handle the apply to SINGLE event button
    const loadAvailableParking = async (event: EventOccurrence) => {
        setLoadingSpots(true);

        try {
            const web = await sp.web.get();
            const siteUrl = web.Url;

            // STEP 1: Fetch all parking stalls using the function from spEventDetailsList
            const allParking = await fetchParkingStalls(siteUrl);

            // STEP 2: Fetch booked parking for this event using the function from spEventDetailsList
            const bookedParkingIds = await fetchBookedParkingForEvent(siteUrl, event.start, event.end);

            // STEP 3: Filter available parking using the function from spEventDetailsList
            const availableParking = filterAvailableParking(allParking, bookedParkingIds);

            // STEP 4: Format the available parking into IDropdownOption format using the function from spEventDetailsList
            const availableParkingOptions = formatParkingOptions(availableParking);

            // STEP 5: If no real parking, add "Unavailable"
            if (availableParkingOptions.length === 0) {
                availableParkingOptions.push({
                    key: -1,
                    text: "Unavailable",
                });
            }

            // STEP 6: Update state
            setParkingStallsOptionsEach((prevState) => ({
                ...prevState,
                [event.id]: availableParkingOptions,
            }));
        } catch (error) {
            console.error("Error determining available parking:", error);
        } finally {
            setLoadingSpots(false);
        }
    };

    const handleIndividualParkingChange = (eventId: number, selectedStall: string) => {
        setIndividualSelections(prevSelections => ({
            ...prevSelections,
            [eventId]: Number(selectedStall), // Use event.id as the key
        }));
    };

    const updateEventInDatabase = async (eventId: number, selectedStall: number) => {
        try {
            const event = filteredEvents.find(event => event.id === eventId);  // Find the event by id

            if (!event) {
                alert('No valid event found to update.');
                return;
            }

            const itemId = event.id;  // Access the event ID

            if (!itemId) {
                alert('No valid event ID found to update.');
                return;
            }

            // Now update the event using the itemId and the selected parking stall
            await sp.web.lists.getByTitle('Rob Calendar Events2').items.getById(itemId).update({
                ParkingStallsId: selectedStall,  // Update parking stall
                RequestStatus: 'Approved',  // Update request status
            });

            // alert(`Event ${itemId} updated successfully!`);
        } catch (error) {
            console.error('Error updating the event in database:', error);
            alert('There was an error updating the event.');
        }
    };

    // Re-assignment panel
    const handleReassignSave = async () => {
        if (!eventToReassign) return;

        try {
            // Extract date (YYYY-MM-DD) from original event datetimes
            const eventDate = eventToReassign.start.format('YYYY-MM-DD');
            const endDate = eventToReassign.end.format('YYYY-MM-DD');

            // Combine original date with new time
            const startDateTime = `${eventDate}T${reassignStart}`;
            const endDateTime = `${endDate}T${reassignEnd}`;

            const newStart = moment.tz(startDateTime, siteTimeZone.momentId);
            const newEnd = moment.tz(endDateTime, siteTimeZone.momentId);
            const parkingId = eventToReassign.parkingStalls;

            // 1. If event is "New"
            if (eventToReassign.requestStatus === "New" || !parkingId || parkingId === -1) {
                await sp.web.lists.getByTitle('Rob Calendar Events2').items.getById(eventToReassign.id).update({
                    EventDate: newStart.format('YYYY-MM-DDTHH:mm:ss'),
                    EndDate: newEnd.format('YYYY-MM-DDTHH:mm:ss'),
                    RequestStatus: 'New'
                });
                alert('Event time updated!');
                setIsReassignPanelOpen(false);
                setEventToReassign(null);
                return;
            }

            // 2. If event is "Approved" and has a stall, check if the stall is available at the new time
            const web = await sp.web.get();
            const siteUrl = web.Url;
            const bookedParkingSet = await fetchBookedParkingForEvent(siteUrl, newStart, newEnd);

            if (!bookedParkingSet.has(parkingId)) {
                // Stall is available for the new time; keep it and update time/status
                await sp.web.lists.getByTitle('Rob Calendar Events2').items.getById(eventToReassign.id).update({
                    EventDate: newStart.format('YYYY-MM-DDTHH:mm:ss'),
                    EndDate: newEnd.format('YYYY-MM-DDTHH:mm:ss'),
                    RequestStatus: 'Approved'
                });
                alert('Event time and parking updated!');
                setIsReassignPanelOpen(false);
                setEventToReassign(null);
                return;
            }

            // 3. If parking is NOT available, remove assignment, set status to New, and open the assign panel
            await sp.web.lists.getByTitle('Rob Calendar Events2').items.getById(eventToReassign.id).update({
                EventDate: newStart.format('YYYY-MM-DDTHH:mm:ss'),
                EndDate: newEnd.format('YYYY-MM-DDTHH:mm:ss'),
                ParkingStallsId: null,
                RequestStatus: 'New'
            });

            alert('Parking for this event is not available at the new time. Please select a new parking assignment.');
            setIsReassignPanelOpen(false);
            setEventToReassign(null);

            // Now open the assign panel for the relevant group
            setGroupIDToDisplay(eventToReassign.groupID); // Show assignment options for this group
            setIsPanelOpen(true); // Open the assign panel
        } catch (err) {
            alert('Failed to re-assign event.');
            console.error(err);
        }
    };

    // Left side of panel event parking 
    const getEventDateRange = (events: EventOccurrence[], groupID: number) => {
        // First filter the events by the provided groupID
        const filteredEventsByGroup = events.filter((event) => event.groupID === groupID);

        // If no events are found for the group, return an empty array
        if (filteredEventsByGroup.length === 0) {
            return [];
        }

        // Get the earliest start date and the latest end date from the filtered events
        const startDate = moment.min(filteredEventsByGroup.map((event) => moment(event.start)));
        const endDate = moment.max(filteredEventsByGroup.map((event) => moment(event.end)));

        let currentDate = startDate.clone();
        const dateRange = [];

        // Add each date from start to end date to the dateRange array
        while (currentDate.isBefore(endDate) || currentDate.isSame(endDate, 'day')) {
            dateRange.push(currentDate.clone());
            currentDate.add(1, 'days');
        }

        return dateRange; // Return the array of dates
    };

    // Cancel entire group
    const handleCancelGroup = async (groupId: number) => {
        const eventIds = filteredEvents.filter(ev => ev.groupID === groupId).map(ev => ev.id);
        try {
            for (const id of eventIds) {
                await sp.web.lists.getByTitle('Rob Calendar Events2').items.getById(id).update({
                    RequestStatus: 'Cancelled',
                });
            }
            alert(`All events in group ${groupId} cancelled successfully!`);
        } catch (error) {
            console.error('Error cancelling group events:', error);
            alert('There was an error cancelling the group events.');
        }
    };

    // Cancel by event
    const handleCancel = async (eventId: number) => {
        try {
            await sp.web.lists.getByTitle('Rob Calendar Events2').items.getById(eventId).update({
                RequestStatus: 'Cancelled',
            });
            alert(`Event ${eventId} cancelled successfully!`);
        } catch (error) {
            alert('Failed to update status to Cancelled.');
            console.error(error);
        }
    };

    // Edit entire group button
    const handleEditSave = async () => {
        if (!editGroupID) return;

        // Filter for all events in this group
        const eventsToUpdate = filteredEvents.filter(ev => ev.groupID === editGroupID);

        // These map to SharePoint internal field names
        const fieldMap: { [key: string]: string } = {
            dvPayGrade: 'DVPayGrade', dvRank: 'DVRank', dvFirstName: 'DVFirstName', dvSurname: 'DVSurname', jdirVisiting: 'JDIRVisiting', dvVisiting: 'DVVisiting', requestorRank: 'RequestorRank', requestorFirstName: 'RequestorFirstName', requestorLastName: 'RequestorLastName', requestorOffice: 'RequestorOffice', requestorDutyPhone: 'RequestorDutyPhone', requestorCellPhone: 'RequestorCellPhone', requestorEmail: 'RequestorEmail'
        };

        for (const event of eventsToUpdate) {
            const updates: any = {};
            // Only set fields that have been changed (not blank)
            Object.entries(editFields).forEach(([key, value]) => {
                if (value && value.trim() !== '' && fieldMap[key]) {
                    updates[fieldMap[key]] = value;
                }
            });

            // Only update if there's something to change
            if (Object.keys(updates).length > 0) {
                try {
                    await sp.web.lists.getByTitle('Rob Calendar Events2').items.getById(event.id).update(updates);
                } catch (err) {
                    console.error('Failed to update event', event.id, err);
                }
            }
        }
        alert('Updated!');
        setIsEditPanelOpen(false);
        setEditFields({ dvPayGrade: '', dvRank: '', dvFirstName: '', dvSurname: '', jdirVisiting: '', dvVisiting: '', requestorRank: '', requestorFirstName: '', requestorLastName: '', requestorOffice: '', requestorDutyPhone: '', requestorCellPhone: '', requestorEmail: ''});
        setEditGroupID(null);
    };

    // Change Dates button
    const handleChangeDatesSave = async () => {
        if (!groupToChangeDates || !changeStartDate || !changeEndDate) return;

        // 1. Find all events in this group, sorted by date
        let groupEvents = filteredEvents
            .filter(ev => ev.groupID === groupToChangeDates)
            .sort((a, b) => moment(a.start).diff(b.start));

        // 2. Build the new list of dates (sorted)
        let newDates: string[] = [];
        let curr = moment(changeStartDate);
        const end = moment(changeEndDate);
        while (curr.isSameOrBefore(end, "day")) {
            newDates.push(curr.format("YYYY-MM-DD"));
            curr.add(1, "day");
        }

        // 3. Determine the minimum count for re-use
        const minCount = Math.min(groupEvents.length, newDates.length);

        // 4. Update the overlapping events
        for (let i = 0; i < minCount; i++) {
            const origEvent = groupEvents[i];
            const newDate = newDates[i];

            const origStartTime = origEvent.start.format('HH:mm:ss');
            const origEndTime = origEvent.end.format('HH:mm:ss');
            const newStart = moment.tz(`${newDate}T${origStartTime}`, siteTimeZone.momentId);
            const newEnd = moment.tz(`${newDate}T${origEndTime}`, siteTimeZone.momentId);

            const parkingId = origEvent.parkingStalls;

            // If event is "New" or doesn't have parking, just update
            if (origEvent.requestStatus === "New" || !parkingId || parkingId === -1) {
                await sp.web.lists.getByTitle('Rob Calendar Events2').items.getById(origEvent.id).update({
                    EventDate: newStart.format('YYYY-MM-DDTHH:mm:ss'),
                    EndDate: newEnd.format('YYYY-MM-DDTHH:mm:ss'),
                    RequestStatus: 'New'
                });
                continue;
            }

            // If event has parking, check if it's still available
            const web = await sp.web.get();
            const siteUrl = web.Url;
            const bookedParkingSet = await fetchBookedParkingForEvent(siteUrl, newStart, newEnd);

            if (!bookedParkingSet.has(parkingId)) {
                await sp.web.lists.getByTitle('Rob Calendar Events2').items.getById(origEvent.id).update({
                    EventDate: newStart.format('YYYY-MM-DDTHH:mm:ss'),
                    EndDate: newEnd.format('YYYY-MM-DDTHH:mm:ss'),
                    RequestStatus: 'Approved'
                });
            } else {
                await sp.web.lists.getByTitle('Rob Calendar Events2').items.getById(origEvent.id).update({
                    EventDate: newStart.format('YYYY-MM-DDTHH:mm:ss'),
                    EndDate: newEnd.format('YYYY-MM-DDTHH:mm:ss'),
                    ParkingStallsId: null,
                    RequestStatus: 'New'
                });
                setIsChangeDatesPanelOpen(false);
                setGroupIDToDisplay(origEvent.groupID);
                setIsPanelOpen(true);
                alert(`Parking for one or more events is not available at the new date. Please reassign parking.`);
                return;
            }
        }

        // 5. Add new events if new range is longer than current events
        if (newDates.length > groupEvents.length) {
            const templateEvent = groupEvents[0];
            for (let i = groupEvents.length; i < newDates.length; i++) {
                const newDate = newDates[i];
                const origStartTime = templateEvent.start.format('HH:mm:ss');
                const origEndTime = templateEvent.end.format('HH:mm:ss');
                const newStart = moment.tz(`${newDate}T${origStartTime}`, siteTimeZone.momentId);
                const newEnd = moment.tz(`${newDate}T${origEndTime}`, siteTimeZone.momentId);

                await sp.web.lists.getByTitle('Rob Calendar Events2').items.add({
                    Title: templateEvent.title || 'Event',
                    GroupID: templateEvent.groupID,
                    DVPayGrade: templateEvent.dvPayGrade,
                    DVRank: templateEvent.dvRank,
                    DVFirstName: templateEvent.dvFirstName,
                    DVSurname: templateEvent.dvSurname,
                    JDIRVisiting: templateEvent.jdirVisiting,
                    DVVisiting: templateEvent.dvVisiting,
                    RequestorRank: templateEvent.requestorRank,
                    RequestorFirstName: templateEvent.requestorFirstName,
                    RequestorLastName: templateEvent.requestorLastName,
                    RequestorOffice: templateEvent.requestorOffice,
                    RequestorDutyPhone: templateEvent.requestorDutyPhone,
                    RequestorCellPhone: templateEvent.requestorCellPhone,
                    RequestorEmail: templateEvent.requestorEmail,
                    ParkingStallsId: null,
                    RequestStatus: 'New',
                    EventDate: newStart.format('YYYY-MM-DDTHH:mm:ss'),
                    EndDate: newEnd.format('YYYY-MM-DDTHH:mm:ss')
                });
            }
        }

        // 6. Cancel or delete extra events if new range is shorter
        if (groupEvents.length > newDates.length) {
            for (let i = newDates.length; i < groupEvents.length; i++) {
                const ev = groupEvents[i];
                await sp.web.lists.getByTitle('Rob Calendar Events2').items.getById(ev.id).update({
                    RequestStatus: 'Cancelled'
                });
            }
        }

        alert('Group events successfully updated!');
        setIsChangeDatesPanelOpen(false);
        setGroupToChangeDates(null);
    };



    const openChangeDatesPanel = (groupID: number) => {
        setGroupToChangeDates(groupID);
        const groupEvents = filteredEvents.filter(e => e.groupID === groupID);
        // sort by date!
        groupEvents.sort((a, b) => moment(a.start).diff(moment(b.start)));
        const start = groupEvents.length ? groupEvents[0].start.format('YYYY-MM-DD') : '';
        const end = groupEvents.length ? groupEvents[groupEvents.length - 1].end.format('YYYY-MM-DD') : '';
        setChangeStartDate(start);
        setChangeEndDate(end);
        setIsChangeDatesPanelOpen(true);
    }

    return (
        <div className="container">
            {/* Filters section */}
            <div className="row mb-3">
                 <div className="col">
                    <label htmlFor="requestStatus">Status</label>
                    <select
                        id="requestStatus"
                        className="form-control"
                        value={requestStatusFilter}
                        onChange={(e) => setRequestStatusFilter(e.target.value)}
                    >
                        <option value="">All</option>
                        {predefinedStatuses.map(status => (
                            <option key={status} value={status}>{status}</option>
                        ))}
                    </select>
                </div>
                <div className="col">
                    <label htmlFor="searchQuery">Search</label>
                    <input
                        type="text"
                        id="searchQuery"
                        className="form-control"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="col">
                    <label htmlFor="startDate">Start Date</label>
                    <input
                        type="date"
                        id="startDate"
                        className="form-control"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                    />
                </div>
                <div className="col">
                    <label htmlFor="endDate">End Date</label>
                    <input
                        type="date"
                        id="endDate"
                        className="form-control"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                    />
                </div>
                <div className="col">
                    <button onClick={resetFilters} className="btn mt-3" style={{ color: "rgb(0, 0, 0)", background: "rgb(197, 197, 183)", border: "1px solid #000" }}>Reset Filters</button>
                </div>
                {/* <div className="col">
                    <label></label>
                    <button
                        className="form-control"
                        style={{ backgroundColor: '#0d6efd', color: '#ffffff' }}
                        onClick={handleExportToExcel}
                    >
                        Export to Excel
                    </button>
                </div> */}
            </div>

            {/* table with sticky headers */}
            <div className="table-responsive" style={{ height: '600px', overflowY: 'auto' }}>
                <table className="table table-bordered table-striped">
                    <thead className="thead-dark sticky-top">
                        <tr>
                            {/* <th>Type</th>
                            <th style={{ width: '200px' }}>Title</th>
                            {showLocation && <th>Location</th>}
                            {showDecisionBrief && <th>Decision Brief</th>}
                            {showReadAheadDueDate && <th>Read Ahead Due Date</th>}
                            <th style={{ width: '280px' }}>Event Date</th>                                                         
                            {showOPR && <th>IPC OPR</th>}
                            {showAttendee && <th>IPC Attendee</th>}
                            <th>Description</th> */}
                            <th style={{ backgroundColor: 'lightblue', minWidth: '375px' }}>Group Actions</th>
                            <th style={{ backgroundColor: 'lightblue', minWidth: '190px' }}>Single Actions</th>
                            <th style={{ backgroundColor: 'lightblue' }}>ID</th>
                            <th style={{ backgroundColor: 'lightblue' }}>Status</th>
                            <th style={{ backgroundColor: 'lightblue' }}>DV Pay Grade</th>
                            <th style={{ backgroundColor: 'lightblue' }}>DV Info</th>
                            <th style={{ backgroundColor: 'lightblue' }}>Parking Assignment</th>
                            <th style={{ backgroundColor: 'lightblue', minWidth: '90px' }}>Request Date</th>
                            <th style={{ backgroundColor: 'lightblue' }}>JDIR</th>
                            <th style={{ backgroundColor: 'lightblue', minWidth: '150px' }}>Requestor Info</th>
                            <th style={{ backgroundColor: 'lightblue' }}>Bridge</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredEvents.map((event, index) => {
                            let eventDateFormatted;
                            
                            // all day and in one day. Example output: 1/1/2024 
                            if (event.isAllDay && event.start.format('MM/DD/YYYY') === event.end.format('MM/DD/YYYY')) {
                                eventDateFormatted = event.start.format('DD MMM, YYYY');
                            // all day and more than one day. Example output: 1/1/2024 - 1/3/2024
                            } else if(event.isAllDay && event.start.format('MM/DD/YYYY') !== event.end.format('MM/DD/YYYY')) { 
                                eventDateFormatted = event.start.format('DD MMM, YYYY') + " - " + event.end.format('DD MMM, YYYY');
                            // not all day and in one day. Example output: 1/1/2024 0600-0800
                            } else if (!event.isAllDay && event.start.format('MM/DD/YYYY') === event.end.format('MM/DD/YYYY')) {
                                eventDateFormatted = event.start.format('DD MMM, YYYY HHmm') + "-" + event.end.format('HHmm');
                            // not all day and more than one day. Example output: 1/1/2024 0600 - 1/3/2024 1400
                            } else if (!event.isAllDay && event.start.format('MM/DD/YYYY') !== event.end.format('MM/DD/YYYY')) {
                                eventDateFormatted = event.start.format('DD MMM, YYYY HHmm') + " - " + event.end.format('DD MMM, YYYY HHmm');    
                            } else {
                                eventDateFormatted = event.start.format('DD MMM, YYYY HHmm') + " - " + event.end.format('DD MMM, YYYY HHmm');
                            }                         

                            return (
                                <tr key={index}>
                                    {/* <td>
                                        {event.getRefinerValuesForRefinerId(1).map((rv, index) => (
                                            <span
                                                key={index}
                                                style={{
                                                    backgroundColor: rv.color.toHexString(),
                                                    color: rv.color.isDarkColor() ? '#ffffff' : '#000000',
                                                    padding: '2px 4px',
                                                    borderRadius: '3px',
                                                    marginRight: '4px',
                                                    display: 'inline-block'
                                                }}
                                            >
                                                {rv.title}
                                            </span>
                                        ))}
                                    </td>
                                    <td style={{ width: '280px' }}>{event.title}</td>
                                    {showLocation && <td>
                                        {event.getRefinerValuesForRefinerName('Location').map(rv => (
                                            <div key={rv.title}>{rv.title}</div>
                                        ))}
                                    </td>}
                                    {showDecisionBrief && <td>
                                        {event.getRefinerValuesForRefinerName('Decision Brief').map(rv => (
                                            <div key={rv.title}>{rv.title}</div>
                                        ))}
                                    </td>}
                                    {showReadAheadDueDate && <td>{event.readAheadDueDate ? event.readAheadDueDate.format('MM/DD/YYYY') : '-'}</td>}
                                    <td style={{ width: '280px' }}>{eventDateFormatted}</td> 
                                    {showOPR && <td>
                                        {event.getRefinerValuesForRefinerName('IPC OPR').map(rv => (
                                            <div key={rv.title}>{rv.title}</div>
                                        ))}
                                    </td>}
                                    {showAttendee && <td>
                                        {event.getRefinerValuesForRefinerName('IPC Attendee').map(rv => (
                                            <div key={rv.title}>{rv.title}</div>
                                        ))}
                                    </td>}
                                    <td style={{ whiteSpace: 'normal', wordWrap: 'break-word', overflowWrap: 'break-word' }}>
                                        {event.description}
                                    </td> */}
                                    <td>
                                        <div>
                                            <button className="btn btn-sm me-2" style={{ color: "rgb(0, 0, 0)", background: "rgb(255, 203, 123)", border: "1px solid #000" }}>Email</button>
                                            <button className="btn btn-sm me-2" style={{ color: "rgb(0, 0, 0)", background: "rgb(123, 218, 255)", border: "1px solid #000" }} onClick={() => openPanel(event.groupID)}>Assign</button>
                                            <button className="btn btn-sm me-2" style={{ color: "rgb(0, 0, 0)", background: "rgb(197, 197, 183)", border: "1px solid #000" }} onClick={() => openEditPanel(event.groupID, event)}>Edit</button> 
                                            <button className="btn btn-sm me-2" style={{ color: "rgb(0, 0, 0)", background: "rgb(226, 233, 127)", border: "1px solid #000" }} onClick={() => openChangeDatesPanel(event.groupID)}>Change Dates</button>
                                            <button className="btn btn-sm me-2" style={{ color: "rgb(0, 0, 0)", background: "rgb(255, 123, 134)", border: "1px solid #000" }} onClick={() => handleCancelGroup(event.groupID)}>Cancel</button>
                                        </div>
                                    </td>
                                    <td>
                                        <div>
                                            <button className="btn btn-sm me-2" style={{ color: "rgb(0, 0, 0)", background: "rgb(226, 233, 127)", border: "1px solid #000" }} onClick={() => openReassignPanel(event)}>Change Time</button>
                                            <button className="btn btn-sm" style={{ color: "rgb(0, 0, 0)", background: "rgb(255, 123, 134)", border: "1px solid #000" }} onClick={() => handleCancel(event.id)}>Cancel</button>
                                        </div>
                                    </td>
                                    <td>{event.groupID}</td>
                                    <td>{event.requestStatus}</td>
                                    <td>{event.dvPayGrade}</td>
                                    <td>{`${event.dvRank} ${event.dvFirstName} ${event.dvSurname}`}</td>
                                    <td>{event.parkingStalls === -1 ? 'Unavailable' : (parkingMap[event.parkingStalls] || event.parkingStalls)}</td>
                                    <td>
                                        <div>{event.start.format('DD MMM, YYYY')}</div>
                                        <div>{event.start.format('HHmm')}-{event.end.format('HHmm')}</div>
                                    </td>
                                    <td>{event.jdirVisiting}</td>
                                    <td>
                                        <div>{`${event.requestorRank} ${event.requestorFirstName} ${event.requestorLastName}`}</div>
                                        <div>{`${event.requestorOffice} ${event.requestorCellPhone?.replace(/^(\(\d{3}\))(\d{3}-\d{4})$/, '$1 $2') || ''}`}</div>
                                    </td>
                                    <td>{event.dvVisiting}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            {isPanelOpen && (
                <div className={styles.panel}>
                <button onClick={closePanel} className={styles.closeButton}>x</button>
                <div className={styles.flexContainer}> 
                    {/* Left Side - Parking Display */}
                    <div className={styles.leftSide}>
                    {panelParkingLoading ? (
                        <div></div>
                    ) : (
                        getEventDateRange(filteredEvents, groupIDToDisplay).map((day) => {
                            const dayOfWeek = moment(day);

                            const eventsForDay = filteredEvents.filter((event) =>
                                event.groupID === groupIDToDisplay && moment(event.start).isSame(dayOfWeek, 'day')
                            );

                            return (
                                <div key={dayOfWeek.format('YYYY-MM-DD')}  className={styles.dayBlock}>
                                    <p>{dayOfWeek.format('DD MMM, YYYY')}</p>
                                    <div style={{ display: "flex", gap: "8px" }}>
                                        {eventsForDay.length > 0 ? (
                                            eventsForDay.map((event) => {
                                        // Get ALL possible stalls (as IDs)
                                        const allStallIds = Object.keys(parkingMap).map(Number);
                                        // The available stalls for this event
                                        const visualOptions = parkingStallsOptionsEach[event.id] || parkingStallsOptions;
                                        const availableStallIds = visualOptions.filter(opt => opt.key !== -1).map((opt) => Number(opt.key));
                                        
                                        return (
                                            <div key={event.id} className={styles.parkingOptionWrapper}>
                                            {allStallIds.map((stallId) => {
                                            if (availableStallIds.includes(stallId)) {
                                                // Stall is available
                                                const option = visualOptions.find((opt) => Number(opt.key) === stallId);
                                                return (
                                                <div key={stallId} className={styles.parkingOption}>
                                                    {option?.text || parkingMap[stallId]}
                                                </div>
                                                );
                                            } else {
                                                // Stall is not available
                                                return (
                                                <div
                                                    key={stallId}
                                                    className={styles.parkingOption + ' ' + styles.occupiedOption}
                                                >
                                                    {parkingMap[stallId] || `Stall ${stallId}`} <span style={{ fontSize: '0.8em' }}></span>
                                                </div>
                                                );
                                            }
                                            })}
                                        </div>
                                    );
                                    })
                                ) : (
                                    <p>No events for this day</p>
                                )}
                                </div>
                            </div>
                            );
                        })
                    )}
                    </div>

                    {/* Right Side - Parking Assignment */}
                    <div className={styles.rightSide}>
                    {(() => {
                    const matchedEvent = filteredEvents.find(e => e.groupID === groupIDToDisplay);
                    return (
                        <>
                            <h6>Assignment for: {matchedEvent?.dvPayGrade || 'N/A'} {matchedEvent?.dvSurname || ''}</h6>
                            <h6>GroupID: {matchedEvent?.groupID || ''} & Bridge: {matchedEvent?.dvVisiting || ''}</h6>
                        </>
                    );
                    })()}

                    {panelParkingLoading ? (
                        <div>Loading...</div>
                    ) : parkingStallsOptions.filter(opt => opt.key !== -1).length > 0 ? (
                    <div className="d-flex flex-column gap-2 w-100">
                        {/* Parking Assignment Dropdown  For all*/}
                        <select
                                className="form-control w-100"
                                value={selectedParkingStall}  
                                onChange={(e) => setSelectedParkingStall(e.target.value)}
                            >
                            <option value="">Select Parking</option>
                            {parkingStallsOptions.map((option) => (
                            <option key={option.key} value={option.key}>
                                {option.text}
                            </option>
                            ))}
                        </select>
                        {/* Assign Parking Button */}
                        <button className="btn btn-success w-100" onClick={handleAssignToAllEvents}>
                            Assign and send email
                        </button>
                    </div>
                    ) : (() => {
                        const events = filteredEvents.filter(event => event.groupID === groupIDToDisplay);
                        return ( <> {events.map(event => {
                            const options = parkingStallsOptionsEach[event.id] || [];  
                            const hasUnavailable = options.some(opt => opt.key === -1); // Check if "Unavailable" is already in the options 
                            const allOptions = hasUnavailable ? options : [...options, { key: -1, text: "Unavailable" }]; // Only add it if it isn't already there
                            return (
                                <div key={event.id} className="d-flex align-items-center w-100 mt-3">
                                    <p className="mb-0" style={{ minWidth: '100px' }}>
                                    {event.start.format('DD MMM, YYYY')}:
                                    </p>
                                    <select
                                        className="form-control" style={{ minWidth: '145px' }}
                                        value={individualSelections[event.id]?.toString() || ''}  // Use event.id to track parking selection
                                        onChange={(e) => handleIndividualParkingChange(event.id, e.target.value)}  // Use event.id here
                                    >
                                        <option value="">Select Parking</option>
                                        {allOptions.map((option) => (
                                            <option key={option.key} value={option.key}>
                                                {option.text}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            );
                        })}
                            <button
                            className="btn btn-success mt-3 w-100" onClick={async () => {
                                const unselected = events.filter(event => individualSelections[event.id] === undefined || isNaN(individualSelections[event.id]) || individualSelections[event.id] === 0);
                                if (unselected.length > 0) {
                                    alert(`Please select parking for all events before assigning.`);
                                    return;
                                } 
                                for (const event of events) {
                                    const selectedStall = individualSelections[event.id];
                                    await updateEventInDatabase(event.id, selectedStall);
                                }
                                alert("All assignments completed.");
                            }}
                            >
                            Assign and send email
                            </button>
                        </>
                        );
                    })()}
                    </div>
                </div>
            </div>
            )}
            {isEditPanelOpen && (
            <div className={styles.panel}>
                <button onClick={() => setIsEditPanelOpen(false)} className={styles.closeButton} >x</button>
                <div className={styles.formContainer}>
                <div style={{ background: "rgb(148, 200, 221)" }}>
                <div className={styles.row}>
                    <div>
                    DV Pay Grade:{" "}
                    <input className="form-control" value={editFields.dvPayGrade ?? ''} onChange={e => setEditFields({ ...editFields, dvPayGrade: e.target.value })}/>
                    </div>
                    <div>
                    DV Rank:{" "}
                    <input className="form-control" value={editFields.dvRank ?? ''} onChange={e => setEditFields({ ...editFields, dvRank: e.target.value })}/>
                    </div>
                    <div>
                    DV First Name:{" "}
                    <input className="form-control" value={editFields.dvFirstName ?? ''} onChange={e => setEditFields({ ...editFields, dvFirstName: e.target.value })}/>
                    </div>
                    <div>
                    DV Last Name:{" "}
                    <input className="form-control" value={editFields.dvSurname ?? ''} onChange={e => setEditFields({ ...editFields, dvSurname: e.target.value })}/>
                    </div>
                </div>
                <div className={styles.row}>
                    <div>
                    DV visiting JDIR/Office:{" "}
                    <input className="form-control" value={editFields.jdirVisiting ?? ''} onChange={e => setEditFields({ ...editFields, jdirVisiting: e.target.value })}/>
                    </div>
                    <div>
                    Is DV visting Bridge:{" "}
                    <input className="form-control" value={editFields.dvVisiting ?? ''} onChange={e => setEditFields({ ...editFields, dvVisiting: e.target.value })}/>
                    </div>
                </div>
                </div>
                <div style={{ background: "rgb(165, 221, 148)" }}>
                <div className={styles.row}>
                    <div>
                    Requestor Rank:{" "}
                    <input className="form-control" value={editFields.requestorRank ?? ''} onChange={e => setEditFields({ ...editFields, requestorRank: e.target.value })}/>
                    </div>
                    <div>
                    Requestor First Name:{" "}
                    <input className="form-control" value={editFields.requestorFirstName ?? ''} onChange={e => setEditFields({ ...editFields, requestorFirstName: e.target.value })}/>
                    </div>
                    <div>
                    Requestor Last Name:{" "}
                    <input className="form-control" value={editFields.requestorLastName ?? ''} onChange={e => setEditFields({ ...editFields, requestorLastName: e.target.value })}/>
                    </div>
                    <div>
                    Requestor Office:{" "}
                    <input className="form-control" value={editFields.requestorOffice ?? ''} onChange={e => setEditFields({ ...editFields, requestorOffice: e.target.value })}/>
                    </div>
                </div>
                <div className={styles.row}>
                    <div>
                    Requestor Duty Phone:{" "}
                    <input className="form-control" value={editFields.requestorDutyPhone ?? ''} onChange={e => setEditFields({ ...editFields, requestorDutyPhone: e.target.value })}/>
                    </div>
                    <div>
                    Requestor Cell Phone:{" "}
                    <input className="form-control" value={editFields.requestorCellPhone ?? ''} onChange={e => setEditFields({ ...editFields, requestorCellPhone: e.target.value })}/>
                    </div>
                    <div>
                    Requestor Email:{" "}
                    <input className="form-control" value={editFields.requestorEmail ?? ''} onChange={e => setEditFields({ ...editFields, requestorEmail: e.target.value })}/>
                    </div>
                </div>
                </div>
                    <button className="btn btn-success" onClick={handleEditSave}>Save Changes</button>
                </div>
            </div>
            )}
            {isReassignPanelOpen && eventToReassign && (
            <div className={styles.panel}>
                <button onClick={() => setIsReassignPanelOpen(false)} className={styles.closeButton}>x</button>
                <div> 
                <h6>{eventToReassign.start.format('DD MMM, YYYY')}</h6>
                <div>
                    <label>
                    Start:
                    <input type="time" className="form-control" value={reassignStart} onChange={e => setReassignStart(e.target.value)}/>
                    </label>
                </div>
                <div>
                    <label>
                    End:
                    <input type="time" className="form-control" value={reassignEnd} onChange={e => setReassignEnd(e.target.value)}/>
                    </label>
                </div>
                <button className="btn btn-success mt-2" onClick={async () => { await handleReassignSave(); }}>
                    Save Changes
                </button>
                </div>
            </div>
            )}
            {isChangeDatesPanelOpen && (
            <div className={styles.panel}>
                <button onClick={() => setIsChangeDatesPanelOpen(false)} className={styles.closeButton}>x</button>
                <div>
                <div>
                    <label>
                    New Start Date:
                    <input
                        type="date"
                        className="form-control"
                        value={changeStartDate}
                        onChange={e => setChangeStartDate(e.target.value)}
                    />
                    </label>
                </div>
                <div>
                    <label>
                    New End Date:
                    <input
                        type="date"
                        className="form-control"
                        value={changeEndDate}
                        onChange={e => setChangeEndDate(e.target.value)}
                    />
                    </label>
                </div>
                <button
                    className="btn btn-success mt-2"
                    onClick={async () => await handleChangeDatesSave()}
                >
                    Save Changes
                </button>
                </div>
            </div>
            )}
        </div>
    );
};

export default EventDetailsList;
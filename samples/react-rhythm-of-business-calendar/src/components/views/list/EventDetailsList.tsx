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

interface EventDetailsListProps {
  cccurrences: readonly EventOccurrence[];
}

interface ParkingSpot {
  id: number;
  parking: string;
}

const EventDetailsList: FC<EventDetailsListProps> = ({ cccurrences }) => {
    const [filteredEvents, setFilteredEvents] = useState<EventOccurrence[]>([...cccurrences]);
    const [startDate, setStartDate] = useState<string>(moment().format('YYYY-MM-DD'));
    const [endDate, setEndDate] = useState<string>(moment().format('YYYY-MM-DD'));
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [requestStatusFilter, setRequestStatusFilter] = useState<string>('New Request');
    const [isPanelOpen, setIsPanelOpen] = useState<boolean>(false);
    const [groupIDToDisplay, setGroupIDToDisplay] = useState<string>('');
    const [parkingStallsOptions, setParkingStallsOptions] = useState<IDropdownOption[]>([]);
    const [loadingSpots, setLoadingSpots] = useState<boolean>(false);

    const timeZoneService = useTimeZoneService();
    const siteTimeZone = timeZoneService.siteTimeZone;
        //const { showOPR, showAttendee, showReadAheadDueDate, showDecisionBrief, showLocation } = useContext(FilterConfigContext);
    const predefinedStatuses = ['New Request', 'Approve Request', 'Cancel Request', 'Reject Request'];
    const [selectedParkingStall, setSelectedParkingStall] = useState<string>(''); 
    const [individualSelections, setIndividualSelections] = useState<{ [key: string]: number }>({});

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

    const openPanel = (groupID: string) => {
        setGroupIDToDisplay(groupID); 
        setIsPanelOpen(true); 
        loadAvailableParking();
    };

    const closePanel = () => setIsPanelOpen(false);

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
    
    // Handle the apply to all events button
    const loadAvailableParking = async () => {
        setLoadingSpots(true);

        try {
        const web = await sp.web.get();
        const siteUrl = web.Url;

        // STEP 1: Fetch all parking stalls
        const parkingResponse = await fetch(
            `${siteUrl}/_api/web/lists/getbytitle('DVParkingStalls')/items?$select=ID,ParkingAssigment`,
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
        const allParking: ParkingSpot[] = allParkingData.d.results.map((item: any) => ({
            id: item.ID,
            parking: item.ParkingAssigment,
        }));

        // STEP 2: Filter out parking spots already booked in the time window
        const bookingsResponse = await fetch(
            `${siteUrl}/_api/web/lists/getbytitle('Rob Calendar Events2')/items?$select=ParkingStallsId,EventDate,EndDate,RequestStatus&$filter=RequestStatus eq 'Approve Request' and (EndDate gt datetime'${startDate}T00:00:00' and EventDate lt datetime'${endDate}T23:59:59')`,
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

        const bookingsData = await bookingsResponse.json();
        const bookedParkingIds = new Set(
            bookingsData.d.results
            .map((item: any) => item.ParkingStallsId)
            .filter((id: number | null) => id != null)
        );

        // STEP 3: Filter out available parking
        const availableParking = allParking.filter(
            (parkingSpot: ParkingSpot) => !bookedParkingIds.has(parkingSpot.id)
        );

        // Update parking stalls options for dropdown
        setParkingStallsOptions(
            availableParking.map((parkingSpot) => ({
            key: parkingSpot.id,
            text: parkingSpot.parking,
            }))
        );
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
    
            // Fetch items that match the groupID and retrieve the ID field
            const response = await fetch(
                `${siteUrl}/_api/web/lists/getbytitle('Rob Calendar Events2')/items?$filter=GroupID eq ${groupID}&$select=ID`,
                {
                    method: 'GET',
                    headers: {
                        Accept: 'application/json;odata=verbose',
                    },
                }
            );
    
            const data = await response.json();
    
            // Check if there are matching items and return their IDs
            if (data.d.results.length > 0) {
                return data.d.results.map((item: any) => item.ID); // Return all matching event IDs
            } else {
                return []; // No items found
            }
        } catch (error) {
            console.error('Error fetching item IDs:', error);
            return []; // Return an empty array in case of an error
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

                if (selectedStall) {
                    await updateEventsInDatabase({
                        displayName: event.displayName,
                        title: event.title,
                        start: event.start,
                        end: event.end,
                        isAllDay: event.isAllDay,
                        location: event.location,
                        color: event.color,
                        tag: event.tag,
                        recurrence: event.recurrence,
                        isPendingApproval: event.isPendingApproval,
                        isApproved: event.isApproved,
                        isRejected: event.isRejected,
                        isRecurring: event.isRecurring,
                        isSeriesMaster: event.isSeriesMaster,
                        isSeriesException: event.isSeriesException,
                        isConfidential: event.isConfidential,
                        refinerValues: event.refinerValues,
                        comDecision: event.comDecision,
                        readAheadDueDate: event.readAheadDueDate,
                        parkingStalls: selectedStall, 
                        requestStatus: 'Approve Request', 
                        dvFirstName: event.dvFirstName,
                        dvSurname: event.dvSurname,
                        dvRank: event.dvRank,
                        dvPayGrade: event.dvPayGrade,
                        jdirVisiting: event.jdirVisiting,
                        dvVisiting: event.dvVisiting,
                        requestorRank: event.requestorRank,
                        requestorFirstName: event.requestorFirstName,
                        requestorLastName: event.requestorLastName,
                        requestorOffice: event.requestorOffice,
                        requestorDutyPhone: event.requestorDutyPhone,
                        requestorCellPhone: event.requestorCellPhone,
                        requestorEmail: event.requestorEmail,
                        groupID: event.groupID,
                        getWrappedEvent: function (): Event { throw new Error('Function not implemented.'); },
                        getSeriesMaster: function (): Event { throw new Error('Function not implemented.'); },
                        getExceptionOrEvent: function (): Event { throw new Error('Function not implemented.'); }
                    });
                } else {
                    alert(`Please select a parking stall for group ${event.groupID}`);
                    setLoadingSpots(false);
                    return;
                }
            }

            alert('Parking has been assigned to all events in the group.');
        } catch (error) {
            console.error('Error updating events:', error);
            alert('There was an error assigning parking to the events.');
        } finally {
            setLoadingSpots(false);
        }
    };

    const updateEventsInDatabase = async (event: IEvent) => {
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
                        ParkingStallsId: event.parkingStalls, // Update the lookup field
                        RequestStatus: event.requestStatus, // Update the status
                    });
                } else {
                    alert('Please select a valid parking stall.');
                    break; // Stop the loop if parking stall is not valid
                }
            }
    
            alert('All events updated successfully!');
        } catch (error) {
            console.error('Error updating events in database:', error);
            alert('There was an error updating the events.');
        }
    };

    // Handle the apply to individual event button
    const handleIndividualParkingChange = (index: number, selectedStall: string) => {
        setIndividualSelections(prevSelections => ({
            ...prevSelections,
            [index]: Number(selectedStall), // Use index as the key
        }));
    };

    const updateEventInDatabase = async (index: number, selectedStall: number) => {
        try {
            const event = filteredEvents[index];  // Get the event from filtered events based on index

            if (!event) {
                alert('No valid event found to update.');
                return;
            }

            const itemId = event.id;  // Access the event ID using the getter `id` from EventOccurrence

            if (!itemId) {
                alert('No valid event ID found to update.');
                return;
            }

            // Now update the event using the itemId and the selected parking stall
            await sp.web.lists.getByTitle('Rob Calendar Events2').items.getById(itemId).update({
                ParkingStallsId: selectedStall,  // Update parking stall
                RequestStatus: 'Approve Request',  // Update request status
            });

            alert(`Event ${itemId} updated successfully!`);
        } catch (error) {
            console.error('Error updating the event in database:', error);
            alert('There was an error updating the event.');
        }
    };
    
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
                            <th className={styles.tdHeader}>Protocol Actions</th>
                            <th className={styles.tdHeader}>Group ID</th>
                            <th className={styles.tdHeader}>Parking Assignment</th>
                            <th className={styles.tdHeader}>Status</th>
                            <th className={styles.tdHeader}>Parking Request Date</th>
                            <th className={styles.tdHeader}>DV Info</th>
                            <th className={styles.tdHeader}>Requestor Info</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredEvents.map((event, index) => {
                            let eventDateFormatted;
                            
                            // all day and in one day. Example output: 1/1/2024 
                            if (event.isAllDay && event.start.format('MM/DD/YYYY') === event.end.format('MM/DD/YYYY')) {
                                eventDateFormatted = event.start.format('MM/DD/YYYY');
                            // all day and more than one day. Example output: 1/1/2024 - 1/3/2024
                            } else if(event.isAllDay && event.start.format('MM/DD/YYYY') !== event.end.format('MM/DD/YYYY')) { 
                                eventDateFormatted = event.start.format('MM/DD/YYYY') + " - " + event.end.format('MM/DD/YYYY');
                            // not all day and in one day. Example output: 1/1/2024 0600-0800
                            } else if (!event.isAllDay && event.start.format('MM/DD/YYYY') === event.end.format('MM/DD/YYYY')) {
                                eventDateFormatted = event.start.format('MM/DD/YYYY HHmm') + "-" + event.end.format('HHmm');
                            // not all day and more than one day. Example output: 1/1/2024 0600 - 1/3/2024 1400
                            } else if (!event.isAllDay && event.start.format('MM/DD/YYYY') !== event.end.format('MM/DD/YYYY')) {
                                eventDateFormatted = event.start.format('MM/DD/YYYY HHmm') + " - " + event.end.format('MM/DD/YYYY HHmm');    
                            } else {
                                eventDateFormatted = event.start.format('MM/DD/YYYY HHmm') + " - " + event.end.format('MM/DD/YYYY HHmm');
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
                                    <td className={styles.tdCell}>
                                        <button
                                            className={styles.openAssignButton}
                                            onClick={() => openPanel(String(event.groupID))}
                                        >
                                            Assign
                                        </button>
                                        <button className={styles.denyButton}>Deny</button>
                                        <button className={styles.cancelButton}>Cancel</button>
                                    </td>
                                    <td>{event.groupID}</td>
                                    <td>{event.parkingStalls}</td>
                                    <td>{event.requestStatus}</td>
                                    <td>{eventDateFormatted}</td>
                                    <td>{`${event.dvRank} ${event.dvFirstName} ${event.dvSurname}`}</td>
                                    <td>{`${event.requestorRank} ${event.requestorFirstName} ${event.requestorLastName} ${event.requestorCellPhone}`}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            {isPanelOpen && (
                <div className={styles.panel}>
                <button onClick={closePanel} className={styles.closeButton}>x</button>
                    <div>
                        <p>Assign Parking for Group ID: {groupIDToDisplay}</p>

                        <div className={styles.flexContainer}>
                        {/* Parking Assignment Dropdown */}
                        <select
                                className={`form-control ${styles.dropdown}`}
                                value={selectedParkingStall}  
                                onChange={(e) => setSelectedParkingStall(e.target.value)}
                            >
                            <option value="">Select Parking Stall</option>
                            {parkingStallsOptions.map((option) => (
                            <option key={option.key} value={option.key}>
                                {option.text}
                            </option>
                            ))}
                        </select>

                        {/* Assign Parking Button */}
                        <button className={styles.assignButtonAll} onClick={handleAssignToAllEvents}>
                        Assign to all events
                        </button>
                        </div>

                        {/* Render buttons for each event within GroupID */}
                        {filteredEvents
                        .filter((event) => event.groupID === Number(groupIDToDisplay))
                        .map((event, index) => (
                            <div key={event.id} className={styles.flexContainer} style={{ marginTop: '10px' }}>
                                <select
                                    className={`form-control ${styles.dropdown}`}
                                    value={individualSelections[event.id]?.toString() || ''}  // Use event.id to track parking selection
                                    onChange={(e) => handleIndividualParkingChange(event.id, e.target.value)}  // Use event.id here
                                >
                                    <option value="">Select Parking Stall</option>
                                    {parkingStallsOptions.map((option) => (
                                        <option key={option.key} value={option.key}>
                                            {option.text}
                                        </option>
                                    ))}
                                </select>
                                <button
                                    className={`${styles.assignButton} ${styles.eventButton}`}
                                    onClick={() => updateEventInDatabase(index, individualSelections[event.id])} // Use event.id here
                                >
                                    Assign to individual event
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default EventDetailsList;
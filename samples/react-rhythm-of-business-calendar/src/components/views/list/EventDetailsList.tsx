import React, { FC, useState, useEffect } from 'react';
import { EventOccurrence } from 'model';
import { useTimeZoneService } from 'services';
import moment from 'moment';
import 'bootstrap/dist/css/bootstrap.min.css';
import { sp } from '@pnp/sp';
import { fetchParkingStalls } from './spEventDetailsList';
import { AssignPanel } from './AssignPanel';
import { EditPanel } from './EditPanel';
import { ReassignPanel } from './ReassignPanel';
import { ChangeDatesPanel } from './ChangeDatesPanel';

interface EventDetailsListProps {
  cccurrences: readonly EventOccurrence[];
}

interface ParkingSpot {
  id: number;
  parking: string;
}

interface OccupiedStall {
    parkingId: number;
    payGrade: string;
    surname: string;
}


const EventDetailsList: FC<EventDetailsListProps> = ({ cccurrences }) => {
    // Filter
    const [filteredEvents, setFilteredEvents] = useState<EventOccurrence[]>([...cccurrences]);
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [requestStatusFilter, setRequestStatusFilter] = useState<string>('New');
    const predefinedStatuses = ['New', 'Approved', 'Cancelled', 'Denied'];
    // Parking Map
    const [parkingMap, setParkingMap] = useState<{ [id: number]: string }>({});
    const [loadingSpots, setLoadingSpots] = useState<boolean>(false);
    // Time Zones
    const timeZoneService = useTimeZoneService();
    const siteTimeZone = timeZoneService.siteTimeZone;
    // Assign Panel
    const [isPanelOpen, setIsPanelOpen] = useState<boolean>(false);
    const [groupIDToDisplay, setGroupIDToDisplay] = useState<number>(0);
    // Edit Panel
    const [isEditPanelOpen, setIsEditPanelOpen] = useState(false);
    const [editGroupID, setEditGroupID] = useState<number | null>(null);
    const [eventToEdit, setEventToEdit] = useState<EventOccurrence | null>(null);
    // Change Date Panel
    const [isChangeDatesPanelOpen, setIsChangeDatesPanelOpen] = useState(false);
    const [groupToChangeDates, setGroupToChangeDates] = useState<number | null>(null);
    const [changeStartDate, setChangeStartDate] = useState('');
    const [changeEndDate, setChangeEndDate] = useState('');
    // Change Time Panel
    const [isReassignPanelOpen, setIsReassignPanelOpen] = useState(false);
    const [eventToReassign, setEventToReassign] = useState<EventOccurrence | null>(null);
    const [reassignStart, setReassignStart] = useState('');
    const [reassignEnd, setReassignEnd] = useState('');


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
    const loadParkingMap = async () => {
        const web = await sp.web.get();
        const siteUrl = web.Url;
        const stalls = await fetchParkingStalls(siteUrl);
        const map: { [id: number]: string } = {};
        stalls.forEach(s => { map[s.id] = s.parking; });
        setParkingMap(map);
    };
    loadParkingMap();
    }, []);

    const resetFilters = () => { setStartDate(''); setEndDate(''); setSearchQuery(''); setRequestStatusFilter(''); };

    // Edit Panel
    const openEditPanel = (groupID: number, event: EventOccurrence) => {
    setEditGroupID(groupID);
    setEventToEdit(event);
    setIsEditPanelOpen(true);
    };

    // Change Dates Panel
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

    // Change Time Panel
    const openReassignPanel = (event: EventOccurrence) => {
        setEventToReassign(event);
        setReassignStart(event.start.format('HH:mm'));
        setReassignEnd(event.end.format('HH:mm'));
        setIsReassignPanelOpen(true);
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
            </div>

            {/* table with sticky headers */}
            <div className="table-responsive" style={{ height: '600px', overflowY: 'auto' }}>
                <table className="table table-bordered table-striped">
                    <thead className="thead-dark sticky-top">
                        <tr>
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
                                    <td>
                                        <div>
                                            <button className="btn btn-sm me-2" style={{ color: "rgb(0, 0, 0)", background: "rgb(255, 203, 123)", border: "1px solid #000" }}>Email</button>
                                            <button className="btn btn-sm me-2" style={{ color: "rgb(0, 0, 0)", background: "rgb(123, 218, 255)", border: "1px solid #000" }} onClick={() => { setGroupIDToDisplay(event.groupID); setIsPanelOpen(true); }}>Assign</button>
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
            <AssignPanel
                isPanelOpen={isPanelOpen}
                setIsPanelOpen={setIsPanelOpen}
                groupIDToDisplay={groupIDToDisplay}
                setGroupIDToDisplay={setGroupIDToDisplay}
                filteredEvents={filteredEvents}
                setLoadingSpots={setLoadingSpots}
            />
            <EditPanel
                isEditPanelOpen={isEditPanelOpen}
                setIsEditPanelOpen={setIsEditPanelOpen}
                editGroupID={editGroupID}
                setEditGroupID={setEditGroupID}
                filteredEvents={filteredEvents}
                eventToEdit={eventToEdit}
            />
            <ChangeDatesPanel
                isChangeDatesPanelOpen={isChangeDatesPanelOpen}
                setIsChangeDatesPanelOpen={setIsChangeDatesPanelOpen}
                groupToChangeDates={groupToChangeDates}
                setGroupToChangeDates={setGroupToChangeDates}
                filteredEvents={filteredEvents}
                siteTimeZone={siteTimeZone}
                setIsPanelOpen={setIsPanelOpen}
                setGroupIDToDisplay={setGroupIDToDisplay}
            />
            <ReassignPanel
                isReassignPanelOpen={isReassignPanelOpen}
                setIsReassignPanelOpen={setIsReassignPanelOpen}
                eventToReassign={eventToReassign}
                siteTimeZone={siteTimeZone}
                setIsPanelOpen={setIsPanelOpen}
                setGroupIDToDisplay={setGroupIDToDisplay}
            /> 
        </div>
    );
};

export default EventDetailsList;

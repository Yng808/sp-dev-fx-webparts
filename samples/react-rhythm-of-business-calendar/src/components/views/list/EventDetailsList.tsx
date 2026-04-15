import React, { FC, useEffect, useState } from 'react';
import { EventOccurrence } from 'model';
import { useTimeZoneService } from 'services';
import moment from 'moment';
import 'bootstrap/dist/css/bootstrap.min.css';
import styles from './EventDetailsList.module.scss'
import { sp } from '@pnp/sp';
import { fetchParkingStalls, fetchEventOccurrenceById, composeEmailInBrowser, fetchEmailSettings } from './spEventDetailsList';
import { applyEmailSettings } from './EmailTemplate';
import { AssignPanel } from './AssignPanel';
import { EditPanel } from './EditPanel';
import { ReassignPanel } from './ReassignPanel';
import { ChangeDatesPanel } from './ChangeDatesPanel';
import { showAlert, AlertHost, ConfirmDialog } from './AlertHost';
import { cancelEventEmail, cancelGroupEmail, snapshotGroupEmail } from './EmailTemplate';
import { CurrentParkingPanel } from './PreviewPanel';

interface EventDetailsListProps {
    cccurrences: readonly EventOccurrence[];
}

const EventDetailsList: FC<EventDetailsListProps> = ({ cccurrences }) => {
    // Filter
    const [filteredEvents, setFilteredEvents] = useState<EventOccurrence[]>([...cccurrences]);
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [requestStatusFilter, setRequestStatusFilter] = useState<string>('New');
    const predefinedStatuses = ['New', 'Approved', 'Cancelled'];
    const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
    // Parking Map
    const [parkingMap, setParkingMap] = useState<{ [id: number]: string }>({});
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [loadingSpots, setLoadingSpots] = useState<boolean>(false);
    // Time Zones
    const timeZoneService = useTimeZoneService();
    const siteTimeZone = timeZoneService.siteTimeZone;
    // Assign Panel
    const [isPanelOpen, setIsPanelOpen] = useState<boolean>(false);
    const [groupIDToDisplay, setGroupIDToDisplay] = useState<number>(0);
    const [eventIdToDisplay, setEventIdToDisplay] = useState<number | null>(null);
    // Edit Panel
    const [isEditPanelOpen, setIsEditPanelOpen] = useState(false);
    const [editGroupID, setEditGroupID] = useState<number | null>(null);
    const [eventToEdit, setEventToEdit] = useState<EventOccurrence | null>(null);
    // Change Date Panel
    const [isChangeDatesPanelOpen, setIsChangeDatesPanelOpen] = useState(false);
    const [groupToChangeDates, setGroupToChangeDates] = useState<number | null>(null);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [changeStartDate, setChangeStartDate] = useState('');
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [changeEndDate, setChangeEndDate] = useState('');
    const [dateChangeNotice, setDateChangeNotice] = useState<string | null>(null);
    // Change Time Panel
    const [isReassignPanelOpen, setIsReassignPanelOpen] = useState(false);
    const [eventToReassign, setEventToReassign] = useState<EventOccurrence | null>(null);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [reassignStart, setReassignStart] = useState('');
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [reassignEnd, setReassignEnd] = useState('');
    const [timeChangeNotice, setTimeChangeNotice] = useState<string | null>(null);
    // Preview Panel
    const [isCurrentPanelOpen, setIsCurrentPanelOpen] = useState(false);
    const [previewGroupEvents, setPreviewGroupEvents] = useState<EventOccurrence[] | null>(null);
    // Cancel Panel
    const [showConfirm, setShowConfirm] = useState(false);
    const [confirmConfig, setConfirmConfig] = useState<{message: string; onConfirm: () => void;} | null>(null);
    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 50; 

    const pagedEvents = filteredEvents.slice(
        (currentPage - 1) * pageSize,
        currentPage * pageSize
    );

    const totalPages = Math.ceil(filteredEvents.length / pageSize);

    const getPageNumbers = () => {
        const totalNumbersToShow = 3; // 3 middle pages
        const pages: (number | string)[] = [];

        const firstPage = 1;
        const lastPage = totalPages;

        pages.push(firstPage); // Always include the first page
        
        let start = currentPage - 1; // Calculate sliding window
        let end = currentPage + 1;

        if (start < 2) { // Clamp bounds
            start = 2;
            end = start + totalNumbersToShow - 1;
        }

        if (end > totalPages - 1) {
            end = totalPages - 1;
            start = end - totalNumbersToShow + 1;
            if (start < 2) start = 2;
        }

        if (start > 2) { // Ellipsis after first page
            pages.push("…");
        }

        for (let i = start; i <= end; i++) { // Middle page numbers
            pages.push(i);
        }
   
        if (end < totalPages - 1) { // Ellipsis before last page
            pages.push("…");
        }

        if (totalPages > 1) { // Always include the last page
            pages.push(lastPage);
        }

        return pages;
    };

    const pageNumbers = getPageNumbers(); 

    const replaceGroupEvents = (groupId: number, updated: EventOccurrence[]) => {
    setFilteredEvents(prev => {
        const others = prev.filter(ev => ev.groupID !== groupId);
        return [...others, ...updated].sort((a,b) =>
        a.groupID - b.groupID || a.start.diff(b.start)
        );
    });
    };

    useEffect(() => {
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && isFullscreen) {
                setIsFullscreen(false);
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isFullscreen]);

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
        setCurrentPage(1);
    }, [startDate, endDate, searchQuery, requestStatusFilter]);

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

    useEffect(() => {
        const loadSettings = async () => {
            try {
                const web = await sp.web.get();
                const siteUrl = web.Url;
                const cached = sessionStorage.getItem('emailSettings');
                if (cached) {
                    applyEmailSettings(JSON.parse(cached));
                    return;
                }
                const spSettings = await fetchEmailSettings(siteUrl);
                sessionStorage.setItem('emailSettings', JSON.stringify(spSettings));
                applyEmailSettings(spSettings);
            } catch (err) {
                console.error('Failed to load email settings', err);
            }
        };
        loadSettings();
    }, []);

    const resetFilters = () => { setStartDate(''); setEndDate(''); setSearchQuery(''); setRequestStatusFilter(''); };

    // Email Current Info
    const handleSendGroupEmail = (groupID: number) => {
        const groupEvents = filteredEvents.filter(ev => ev.groupID === groupID);
    
        if (groupEvents.length === 0) {
            showAlert(`No events found for group ${groupID}.`, 'warning');
            return;
        }
        const mapWithUnavailable = { ...parkingMap, [-1]: 'Unavailable' };
        const { to, subject, body } = snapshotGroupEmail(groupEvents, mapWithUnavailable);
        composeEmailInBrowser(to, subject, body);
    };

    // Edit Panel
    const openEditPanel = async (groupID: number, eventId: number) => {
        const siteUrl = (await sp.web.get()).Url;
        const latestEvent = await fetchEventOccurrenceById(siteUrl, eventId);
        setEditGroupID(groupID);
        setEventToEdit(latestEvent);
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
    const handleCancelGroup = (groupId: number, event: EventOccurrence) => {
        setConfirmConfig({ message: `Are you sure you want to cancel ALL events in group ${groupId} for ${event.dvRank} ${event.dvFirstName} ${event.dvSurname}?`,
        onConfirm: async () => {
        const groupEvents = filteredEvents.filter(ev => ev.groupID === groupId);
        const eventIds = groupEvents.map(ev => ev.id);
        try {
            for (const id of eventIds) {
                await sp.web.lists.getByTitle('Rob Calendar Events2').items.getById(id).update({
                    RequestStatus: 'Cancelled',
                });

                setFilteredEvents(prev =>
                    prev.map(ev =>
                        ev.groupID === groupId
                        ? new EventOccurrence((() => {
                            ev.event.requestStatus = 'Cancelled';
                            return ev.event;
                            })(), ev.start, ev.end)
                        : ev
                    )
                );
            }
            showAlert(`All events in group ${groupId} for ${event.dvRank} ${event.dvFirstName} ${event.dvSurname} cancelled successfully!`, 'success');

            if (groupEvents.length > 0) {
                const email = cancelGroupEmail(groupEvents);
                composeEmailInBrowser(email.to, email.subject, email.body);
            }
        } catch (error) {
            console.error('Error cancelling group events:', error);
            showAlert('There was an error cancelling the group events.', 'warning');
        }
        },
    });
    setShowConfirm(true);
    };

    // Cancel by event
    const handleCancel = (event: EventOccurrence) => {
        setConfirmConfig({ message: `Are you sure you want to cancel the event for ${event.dvRank} ${event.dvFirstName} ${event.dvSurname} on ${event.start.format("MMM DD, YYYY")}?`,
        onConfirm: async () => {
        try {
            await sp.web.lists.getByTitle('Rob Calendar Events2').items.getById(event.id).update({
                RequestStatus: 'Cancelled',
            });

            setFilteredEvents(prev => 
                prev.map(ev => 
                    ev.id === event.id ? new EventOccurrence((() => {
                    ev.event.requestStatus = 'Cancelled';
                    return ev.event;
                })(), ev.start, ev.end) : ev)
            );

            showAlert(`Event for ${event.dvRank} ${event.dvFirstName} ${event.dvSurname} cancelled successfully!`,'success');

            const { to, subject, body } = cancelEventEmail(event);
            composeEmailInBrowser(to, subject, body);
        
        } catch (error) {
            showAlert('Failed to update status to Cancelled.', 'warning');
            console.error(error);
        }
        },
    });
    setShowConfirm(true);
    };

    const toggleFullscreen = () => {
        setIsFullscreen(!isFullscreen);
    };

    // Fullscreen container styles
    const fullscreenStyles = isFullscreen ? {
        position: 'fixed' as const,
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'white',
        zIndex: 9999,
        padding: '20px',
        boxSizing: 'border-box' as const,
        maxWidth: 'none',
        margin: 0
    } : {};

    // Table container styles
    const tableContainerStyles = isFullscreen ? {
        height: 'calc(100vh - 140px)', // Account for filters and padding
        overflowY: 'auto' as const,
        position: 'relative' as const,
        transform: 'translateZ(0)', // Force hardware acceleration
        willChange: 'scroll-position' as const
    } : {
        maxHeight: '70vh',
        minHeight: '300px',
        overflowY: 'auto' as const,
        position: 'relative' as const,
        transform: 'translateZ(0)', // Force hardware acceleration
        willChange: 'scroll-position' as const
    };

    return (
        <div className={isFullscreen ? "" : "container-fluid"} style={fullscreenStyles}>
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
                    <label/>
                    <button
                        className='form-control' 
                        style={{ 
                            color: "rgb(0, 0, 0)", 
                            background: "rgb(197, 197, 183)"
                        }} 
                        onClick={resetFilters}
                    >
                        Reset Filters
                    </button>
                </div>
                <div className="col">
                    <label/>
                    <button
                        className="form-control"
                        style={{ 
                            backgroundColor: isFullscreen ? '#dc3545' : '#28a745', 
                            color: '#ffffff' 
                        }}
                        onClick={toggleFullscreen}
                        title={isFullscreen ? "Exit Fullscreen (Press Esc)" : "Enter Fullscreen"}
                    >
                        {isFullscreen ? '⛶ Exit Fullscreen' : '⛶ Fullscreen'}
                    </button>
                </div>
            </div>

            {/* table with sticky headers */}
            <div className="table-responsive" style={tableContainerStyles}>
                <table className="table table-bordered table-striped" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                    <thead className="thead-dark sticky-top" style={{ zIndex: 10 }}>
                        <tr>
                            <th>Group Actions</th>
                            <th>Single Actions</th>
                            <th>ID</th>
                            <th>Status</th>
                            <th>DV Pay Grade</th>
                            <th>DV Info</th>
                            <th>Parking Assignment</th>
                            <th>Request Date</th>
                            <th>JDIR</th>
                            <th>Requestor Info</th>
                            <th>Bridge</th>
                            <th>Last Modified By</th>
                        </tr>
                    </thead>
                    <tbody>
                        {pagedEvents.map((event, index) => {
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
                                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                                eventDateFormatted = event.start.format('MM/DD/YYYY HHmm') + " - " + event.end.format('MM/DD/YYYY HHmm');
                            }

                            return (
                                <tr key={index}>
                                    <td className={styles.tdWide}>
                                        <div>
                                            <button className={`btn btn-sm me-2 ${styles.emailButton}`} onClick={() => handleSendGroupEmail(event.groupID)}>Email</button>   
                                            {event.requestStatus !== 'Cancelled' && (
                                                <>
                                                    <button className={`btn btn-sm me-2 ${styles.assignButton}`} onClick={() => { setGroupIDToDisplay(event.groupID); setIsPanelOpen(true); }}>Assign</button>
                                                    <button className={`btn btn-sm me-2 ${styles.editButton}`} onClick={() => openEditPanel(event.groupID, event.id)}>Edit</button>
                                                    <button className={`btn btn-sm me-2 ${styles.changeButton}`} onClick={() => openChangeDatesPanel(event.groupID)}>Change Dates</button>
                                                    <button className={`btn btn-sm me-2 ${styles.cancelButton}`} onClick={() => handleCancelGroup(event.groupID, event)}>Cancel</button>
                                                </>
                                            )}
                                    </div>
                                
                                    </td>
                                    <td className={styles.tdLarge}>
                                    {event.requestStatus !== 'Cancelled' && (
                                        <div>
                                            <button className={`btn btn-sm me-2 ${styles.changeButton}`} onClick={() => openReassignPanel(event)}>Change Time</button>
                                            <button className={`btn btn-sm me-2 ${styles.cancelButton}`} onClick={() => handleCancel(event)}>Cancel</button>
                                        </div>
                                    )}
                                    </td>
                                    <td>{event.groupID}</td>
                                    <td>{event.requestStatus}</td>
                                    <td>{event.dvPayGrade}</td>
                                    <td className={styles.tdWrap}>{`${event.dvRank} ${event.dvFirstName} ${event.dvSurname}`}</td>
                                    <td>{event.parkingStalls === -1 ? 'Unavailable' : event.parkingStallName}</td>
                                    <td>
                                        <div>{event.start.format('DD MMM, YYYY')}</div>
                                        <div>{event.start.format('HHmm')}-{event.end.format('HHmm')}</div>
                                    </td>
                                    <td>
                                        <div className={styles.tdTiny}>{event.jdirVisiting}</div>
                                    </td>
                                    <td>
                                        <div className={styles.tdWrap}>{`${event.requestorRank} ${event.requestorFirstName} ${event.requestorLastName}`}</div>
                                        <div className={styles.tdEllipsis}>{`${event.requestorOffice} ${event.requestorCellPhone?.replace(/^(\(\d{3}\))(\d{3}-\d{4})$/, '$1 $2') || ''}`}</div>
                                    </td>
                                    <td>{event.dvVisiting}</td>
                                    <td>{event.editor?.title}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Pagination section */}
            <div className="d-flex justify-content-center align-items-center mt-3">
                <button className="btn btn-sm btn-secondary me-2" disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}>Prev</button>
                {pageNumbers.map((num, idx) =>
                    num === "…" ? (
                    <span key={`ellipsis-${idx}`} className="me-2">…</span>
                    ) : (
                    <button key={`page-${num}`} className={`btn btn-sm me-2 ${num === currentPage ? "btn-primary" : "btn-outline-secondary"}`} onClick={() => setCurrentPage(num as number)}>{num}</button>
                    )
                )}
                <button className="btn btn-sm btn-secondary" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}>Next</button>
            </div>
            <AssignPanel
                isPanelOpen={isPanelOpen}
                setIsPanelOpen={setIsPanelOpen}
                groupIDToDisplay={groupIDToDisplay}
                setGroupIDToDisplay={setGroupIDToDisplay}
                eventIdToDisplay={eventIdToDisplay}
                setEventIdToDisplay={setEventIdToDisplay}  
                filteredEvents={filteredEvents}
                setLoadingSpots={setLoadingSpots}
                onOpenPreview={(events) => {setPreviewGroupEvents(events); setIsCurrentPanelOpen(true);}}
                timeChangeNotice={timeChangeNotice}
                setTimeChangeNotice={setTimeChangeNotice}
                dateChangeNotice={dateChangeNotice}
                setDateChangeNotice={setDateChangeNotice}   
                setFilteredEvents={setFilteredEvents}
                onReplaceGroupEvents={replaceGroupEvents}
            />
            <EditPanel
                isEditPanelOpen={isEditPanelOpen}
                setIsEditPanelOpen={setIsEditPanelOpen}
                editGroupID={editGroupID}
                setEditGroupID={setEditGroupID}
                filteredEvents={filteredEvents}
                eventToEdit={eventToEdit}
                setFilteredEvents={setFilteredEvents}
            />
            <ChangeDatesPanel
                isChangeDatesPanelOpen={isChangeDatesPanelOpen}
                setIsChangeDatesPanelOpen={setIsChangeDatesPanelOpen}
                groupToChangeDates={groupToChangeDates}
                setGroupToChangeDates={setGroupToChangeDates}
                filteredEvents={filteredEvents}
                siteTimeZone={siteTimeZone}
                setIsPanelOpen={setIsPanelOpen}
                setDateChangeNotice={setDateChangeNotice}
                setGroupIDToDisplay={setGroupIDToDisplay}
                onReplaceGroupEvents={replaceGroupEvents}
                parkingMap={parkingMap}
                setFilteredEvents={setFilteredEvents}
            />
            <ReassignPanel
                isReassignPanelOpen={isReassignPanelOpen}
                setIsReassignPanelOpen={setIsReassignPanelOpen}
                eventToReassign={eventToReassign}
                siteTimeZone={siteTimeZone}
                setIsPanelOpen={setIsPanelOpen}
                setGroupIDToDisplay={setGroupIDToDisplay}
                setEventIdToDisplay={setEventIdToDisplay} 
                parkingMap={parkingMap}
                setTimeChangeNotice={setTimeChangeNotice}
                setFilteredEvents={setFilteredEvents}
            /> 
            <CurrentParkingPanel
                isPanelOpen={isCurrentPanelOpen}
                setIsPanelOpen={(isOpen) => { setIsCurrentPanelOpen(isOpen); if (!isOpen) setPreviewGroupEvents(null); }}
                groupIDToDisplay={groupIDToDisplay}
                eventIdToDisplay={eventIdToDisplay}
                filteredEvents={previewGroupEvents ?? filteredEvents}
            /> 
            <ConfirmDialog
                show={showConfirm}
                message={confirmConfig?.message || ""}
                onConfirm={() => {confirmConfig?.onConfirm(); setShowConfirm(false);}}
                onCancel={() => setShowConfirm(false)}
            /> 
            <AlertHost />
        </div>
    );
};

export default EventDetailsList;
import React, { FC, useState, useEffect } from 'react';
import { EventOccurrence, IEvent } from 'model';
import moment from 'moment';
import 'bootstrap/dist/css/bootstrap.min.css';
import styles from './EventDetailsList.module.scss';
import { sp } from '@pnp/sp';
import { IDropdownOption } from '@fluentui/react';
import { fetchParkingStalls, fetchBookingsForGroup, fetchBookedParkingForEvent, filterAvailableParking, formatParkingOptions, fetchFromSharePoint, fetchOccupiedParkingDetails} from './spEventDetailsList';

interface AssignPanelProps {
    isPanelOpen: boolean;
    setIsPanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
    groupIDToDisplay: number;
    setGroupIDToDisplay: React.Dispatch<React.SetStateAction<number>>;
    filteredEvents: EventOccurrence[];
    setLoadingSpots: React.Dispatch<React.SetStateAction<boolean>>;
}

export const AssignPanel: FC<AssignPanelProps> = ({ isPanelOpen, setIsPanelOpen, groupIDToDisplay, setGroupIDToDisplay, filteredEvents, setLoadingSpots }) => {
    const [parkingStallsOptions, setParkingStallsOptions] = useState<IDropdownOption[]>([]);
    const [parkingStallsOptionsEach, setParkingStallsOptionsEach] = useState<{ [key: number]: IDropdownOption[] }>({});
    const [parkingMap, setParkingMap] = useState<{ [id: number]: string }>({});
    const [selectedParkingStall, setSelectedParkingStall] = useState<string>('');
    const [individualSelections, setIndividualSelections] = useState<{ [key: string]: number }>({});
    const [panelParkingLoading, setPanelParkingLoading] = useState(false);
    const [occupiedMapByDay, setOccupiedMapByDay] = useState<{ [date: string]: { [stallId: number]: { payGrade: string; surname: string }[] } }>({});
    const [panelParkingOccupiedLoading, setPanelParkingOccupiedLoading] = useState(true);

    useEffect(() => {
        if (groupIDToDisplay !== 0) {
        loadAvailableParkingForAllEvents(groupIDToDisplay);
        }
    }, [groupIDToDisplay]);

    useEffect(() => {
        if (parkingStallsOptions.length > 0 && !selectedParkingStall) {
        const excludedIds = [35, 46, 47, -1];
        const firstAvailable = parkingStallsOptions.find(opt => !excludedIds.includes(Number(opt.key)));
        if (firstAvailable) {
            setSelectedParkingStall(firstAvailable.key.toString());
        }
        }
    }, [parkingStallsOptions]);

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

    useEffect(() => {
        if (!isPanelOpen || !groupIDToDisplay) return;
        const loadOccupied = async () => {
        setPanelParkingOccupiedLoading(true);
        const web = await sp.web.get();
        const siteUrl = web.Url;
        const dateRange = getEventDateRange(filteredEvents, groupIDToDisplay);
        const newMap: typeof occupiedMapByDay = {};
        for (const day of dateRange) {
            const start = moment(day).startOf('day');
            const end = moment(day).endOf('day');
            const occupiedDetails = await fetchOccupiedParkingDetails(siteUrl, start, end);
            const dayKey = moment(day).format('YYYY-MM-DD');
            occupiedDetails.forEach(o => {
            if (!newMap[dayKey]) newMap[dayKey] = {};
            if (!newMap[dayKey][o.parkingId]) newMap[dayKey][o.parkingId] = [];
            const alreadyExists = newMap[dayKey][o.parkingId].some(
                existing => existing.payGrade === o.payGrade && existing.surname === o.surname
            );
            if (!alreadyExists) {
                newMap[dayKey][o.parkingId].push({ payGrade: o.payGrade, surname: o.surname });
            }
            });
        }
        setOccupiedMapByDay(newMap);
        setPanelParkingOccupiedLoading(false);
        };
        loadOccupied();
    }, [isPanelOpen, groupIDToDisplay, filteredEvents]);

    const openPanel = async (groupID: number) => {
        setGroupIDToDisplay(groupID);
        setIsPanelOpen(true);
        setParkingStallsOptions([]);
        setParkingStallsOptionsEach([]);
        setPanelParkingLoading(true);
        await loadAvailableParkingForAllEvents(groupID);
        setPanelParkingLoading(false);
    };

    const closePanel = () => {
        setIsPanelOpen(false);
        setParkingStallsOptions([]);
        setParkingStallsOptionsEach([]);
    };

    const loadAvailableParkingForAllEvents = async (groupID: number) => {
    setLoadingSpots(true);
    try {
        const web = await sp.web.get();
        const siteUrl = web.Url;
        const allParking = await fetchParkingStalls(siteUrl);
        const bookingsData = await fetchBookingsForGroup(siteUrl, groupID);
        type GroupEvent = { start: moment.Moment; end: moment.Moment };
        const groupEvents: GroupEvent[] = bookingsData.d.results.map((ev: any) => ({
        start: moment(ev.EventDate),
        end: moment(ev.EndDate),
        }));
        const groupStart = moment.min(groupEvents.map(ev => ev.start));
        const groupEnd = moment.max(groupEvents.map(ev => ev.end));
        const bookedParkingIds = await fetchBookedParkingForEvent(siteUrl, groupStart, groupEnd);
        const allBookedParkingIds = new Set(bookedParkingIds);
        const availableParking = filterAvailableParking(allParking, allBookedParkingIds);

        if (availableParking.length === 0) {
        const events = filteredEvents.filter(event => event.groupID === groupID);
        for (const event of events) {
            await loadAvailableParking(event);
        }
        }
        availableParking.push({ id: -1, parking: "Unavailable" });
        const finalOptions = formatParkingOptions(availableParking);
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
        const query = `$filter=GroupID eq ${groupID}&$select=ID`;
        const data = await fetchFromSharePoint(siteUrl, 'Rob Calendar Events2', query);
        return data.d.results.map((item: any) => item.ID);
        } catch (error) {
        console.error('Error fetching event IDs by group ID:', error);
        return [];
        }
    };

    const handleAssignToAllEvents = async () => {
        setLoadingSpots(true);
        try {
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
        const itemIds = await getEventIdsByGroupId(event.groupID);
        if (itemIds.length === 0) {
            alert('No items found with the given groupID or items may have been deleted.');
            return;
        }
        for (const itemId of itemIds) {
            if (event.parkingStalls) {
            await sp.web.lists.getByTitle('Rob Calendar Events2').items.getById(itemId).update({
                ParkingStallsId: event.parkingStalls,
                RequestStatus: event.requestStatus,
            });
            } else {
            alert('Please select a valid parking stall.');
            break;
            }
        }
        } catch (error) {
        console.error('Error updating events in database:', error);
        alert('There was an error updating the events.');
        }
    };

    const loadAvailableParking = async (event: EventOccurrence) => {
        setLoadingSpots(true);
        try {
        const web = await sp.web.get();
        const siteUrl = web.Url;
        const allParking = await fetchParkingStalls(siteUrl);
        const bookedParkingIds = await fetchBookedParkingForEvent(siteUrl, event.start, event.end);
        const availableParking = filterAvailableParking(allParking, bookedParkingIds);
        const availableParkingOptions = formatParkingOptions(availableParking);
        if (availableParkingOptions.length === 0) {
            availableParkingOptions.push({ key: -1, text: "Unavailable" });
        }
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
        [eventId]: Number(selectedStall),
        }));
    };

    const updateEventInDatabase = async (eventId: number, selectedStall: number) => {
        try {
        const event = filteredEvents.find(event => event.id === eventId);
        if (!event) {
            alert('No valid event found to update.');
            return;
        }
        const itemId = event.id;
        if (!itemId) {
            alert('No valid event ID found to update.');
            return;
        }
        await sp.web.lists.getByTitle('Rob Calendar Events2').items.getById(itemId).update({
            ParkingStallsId: selectedStall,
            RequestStatus: 'Approved',
        });
        } catch (error) {
        console.error('Error updating the event in database:', error);
        alert('There was an error updating the event.');
        }
    };

    const getEventDateRange = (events: EventOccurrence[], groupID: number) => {
        const filteredEventsByGroup = events.filter((event) => event.groupID === groupID);
        if (filteredEventsByGroup.length === 0) return [];
        const startDate = moment.min(filteredEventsByGroup.map((event) => moment(event.start)));
        const endDate = moment.max(filteredEventsByGroup.map((event) => moment(event.end)));
        let currentDate = startDate.clone();
        const dateRange = [];
        while (currentDate.isBefore(endDate) || currentDate.isSame(endDate, 'day')) {
        dateRange.push(currentDate.clone());
        currentDate.add(1, 'days');
        }
        return dateRange;
    };

    return (
        <>
        {isPanelOpen && (
            <div className={styles.panel}>
            <button onClick={closePanel} className={styles.closeButton}>x</button>
            <div className={styles.flexContainer}>
                {/* Left Side */}
                <div className={styles.leftSide}>
                {(panelParkingLoading || panelParkingOccupiedLoading) ? (
                    <div></div>
                ) : (
                    getEventDateRange(filteredEvents, groupIDToDisplay).map((day) => {
                    const dayOfWeek = moment(day);
                    const dayKey = dayOfWeek.format('YYYY-MM-DD');
                    const eventsForDay = filteredEvents.filter((event) =>
                        event.groupID === groupIDToDisplay && moment(event.start).isSame(dayOfWeek, 'day')
                    );
                    return (
                        <div key={dayOfWeek.format('YYYY-MM-DD')} className={styles.dayBlock}>
                        <p>{dayOfWeek.format('DD MMM, YYYY')}</p>
                        <div style={{ display: "flex", gap: "8px" }}>
                            {eventsForDay.length > 0 ? (
                            eventsForDay.map((event) => {
                                const allStallIds = Object.keys(parkingMap).map(Number);
                                const visualOptions = parkingStallsOptionsEach[event.id] || parkingStallsOptions;
                                const availableStallIds = visualOptions.filter(opt => opt.key !== -1).map((opt) => Number(opt.key));
                                return (
                                <div key={event.id} className={styles.parkingOptionWrapper}>
                                    {allStallIds.map((stallId) => {
                                    if (availableStallIds.includes(stallId)) {
                                        const option = visualOptions.find((opt) => Number(opt.key) === stallId);
                                        return (
                                        <div key={stallId} className={styles.parkingOption}>
                                            {option?.text || parkingMap[stallId]}
                                        </div>
                                        );
                                    } else {
                                        const occupantsForDay = occupiedMapByDay[dayKey]?.[stallId] || [];
                                        if (occupantsForDay.length > 0) {
                                        return (
                                            <div key={stallId} className={styles.parkingOption + ' ' + styles.occupiedOption}>
                                            {parkingMap[stallId] || `Stall ${stallId}`}{" "}
                                            <br />
                                            <span style={{ fontSize: '0.8em' }}>
                                                {occupantsForDay.map(o => `${o.payGrade} ${o.surname}`).join(', ')}
                                            </span>
                                            </div>
                                        );
                                        } else {
                                        const option = visualOptions.find((opt) => Number(opt.key) === stallId);
                                        return (
                                            <div key={stallId} className={styles.parkingOption}>
                                            {option?.text || parkingMap[stallId]}
                                            </div>
                                        );
                                        }
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

                {/* Right Side */}
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

                {(panelParkingLoading || panelParkingOccupiedLoading) ? (
                    <div>Loading...</div>
                ) : parkingStallsOptions.filter(opt => opt.key !== -1).length > 0 ? (
                    <div className="d-flex flex-column gap-2 w-100">
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
                    <button className="btn btn-success w-100" onClick={handleAssignToAllEvents}>
                        Assign and send email
                    </button>
                    </div>
                ) : (() => {
                    const events = filteredEvents.filter(event => event.groupID === groupIDToDisplay);
                    return (
                    <>
                        {events.map(event => {
                        const options = parkingStallsOptionsEach[event.id] || [];
                        const hasUnavailable = options.some(opt => opt.key === -1);
                        const allOptions = hasUnavailable ? options : [...options, { key: -1, text: "Unavailable" }];
                        return (
                            <div key={event.id} className="d-flex align-items-center w-100 mt-3">
                            <p className="mb-0" style={{ minWidth: '100px' }}>
                                {event.start.format('DD MMM, YYYY')}:
                            </p>
                            <select
                                className="form-control" style={{ minWidth: '145px' }}
                                value={individualSelections[event.id]?.toString() || ''}
                                onChange={(e) => handleIndividualParkingChange(event.id, e.target.value)}
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
        </>
    );
};
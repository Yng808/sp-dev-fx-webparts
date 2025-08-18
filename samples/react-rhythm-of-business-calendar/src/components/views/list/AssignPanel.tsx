import React, { FC, useState, useEffect } from 'react';
import { EventOccurrence } from 'model';
import moment from 'moment';
import 'bootstrap/dist/css/bootstrap.min.css';
import styles from './EventDetailsList.module.scss';
import { sp } from '@pnp/sp';
import { IDropdownOption } from '@fluentui/react';
import { fetchParkingStalls, fetchBookedParkingForEvent, filterAvailableParking, formatParkingOptions, fetchOccupiedParkingDetails, composeEmailInBrowser} from './spEventDetailsList';
import { showAlert } from './AlertHost';
import { assignGroupEmail, noParkingAvailableEmail } from './EmailTemplate';

interface AssignPanelProps {
    isPanelOpen: boolean;
    setIsPanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
    groupIDToDisplay: number;
    setGroupIDToDisplay: React.Dispatch<React.SetStateAction<number>>;
    filteredEvents: EventOccurrence[];
    setLoadingSpots: React.Dispatch<React.SetStateAction<boolean>>;
    onOpenPreview: () => void;
}

export const AssignPanel: FC<AssignPanelProps> = ({ isPanelOpen, setIsPanelOpen, groupIDToDisplay, setGroupIDToDisplay, filteredEvents, setLoadingSpots, onOpenPreview }) => {
    const [parkingStallsOptionsEach, setParkingStallsOptionsEach] = useState<{ [key: number]: IDropdownOption[] }>({});
    const [parkingMap, setParkingMap] = useState<{ [id: number]: string }>({});
    const [individualSelections, setIndividualSelections] = useState<{ [key: string]: number }>({});
    const [panelParkingLoading, setPanelParkingLoading] = useState(false);
    const [occupiedMapByDay, setOccupiedMapByDay] = useState<{ [date: string]: { [stallId: number]: { payGrade: string; surname: string }[] } }>({});
    const [panelParkingOccupiedLoading, setPanelParkingOccupiedLoading] = useState(true);

    useEffect(() => {
        if (isPanelOpen && groupIDToDisplay !== 0) {
            setParkingStallsOptionsEach({});
            Promise.all(filteredEvents.filter(ev => ev.groupID === groupIDToDisplay).map(ev => loadAvailableParking(ev)));
        }
    }, [isPanelOpen, groupIDToDisplay]);

    useEffect(() => {
        const fetchParkingNames = async () => {
            const web = await sp.web.get();
            const siteUrl = web.Url;
            const stalls = await fetchParkingStalls(siteUrl);
            const map: { [id: number]: string } = {};
            stalls.forEach(stall => { map[stall.id] = stall.parking; });
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

    const closePanel = () => {
        setIsPanelOpen(false);
        setParkingStallsOptionsEach({});
    };

    const loadAvailableParking = async (event: EventOccurrence) => {
        setLoadingSpots(true);
        try {
            const web = await sp.web.get();
            const siteUrl = web.Url;
            const allParking = await fetchParkingStalls(siteUrl);
            const refreshed = await sp.web.lists.getByTitle('Rob Calendar Events2').items.getById(event.id).get();
            const start = moment(refreshed.EventDate);
            const end = moment(refreshed.EndDate);
            const bookedParkingIds = await fetchBookedParkingForEvent(siteUrl, start, end);
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
            showAlert('No valid event found to update.', 'warning');
            return;
        }
        const itemId = event.id;
        if (!itemId) {
            showAlert('No valid event ID found to update.', 'warning');
            return;
        }
        await sp.web.lists.getByTitle('Rob Calendar Events2').items.getById(itemId).update({
            ParkingStallsId: selectedStall,
            RequestStatus: 'Approved',
        });
        } catch (error) {
            console.error('Error updating the event in database:', error);
            showAlert('There was an error updating the event.', 'danger');
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
                                                const visualOptions = parkingStallsOptionsEach[event.id] || [];
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
                                                                <span style={{ fontSize: '0.8em', maxWidth: '80px', display: 'inline-block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
                            <h6>Assignment for: {matchedEvent?.dvPayGrade || ''} {matchedEvent?.dvSurname || ''}</h6>
                            <h6>GroupID: {matchedEvent?.groupID || ''} & Bridge: {matchedEvent?.dvVisiting || ''}</h6>
                        </>
                        );
                    })()}

                    {(panelParkingLoading || panelParkingOccupiedLoading) ? (
                        <div>Loading...</div>
                    ) : (
                        <>
                        {filteredEvents
                            .filter(event => event.groupID === groupIDToDisplay)
                            .map(event => {
                                const options = parkingStallsOptionsEach[event.id] || [];
                                const hasUnavailable = options.some(opt => opt.key === -1);
                                const allOptions = hasUnavailable ? options : [...options, { key: -1, text: "Unavailable" }];

                                return (
                                    <div key={event.id} className="d-flex align-items-center w-100 mt-3">
                                        <p className="mb-0" style={{ minWidth: '100px' }}>
                                            {event.start.format('DD MMM, YYYY')}:
                                        </p>
                                        <select className="form-control" style={{ minWidth: '145px' }} value={individualSelections[event.id]?.toString() || ''} onChange={(e) => handleIndividualParkingChange(event.id, e.target.value)}>
                                            <option value="">Select Parking</option>
                                            {allOptions.map(option => (
                                            <option key={option.key} value={option.key}>
                                                {option.text}
                                            </option>
                                            ))}
                                        </select>
                                    </div>
                                );
                            })}
                            <button className="btn btn-success mt-3 w-100" onClick={async () => {
                                const events = filteredEvents.filter(ev => ev.groupID === groupIDToDisplay);
                                const unselected = events.filter(ev => individualSelections[ev.id] === undefined || isNaN(individualSelections[ev.id]) || individualSelections[ev.id] === 0);
                                if (unselected.length > 0) {
                                showAlert(`Please select parking for all events before assigning.`, 'warning');
                                return;
                                }
                                await Promise.all(events.map(ev =>
                                    updateEventInDatabase(ev.id, individualSelections[ev.id])
                                ));
                                const updatedEvents = events.map(ev => ({
                                    ...ev,
                                    dvPayGrade: ev.dvPayGrade,
                                    dvSurname: ev.dvSurname,
                                    requestorEmail: ev.requestorEmail, 
                                    requestorRank: ev.requestorRank,   
                                    requestorLastName: ev.requestorLastName,
                                    parkingStalls: individualSelections[ev.id]
                                })) as unknown as EventOccurrence[];

                                const allUnavailable = updatedEvents.every(ev => ev.parkingStalls === -1);

                                if (allUnavailable) {
                                const email = noParkingAvailableEmail(updatedEvents);
                                composeEmailInBrowser(email.to, email.subject, email.body);
                                } else {
                                const updatedParkingMap = { ...parkingMap, [-1]: 'Unavailable' };

                                const email = assignGroupEmail(updatedEvents, updatedParkingMap);
                                composeEmailInBrowser(email.to, email.subject, email.body);
                                }

                                showAlert("All assignments completed.", 'success');
                                setIsPanelOpen(false);
                                onOpenPreview();
                            }}
                            >Assign and send email</button>
                        </>
                        )}
                    </div>
                </div>
            </div>
        )}
        </>
    );
};
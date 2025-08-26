import React, { FC, useState, useEffect } from 'react';
import { EventOccurrence } from 'model';
import moment from 'moment';
import 'bootstrap/dist/css/bootstrap.min.css';
import styles from './EventDetailsList.module.scss';
import { sp } from '@pnp/sp';
import { IDropdownOption } from '@fluentui/react';
import { fetchParkingStalls, fetchBookedParkingForEvent, filterAvailableParking, formatParkingOptions, fetchOccupiedParkingDetails, composeEmailInBrowser, OccupiedStall} from './spEventDetailsList';
import { ConfirmDialog, showAlert } from './AlertHost';
import { assignGroupEmail, noParkingAvailableEmail } from './EmailTemplate';

interface AssignPanelProps {
    isPanelOpen: boolean;
    setIsPanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
    groupIDToDisplay: number;
    setGroupIDToDisplay: React.Dispatch<React.SetStateAction<number>>;
    eventIdToDisplay?: number | undefined;
    setEventIdToDisplay?: React.Dispatch<React.SetStateAction<number | undefined>>;
    filteredEvents: EventOccurrence[];
    setLoadingSpots: React.Dispatch<React.SetStateAction<boolean>>;
    onOpenPreview: () => void;
    timeChangeNotice?: string | undefined; 
    setTimeChangeNotice?: (notice: string | undefined) => void;
    dateChangeNotice?: string | undefined;
    setDateChangeNotice?: (notice: string | undefined) => void;
}

export const AssignPanel: FC<AssignPanelProps> = ({ isPanelOpen, setIsPanelOpen, groupIDToDisplay, setGroupIDToDisplay, eventIdToDisplay, setEventIdToDisplay, filteredEvents, setLoadingSpots, onOpenPreview, timeChangeNotice, setTimeChangeNotice, dateChangeNotice, setDateChangeNotice }) => {
    const [parkingStallsOptionsEach, setParkingStallsOptionsEach] = useState<{ [key: number]: IDropdownOption[] }>({});
    const [parkingMap, setParkingMap] = useState<{ [id: number]: string }>({});
    const [individualSelections, setIndividualSelections] = useState<{ [key: string]: number }>({});
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [panelParkingLoading, setPanelParkingLoading] = useState(false);
    const [occupiedMapByDay, setOccupiedMapByDay] = useState<{ [date: string]: { [stallId: number]: OccupiedStall[] }}>({});
    const [panelParkingOccupiedLoading, setPanelParkingOccupiedLoading] = useState(true);
    const [showConfirm, setShowConfirm] = useState(false);

    const targetEvents = eventIdToDisplay ? filteredEvents.filter(ev => ev.id === eventIdToDisplay) : filteredEvents.filter(ev => ev.groupID === groupIDToDisplay && ev.requestStatus !== "Cancelled");

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

    const getEventDateRange = () => {
        if (targetEvents.length === 0) return [];
        const startDate = moment.min(targetEvents.map((event) => moment(event.start)));
        const endDate = moment.max(targetEvents.map((event) => moment(event.end)));
        const currentDate = startDate.clone();
        const dateRange = [];
        while (currentDate.isBefore(endDate) || currentDate.isSame(endDate, 'day')) {
            dateRange.push(currentDate.clone());
            currentDate.add(1, 'days');
        }
        return dateRange;
    };

    useEffect(() => {
        if (isPanelOpen && targetEvents.length > 0) {
            setParkingStallsOptionsEach({});
            Promise.all(targetEvents.map(ev => loadAvailableParking(ev)));
        }
    }, [isPanelOpen, groupIDToDisplay, eventIdToDisplay]);

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
        if (!isPanelOpen || targetEvents.length === 0) return;
        const loadOccupied = async () => {
        setPanelParkingOccupiedLoading(true);
        const web = await sp.web.get();
        const siteUrl = web.Url;
        const dateRange = getEventDateRange();
        const newMap: typeof occupiedMapByDay = {};
        for (const day of dateRange) {
            const start = moment(day).startOf('day');
            const end = moment(day).endOf('day');
            const occupiedDetails = await fetchOccupiedParkingDetails(siteUrl, start, end);
            const dayKey = moment(day).format('YYYY-MM-DD');
            occupiedDetails.forEach(o => {
            if (!newMap[dayKey]) newMap[dayKey] = {};
            if (!newMap[dayKey][o.parkingId]) newMap[dayKey][o.parkingId] = [];

            const overlap = moment(o.start).isBefore(end) && moment(o.end).isAfter(start);

            if (overlap) {
                const alreadyExists = newMap[dayKey][o.parkingId].some(
                    existing => existing.rank === o.rank && existing.surname === o.surname && existing.start === o.start && existing.end === o.end
                );
                if (!alreadyExists) {
                    newMap[dayKey][o.parkingId].push({ parkingId: o.parkingId, rank: o.rank, surname: o.surname, start: o.start, end: o.end });
                }
            }
            });
        }
            setOccupiedMapByDay(newMap);
            setPanelParkingOccupiedLoading(false);
        };
        loadOccupied();
    }, [isPanelOpen, groupIDToDisplay, eventIdToDisplay, filteredEvents]);

    const closePanel = () => {
        setShowConfirm(true);
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

    return (
        <>
        {isPanelOpen && (
            <div className={styles.panel}>
                <button onClick={closePanel} className={styles.closeButton}>x</button>
                <div className={styles.flexContainer}>
                    {/* Left Side */}
                    <div className={styles.leftSide}>
                        {(panelParkingLoading || panelParkingOccupiedLoading) ? (
                            <div/>
                        ) : (
                            getEventDateRange().map((day) => {
                                const dayOfWeek = moment(day);
                                const dayKey = dayOfWeek.format('YYYY-MM-DD');
                                const eventsForDay = targetEvents.filter((event) =>
                                    moment(event.start).isSame(dayOfWeek, 'day')
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
                                                        const eventStart = moment(event.start);
                                                        const eventEnd = moment(event.end);

                                                        const occupantsForDay = (occupiedMapByDay[dayKey]?.[stallId] || []).filter(
                                                            o =>
                                                                moment(o.start).isBefore(eventEnd) &&
                                                                moment(o.end).isAfter(eventStart)
                                                        );
                                                        if (occupantsForDay.length > 0) {
                                                        return (
                                                            <div key={stallId} className={styles.parkingOption + ' ' + styles.occupiedOption}>
                                                                {parkingMap[stallId] || `Stall ${stallId}`}{" "}
                                                                <br />
                                                                <span style={{ fontSize: '0.8em', maxWidth: '80px', display: 'inline-block' }}>
                                                                    {occupantsForDay.map((o, idx) => (
                                                                        <div key={idx} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
                                                                        {o.rank} <br />
                                                                        {o.surname}
                                                                        </div>
                                                                    ))}
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
                        const matchedEvent = targetEvents[0];
                        return (
                        <>
                            <h6>Assignment for: {matchedEvent?.dvPayGrade || ''} {matchedEvent?.dvSurname || ''}</h6>
                            <h6>GroupID: {matchedEvent?.groupID || ''} _ Bridge: {matchedEvent?.dvVisiting || ''}</h6>
                        </>
                        );
                    })()}

                    {(panelParkingLoading || panelParkingOccupiedLoading) ? (
                        <div>Loading...</div>
                    ) : (
                        <>
                        {targetEvents.map(event => {
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
                                const unselected = targetEvents.filter(ev => individualSelections[ev.id] === undefined || isNaN(individualSelections[ev.id]) || individualSelections[ev.id] === 0);
                                if (unselected.length > 0) {
                                showAlert(`Please select parking for all events before assigning.`, 'warning');
                                return;
                                }
                                await Promise.all(targetEvents.map(ev =>
                                    updateEventInDatabase(ev.id, individualSelections[ev.id])
                                ));
                                const updatedEvents = targetEvents.map(ev => ({
                                    ...ev,
                                    dvRank: ev.dvRank,
                                    dvSurname: ev.dvSurname,
                                    requestorEmail: ev.requestorEmail, 
                                    requestorRank: ev.requestorRank,   
                                    requestorLastName: ev.requestorLastName,
                                    parkingStalls: individualSelections[ev.id],
                                    start: ev.start.clone(),
                                    end: ev.end.clone()
                                })) as unknown as EventOccurrence[];

                                const allUnavailable = updatedEvents.every(ev => ev.parkingStalls === -1);

                                if (allUnavailable) {
                                const email = noParkingAvailableEmail(updatedEvents);
                                composeEmailInBrowser(email.to, email.subject, email.body);
                                } else {
                                const updatedParkingMap = { ...parkingMap, [-1]: 'Unavailable' };

                                const email = assignGroupEmail(updatedEvents, updatedParkingMap, timeChangeNotice || undefined, dateChangeNotice || undefined );
                                composeEmailInBrowser(email.to, email.subject, email.body);
                                }

                                if (setTimeChangeNotice) {
                                    setTimeChangeNotice(null);
                                }
                                if (setDateChangeNotice) {
                                    setDateChangeNotice(null);
                                }

                                showAlert("All assignments completed.", 'success');
                                setIsPanelOpen(false);
                                setEventIdToDisplay?.(null);
                                onOpenPreview();
                            }}
                            >Assign and send email</button>
                        </>
                        )}
                    </div>
                    <ConfirmDialog
                        show={showConfirm}
                        message="Are you sure you want to stop the assignment process?"
                        onConfirm={() => { setShowConfirm(false); setIsPanelOpen(false); setParkingStallsOptionsEach({}); setEventIdToDisplay?.(null);}}
                        onCancel={() => { setShowConfirm(false); }}
                    />
                </div>
            </div>
        )}
        </>
    );
};
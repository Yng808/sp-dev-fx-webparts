import React, { FC, useState, useEffect } from 'react';
import moment from 'moment';
import styles from './EventDetailsList.module.scss';
import { sp } from '@pnp/sp';
import { EventOccurrence } from 'model';
import { fetchParkingStalls, fetchOccupiedParkingDetails } from './spEventDetailsList';

interface CurrentParkingPanelProps {
    isPanelOpen: boolean;
    setIsPanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
    groupIDToDisplay: number;
    filteredEvents: EventOccurrence[];
}

export const CurrentParkingPanel: FC<CurrentParkingPanelProps> = ({ isPanelOpen, setIsPanelOpen, groupIDToDisplay, filteredEvents }) => {
    const [parkingMap, setParkingMap] = useState<{ [id: number]: string }>({});
    const [occupiedMapByDay, setOccupiedMapByDay] = useState<{ [date: string]: { [stallId: number]: { payGrade: string; surname: string }[] } }>({});
    const [panelParkingOccupiedLoading, setPanelParkingOccupiedLoading] = useState(true);

    const getEventDateRange = (events: EventOccurrence[], groupID: number) => {
        const filtered = events.filter((event) => event.groupID === groupID && event.requestStatus !== "Cancelled");
        if (filtered.length === 0) return [];
        const startDate = moment.min(filtered.map((event) => moment(event.start)));
        const endDate = moment.max(filtered.map((event) => moment(event.end)));
        const range = [];
        let current = startDate.clone();
        while (current.isSameOrBefore(endDate, 'day')) {
            range.push(current.clone());
            current.add(1, 'day');
        }
        return range;
    };

    useEffect(() => {
        if (!isPanelOpen || !groupIDToDisplay) return;

        const loadData = async () => {
            setPanelParkingOccupiedLoading(true);
            const web = await sp.web.get();
            const siteUrl = web.Url;

            // Load stall names
            const stalls = await fetchParkingStalls(siteUrl);
            const map: { [id: number]: string } = {};
            stalls.forEach(stall => {
                map[stall.id] = stall.parking;
            });
            setParkingMap(map);

            // Load occupied stalls by day
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
                    newMap[dayKey][o.parkingId].push({ payGrade: o.payGrade, surname: o.surname });
                });
            }
            setOccupiedMapByDay(newMap);
            setPanelParkingOccupiedLoading(false);
        };

        loadData();
    }, [isPanelOpen, groupIDToDisplay, filteredEvents]);

    if (!isPanelOpen) return null;

    return (
        <div className={styles.panel}>
            <button onClick={() => setIsPanelOpen(false)} className={styles.closeButton}>x</button>
            <div className={styles.flexContainer}>
                {/* Only the Left Side */}
                <div className={styles.leftSide}>
                    {panelParkingOccupiedLoading ? (
                        <div>Loading...</div>
                    ) : (
                        getEventDateRange(filteredEvents, groupIDToDisplay).map((day) => {
                            const dayOfWeek = moment(day);
                            const dayKey = dayOfWeek.format('YYYY-MM-DD');
                            const eventsForDay = filteredEvents.filter(
                                (event) => event.groupID === groupIDToDisplay && event.requestStatus !== "Cancelled" && moment(event.start).isSame(dayOfWeek, 'day')
                            );
                            return (
                                // Render a block for each day of the schedule
                                <div key={dayKey} className={styles.dayBlock}>
                                    <p>{dayOfWeek.format('DD MMM, YYYY')}</p>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        {eventsForDay.length > 0 ? (
                                            eventsForDay.map((event) => {
                                                return (
                                                    // Wrapper for the event’s parking options
                                                    <div key={event.id} className={styles.parkingOptionWrapper}>
                                                        {Object.keys(parkingMap).map(stallIdStr => {
                                                            const stallId = Number(stallIdStr);
                                                            const occupantsForDay = occupiedMapByDay[dayKey]?.[stallId] || [];
                                                            // If the stall is occupied, render it with occupant info
                                                            if (occupantsForDay.length > 0) {
                                                                return (
                                                                    <div key={stallId} className={`${styles.parkingOption} ${styles.occupiedOption}`}>
                                                                        {parkingMap[stallId] || `Stall ${stallId}`}<br />
                                                                        <span style={{ fontSize: '0.8em' }}>
                                                                            {occupantsForDay.map(o => `${o.payGrade} ${o.surname}`).join(', ')}
                                                                        </span>
                                                                    </div>
                                                                );
                                                            }
                                                            // If the stall is not occupied, render it as available
                                                            return (
                                                                <div key={stallId} className={styles.parkingOption}>
                                                                    {parkingMap[stallId] || `Stall ${stallId}`}
                                                                </div>
                                                            );
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
            </div>
        </div>
    );
};
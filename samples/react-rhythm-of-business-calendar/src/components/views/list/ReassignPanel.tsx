import React, { useState, useEffect } from 'react';
import moment from 'moment-timezone';
import styles from './EventDetailsList.module.scss';
import { sp } from '@pnp/sp';
import { EventOccurrence } from 'model';
import { showAlert } from './AlertHost';
import { buildTimeChangeNotice } from './EmailTemplate';

interface Props {
    isReassignPanelOpen: boolean;
    setIsReassignPanelOpen: (open: boolean) => void;
    eventToReassign: EventOccurrence | undefined;
    siteTimeZone: any;
    setIsPanelOpen: (open: boolean) => void;
    setGroupIDToDisplay: (id: number) => void;
    setEventIdToDisplay: (id: number | undefined) => void;
    parkingMap: { [id: number]: string };
    setTimeChangeNotice: (notice: string | undefined) => void;
    setFilteredEvents: React.Dispatch<React.SetStateAction<EventOccurrence[]>>;
}

export const ReassignPanel: React.FC<Props> = ({ isReassignPanelOpen, setIsReassignPanelOpen, eventToReassign, siteTimeZone, setIsPanelOpen, setGroupIDToDisplay, setEventIdToDisplay, setTimeChangeNotice, setFilteredEvents }) => {
    const [reassignStart, setReassignStart] = useState('');
    const [reassignEnd, setReassignEnd] = useState('');

    useEffect(() => {
        if (eventToReassign) {
        setReassignStart(eventToReassign.start.format('HH:mm'));
        setReassignEnd(eventToReassign.end.format('HH:mm'));
        }
    }, [eventToReassign]);

    const handleReassignSave = async () => {
        if (!eventToReassign) return;

        const eventDate = eventToReassign.start.format('YYYY-MM-DD');
        const endDate = eventToReassign.end.format('YYYY-MM-DD');
        const startDateTime = `${eventDate}T${reassignStart}`;
        const endDateTime = `${endDate}T${reassignEnd}`;
        const newStart = moment.tz(startDateTime, siteTimeZone.momentId);
        const newEnd = moment.tz(endDateTime, siteTimeZone.momentId);

        if (!newEnd.isAfter(newStart)) {
            showAlert('End time must be after start time.', 'warning');
            return;
        }

        try {
            await sp.web.lists.getByTitle('Rob Calendar Events2').items.getById(eventToReassign.id).update({
                EventDate: newStart.format('YYYY-MM-DDTHH:mm:ss'),
                EndDate: newEnd.format('YYYY-MM-DDTHH:mm:ss'),
                RequestStatus: 'New',
                ParkingStallsId: null,
                ParkingStallName: ""
            });

            setFilteredEvents(prev =>
                prev.map(ev => {
                    if (ev.id !== eventToReassign.id) return ev;

                    const updatedEvent = Object.assign(Object.create(Object.getPrototypeOf(ev.event)), ev.event);
                    return new EventOccurrence(updatedEvent, newStart, newEnd);
                })
            );

            showAlert('Event time updated. Please reassign parking.', 'success');
            setIsReassignPanelOpen(false);
            setTimeChangeNotice(buildTimeChangeNotice(eventToReassign, newStart, newEnd));
            setGroupIDToDisplay(eventToReassign.groupID);
            setEventIdToDisplay(eventToReassign.id); 
            setIsPanelOpen(true);
        } catch (err) {
            console.error(err);
            showAlert('Failed to re-assign event.', 'danger');
        }
    };

    if (!isReassignPanelOpen || !eventToReassign) return null;

    return (
        <div className={styles.panel}>
            <button onClick={() => setIsReassignPanelOpen(false)} className={styles.closeButton}>x</button>
            <div className={styles.flexContainer}>
                <div>
                    <h6>New Start Time: <input type="time" className="form-control" value={reassignStart} onChange={e => setReassignStart(e.target.value)}/></h6>
                    <h6>New End Time:   <input type="time" className="form-control" value={reassignEnd} onChange={e => setReassignEnd(e.target.value)}/></h6>
                    <button className="btn btn-success mt-2 w-100" onClick={handleReassignSave}>Save Changes</button>
                </div>
                <div>
                    <h6>GroupID:        {eventToReassign.groupID}</h6>
                    <h6>Assignment for: {eventToReassign.dvPayGrade} {eventToReassign.dvSurname}</h6>
                    <h6>Date:           {eventToReassign.start.format('DD MMM, YYYY')}</h6>
                </div>
            </div>
        </div>
    );
};
import React, { FC, useState, useEffect } from 'react';
import moment from 'moment-timezone';
import styles from './EventDetailsList.module.scss';
import { EventOccurrence } from 'model';
import { sp } from '@pnp/sp';
import { fetchBookedParkingForEvent } from './spEventDetailsList';
import { showAlert } from './AlertHost';

interface ChangeDatesPanelProps {
    isChangeDatesPanelOpen: boolean;
    setIsChangeDatesPanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
    groupToChangeDates: number | null;
    setGroupToChangeDates: React.Dispatch<React.SetStateAction<number | null>>;
    filteredEvents: EventOccurrence[];
    siteTimeZone: { momentId: string };
    setIsPanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
    setGroupIDToDisplay: React.Dispatch<React.SetStateAction<number>>;
}

export const ChangeDatesPanel: FC<ChangeDatesPanelProps> = ({ isChangeDatesPanelOpen, setIsChangeDatesPanelOpen, groupToChangeDates, setGroupToChangeDates, filteredEvents, siteTimeZone, setIsPanelOpen, setGroupIDToDisplay }) => {
    const [changeStartDate, setChangeStartDate] = useState('');
    const [changeEndDate, setChangeEndDate] = useState('');

    useEffect(() => {
        if (groupToChangeDates) {
            const groupEvents = filteredEvents.filter(e => e.groupID === groupToChangeDates);
            groupEvents.sort((a, b) => moment(a.start).diff(moment(b.start)));
            const start = groupEvents.length ? groupEvents[0].start.format('YYYY-MM-DD') : '';
            const end = groupEvents.length ? groupEvents[groupEvents.length - 1].end.format('YYYY-MM-DD') : '';
            setChangeStartDate(start);
            setChangeEndDate(end);
        }
    }, [groupToChangeDates, filteredEvents]);

    const handleChangeDatesSave = async () => {
        if (!groupToChangeDates || !changeStartDate || !changeEndDate) return;

        const web = await sp.web.get();
        const siteUrl = web.Url;

        const groupEvents = filteredEvents
            .filter(ev => ev.groupID === groupToChangeDates)
            .sort((a, b) => moment(a.start).diff(b.start));

        const newDates: string[] = [];
        let curr = moment(changeStartDate);
        const end = moment(changeEndDate);
        while (curr.isSameOrBefore(end, "day")) {
            newDates.push(curr.format("YYYY-MM-DD"));
            curr.add(1, "day");
        }

        const minCount = Math.min(groupEvents.length, newDates.length);

        let anyConflicts = false;
        // Update existing events to match new dates
        for (let i = 0; i < minCount; i++) {
            const origEvent = groupEvents[i];
            const newDate = newDates[i];
            const origStartTime = origEvent.start.format('HH:mm:ss');
            const origEndTime = origEvent.end.format('HH:mm:ss');
            const newStart = moment.tz(`${newDate}T${origStartTime}`, siteTimeZone.momentId);
            const newEnd = moment.tz(`${newDate}T${origEndTime}`, siteTimeZone.momentId);
            const parkingId = origEvent.parkingStalls;
            // Case 1 Event is new or has no parking assigned — just update date and mark as "New"
            if (origEvent.requestStatus === "New" || !parkingId || parkingId === -1) {
                await sp.web.lists.getByTitle('Rob Calendar Events2').items.getById(origEvent.id).update({
                    EventDate: newStart.format('YYYY-MM-DDTHH:mm:ss'),
                    EndDate: newEnd.format('YYYY-MM-DDTHH:mm:ss'),
                    RequestStatus: 'New'
                });
                continue;
            }

            const web = await sp.web.get();
            const siteUrl = web.Url;
            const bookedParkingSet = await fetchBookedParkingForEvent(siteUrl, newStart, newEnd,  origEvent.id);
            // Case 2 Parking stall is available — update event and approve
            if (!bookedParkingSet.has(parkingId)) {
                await sp.web.lists.getByTitle('Rob Calendar Events2').items.getById(origEvent.id).update({
                    EventDate: newStart.format('YYYY-MM-DDTHH:mm:ss'),
                    EndDate: newEnd.format('YYYY-MM-DDTHH:mm:ss'),
                    RequestStatus: 'Approved'
                });
            } else /* Case 3 Parking stall is taken — clear stall, set to "New", open assign panel */ {
                await sp.web.lists.getByTitle('Rob Calendar Events2').items.getById(origEvent.id).update({
                    EventDate: newStart.format('YYYY-MM-DDTHH:mm:ss'),
                    EndDate: newEnd.format('YYYY-MM-DDTHH:mm:ss'),
                    ParkingStallsId: null,
                    RequestStatus: 'New'
                });
                anyConflicts = true;
                setIsChangeDatesPanelOpen(false);
                setGroupIDToDisplay(origEvent.groupID);
                setIsPanelOpen(true);
                showAlert(`Parking for one or more events is not available at the new date. Please reassign parking.`, 'warning');
                return;
            }
        }
        // Add new events if date range is extended
        if (newDates.length > groupEvents.length) {
            const templateEvent = groupEvents[0];
            for (let i = groupEvents.length; i < newDates.length; i++) {
                const newDate = newDates[i];
                const origStartTime = templateEvent.start.format('HH:mm:ss');
                const origEndTime = templateEvent.end.format('HH:mm:ss');
                const newStart = moment.tz(`${newDate}T${origStartTime}`, siteTimeZone.momentId);
                const newEnd = moment.tz(`${newDate}T${origEndTime}`, siteTimeZone.momentId);

                let newRequestStatus = 'New';
                let newParkingStallId: number | null = null;
                let hasConflict = false;
                
                if (templateEvent.parkingStalls && templateEvent.parkingStalls !== -1) {
                    const bookedParkingSet = await fetchBookedParkingForEvent(siteUrl, newStart, newEnd, null);
                    if (!bookedParkingSet.has(templateEvent.parkingStalls)) {
                        newParkingStallId = templateEvent.parkingStalls;
                        newRequestStatus = 'Approved';
                    } else {
                        hasConflict = true;
                    }
                }

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
                    ParkingStallsId: newParkingStallId,
                    RequestStatus: newRequestStatus,
                    EventDate: newStart.format('YYYY-MM-DDTHH:mm:ss'),
                    EndDate: newEnd.format('YYYY-MM-DDTHH:mm:ss')
                });

                if (hasConflict) {
                    anyConflicts = true;
                    setIsChangeDatesPanelOpen(false);
                    setGroupIDToDisplay(templateEvent.groupID);
                    setIsPanelOpen(true);
                    showAlert(`Parking not available for new date(s). Please assign stall(s).`, 'warning');
                }
            }
        }
        // Cancel extra events if date range is shortened
        if (groupEvents.length > newDates.length) {
            for (let i = newDates.length; i < groupEvents.length; i++) {
                const ev = groupEvents[i];
                await sp.web.lists.getByTitle('Rob Calendar Events2').items.getById(ev.id).update({
                    RequestStatus: 'Cancelled'
                });
            }
        }
        // Show success message only if no conflicts occurred
        if (!anyConflicts) {
        showAlert('Group events successfully updated!', 'success');
        setIsChangeDatesPanelOpen(false);
        setGroupToChangeDates(null);
        }
    };

    if (!isChangeDatesPanelOpen) return null;

    return (
        <div className={styles.panel}>
            <button onClick={() => setIsChangeDatesPanelOpen(false)} className={styles.closeButton}>x</button>
            <div className={styles.flexContainer}>
                {/* Left side */}
                <div>
                    <h6>
                        New Start Date:
                        <input type="date" className="form-control" value={changeStartDate} onChange={e => setChangeStartDate(e.target.value)}/>
                    </h6>
                    <h6>
                        New End Date:
                        <input type="date" className="form-control" value={changeEndDate} onChange={e => setChangeEndDate(e.target.value)}/>
                    </h6>
                    <button className="btn btn-success mt-2 w-100" onClick={handleChangeDatesSave}>
                        Save Changes
                    </button>
                </div>

                {/* Right side */}
                <div>
                    {(() => {
                        const groupEvents = filteredEvents.filter(e => e.groupID === groupToChangeDates);
                        if (!groupEvents.length) {
                            return <h6>No events found for this group.</h6>;
                        }
                        groupEvents.sort((a, b) => a.start.diff(b.start));
                        const first = groupEvents[0];
                        const last = groupEvents[groupEvents.length - 1];
                        
                        return (
                            <>
                                <h6>GroupID: {first.groupID || ''} & Bridge: {first.dvVisiting || ''}</h6>
                                <h6>Assignment for: {first.dvPayGrade || 'N/A'} {first.dvSurname || ''}</h6>
                                <h6>Dates: {first.start.format('DD MMM, YYYY')} - {last.end.format('DD MMM, YYYY')}</h6>
                            </>
                        );
                    })()}
                </div>
            </div>
        </div>
    );
};
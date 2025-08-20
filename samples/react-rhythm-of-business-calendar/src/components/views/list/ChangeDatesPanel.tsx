import React, { FC, useState, useEffect } from 'react';
import moment from 'moment-timezone';
import styles from './EventDetailsList.module.scss';
import { EventOccurrence } from 'model';
import { sp } from '@pnp/sp';
import { mapSharePointItemToEventOccurrence } from './spEventDetailsList';
import { showAlert } from './AlertHost';
import { buildDateChangeNotice } from './EmailTemplate';

interface ChangeDatesPanelProps {
    isChangeDatesPanelOpen: boolean;
    setIsChangeDatesPanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
    groupToChangeDates: number | null;
    setGroupToChangeDates: React.Dispatch<React.SetStateAction<number | null>>;
    filteredEvents: EventOccurrence[];
    siteTimeZone: { momentId: string };
    setDateChangeNotice: (notice: string | null) => void;
    setIsPanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
    setGroupIDToDisplay: React.Dispatch<React.SetStateAction<number>>;
    onReplaceGroupEvents: (groupId: number, updated: EventOccurrence[]) => void;
    parkingMap: { [id: number]: string };
}

export const ChangeDatesPanel: FC<ChangeDatesPanelProps> = ({ isChangeDatesPanelOpen, setIsChangeDatesPanelOpen, groupToChangeDates, setGroupToChangeDates, filteredEvents, siteTimeZone, setDateChangeNotice, setIsPanelOpen, setGroupIDToDisplay, onReplaceGroupEvents }) => {
    const [changeStartDate, setChangeStartDate] = useState('');
    const [changeEndDate, setChangeEndDate] = useState('');

    useEffect(() => {
        if (groupToChangeDates) {
            const groupEvents = filteredEvents.filter(e => e.groupID === groupToChangeDates && e.requestStatus !== "Cancelled");
            groupEvents.sort((a, b) => moment(a.start).diff(moment(b.start)));
            const start = groupEvents.length ? groupEvents[0].start.format('YYYY-MM-DD') : '';
            const end = groupEvents.length ? groupEvents[groupEvents.length - 1].end.format('YYYY-MM-DD') : '';
            setChangeStartDate(start);
            setChangeEndDate(end);
        }
    }, [groupToChangeDates, filteredEvents]);

    const handleChangeDatesSave = async () => {
        if (!groupToChangeDates || !changeStartDate || !changeEndDate) return;

        const startDateMoment = moment(changeStartDate, 'YYYY-MM-DD');
        const endDateMoment = moment(changeEndDate, 'YYYY-MM-DD');
 
        if (endDateMoment.isBefore(startDateMoment)) {
            showAlert('End date cannot be before start date.', 'warning');
            return;
        }

        const web = await sp.web.get();
        const siteUrl = web.Url;

        // group events (from props) in date order
        const groupEvents = filteredEvents
            .filter(ev => ev.groupID === groupToChangeDates)
            .sort((a, b) => a.start.diff(b.start));

        if (!groupEvents.length) {
            showAlert('No events found for this group.', 'warning');
            return;
        }

        // build full date list
        const newDates: string[] = [];
        for (let cur = moment(changeStartDate); cur.isSameOrBefore(moment(changeEndDate), 'day'); cur.add(1, 'day')) {
            newDates.push(cur.format('YYYY-MM-DD'));
        }

        // map existing events by date
        const eventMap = new Map<string, EventOccurrence>();
        groupEvents.forEach(ev => eventMap.set(ev.start.format('YYYY-MM-DD'), ev));

        const templateEvent = groupEvents[0];

        // Update or add events for new range
        for (const newDate of newDates) {
            const origEvent = eventMap.get(newDate);
            const origStartTime = templateEvent.start.format('HH:mm:ss');
            const origEndTime = templateEvent.end.format('HH:mm:ss');
            const newStart = moment.tz(`${newDate}T${origStartTime}`, siteTimeZone.momentId);
            const newEnd = moment.tz(`${newDate}T${origEndTime}`, siteTimeZone.momentId);

            if (origEvent) {
                // Always reset to New and clear parking
                await sp.web.lists.getByTitle('Rob Calendar Events2').items.getById(origEvent.id).update({
                    EventDate: newStart.format('YYYY-MM-DDTHH:mm:ss'),
                    EndDate: newEnd.format('YYYY-MM-DDTHH:mm:ss'),
                    ParkingStallsId: null,
                    RequestStatus: 'New'
                });
            } else {
                // Add new event with New + no stall
                await sp.web.lists.getByTitle('Rob Calendar Events2').items.add({
                    Title: templateEvent.title || 'Event', GroupID: templateEvent.groupID, DVPayGrade: templateEvent.dvPayGrade, DVRank: templateEvent.dvRank, DVFirstName: templateEvent.dvFirstName, DVSurname: templateEvent.dvSurname, JDIRVisiting: templateEvent.jdirVisiting, DVVisiting: templateEvent.dvVisiting, RequestorRank: templateEvent.requestorRank, RequestorFirstName: templateEvent.requestorFirstName, RequestorLastName: templateEvent.requestorLastName, RequestorOffice: templateEvent.requestorOffice, RequestorDutyPhone: templateEvent.requestorDutyPhone, RequestorCellPhone: templateEvent.requestorCellPhone, RequestorEmail: templateEvent.requestorEmail,
                    ParkingStallsId: null,
                    RequestStatus: 'New',
                    EventDate: newStart.format('YYYY-MM-DDTHH:mm:ss'),
                    EndDate: newEnd.format('YYYY-MM-DDTHH:mm:ss')
                });
            }
        }

        // cancel anything outside the new range
        for (const ev of groupEvents) {
            const evDate = ev.start.format('YYYY-MM-DD');
            if (!newDates.includes(evDate)) {
                await sp.web.lists.getByTitle('Rob Calendar Events2').items.getById(ev.id).update({
                    RequestStatus: 'Cancelled'
                });
            }
        }

        // Refresh group's events from SP and push to parent so AssignPanel sees them
        const resp = await fetch(
            `${siteUrl}/_api/web/lists/getbytitle('Rob Calendar Events2')/items?$select=*` +
            `&$filter=GroupID eq ${templateEvent.groupID}`,
            { headers: { Accept: 'application/json;odata=verbose' } }
        );
        const json = await resp.json();
        const updatedGroup = (json.d.results as any[]).map(mapSharePointItemToEventOccurrence);

        onReplaceGroupEvents(templateEvent.groupID, updatedGroup);
        const oldStart = groupEvents[0].start.clone();
        const oldEnd = groupEvents[groupEvents.length - 1].end.clone();

        const prevRange = oldStart.isSame(oldEnd, 'day') ? oldStart.format('DD MMM, YYYY') : `${oldStart.format('DD MMM, YYYY')} - ${oldEnd.format('DD MMM, YYYY')}`;
        const newRange = startDateMoment.isSame(endDateMoment, 'day') ? startDateMoment.format('DD MMM, YYYY') : `${startDateMoment.format('DD MMM, YYYY')} - ${endDateMoment.format('DD MMM, YYYY')}`;
 
        setDateChangeNotice(buildDateChangeNotice(prevRange, newRange));

        setIsChangeDatesPanelOpen(false);
        setGroupIDToDisplay(templateEvent.groupID);
        setIsPanelOpen(true);
        showAlert(`Dates updated. Please assign parking.`, 'warning');
    };

    if (!isChangeDatesPanelOpen) return null;

    return (
        <div className={styles.panel}>
            <button onClick={() => setIsChangeDatesPanelOpen(false)} className={styles.closeButton}>x</button>
            <div className={styles.flexContainer}>
                {/* Left side */}
                <div>
                    <h6>New Start Date: <input type="date" className="form-control" value={changeStartDate} onChange={e => setChangeStartDate(e.target.value)}/></h6>
                    <h6>New End Date:   <input type="date" className="form-control" value={changeEndDate} onChange={e => setChangeEndDate(e.target.value)}/></h6>
                    <button className="btn btn-success mt-2 w-100" onClick={handleChangeDatesSave}>Save Changes</button>
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
import React, { FC, useState, useEffect } from 'react';
import styles from './EventDetailsList.module.scss';
import { EventOccurrence } from 'model';
import { sp } from '@pnp/sp';
import { showAlert } from './AlertHost';
import { fieldsChangedEmail } from './EmailTemplate';
import { composeEmailInBrowser } from './spEventDetailsList';
import { EmailSettingsContext } from '../../shared/EmailSettingsContext';

interface EditPanelProps {
    isEditPanelOpen: boolean;
    setIsEditPanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
    editGroupID: number | undefined;
    setEditGroupID: React.Dispatch<React.SetStateAction<number | undefined>>;
    filteredEvents: EventOccurrence[];
    setFilteredEvents: React.Dispatch<React.SetStateAction<EventOccurrence[]>>;
    eventToEdit: EventOccurrence | undefined;
}

export const EditPanel: FC<EditPanelProps> = ({ isEditPanelOpen, setIsEditPanelOpen, editGroupID, setEditGroupID, filteredEvents, setFilteredEvents, eventToEdit }) => {
    const emailSettings = React.useContext(EmailSettingsContext);
    const [editFields, setEditFields] = useState({ dvPayGrade: '', dvRank: '', dvFirstName: '', dvSurname: '', jdirVisiting: '', dvVisiting: '', requestorRank: '', requestorFirstName: '', requestorLastName: '', requestorOffice: '', requestorDutyPhone: '', requestorCellPhone: '', requestorEmail: '' });

    useEffect(() => {
        if (eventToEdit) {
            setEditFields({ dvPayGrade: eventToEdit.dvPayGrade ?? '', dvRank: eventToEdit.dvRank ?? '', dvFirstName: eventToEdit.dvFirstName ?? '', dvSurname: eventToEdit.dvSurname ?? '', jdirVisiting: eventToEdit.jdirVisiting ?? '', dvVisiting: eventToEdit.dvVisiting ?? '', requestorRank: eventToEdit.requestorRank ?? '', requestorFirstName: eventToEdit.requestorFirstName ?? '', requestorLastName: eventToEdit.requestorLastName ?? '', requestorOffice: eventToEdit.requestorOffice ?? '', requestorDutyPhone: eventToEdit.requestorDutyPhone ?? '', requestorCellPhone: eventToEdit.requestorCellPhone ?? '', requestorEmail: eventToEdit.requestorEmail ?? '' });
        }
    }, [eventToEdit]);

    const handleEditSave = async () => {
        if (!editGroupID) return;

        const eventsToUpdate = filteredEvents.filter(ev => ev.groupID === editGroupID);

        const fieldMap: { [key: string]: string } = { dvPayGrade: 'DVPayGrade', dvRank: 'DVRank', dvFirstName: 'DVFirstName', dvSurname: 'DVSurname', jdirVisiting: 'JDIRVisiting', dvVisiting: 'DVVisiting', requestorRank: 'RequestorRank', requestorFirstName: 'RequestorFirstName', requestorLastName: 'RequestorLastName', requestorOffice: 'RequestorOffice', requestorDutyPhone: 'RequestorDutyPhone', requestorCellPhone: 'RequestorCellPhone', requestorEmail: 'RequestorEmail' };

        for (const event of eventsToUpdate) {
        const updates: any = {};
        Object.entries(editFields).forEach(([key, value]) => {
            if (value && value.trim() !== '' && fieldMap[key]) {
            updates[fieldMap[key]] = value;
            }
        });

        if (Object.keys(updates).length > 0) {
            try {
                await sp.web.lists
                    .getByTitle('Rob Calendar Events2')
                    .items.getById(event.id)
                    .update(updates);
            } catch (err) {
                console.error('Failed to update event', event.id, err);
            }
        }
        }
        // After updates succeed, send email if fields changed
        if (eventToEdit) {
            const email = fieldsChangedEmail(eventToEdit, editFields, eventsToUpdate, emailSettings);
            if (email) {
                composeEmailInBrowser(email.to, email.subject, email.body);
            }
        }
        
       setFilteredEvents(prev => 
            prev.map(ev => {
                if (ev.groupID !== editGroupID) return ev;

                // Shallow clone while preserving prototype
                const updatedEvent = Object.assign(Object.create(Object.getPrototypeOf(ev.event)), ev.event);

                Object.entries(editFields).forEach(([key, value]) => {
                    if (value && value.trim() !== '') {
                        (updatedEvent as any)[key] = value;
                    }
                });

                return new EventOccurrence(updatedEvent, ev.start, ev.end);
            })
        );

        showAlert('Successfully updated fields!', 'success');
        setIsEditPanelOpen(false);
        setEditFields({ dvPayGrade: '', dvRank: '', dvFirstName: '', dvSurname: '', jdirVisiting: '', dvVisiting: '', requestorRank: '', requestorFirstName: '', requestorLastName: '', requestorOffice: '', requestorDutyPhone: '', requestorCellPhone: '', requestorEmail: ''});
        setEditGroupID(null);
    };

    if (!isEditPanelOpen) return null;

    return (
        <div className={styles.panel}>
            <button onClick={() => setIsEditPanelOpen(false)} className={styles.closeButton}>x</button>
            <div className={styles.formContainer}>
                {/* Section 1: DV Info */}
                <div style={{ background: "rgb(148, 200, 221)" }}>
                    <div className={styles.row}>
                        <div>DV Pay Grade:  <input className="form-control" value={editFields.dvPayGrade} onChange={e => setEditFields({ ...editFields, dvPayGrade: e.target.value })}/></div>
                        <div>DV Rank:       <input className="form-control" value={editFields.dvRank} onChange={e => setEditFields({ ...editFields, dvRank: e.target.value })}/></div>
                        <div>DV First Name: <input className="form-control" value={editFields.dvFirstName} onChange={e => setEditFields({ ...editFields, dvFirstName: e.target.value })}/></div>
                        <div>DV Last Name:  <input className="form-control" value={editFields.dvSurname} onChange={e => setEditFields({ ...editFields, dvSurname: e.target.value })} /></div>
                    </div>
                    <div className={styles.row}>
                        <div>DV visiting JDIR/Office:   <input className="form-control" value={editFields.jdirVisiting} onChange={e => setEditFields({ ...editFields, jdirVisiting: e.target.value })}/></div>
                        <div>Is DV visiting Bridge:     <input className="form-control" value={editFields.dvVisiting} onChange={e => setEditFields({ ...editFields, dvVisiting: e.target.value })}/></div>
                    </div>
                </div>
                {/* Section 2: Requestor Info */}
                <div style={{ background: "rgb(165, 221, 148)" }}>
                    <div className={styles.row}>
                        <div>Requestor Rank:        <input className="form-control" value={editFields.requestorRank} onChange={e => setEditFields({ ...editFields, requestorRank: e.target.value })}/></div>
                        <div>Requestor First Name:  <input className="form-control" value={editFields.requestorFirstName} onChange={e => setEditFields({ ...editFields, requestorFirstName: e.target.value })}/></div>
                        <div>Requestor Last Name:   <input className="form-control" value={editFields.requestorLastName} onChange={e => setEditFields({ ...editFields, requestorLastName: e.target.value })}/></div>
                        <div>Requestor Office:      <input className="form-control" value={editFields.requestorOffice} onChange={e => setEditFields({ ...editFields, requestorOffice: e.target.value })}/></div>
                    </div>
                    <div className={styles.row}>
                        <div>Requestor Duty Phone:  <input className="form-control" value={editFields.requestorDutyPhone} onChange={e => setEditFields({ ...editFields, requestorDutyPhone: e.target.value })}/></div>
                        <div>Requestor Cell Phone:  <input className="form-control" value={editFields.requestorCellPhone} onChange={e => setEditFields({ ...editFields, requestorCellPhone: e.target.value })}/></div>
                        <div>Requestor Email:       <input className="form-control" value={editFields.requestorEmail} onChange={e => setEditFields({ ...editFields, requestorEmail: e.target.value })}/></div>
                    </div>
                </div>
                <button className="btn btn-success" onClick={handleEditSave}>Save Changes</button>
            </div>
        </div>
    );
};
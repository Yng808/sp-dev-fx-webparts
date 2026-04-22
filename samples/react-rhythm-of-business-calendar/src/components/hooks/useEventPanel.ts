import { Moment } from "moment-timezone";
import { useCallback, useRef } from "react";
import { useForceUpdate } from "@fluentui/react-hooks";
import { Event, IEvent } from "model";
import { IEventPanel } from "../events";
import { useDirectoryService } from 'services';

export const useEventPanel = (anchorDate: Moment) => {
    const forceUpdate = useForceUpdate();

    const eventPanel = useRef<IEventPanel>();
    const directoryService = useDirectoryService();
    const newEvent = useCallback(async (date?: Moment) => {
        try {
            const event = new Event();
            event.startDate = date || anchorDate;
            event.requestStatus ='New';
            event.dvVisiting = 'No';
            event.groupID = (Date.now() * 10000) + 621355968000000000;

            const currentUser = directoryService.currentUser;

            if (currentUser) {
                const nameParts = (currentUser.title || '').split(' ');
                event.requestorFirstName = nameParts[0] || '';
                event.requestorLastName = nameParts.slice(1).join(' ') || '';
                event.requestorEmail = currentUser.email || '';
            }

            await eventPanel.current.edit(event);
        } finally { forceUpdate(); }
    }, [anchorDate, eventPanel, forceUpdate, directoryService]);

    const displayEvent = useCallback(async (event: IEvent) => {
        try {
            await eventPanel.current.display(event.getExceptionOrEvent());
        } finally { forceUpdate(); }
    }, [eventPanel, forceUpdate]);

    return [
        eventPanel,
        newEvent,
        displayEvent
    ] as const;
};
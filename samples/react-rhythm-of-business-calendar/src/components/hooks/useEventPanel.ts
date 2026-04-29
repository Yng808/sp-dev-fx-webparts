import { Moment } from "moment-timezone";
import { useCallback, useRef } from "react";
import { useForceUpdate } from "@fluentui/react-hooks";
import { Event, IEvent } from "model";
import { IEventPanel } from "../events";
import { useDirectoryService } from 'services';

const parseRequestorName = (title: string, email: string): { firstName: string; lastName: string } => {
    const normalizedTitle = (title || '').trim();
    const emailAlias = (email || '').split('@')[0];
    const emailNameParts = emailAlias
        .split(/[._-]+/)
        .map(part => part.trim())
        .filter(Boolean);

    if (emailNameParts.length >= 2) {
        return {
            firstName: emailNameParts[0],
            lastName: emailNameParts[emailNameParts.length - 1]
        };
    }

    if (normalizedTitle.includes(',')) {
        const [lastNamePart, firstNamePart] = normalizedTitle.split(',', 2);
        const firstName = (firstNamePart || '').trim().split(/\s+/)[0] || '';

        return {
            firstName,
            lastName: (lastNamePart || '').trim()
        };
    }

    const titleParts = normalizedTitle.split(/\s+/).filter(Boolean);

    return {
        firstName: titleParts[0] || '',
        lastName: titleParts.slice(1).join(' ') || ''
    };
};

export const useEventPanel = (anchorDate: Moment) => {
    const forceUpdate = useForceUpdate();

    const eventPanel = useRef<IEventPanel>();
    const directoryService = useDirectoryService();
    const newEvent = useCallback(async (date?: Moment) => {
        try {
            const event = new Event();
            event.startDate = date || anchorDate;
            event.requestStatus ='Approved';
            event.dvVisiting = 'No';
            event.groupID = (Date.now() * 10000) + 621355968000000000;

            const currentUser = directoryService.currentUser;

            if (currentUser) {
                const { firstName, lastName } = parseRequestorName(currentUser.title, currentUser.email);
                event.requestorFirstName = firstName;
                event.requestorLastName = lastName;
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
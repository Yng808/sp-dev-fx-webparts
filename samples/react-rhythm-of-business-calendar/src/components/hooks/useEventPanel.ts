import { Moment } from "moment-timezone";
import { useCallback, useContext, useRef } from "react";
import { useForceUpdate } from "@fluentui/react-hooks";
import { Event, IEvent } from "model";
import { IEventPanel } from "../events";
import { useDirectoryService } from 'services';
import { EmailSettingsContext } from "../shared/EmailSettingsContext";

const parseRequestorName = (title: string, email: string): { firstName: string; lastName: string; rank: string } => {
    const normalizedTitle = (title || '').trim();
    const emailAlias = (email || '').split('@')[0];
    const emailNameParts = emailAlias
        .split(/[._-]+/)
        .map(part => part.trim())
        .filter(Boolean);

    if (emailNameParts.length >= 3) {
        const surnameParts = emailNameParts.slice(1, -1);
        const surnameWithoutMiddleInitial = surnameParts.length > 1 && /^[a-z]$/i.test(surnameParts[0])
            ? surnameParts.slice(1)
            : surnameParts;

        return {
            firstName: emailNameParts[0],
            lastName: surnameWithoutMiddleInitial.join(' ').replace(/\d+$/g, ''),
            rank: emailNameParts[emailNameParts.length - 1]
        };
    }

    if (emailNameParts.length === 2) {
        return {
            firstName: emailNameParts[0],
            lastName: emailNameParts[1].replace(/\d+$/g, ''),
            rank: ''
        };
    }

    if (emailNameParts.length === 1) {
        return {
            firstName: emailNameParts[0],
            lastName: '',
            rank: ''
        };
    }

    if (normalizedTitle.includes(',')) {
        const [lastNamePart, firstNamePart] = normalizedTitle.split(',', 2);
        const firstName = (firstNamePart || '').trim().split(/\s+/)[0] || '';

        return {
            firstName,
            lastName: (lastNamePart || '').trim(),
            rank: ''
        };
    }

    const titleParts = normalizedTitle.split(/\s+/).filter(Boolean);

    return {
        firstName: titleParts[0] || '',
        lastName: titleParts.slice(1).join(' ') || '',
        rank: ''
    };
};

export const useEventPanel = (anchorDate: Moment) => {
    const forceUpdate = useForceUpdate();
    const emailSettings = useContext(EmailSettingsContext);

    const eventPanel = useRef<IEventPanel>();
    const directoryService = useDirectoryService();
    const newEvent = useCallback(async (date?: Moment) => {
        try {
            const event = new Event();
            event.startDate = date || anchorDate;
            event.requestStatus ='Approved';
            event.dvVisiting = 'No';
            event.groupID = (Date.now() * 10000) + 621355968000000000;
            event.requestorOffice = 'Protocol';
            event.requestorCellPhone = emailSettings.phone;
            event.requestorDutyPhone = emailSettings.phone;
            const currentUser = directoryService.currentUser;

            if (currentUser) {
                const { firstName, lastName, rank } = parseRequestorName(currentUser.title, currentUser.email);
                event.requestorFirstName = firstName;
                event.requestorLastName = lastName;
                event.requestorRank = rank;
                event.requestorEmail = currentUser.email || '';
            }

            await eventPanel.current.edit(event);
        } finally { forceUpdate(); }
    }, [anchorDate, eventPanel, forceUpdate, directoryService, emailSettings.phone]);

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
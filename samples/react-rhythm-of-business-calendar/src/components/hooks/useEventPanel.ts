import { Moment } from "moment-timezone";
import { useCallback, useRef } from "react";
import { useForceUpdate } from "@fluentui/react-hooks";
import { Entity } from "common";
import { Event, IEvent } from "model";
import { useEventsService } from "services";
import { IEventPanel } from "../events";

export const useEventPanel = (anchorDate: Moment) => {
    const forceUpdate = useForceUpdate();
    const { refinerValuesAsync } = useEventsService();

    const eventPanel = useRef<IEventPanel>();

    const newEvent = useCallback(async (date?: Moment) => {
        try {
            const event = new Event();
            event.startDate = date || anchorDate;

            await refinerValuesAsync.promise;

            const defaultRefinerKeys = new Set<string | number>();
            const defaultValues = (refinerValuesAsync.data || [])
                .filter(Entity.NotDeletedFilter)
                .filter(value => value.isActive && value.isDefault && value.refiner.get())
                .sort(Event.RefinerValueOrderAscComparer);

            defaultValues.forEach(value => {
                const refinerKey = value.refiner.get().key;

                if (!defaultRefinerKeys.has(refinerKey)) {
                    event.refinerValues.add(value);
                    defaultRefinerKeys.add(refinerKey);
                }
            });

            await eventPanel.current.edit(event);
        } finally { forceUpdate(); }
    }, [anchorDate, eventPanel, forceUpdate, refinerValuesAsync]);

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

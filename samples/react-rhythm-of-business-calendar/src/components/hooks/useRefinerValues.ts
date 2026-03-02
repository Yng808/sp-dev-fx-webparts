import { useCallback, useEffect, useState } from "react";
import { useForceUpdate } from "@fluentui/react-hooks";
import { Entity, IComponent } from "common";
import { RefinerValue } from "model";
import { useEventsService } from "services";
import { OnRefinerSelectionChanged } from "../refiners";

export const useRefinerValues = () => {
    const forceUpdate = useForceUpdate();
    const { refinersAsync, refinerValuesAsync, eventsAsync } = useEventsService();

    const [selectedRefinerValues] = useState(new Set<RefinerValue>());
    const [knownRefinerValues] = useState(new Set<RefinerValue>());
    const [hasRefiners, setHasRefiners] = useState(false);

    useEffect(() => {
        const update = () => {
            const refiners = refinersAsync.data?.filter(Entity.NotDeletedFilter);

            refiners?.forEach(({ required, blankValue }) => {
                if (!required && !knownRefinerValues.has(blankValue)) {
                    selectedRefinerValues.add(blankValue);
                    knownRefinerValues.add(blankValue);
                }
            });

            setHasRefiners(refiners?.length > 0);
            forceUpdate();
        }

        refinersAsync.promise.then(update);

        const component: IComponent = { componentShouldRender: update };
        refinersAsync.registerComponentForUpdates(component);
        return () => refinersAsync.unregisterComponentForUpdates(component);
    }, [refinersAsync, selectedRefinerValues, knownRefinerValues, setHasRefiners, forceUpdate]);

    useEffect(() => {
        const update = () => {
            const refinerValues = refinerValuesAsync.data?.filter(Entity.NotDeletedFilter);
            refinerValues?.forEach(value => {
                if (value.isActive) {
                    if (!knownRefinerValues.has(value)) {
                        knownRefinerValues.add(value);
                        selectedRefinerValues.add(value);
                    }
                } else {
                    knownRefinerValues.delete(value);
                    selectedRefinerValues.delete(value);
                }
            });

            forceUpdate();
        }

        refinerValuesAsync.promise.then(update);

        const component: IComponent = { componentShouldRender: update };
        refinerValuesAsync.registerComponentForUpdates(component);
        return () => refinerValuesAsync.unregisterComponentForUpdates(component);
    }, [refinersAsync, refinerValuesAsync, selectedRefinerValues, knownRefinerValues, forceUpdate]);

    useEffect(() => {
        const update = () => {
            const refiners = refinersAsync.data?.filter(Entity.NotDeletedFilter);
            if (!refiners?.length) return;

            let changed = false;
            refiners.forEach(refiner => {
                refiner.values.get().forEach((value: RefinerValue) => {
                    if (!knownRefinerValues.has(value)) {
                        knownRefinerValues.add(value);
                        selectedRefinerValues.add(value);
                        changed = true;
                    }
                });
            });

            if (changed) forceUpdate();
        };

        eventsAsync.promise.then(update);
        const component: IComponent = { componentShouldRender: update };
        eventsAsync.registerComponentForUpdates(component);
        return () => eventsAsync.unregisterComponentForUpdates(component);
    }, [eventsAsync, refinersAsync, selectedRefinerValues, knownRefinerValues, forceUpdate]);

    const onSelectedRefinerValuesChanged: OnRefinerSelectionChanged = useCallback(({ added, removed }) => {
        added.forEach(v => selectedRefinerValues.add(v));
        removed.forEach(v => selectedRefinerValues.delete(v));
        forceUpdate();
    }, [selectedRefinerValues, forceUpdate]);

    return [
        hasRefiners,
        selectedRefinerValues,
        onSelectedRefinerValuesChanged
    ] as const;
};
import { useCallback, useEffect, useState, useContext, useMemo } from "react";
import { useForceUpdate } from "@fluentui/react-hooks";
import { Entity, IComponent } from "common";
import { RefinerValue } from "model";
import { useEventsService } from "services";
import { OnRefinerSelectionChanged } from "../refiners";
import { FilterConfigContext } from "components/shared/FilterConfigContext";

export const useRefinerValues = () => {
    const forceUpdate = useForceUpdate();
    const { refinersAsync, refinerValuesAsync, eventsAsync } = useEventsService();
    const { filterButtons } = useContext(FilterConfigContext);

    const [selectedRefinerValues] = useState(new Set<RefinerValue>());
    const [knownRefinerValues] = useState(new Set<RefinerValue>());
    const [hasRefiners, setHasRefiners] = useState(false);
    const [initializedDefault, setInitializedDefault] = useState(false);

    const defaultButton = useMemo(
        () => filterButtons?.find(b => b.applyOnLoad), // Find default filter button (if any)
        [filterButtons]
    );

    const defaultPrefixes = useMemo(
        () =>
            defaultButton?.filterPrefixes
                ?.split(";")
                .map(p => p.trim()),
        [defaultButton]
    );

    const hasDefaultFilter = !!defaultButton;

    
    const shouldSelectValue = (value: RefinerValue) => {
        if (!initializedDefault && hasDefaultFilter) {
            return defaultPrefixes?.includes(value.title);
        }
        return true; // fallback = select all
    };

    useEffect(() => {
        const update = () => {
            const refiners = refinersAsync.data?.filter(Entity.NotDeletedFilter);

            refiners?.forEach(({ required, blankValue }) => {
                if (!required && !knownRefinerValues.has(blankValue)) {
                    knownRefinerValues.add(blankValue);

                    if (shouldSelectValue(blankValue)) {
                        selectedRefinerValues.add(blankValue);
                    }
                }
            });

            setHasRefiners(refiners?.length > 0);

            if (hasDefaultFilter && !initializedDefault) {
                setInitializedDefault(true);
            }

            forceUpdate();
        }

        refinersAsync.promise.then(update);

        const component: IComponent = { componentShouldRender: update };
        refinersAsync.registerComponentForUpdates(component);
        return () => refinersAsync.unregisterComponentForUpdates(component);
    }, [refinersAsync, selectedRefinerValues, knownRefinerValues, setHasRefiners, forceUpdate, initializedDefault, hasDefaultFilter, defaultPrefixes]);

    useEffect(() => {
        const update = () => {
            const refinerValues = refinerValuesAsync.data?.filter(Entity.NotDeletedFilter);
            refinerValues?.forEach(value => {
                if (value.isActive) {
                    if (!knownRefinerValues.has(value)) {
                        knownRefinerValues.add(value);

                        if (shouldSelectValue(value)) {
                            selectedRefinerValues.add(value);
                        }
                    }
                } else {
                    knownRefinerValues.delete(value);
                    selectedRefinerValues.delete(value);
                }
            });

            if (hasDefaultFilter && !initializedDefault) {
                setInitializedDefault(true);
            }

            forceUpdate();
        }

        refinerValuesAsync.promise.then(update);

        const component: IComponent = { componentShouldRender: update };
        refinerValuesAsync.registerComponentForUpdates(component);
        return () => refinerValuesAsync.unregisterComponentForUpdates(component);
    }, [refinersAsync, refinerValuesAsync, selectedRefinerValues, knownRefinerValues, forceUpdate, initializedDefault, hasDefaultFilter, defaultPrefixes]);

    useEffect(() => {
        const update = () => {
            const refiners = refinersAsync.data?.filter(Entity.NotDeletedFilter);
            if (!refiners?.length) return;

            let changed = false;
            refiners.forEach(refiner => {
                refiner.values.get().forEach((value: RefinerValue) => {
                    if (!knownRefinerValues.has(value)) {
                        knownRefinerValues.add(value);

                        if (shouldSelectValue(value)) {
                            selectedRefinerValues.add(value);
                        }

                        changed = true;
                    }
                });
            });

            if (hasDefaultFilter && !initializedDefault) {
                setInitializedDefault(true);
            }

            if (changed) forceUpdate();
        };

        eventsAsync.promise.then(update);
        const component: IComponent = { componentShouldRender: update };
        eventsAsync.registerComponentForUpdates(component);
        return () => eventsAsync.unregisterComponentForUpdates(component);
    }, [eventsAsync, refinersAsync, selectedRefinerValues, knownRefinerValues, forceUpdate, initializedDefault, hasDefaultFilter, defaultPrefixes]);

    const onSelectedRefinerValuesChanged: OnRefinerSelectionChanged = useCallback(
        ({ added, removed }) => {
            added.forEach(v => selectedRefinerValues.add(v));
            removed.forEach(v => selectedRefinerValues.delete(v));
            forceUpdate();
        },
        [selectedRefinerValues, forceUpdate]
    );

    return [
        hasRefiners,
        selectedRefinerValues,
        onSelectedRefinerValuesChanged
    ] as const;
};
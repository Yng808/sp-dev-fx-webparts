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
        () => filterButtons?.find(b => b.applyOnLoad),
        [filterButtons]
    );

    const defaultPrefixes = useMemo(
        () =>
            defaultButton?.filterPrefixes
                ?.split(";")
                .map(p => p.trim())
                .filter(Boolean),
        [defaultButton]
    );

    const hasDefaultFilter = !!defaultButton;

    useEffect(() => {
        const update = () => {
            const refiners = refinersAsync.data?.filter(Entity.NotDeletedFilter);

            refiners?.forEach(({ required, blankValue }) => {
                if (!required && !knownRefinerValues.has(blankValue)) {
                    knownRefinerValues.add(blankValue);
                    selectedRefinerValues.add(blankValue);
                }
            });

            setHasRefiners(refiners?.length > 0);
            forceUpdate();
        }

        refinersAsync.promise.then(update);

        const component: IComponent = { componentShouldRender: update };
        refinersAsync.registerComponentForUpdates(component);
        return () => refinersAsync.unregisterComponentForUpdates(component);
    }, [refinersAsync, selectedRefinerValues, knownRefinerValues, forceUpdate]);

    const onSelectedRefinerValuesChanged: OnRefinerSelectionChanged = useCallback(({ added, removed }) => {
        added.forEach(v => selectedRefinerValues.add(v));
        removed.forEach(v => selectedRefinerValues.delete(v));
        forceUpdate();
    }, [selectedRefinerValues, forceUpdate]);

    useEffect(() => {
        const update = () => {
            const refinerValues = refinerValuesAsync.data?.filter(Entity.NotDeletedFilter);
            if (!refinerValues) return;

            // DEFAULT FILTER
            if (hasDefaultFilter && !initializedDefault && refinerValues.length > 0 && defaultPrefixes?.length) {
                const fullValues = refinerValues;

                const filteredIds = new Set(
                    fullValues
                        .filter(v => !v.title || v.title.split(";").some(part => defaultPrefixes.includes(part.trim())))
                        .map(v => v.id)
                );

                // STEP 1: add all
                onSelectedRefinerValuesChanged({ added: fullValues, removed: [] });

                // STEP 2: remove non-matching (by id)
                onSelectedRefinerValuesChanged({ added: [], removed: fullValues.filter(v => !filteredIds.has(v.id)) });

                setInitializedDefault(true);
                return;
            }

            // Normal behavior
            refinerValues.forEach(value => {
                if (value.isActive) {
                    if (!knownRefinerValues.has(value)) {
                        knownRefinerValues.add(value);
                        selectedRefinerValues.add(value);
                    }
                } else {
                    if (knownRefinerValues.has(value)) {
                        knownRefinerValues.delete(value);
                        selectedRefinerValues.delete(value);
                    }
                }
            });

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
                    if (value.isActive && !knownRefinerValues.has(value)) {
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

    return [
        hasRefiners,
        selectedRefinerValues,
        onSelectedRefinerValuesChanged
    ] as const;
};
import React, { useState, useEffect } from "react";
import { Stack } from "@fluentui/react";
import { Refiner, RefinerValue } from "model"; // Adjust the import path as necessary
import { IStackTokens } from "@fluentui/react";
import { useEventsService } from "services"; // Adjust the import path
import { Entity } from "common";

const legendStackTokens: IStackTokens = { childrenGap: 10 };

const Legend: React.FC = () => {
    const { refinersAsync, refinerValuesAsync } = useEventsService();
    const [refiners, setRefiners] = useState<Refiner[]>([]);
    const [refinerValues, setRefinerValues] = useState<RefinerValue[]>([]);


    useEffect(() => {
        const fetchData = async () => {
            // Filter and set refiners
            const refinersData = (await refinersAsync.promise)?.filter(Entity.NotDeletedFilter);
            setRefiners(refinersData || []);

            // Filter and set refiner values
            const refinerValuesData = (await refinerValuesAsync.promise)?.filter(value => value.refiner.get()?.id === 1 && Entity.NotDeletedFilter);
            setRefinerValues(refinerValuesData || []);
        };

        fetchData();

        // Register for updates to refiners and refiner values
        const updateRefiners = () => setRefiners(refinersAsync.data?.filter(Entity.NotDeletedFilter) || []);
        const updateRefinerValues = () => setRefinerValues(refinerValuesAsync.data?.filter(Entity.NotDeletedFilter) || []);

        refinersAsync.registerComponentForUpdates({ componentShouldRender: updateRefiners });
        refinerValuesAsync.registerComponentForUpdates({ componentShouldRender: updateRefinerValues });

        // Cleanup
        return () => {
            refinersAsync.unregisterComponentForUpdates({ componentShouldRender: updateRefiners });
            refinerValuesAsync.unregisterComponentForUpdates({ componentShouldRender: updateRefinerValues });
        };
    }, [refinersAsync, refinerValuesAsync]);

    // Map refiners to include associated refiner values
    const refinerWithValues = refiners.map(refiner => ({
        ...refiner,
        values: refinerValues.filter(value => value.refiner.get()?.id === refiner.id)
    }));

    console.log('refiner values:', refinerWithValues);

    return (
        <Stack horizontal wrap tokens={legendStackTokens}>
            {refinerWithValues.map(refiner =>
                refiner.values.map((value, idx) => (
                    <Stack horizontal key={idx} tokens={{ childrenGap: 5 }} verticalAlign="center">
                        <div
                            style={{
                                width: 16,
                                height: 16,
                                backgroundColor: value.color.toCssString(),
                                borderRadius: "4px", // Adjust this for square or rounded square
                                marginRight: "5px"
                            }}
                        ></div>
                        <span>{value.title}</span>
                    </Stack>
                ))
            )}
        </Stack>
    );
};

export default Legend;
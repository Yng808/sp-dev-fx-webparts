import React, { FC, useEffect, useState } from 'react';
import Plot from 'react-plotly.js';
import { EventOccurrence } from 'model';
import { DetailsList, DetailsListLayoutMode, IColumn } from '@fluentui/react';

interface RefinerPieChartProps {
    cccurrences: readonly EventOccurrence[];
}

const RefinerPieChart: FC<RefinerPieChartProps> = ({ cccurrences }) => {
    const [data, setData] = useState<{ labels: string[], values: number[], items: any[] }>({
        labels: [],
        values: [],
        items: []
    });

    useEffect(() => {
        const refinerValueCounts: { [key: string]: number } = {};

        // Count the occurrences by refiner value
        cccurrences.forEach(cccurrence => {
            const valuesByRefiner = cccurrence.event.valuesByRefiner();
            valuesByRefiner.forEach((values) => {
                values.forEach(value => {
                    const refinerValue = value.title;
                    refinerValueCounts[refinerValue] = (refinerValueCounts[refinerValue] || 0) + 1;
                });
            });
        });

        // Prepare data for the pie chart and table
        const labels = Object.keys(refinerValueCounts);
        const values = Object.values(refinerValueCounts);
        const total = values.reduce((sum, value) => sum + value, 0);
        const items = labels.map((label, index) => ({
            key: index,
            refinerValue: label,
            count: values[index],
            percentage: `${((values[index] / total) * 100).toFixed(2)}%`
        }));

        setData({ labels, values, items });
    }, [cccurrences]);

    const columns: IColumn[] = [
        {
            key: 'column1',
            name: 'Refiner Value',
            fieldName: 'refinerValue',
            minWidth: 100,
            maxWidth: 200,
            isResizable: true,
        },
        {
            key: 'column2',
            name: 'Count',
            fieldName: 'count',
            minWidth: 50,
            maxWidth: 100,
            isResizable: true,
        },
        {
            key: 'column3',
            name: 'Percentage',
            fieldName: 'percentage',
            minWidth: 100,
            maxWidth: 150,
            isResizable: true,
        }
    ];


    return (
        <div>
        <Plot
            data={[
                {
                    type: 'pie',
                    labels: data.labels,
                    values: data.values,
                    textinfo: 'label+value+percent',  
                    textposition: 'outside',
                    pull: 0.05,
                    marker: {
                        line: {
                            color: '#000000', // Optional: color of slice borders
                            width: 1
                        }
                    },
                    hoverinfo: 'label+value+percent',  
                    automargin: true,
                },
            ]}
            layout={{ title: 'Refiner Values Distribution', showlegend: true }}
            style={{ width: '100%', height: '100%' }}
        />
        <DetailsList
                items={data.items}
                columns={columns}
                setKey="set"
                layoutMode={DetailsListLayoutMode.fixedColumns}
                selectionPreservedOnEmptyClick={true}
                ariaLabelForSelectionColumn="Toggle selection"
                checkButtonAriaLabel="Row checkbox"
            />
        </div>
    );
};

export default RefinerPieChart;

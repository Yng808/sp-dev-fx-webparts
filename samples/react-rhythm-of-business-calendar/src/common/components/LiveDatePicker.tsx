import moment, { Moment } from 'moment-timezone';
import React, { useCallback } from 'react';
import { DatePicker, IDatePickerProps, Label, Stack } from '@fluentui/react';
import { ValidationRule, PropsOfType } from 'common';
import { ListItemEntity } from 'common/sharepoint';
import LiveUpdate from './LiveUpdate';
import { getCurrentValue, LiveType, setValue } from './LiveUtils';
import { Validation } from './Validation';

type DataType = Moment;

const toDatePickerValue = (date?: Moment): Date | undefined => date?.isValid() ? new Date(date.year(), date.month(), date.date()) : undefined;

const fromDatePickerValue = (date: Date, reference?: Moment): Moment => {
    const selected = moment(date);
    return reference?.isValid() ? reference.clone().year(selected.year()).month(selected.month()).date(selected.date()).startOf('day') : selected;
};

interface IProps<E extends ListItemEntity<any>, P extends PropsOfType<E, T>, T extends DataType> extends Omit<IDatePickerProps, 'value' | 'onSelectDate' | 'formatDate' | 'isRequired'> {
    entity: E;
    propertyName: P;
    required?: boolean;
    rules?: ValidationRule<E>[];
    showValidationFeedback?: boolean;
    formatMoment?: (date?: Moment) => string;
    updateField: (update: (data: E) => void, callback?: () => any) => void;
}

const LiveDatePicker = <E extends ListItemEntity<any>, P extends PropsOfType<E, T>, T extends DataType>(props: IProps<E, P, T>) => {
    const {
        entity,
        propertyName,
        rules,
        showValidationFeedback,
        label,
        ariaLabel = label,
        required,
        formatMoment = date => date?.isValid() ? date.format('l') : '',
        updateField
    } = props;

    const value = getCurrentValue(entity, propertyName) as T;
    const updateValue = useCallback((val: LiveType<E, P>) => updateField(e => setValue(e, propertyName, val)), [updateField, propertyName]);
    const renderValue = useCallback((val: LiveType<E, P>) => <span>{(val as DataType)?.isValid() ? (val as DataType).format('dddd, MMMM DD, YYYY') : ''}</span>, []);
    const formatDate = useCallback((val: Date) => formatMoment(moment(val)), [formatMoment]);
    const onChange = useCallback((date: Date) => updateField(e => setValue(e, propertyName, fromDatePickerValue(date, value) as LiveType<E, P>)), [updateField, propertyName, value]);

    return (
        <Validation entity={entity} rules={rules} active={showValidationFeedback}>
            <LiveUpdate entity={entity} propertyName={propertyName} updateValue={updateValue} renderValue={renderValue}>
                {(renderLiveUpdateMark) => <>
                    {label && <Stack horizontal>
                        <Label required={required}>{label}</Label>
                        {renderLiveUpdateMark()}
                    </Stack>}
                    <DatePicker
                        {...props}
                        label={undefined}
                        ariaLabel={ariaLabel}
                        isRequired={!label && required}
                        formatDate={formatDate}
                        value={toDatePickerValue(value)}
                        onSelectDate={onChange}
                    />
                    {!label && renderLiveUpdateMark()}
                </>}
            </LiveUpdate>
        </Validation>
    );
};

export default LiveDatePicker;

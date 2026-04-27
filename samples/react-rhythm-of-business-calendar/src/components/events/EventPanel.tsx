import { sp } from '@pnp/sp';
import { Guid } from '@microsoft/sp-core-library';
import React from 'react';
import { Dropdown, FocusZone, format, ICommandBarItemProps, IDropdownOption, Label, Link, MessageBar, MessageBarType, Stack, Text, PrimaryButton } from "@fluentui/react";
import { Entity, ErrorHandler, mapToArray, now, User, ValidationRule } from 'common';
import { EntityPanelBase, IEntityPanelProps, IDataPanelBaseState, ResponsiveGrid, GridRow, GridCol, LiveText, IDataPanelBase, LiveTextField, LiveTimePicker, LiveDatePicker, LiveDropdown } from "common/components";
import { Event, Refiner, RefinerValue, EventModerationStatus, Approvers, humanizeRecurrencePattern } from "model";
import { withServices, ServicesProp, EventsServiceProp, EventsService, ConfigurationServiceProp, ConfigurationService, DirectoryServiceProp, DirectoryService, TimeZoneService, TimeZoneServiceProp } from 'services';
import { EventOverview } from '../events';
import { IEventCommands } from './IEventCommands';
import { PersistConcurrencyFailureMessage, Validation as validationStrings, EventPanel as strings } from "ComponentStrings";

import styles from './EventPanel.module.scss';
import { fetchBookedParkingForEvent, fetchParkingStalls, filterAvailableParking, formatParkingOptions } from 'components/views/list/spEventDetailsList';
import { Moment } from 'moment-timezone';
import moment from 'moment';

export class RefinerValueValidationRule extends ValidationRule<Event> {
    constructor(
        private _refiner: Refiner
    ) {
        super((e: Event) => this._isValid(e), validationStrings.Refiners.Required);
    }

    private _isValid({ refinerValues }: Event): boolean {
        return !this._refiner.required || refinerValues.get().some(v => v.refiner.get() === this._refiner);
    }
}

export interface IEventPanel extends IDataPanelBase<Event> {
}

interface IOwnProps {
    commands: IEventCommands;
}
type IProps = IOwnProps & IEntityPanelProps<Event> & ServicesProp<DirectoryServiceProp & ConfigurationServiceProp & EventsServiceProp & TimeZoneServiceProp>;

interface IOwnState {
    refinerValueOptionsByRefiner: Map<Refiner, IDropdownOption[]>;
    refiners: readonly Refiner[];
}
type IState = IOwnState & IDataPanelBaseState<Event>;

class EventPanel extends EntityPanelBase<Event, IProps, IState> implements IEventPanel {
    private readonly _refinerValueValidationRulesByRefiner = new Map<Refiner, RefinerValueValidationRule>();
    private _parkingOptions: IDropdownOption[] = [];
    private _parkingOptionsByDate = new Map<string, IDropdownOption[]>(); 
    private _parkingSelectionsByDate = new Map<string, number>();

    protected get title() {
        return this.entity?.displayName || (this.isNew ? strings.NewEvent : '');
    }

    protected resetState(): IState {
        this._parkingOptions = [];
        this._parkingOptionsByDate?.clear();
        this._parkingSelectionsByDate?.clear();
        this._buildRefinerValueOptions();
        this._buildRefinerValueValidationRules();

        return {
            ...super.resetState(),
            refinerValueOptionsByRefiner: new Map(),
            refiners: []
        };
    }

    private _resetParkingState(): void {
        this._parkingOptions = [];
        this._parkingOptionsByDate.clear();
        this._parkingSelectionsByDate.clear();

        this.forceUpdate();
    }

    protected validate(): boolean {
        const rules = mapToArray(this._refinerValueValidationRulesByRefiner);
        return super.validate() && rules.every(rule => rule.validate(this.entity)) && this._multiDayParkingIsValid();
    }

    public componentShouldRender() {
        super.componentShouldRender();
        this._buildRefinerValueOptions();
        this._buildRefinerValueValidationRules();
    }

    public componentDidMount(): void {
        super.componentDidMount?.();
    }

    private _toSiteTimeZone(date: Moment): Moment {
        const { [TimeZoneService]: { siteTimeZone } } = this.props.services;
        return date?.clone().tz(siteTimeZone.momentId, true);
    }

    private _isNewMultiDayEvent(): boolean {
        const { start, end } = this.entity;
        return start?.isValid() && end?.isValid() && !start.isSame(end, 'day');
    }

    private _dailyEventDates(): Moment[] {
        const event = this.entity;
        if (!event?.start || !event?.end) return [];

        const start = this._toSiteTimeZone(event.start).startOf('day');
        const end = this._toSiteTimeZone(event.end).startOf('day');
        const dates: Moment[] = [];

        for (const date = start.clone(); date.isSameOrBefore(end, 'day'); date.add(1, 'day')) {
            dates.push(date.clone());
        }

        return dates;
    }

    private _dailyEventRange(date: Moment): { start: Moment; end: Moment } {
        const { startTime, endTime } = this.entity;
        const start = date.clone().startOf('day').add(startTime);
        const end = date.clone().startOf('day').add(endTime);

        if (!end.isAfter(start)) {
            end.add(1, 'day');
        }

        return { start, end };
    }

    private _multiDayParkingIsValid(): boolean {
        if (!this._isNewMultiDayEvent()) return true;

        const dates = this._dailyEventDates();
        return dates.length > 0 && dates.every(date => this._parkingSelectionsByDate.has(date.format('YYYY-MM-DD')));
    }

    private async _loadAvailableParking() {
        const event = this.entity; 
        const start = this._toSiteTimeZone(event.start);
        const end = this._toSiteTimeZone(event.end);

        this._parkingOptions = [];
        this.forceUpdate();

        if (!start || !end || !end.isAfter(start)) {
            alert("Invalid time range");
            return;
        }

        try {
            const web = await sp.web.get();
            const siteUrl = web.Url;

            const ignoreIds = event.id ? [event.id] : [];
            const allParking = await fetchParkingStalls(siteUrl);

            if (this._isNewMultiDayEvent()) {
                const availability = await Promise.all(this._dailyEventDates().map(async date => {
                    const dateKey = date.format('YYYY-MM-DD');
                    const range = this._dailyEventRange(date);
                    const bookedIds = await fetchBookedParkingForEvent(siteUrl, range.start, range.end, ignoreIds);
                    const available = filterAvailableParking(allParking, bookedIds);
                    return [dateKey, formatParkingOptions(available)] as [string, IDropdownOption[]];
                }));

                this._parkingOptions = [];
                this._parkingOptionsByDate = new Map(availability);
                this._parkingSelectionsByDate.clear();
                this.forceUpdate();
                return;
            }

            const bookedIds = await fetchBookedParkingForEvent(siteUrl, start, end, ignoreIds);

            const available = filterAvailableParking(allParking, bookedIds);
            this._parkingOptions = formatParkingOptions(available);

            this.forceUpdate();
        } catch (err) {
            console.error(err);
            alert("Failed to load parking");
        }
    }

    private _setDailyParking(dateKey: string, option?: IDropdownOption): void {
        if (option) {
            this._parkingSelectionsByDate.set(dateKey, Number(option.key));
        } else {
            this._parkingSelectionsByDate.delete(dateKey);
        }

        this.forceUpdate();
    }

    private _copyEventForDate(source: Event, start: Moment, end: Moment, parkingStalls: number, parkingStallName: string): Event {
        const event = new Event(source.author, source.editor);

        event.title = source.title;
        event.description = source.description;
        event.comDecision = source.comDecision;
        event.location = source.location;
        event.contacts = [...source.contacts];
        event.start = start;
        event.end = end;
        const startOfDay = start.clone().startOf('day');
        const endOfDay = end.clone().startOf('day');

        event.startDate = start.clone();
        event.endDate = end.clone();

        event.startTime = moment.duration(start.diff(startOfDay));
        event.endTime = moment.duration(end.diff(endOfDay));
        event.isAllDay = source.isAllDay;
        event.isRecurring = false;
        event.isConfidential = source.isConfidential;
        event.restrictedToAccounts = [...source.restrictedToAccounts];
        event.moderationStatus = source.moderationStatus;
        event.moderator = source.moderator;
        event.moderationTimestamp = source.moderationTimestamp?.clone();
        event.moderationMessage = source.moderationMessage;
        event.readAheadDueDate = source.readAheadDueDate?.clone();
        event.requestStatus = source.requestStatus;
        event.dvPayGrade = source.dvPayGrade;
        event.dvRank = source.dvRank;
        event.dvFirstName = source.dvFirstName;
        event.dvSurname = source.dvSurname;
        event.jdirVisiting = source.jdirVisiting;
        event.dvVisiting = source.dvVisiting;
        event.requestorRank = source.requestorRank;
        event.requestorFirstName = source.requestorFirstName;
        event.requestorLastName = source.requestorLastName;
        event.requestorOffice = source.requestorOffice;
        event.requestorDutyPhone = source.requestorDutyPhone;
        event.requestorCellPhone = source.requestorCellPhone;
        event.requestorEmail = source.requestorEmail;
        event.parkingStalls = parkingStalls;
        event.parkingStallName = parkingStallName;
        event.groupID = source.groupID;

        source.refinerValues.get().forEach(value => event.refinerValues.add(value));

        event.snapshot();

        return event;
    }

    private async _saveAndReset(): Promise<void> {
        try {
            const current = this.entity;

            await this.submit(async () => {
                // 1. Create new event
                const newEvent = new Event(current.author, current.editor);
                newEvent.groupID = (Date.now() * 10000) + 621355968000000000;
                newEvent.requestStatus = "Approved";
                // 2. Copy ONLY desired fields
                newEvent.dvPayGrade = current.dvPayGrade;
                newEvent.dvRank = current.dvRank;
                newEvent.dvFirstName = current.dvFirstName;
                newEvent.dvSurname = current.dvSurname;
                newEvent.jdirVisiting = current.jdirVisiting;
                newEvent.dvVisiting = current.dvVisiting;
                newEvent.requestorRank = current.requestorRank;
                newEvent.requestorFirstName = current.requestorFirstName;
                newEvent.requestorLastName = current.requestorLastName;
                newEvent.requestorOffice = current.requestorOffice;
                newEvent.requestorDutyPhone = current.requestorDutyPhone;
                newEvent.requestorCellPhone = current.requestorCellPhone;
                newEvent.requestorEmail = current.requestorEmail;
                newEvent.title = current.title;

                // 3. Reset date/time
                newEvent.start = undefined;
                newEvent.end = undefined;
                newEvent.startDate = current.startDate?.clone().add(1, 'day');
                newEvent.endDate = current.endDate?.clone().add(1, 'day');
                newEvent.startTime = current.startTime;
                newEvent.endTime = current.endTime;

                // 4. Reset parking
                newEvent.parkingStalls = undefined;
                newEvent.parkingStallName = '';

                // 5. Reset panel-level parking state
                this._resetParkingState();

                // 6. Snapshot clean entity
                newEvent.snapshot();

                // 7. Reopen panel in edit mode
                this.edit(newEvent);
            });

        } catch (e) {
            console.error("Save & Submit Another failed", e);
        }
    }

    private async _buildRefinerValueOptions() {
        const { [EventsService]: { refinersAsync } } = this.props.services;

        await refinersAsync.promise;

        const refiners = [...refinersAsync.data];
        refiners.sort(Refiner.OrderAscComparer);

        const refinerValueToDropdownOption = (value: RefinerValue) => {
            const { key, displayName: text } = value;
            return { key, text, data: value } as IDropdownOption;
        };

        const refinerValueOptionsByRefiner = new Map<Refiner, IDropdownOption[]>();
        for (const refiner of refiners) {
            const { required, allowMultiselect, blankValue } = refiner;
            const options: IDropdownOption[] = [];

            if (!required && !allowMultiselect) {
                options.push(refinerValueToDropdownOption(blankValue));
            }

            options.push(...refiner.values.filter(Entity.NotDeletedFilter).map(refinerValueToDropdownOption));

            refinerValueOptionsByRefiner.set(refiner, options);
        }

        this.setState({ refinerValueOptionsByRefiner, refiners });
    }

    private async _buildRefinerValueValidationRules() {
        const { [EventsService]: { refinersAsync } } = this.props.services;

        await refinersAsync.promise;

        const { data: refiners } = refinersAsync;

        this._refinerValueValidationRulesByRefiner.clear();

        for (const refiner of refiners.filter(Entity.NotDeletedFilter)) {
            const rule = new RefinerValueValidationRule(refiner);
            this._refinerValueValidationRulesByRefiner.set(refiner, rule);
        }
    }

    protected async persistChangesCore() {
        const {
            [DirectoryService]: { currentUserIsSiteAdmin, currentUser },
            [ConfigurationService]: { active: { useApprovals } },
            [EventsService]: events
        } = this.props.services;
        const { isApproved, isRejected, isDeleted, isConfidential } = this.entity;

        const userCanApprove = currentUserIsSiteAdmin || this._currentUserIsAnApprover();

        try {
            if (isRejected && !userCanApprove) {
                this.entity.moderationStatus = EventModerationStatus.Pending;
            }
            else if (!isApproved && (!useApprovals || userCanApprove)) {
                this.entity.moderationStatus = EventModerationStatus.Approved;
                this.entity.moderator = currentUser;
                this.entity.moderationTimestamp = now();
            }

            if (this.entity.hasRecurrenceChanges() && !isDeleted) {
                this.entity.exceptions.forEach(e => e.delete());
                this.entity.recurrenceUID = Guid.newGuid();
            }

            if (!isConfidential) {
                this.entity.restrictedToAccounts = [];
            }

            if (this._isNewMultiDayEvent()) {
                this._dailyEventDates().forEach(date => {
                    const dateKey = date.format('YYYY-MM-DD');
                    const parkingStalls = this._parkingSelectionsByDate.get(dateKey);
                    const parkingStallName = parkingStalls === -1
                        ? 'Unavailable'
                        : this._parkingOptionsByDate.get(dateKey)?.find(opt => Number(opt.key) === parkingStalls)?.text || '';
                    const { start, end } = this._dailyEventRange(date);
                    events.track(this._copyEventForDate(this.entity, start, end, parkingStalls, parkingStallName));
                });
            } else {
                events.track(this.entity);
            }

            await events.persist();
        } catch (e) {
            if (ErrorHandler.is_412_PRECONDITION_FAILED(e)) {
                const message = await ErrorHandler.message(e);
                console.warn(message, e);
                return Promise.reject(PersistConcurrencyFailureMessage);
            } else {
                throw e;
            }
        }
    }

    protected renderDisplayContent(): JSX.Element {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { [ConfigurationService]: { active: config } } = this.props.services;
        const event = this.entity;
        const liveProps = {
            entity: event
        };
        const { isAllDay, isSeriesMaster } = event;


        return (
            <FocusZone>
                <ResponsiveGrid className={styles.content}>
                    <GridRow>
                        {!isSeriesMaster && (
                            <GridCol sm={7} lg={5}>
                                <LiveText
                                    label={strings.Field_StartDate.Label}
                                    {...liveProps}
                                    propertyName="start"
                                >
                                    {(start) => (
                                        <Text data-is-focusable>
                                            {start.format(
                                                "dddd, MMMM DD, YYYY"
                                            )}
                                        </Text>
                                    )}
                                </LiveText>
                            </GridCol>
                        )}
                        <GridCol sm={5} lg={6}>
                            <LiveText
                                label={strings.Field_StartTime.Label}
                                {...liveProps}
                                propertyName="start"
                            >
                                {(start, state) => {
                                    let isAllDay = false;
                                    switch (state) {
                                        case "current":
                                            isAllDay =
                                                this.entity.currentValue<boolean>(
                                                    "isAllDay"
                                                );
                                            break;
                                        case "snapshot":
                                            isAllDay =
                                                this.entity.snapshotValue<boolean>(
                                                    "isAllDay"
                                                );
                                            break;
                                        case "previous":
                                            isAllDay =
                                                this.entity.previousValue<boolean>(
                                                    "isAllDay"
                                                );
                                            break;
                                    }
                                    return (
                                        <Text data-is-focusable>
                                            {isAllDay
                                                ? strings.AllDay
                                                : start.format("HH:mm")}
                                        </Text>
                                    );
                                }}
                            </LiveText>
                        </GridCol>
                        {!isSeriesMaster && (
                            <GridCol sm={7} lg={5}>
                                <LiveText
                                    label={strings.Field_EndDate.Label}
                                    {...liveProps}
                                    propertyName="end"
                                >
                                    {(end) => (
                                        <Text data-is-focusable>
                                            {end.format("dddd, MMMM DD, YYYY")}
                                        </Text>
                                    )}
                                </LiveText>
                            </GridCol>
                        )}
                        <GridCol sm={5} lg={6}>
                            {!isAllDay && (
                                <LiveText
                                    label={strings.Field_EndTime.Label}
                                    {...liveProps}
                                    propertyName="end"
                                >
                                    {(end, state) => {
                                        let isAllDay = false;
                                        switch (state) {
                                            case "current":
                                                isAllDay =
                                                    this.entity.currentValue<boolean>(
                                                        "isAllDay"
                                                    );
                                                break;
                                            case "snapshot":
                                                isAllDay =
                                                    this.entity.snapshotValue<boolean>(
                                                        "isAllDay"
                                                    );
                                                break;
                                            case "previous":
                                                isAllDay =
                                                    this.entity.previousValue<boolean>(
                                                        "isAllDay"
                                                    );
                                                break;
                                        }
                                        return (
                                            <Text data-is-focusable>
                                                {isAllDay
                                                    ? strings.AllDay
                                                    : end.format("HH:mm")}
                                            </Text>
                                        );
                                    }}
                                </LiveText>
                            )}
                        </GridCol>
                    </GridRow>
                    <GridRow>
                        <GridCol sm={6}>
                            <LiveText label="DV Pay Grade" {...liveProps} propertyName="dvPayGrade">
                            {(val) => {
                                return (
                                <Text data-is-focusable>{val || "-"}</Text>
                                 );
                            }}
                            </LiveText>
                        </GridCol>
                        <GridCol sm={6}>
                            <LiveText label="DV Rank/Mr./Mrs./Dr." {...liveProps} propertyName="dvRank">
                            {(val) => {
                                return (
                                <Text data-is-focusable>{val || "-"}</Text>
                                 );
                            }}
                            </LiveText>
                        </GridCol>
                    </GridRow>
                    <GridRow>
                        <GridCol sm={6}>
                            <LiveText label="DV First Name" {...liveProps} propertyName="dvFirstName">
                            {(val) => {
                                return (
                                <Text data-is-focusable>{val || "-"}</Text>
                                );
                            }}
                            </LiveText>
                        </GridCol>
                        <GridCol sm={6}>
                            <LiveText label="DV Last Name (Surname)" {...liveProps} propertyName="dvSurname">
                            {(val) => {
                                return (
                                <Text data-is-focusable>{val || "-"}</Text>
                                );
                            }}
                            </LiveText>
                        </GridCol>
                    </GridRow>
                    <GridRow>
                        <GridCol sm={6}>
                            <LiveText label="Which JDIR/Office is DV Visiting" {...liveProps} propertyName="jdirVisiting">
                            {(val) => {
                                return (
                                <Text data-is-focusable>{val || "-"}</Text>
                                 );
                            }}
                            </LiveText>
                        </GridCol>
                        <GridCol sm={6}>
                            <LiveText label="Is DV visiting COM, DCOM or COS?" {...liveProps} propertyName="dvVisiting">
                            {(val) => {
                                return (
                                <Text data-is-focusable>{val || "-"}</Text>
                                 );
                            }}
                            </LiveText>
                        </GridCol>
                    </GridRow> 
                    <GridRow>
                        <GridCol sm={6}>
                            <LiveText label="Requestor Rank/Mr./Mrs./Dr." {...liveProps} propertyName="requestorRank">
                            {(val) => {
                                return (
                                <Text data-is-focusable>{val || "-"}</Text>
                                 );
                            }}
                            </LiveText>
                        </GridCol>
                        <GridCol sm={6}>
                            <LiveText label="Requestor First Name" {...liveProps} propertyName="requestorFirstName">
                            {(val) => {
                                return (
                                <Text data-is-focusable>{val || "-"}</Text>
                                 );
                            }}
                            </LiveText>
                        </GridCol>
                    </GridRow>
                    <GridRow>
                        <GridCol sm={6}>
                            <LiveText label="Requestor Last Name" {...liveProps} propertyName="requestorLastName">
                            {(val) => {
                                return (
                                <Text data-is-focusable>{val || "-"}</Text>
                                 );
                            }}
                            </LiveText>
                        </GridCol>
                        <GridCol sm={6}>
                            <LiveText label="Requestor Office" {...liveProps} propertyName="requestorOffice">
                            {(val) => {
                                return (
                                <Text data-is-focusable>{val || "-"}</Text>
                                 );
                            }}
                            </LiveText>
                        </GridCol>
                    </GridRow>  
                    <GridRow>
                        <GridCol sm={6}>
                            <LiveText label="Requestor Duty Phone" {...liveProps} propertyName="requestorDutyPhone">
                            {(val) => {
                                return (
                                <Text data-is-focusable>{val || "-"}</Text>
                                 );
                            }}
                            </LiveText>
                        </GridCol>
                        <GridCol sm={6}>
                            <LiveText label="Requestor Cell Phone" {...liveProps} propertyName="requestorCellPhone">
                            {(val) => {
                                return (
                                <Text data-is-focusable>{val || "-"}</Text>
                                 );
                            }}
                            </LiveText>
                        </GridCol>
                    </GridRow>  
                    <GridRow>
                        <GridCol sm={12}>
                            <LiveText label="Requestor Email" {...liveProps} propertyName="requestorEmail">
                            {(val) => {
                                return (
                                <Text data-is-focusable>{val || "-"}</Text>
                                 );
                            }}
                            </LiveText>
                        </GridCol>
                    </GridRow>
                </ResponsiveGrid>
            </FocusZone>
        );
    }

    protected renderEditContent(): JSX.Element {
        const { [ConfigurationService]: { active: config } } = this.props.services;
        const { refiners, refinerValueOptionsByRefiner, showValidationFeedback } = this.state;
        const event = this.entity;
        const { isAllDay, start, isConfidential, isRecurring, isSeriesException, recurrence, recurrenceExceptionInstanceDate } = event;
        const isConfidentialPrevious = event.hasPrevious && event.previousValue<boolean>('isConfidential');
        const isConfidentialSnapshot = event.hasSnapshot && event.snapshotValue<boolean>('isConfidential');
        const confidentialFieldEnabled = (isConfidential || isConfidentialSnapshot || isConfidentialPrevious || config.allowConfidentialEvents);
        const liveProps = {
            entity: event,
            showValidationFeedback,
            updateField: this.updateField
        };
        const itemId = this.entity.id;

        return (
            <ResponsiveGrid className={styles.content}>
                <GridRow>
                    <GridCol sm={12}>
                        <ResponsiveGrid>
                            <GridRow>
                                {(!isRecurring || isSeriesException) &&
                                    <GridCol sm={12} lg={4}>
                                        <LiveDatePicker
                                            {...liveProps}
                                            label={strings.Field_StartDate.Label}
                                            propertyName='startDate'
                                            rules={Event.StartDateValidations}
                                            required
                                            allowTextInput
                                            updateField={(update) =>
                                                this.updateField(e => {
                                                    update(e);
                                                    this._resetParkingState();
                                                })
                                            }
                                        />
                                    </GridCol>
                                }
                                <GridCol sm={8} lg={5}>
                                    <LiveTimePicker
                                        {...liveProps}
                                        label={strings.Field_StartTime.Label}
                                        propertyName='startTime'
                                        required
                                        disabled={isAllDay}
                                        updateField={(update) =>
                                            this.updateField(e => {
                                                update(e);
                                                this._resetParkingState();
                                            })
                                        }
                                    />
                                </GridCol>
                            </GridRow>
                            <GridRow>
                                {(!isRecurring || isSeriesException) &&
                                    <GridCol sm={12} lg={4}>
                                        <LiveDatePicker
                                            {...liveProps}
                                            label={strings.Field_EndDate.Label}
                                            propertyName='endDate'
                                            rules={Event.EndDateValidations}
                                            required
                                            allowTextInput
                                            updateField={(update) =>
                                                this.updateField(e => {
                                                    update(e);
                                                    this._resetParkingState();
                                                })
                                            }
                                        />
                                    </GridCol>
                                }
                                <GridCol sm={8} lg={5}>
                                    <LiveTimePicker
                                        {...liveProps}
                                        label={strings.Field_EndTime.Label}
                                        propertyName='endTime'
                                        required
                                        disabled={isAllDay}
                                        updateField={(update) =>
                                            this.updateField(e => {
                                                update(e); 
                                                this._resetParkingState();
                                            })
                                        }
                                    />
                                </GridCol>
                            </GridRow>
                        </ResponsiveGrid>
                    </GridCol>
                </GridRow>
                {isSeriesException &&
                    <GridRow>
                        <GridCol>
                            <Label>{strings.Field_Recurring.Label}</Label>
                            <Text>{format(strings.ThisInstanceOccursOn, recurrenceExceptionInstanceDate.format('LL'))}</Text>
                            <br />
                            <Text>{humanizeRecurrencePattern(start, recurrence)}</Text>
                        </GridCol>
                    </GridRow>
                }
                <GridRow>
                    <GridCol sm={6}>
                        <LiveDropdown
                            {...liveProps}
                            label="DV Pay Grade"
                            propertyName="dvPayGrade"
                            required
                            options={[
                                { key: 'O-6', text: 'O-6' },
                                { key: 'O-7', text: 'O-7' },
                                { key: 'O-8', text: 'O-8' },
                                { key: 'O-9', text: 'O-9' },
                                { key: 'O-10', text: 'O-10' },
                                { key: 'GS-15', text: 'GS-15' },
                                { key: 'SES-1', text: 'SES-1' },
                                { key: 'SES-2', text: 'SES-2' },
                                { key: 'SES-3', text: 'SES-3' },
                                { key: 'SES-4', text: 'SES-4' },
                                { key: 'Other', text: 'Other' }
                            ]}
                            getKeyFromValue={(val) => val}
                        />
                    </GridCol>
                    <GridCol sm={6}>
                        <LiveTextField {...liveProps} label="DV Rank/Mr./Mrs./Dr." propertyName="dvRank" />
                    </GridCol>
                </GridRow>
                <GridRow>
                    <GridCol sm={6}>
                        <LiveTextField
                            {...liveProps}
                            label="DV First Name"
                            propertyName="dvFirstName"
                            updateField={(update) => this.updateField(e => {
                                update(e);
                                e.title = `${e.dvFirstName || ''} ${e.dvSurname || ''}`.trim();
                            })}
                        />
                    </GridCol>
                    <GridCol sm={6}>
                        <LiveTextField
                            {...liveProps}
                            label="DV Last Name (Surname)"
                            propertyName="dvSurname"
                            required
                            updateField={(update) => this.updateField(e => {
                                update(e);
                                e.title = `${e.dvFirstName || ''} ${e.dvSurname || ''}`.trim();
                            })}
                        />
                    </GridCol>
                </GridRow>
                <GridRow>
                    <GridCol sm={6}>
                        <LiveTextField {...liveProps} label="Which JDIR/Office is DV Visiting" propertyName="jdirVisiting" />
                    </GridCol>
                    <GridCol sm={6}>
                    <LiveDropdown
                        {...liveProps}
                        label="Is DV visiting COM, DCOM or COS?"
                        propertyName="dvVisiting"
                        required
                        options={[
                            { key: 'Yes', text: 'Yes' },
                            { key: 'No', text: 'No' }
                        ]}
                        getKeyFromValue={(val) => val}
                    />
                    </GridCol>
                </GridRow>
                    {this._isNewMultiDayEvent() ? (
                    <>
                        <GridRow>
                            <GridCol sm={12}>
                                <Stack verticalAlign="end" styles={{ root: { marginTop: 28 } }}>
                                    <PrimaryButton text="Search Available Parking" onClick={() => this._loadAvailableParking()}/>
                                </Stack>
                            </GridCol>
                        </GridRow>
                        {this._dailyEventDates().map(date => {
                            const dateKey = date.format('YYYY-MM-DD');
                            const options = this._parkingOptionsByDate.get(dateKey) || [];
                            const hasUnavailable = options.some(opt => opt.key === -1);
                            const dropdownOptions = options.length === 0 ? [{ key: -1, text: "Unavailable" }] : hasUnavailable ? options : [...options, { key: -1, text: "Unavailable" }];

                            return (
                                <GridRow key={dateKey}>
                                    <GridCol sm={12}>
                                        <Dropdown
                                            label={`Parking Stall - ${date.format('DD MMM, YYYY')}`}
                                            required
                                            placeholder="Select Parking"
                                            options={dropdownOptions}
                                            selectedKey={this._parkingSelectionsByDate.get(dateKey)}
                                            onChange={(ev, option) => this._setDailyParking(dateKey, option)}
                                            disabled={!this._parkingOptionsByDate.has(dateKey)}
                                        />
                                    </GridCol>
                                </GridRow>
                            );
                        })}
                    </>
                ) : (
                    <GridRow>
                        <GridCol sm={6}>
                            <LiveDropdown
                                {...liveProps}
                                label="Parking Stall"
                                propertyName="parkingStalls"
                                required
                                options={this._parkingOptions}
                                getKeyFromValue={(val) => val}
                                updateField={(update) =>
                                    this.updateField(e => {
                                        update(e);
                                        const selected = this._parkingOptions.find(opt => opt.key === e.parkingStalls);
                                        e.parkingStallName = selected?.text || '';
                                    })
                                }
                            />
                        </GridCol>
                        <GridCol sm={6}>
                            <Stack verticalAlign="end" styles={{ root: { marginTop: 28 } }}>
                                <PrimaryButton text="Search Available Parking" onClick={() => this._loadAvailableParking()}/>
                            </Stack>
                        </GridCol>
                    </GridRow>
                )}
            </ResponsiveGrid>
        );
    }

    protected renderDisplayHeader(): JSX.Element {
        return <EventOverview className={styles.header} event={this.entity}/>;
    }

    protected renderEditHeader(): JSX.Element {
        const event = this.entity;
        const { isSeriesException, recurrenceExceptionInstanceDate, seriesMaster } = event;
        const onEditSeries = () => { this.edit(seriesMaster.get()); };

        return <>
            {/* <EventOverview className={styles.header} event={this.entity} /> */}
            {isSeriesException &&
                <MessageBar delayedRender={false} role='alert' messageBarType={MessageBarType.info}>
                    {format(strings.Recurrence.EditingInstanceWarning, recurrenceExceptionInstanceDate.format('LL'))}.
                    &nbsp;
                    <Link onClick={onEditSeries}>{strings.Recurrence.Command_EditSeries.Text}</Link> {strings.Recurrence.EditSeriesButtonExplanation}
                </MessageBar>
            }
        </>;
    }

    protected markEntityDeleted(): void {
        this.entity.snapshot();

        if (this.entity.isSeriesException)
            this.entity.recurrenceInstanceCancelled = true;
        else
            this.entity.delete();
    }

    private _currentUserIsAnApprover(): boolean {
        const {
            [DirectoryService]: { currentUser },
            [EventsService]: { approversAsync },
        } = this.props.services;

        const currentUserApprovers = approversAsync.data?.filter(a => a.userIsAnApprover(currentUser)) || [];

        return Approvers.appliesToAny(currentUserApprovers, this.entity.valuesByRefiner());
    }

    protected buildDisplayHeaderCommands(): ICommandBarItemProps[] {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { creator } = this.entity;

        return [
        ].filter(Boolean);
    }

    protected buildEditHeaderCommands(): ICommandBarItemProps[] {
        const { [DirectoryService]: { currentUserIsSiteAdmin, currentUser } } = this.props.services;
        const { submitting } = this.state;
        const { isRecurring, isSeriesException, isSeriesMaster, seriesMaster, isDeleted, isNew, creator } = this.entity;
        const onSubmit = () => this.submit(() => {
            if (this._isNewMultiDayEvent())
                this.dismiss();
            else
                this.display();
        });
        const onSaveAndAddAnother = () => this._saveAndReset();
        const onConfirmDiscard = () => this.confirmDiscard();
        const onDelete = () => { this.confirmDelete(); };
        const onDeleteSeries = () => {
            this.entity.revert();
            this.edit(seriesMaster.get(), false);
            this.confirmDelete();
        };

        const deleteSingleCommand: ICommandBarItemProps = {
            key: 'delete',
            text: strings.Command_Delete.Text,
            iconProps: { iconName: 'Delete' },
            disabled: isDeleted,
            onClick: onDelete
        };

        const deleteSeriesMasterCommand: ICommandBarItemProps = {
            key: 'delete',
            text: strings.Command_Delete_Series.Text,
            iconProps: { iconName: 'Delete' },
            disabled: isDeleted,
            onClick: onDelete
        };

        const deleteRecurringCommand: ICommandBarItemProps = {
            key: 'delete',
            text: strings.Command_Delete.Text,
            iconProps: { iconName: 'Delete' },
            disabled: isDeleted,
            subMenuProps: {
                items: [{
                    key: 'delete-series',
                    text: strings.Command_Delete_Recurring_Series.Text,
                    onClick: onDeleteSeries
                }, {
                    key: 'delete-occurrence',
                    text: strings.Command_Delete_Recurring_Instance.Text,
                    onClick: onDelete
                }]
            }
        };

        const userCanApprove = currentUserIsSiteAdmin || this._currentUserIsAnApprover();
        const userIsCreator = User.equal(creator, currentUser);
        const canEdit = userIsCreator || userCanApprove;
        const canDelete = (!isNew || isSeriesException) && canEdit;

        return [{
            key: 'save',
            text: strings.Command_Save.Text,
            iconProps: { iconName: 'Save' },
            disabled: submitting || isDeleted,
            onClick: onSubmit
        }, {
            key: 'save-add-another',
            text: 'Save & Submit Another',
            iconProps: { iconName: 'Add' },
            disabled: submitting || isDeleted,
            onClick: onSaveAndAddAnother
        }, {
            key: 'discard',
            text: strings.Command_Discard.Text,
            iconProps: { iconName: 'Cancel' },
            disabled: isDeleted,
            onClick: onConfirmDiscard
        },
        canDelete && (
            isRecurring
                ? (isSeriesMaster
                    ? deleteSeriesMasterCommand
                    : deleteRecurringCommand
                )
                : deleteSingleCommand
        )
        ].filter(Boolean);
    }
}

export default withServices(EventPanel);
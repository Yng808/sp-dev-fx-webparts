import { PrincipalType } from '@pnp/sp';
import { Guid } from '@microsoft/sp-core-library';
import React from 'react';
import { FocusZone, format, ICommandBarItemProps, IDropdownOption, Label, Link, MessageBar, MessageBarType, Stack, Text, DefaultButton } from "@fluentui/react";
import { Entity, ErrorHandler, humanizeDuration, mapToArray, now, User, ValidationRule } from 'common';
import { EntityPanelBase, IEntityPanelProps, IDataPanelBaseState, ResponsiveGrid, GridRow, GridCol, LiveText, LiveUpdate, IDataPanelBase, LiveToggle, LiveUserPicker, LiveTextField, LiveTimePicker, LiveDatePicker, Validation, ITransformer, LiveMultiselectDropdown, LiveDropdown } from "common/components";
import { Event, Refiner, RefinerValue, RecurPattern, EventModerationStatus, Approvers, humanizeRecurrencePattern } from "model";
import { withServices, ServicesProp, EventsServiceProp, EventsService, ConfigurationServiceProp, ConfigurationService, DirectoryServiceProp, DirectoryService } from 'services';
import { EventOverview } from '../events';
import { RefinerValuePill } from '../refiners';
import { ListItemTechnicals } from '../shared';
import { PatternChoiceGroup, DailyEditor, WeeklyEditor, MonthlyEditor, YearlyEditor, UntilEditor } from '../recurrence';
import { IEventCommands } from './IEventCommands';

import { PersistConcurrencyFailureMessage, Validation as validationStrings, EventPanel as strings } from "ComponentStrings";

import styles from './EventPanel.module.scss';
import EventAttachments from './EventAttachments';
import { sp } from "@pnp/sp";

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
type IProps = IOwnProps & IEntityPanelProps<Event> & ServicesProp<DirectoryServiceProp & ConfigurationServiceProp & EventsServiceProp>;

interface IOwnState {
    refinerValueOptionsByRefiner: Map<Refiner, IDropdownOption[]>;
    refiners: readonly Refiner[];
    parkingStallsOptions: IDropdownOption[];
    loadingSpots: boolean;
}
type IState = IOwnState & IDataPanelBaseState<Event>;

class EventPanel extends EntityPanelBase<Event, IProps, IState> implements IEventPanel {
    private readonly _refinerValueValidationRulesByRefiner = new Map<Refiner, RefinerValueValidationRule>();

    protected get title() {
        return this.entity?.displayName || (this.isNew ? strings.NewEvent : '');
    }

    protected resetState(): IState {
        this._buildRefinerValueOptions();
        //this._buildRefinerValueValidationRules();

        return {
            ...super.resetState(),
            refinerValueOptionsByRefiner: new Map(),
            refiners: [],
            parkingStallsOptions: [],
            loadingSpots: false
        };
    }

    protected validate(): boolean {
        const rules = mapToArray(this._refinerValueValidationRulesByRefiner);
        return super.validate() && rules.every(rule => rule.validate(this.entity));
    }

    public componentShouldRender() {
        super.componentShouldRender();
        this._buildRefinerValueOptions();
        //this._buildRefinerValueValidationRules();
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

    private async _loadAvailableParking(start: Date, end: Date) {
        this.setState({ loadingSpots: true });

        try {
            const web = await sp.web.get();
            const siteUrl = web.Url;

            // STEP 1: Fetch all parking stalls
            const parkingResponse = await fetch(
            `${siteUrl}/_api/web/lists/getbytitle('DVParkingStalls')/items?$select=ID,ParkingAssigment`,
            {
                method: "GET",
                headers: {
                Accept: "application/json;odata=verbose",
                },
            }
            );

            if (!parkingResponse.ok) {
            throw new Error(`Failed to fetch spots: ${parkingResponse.statusText}`);
            }

            const allParkingData = await parkingResponse.json();
            const allParking = allParkingData.d.results.map((item: any) => ({
            id: item.ID,
            //title: item.Title,
            parking :item.ParkingAssigment
            }));

            // STEP 2: Fetch booked parking assignments in the time window
            const bookingsResponse = await fetch(
            `${siteUrl}/_api/web/lists/getbytitle('Rob Calendar Events2')/items` +
                `?$select=ParkingStallsId,EventDate,EndDate,RequestStatus` +
                `&$filter=RequestStatus eq 'Approve Request' 
                and (EndDate gt datetime'${start.toISOString()}' 
                and EventDate lt datetime'${end.toISOString()}')`,
            {
                method: "GET",
                headers: {
                Accept: "application/json;odata=verbose",
                },
            }
            );

            if (!bookingsResponse.ok) {
            throw new Error(`Failed to fetch bookings: ${bookingsResponse.statusText}`);
            }

            const bookingsData = await bookingsResponse.json();
            const bookedParkingIds = new Set(
            bookingsData.d.results
                .map((item: any) => item.ParkingStallsId)
                .filter((id: number | null) => id != null)
            );

            // STEP 3: Filter parking that aren't booked
            const availableParking = allParking
            .filter((parkingSpot: { id: number; parking: string }) => !bookedParkingIds.has(parkingSpot.id))
            .map((parkingSpot: { id: number; parking: string }) => ({
                key: parkingSpot.id,
                text: parkingSpot.parking,
            }));

            this.setState({
            parkingStallsOptions: availableParking,
            loadingSpots: false,
            });

        } catch (error) {
            console.error("Error determining available parking:", error);
            this.setState({ loadingSpots: false });
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

            events.track(this.entity);
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

    // private _renderModerationStatus() {
    //     const {
    //         [DirectoryService]: { currentUserIsSiteAdmin, currentUser },
    //         [ConfigurationService]: { active: { useApprovals } }
    //     } = this.props.services;
    //     const { creator, isApproved, isPendingApproval, isRejected, moderator, moderationMessage, moderationTimestamp } = this.entity

    //     if (!useApprovals) return <></>;

    //     const userCanApprove = currentUserIsSiteAdmin || this._currentUserIsAnApprover();
    //     const userIsCreator = this.isNew || User.equal(creator, currentUser);

    //     return <>
    //         {this.inDisplayMode && isPendingApproval && <>
    //             <MessageBar messageBarType={MessageBarType.warning} data-is-focusable>
    //                 {strings.Moderation.EventIsPendingApproval}
    //             </MessageBar>
    //         </>}
    //         {this.inEditMode && isPendingApproval && !userCanApprove && <>
    //             <MessageBar messageBarType={MessageBarType.warning} data-is-focusable>
    //                 {strings.Moderation.EventWillNeedApproval}
    //             </MessageBar>
    //         </>}
    //         {this.inEditMode && isPendingApproval && userCanApprove && <>
    //             <MessageBar messageBarType={MessageBarType.success} data-is-focusable>
    //                 {strings.Moderation.EventWillBeAutoApproved}
    //             </MessageBar>
    //         </>}
    //         {isApproved && (userIsCreator || userCanApprove) && <>
    //             <MessageBar messageBarType={MessageBarType.success} data-is-focusable>
    //                 {format(strings.Moderation.EventIsApproved, moderator.title, moderationTimestamp.format('LLL'))}
    //                 {moderationMessage && <>
    //                     <Label>{strings.Moderation.ModeratorMessage}</Label>
    //                     <Text>{moderationMessage}</Text>
    //                 </>}
    //             </MessageBar>
    //         </>}
    //         {isRejected && (userIsCreator || userCanApprove) && <>
    //             <MessageBar messageBarType={MessageBarType.severeWarning} data-is-focusable>
    //                 {format(strings.Moderation.EventIsRejected, moderator.title, moderationTimestamp.format('LLL'))}
    //                 {moderationMessage && <>
    //                     <Label>{strings.Moderation.ModeratorMessage}</Label>
    //                     <Text>{moderationMessage}</Text>
    //                 </>}
    //             </MessageBar>
    //         </>}
    //     </>;
    // }

    protected renderDisplayContent(): JSX.Element {
        const { [ConfigurationService]: { active: config } } = this.props.services;
        const { refiners } = this.state;
        const event = this.entity;
        const liveProps = {
            entity: event
        };
        const { isAllDay, start, isConfidential, isRecurring, isSeriesMaster, isSeriesException, seriesMaster } = event;
        const isConfidentialPrevious = event.hasPrevious && event.previousValue<boolean>('isConfidential');
        const isConfidentialSnapshot = event.hasSnapshot && event.snapshotValue<boolean>('isConfidential');
        const confidentialFieldEnabled = (isConfidential || isConfidentialSnapshot || isConfidentialPrevious || config.allowConfidentialEvents);
        const itemId = event.id;
        const masterEvent = event.isSeriesException ? event.getSeriesMaster() : event;
        const eventId = masterEvent.id;
        

        return (
            <FocusZone>
                <ResponsiveGrid className={styles.content}>
                    <GridRow>
                        <GridCol sm={12}>
                            <LiveText
                                label={strings.Field_Title.Label}
                                {...liveProps}
                                propertyName="title"
                            >
                                {(val) => (
                                    <Text data-is-focusable>{val || "-"}</Text>
                                )}
                            </LiveText>
                        </GridCol>
                    </GridRow>
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
                                                : start.format("LT")}
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
                                                    : end.format("LT")}
                                            </Text>
                                        );
                                    }}
                                </LiveText>
                            )}
                        </GridCol>
                    </GridRow>
                    {/* {isRecurring && (
                        <GridRow>
                            <GridCol>
                                <LiveText
                                    label={strings.Field_Recurring.Label}
                                    {...liveProps}
                                    propertyName="recurrence"
                                >
                                    {(recurrence) => (
                                        <Text data-is-focusable>
                                            {humanizeRecurrencePattern(
                                                start,
                                                recurrence
                                            )}
                                        </Text>
                                    )}
                                </LiveText>
                            </GridCol>
                        </GridRow>
                    )} */}
                    {/* <GridRow>
                        <GridCol sm={12}>
                            <LiveText label={strings.Field_Location.Label} {...liveProps} propertyName='location'>
                                {val => <Text data-is-focusable>{val || "-"}</Text>}
                            </LiveText>
                        </GridCol>
                    </GridRow> */}
                    {/* <GridRow>
                        <GridCol sm={12}>
                            <LiveText
                                label={strings.Field_Description.Label}
                                {...liveProps}
                                propertyName="description"
                            >
                                {(val) => (
                                    <Text data-is-focusable>{val || "-"}</Text>
                                )}
                            </LiveText>
                        </GridCol>
                    </GridRow>
                    <GridRow>
                        <GridCol sm={12}>
                            <LiveText
                                label={strings.Field_Contacts.Label}
                                {...liveProps}
                                propertyName="contacts"
                                tooltip={strings.Field_Contacts.Tooltip}
                            >
                                {(val) => (
                                    <Text data-is-focusable>
                                        {val
                                            .map(({ title }) => title)
                                            .join(", ") || "-"}
                                    </Text>
                                )}
                            </LiveText>
                        </GridCol>
                    </GridRow>
                    <GridRow>
                        <GridCol sm={12}>
                            <LiveText
                                label="COM Decision"
                                {...liveProps}
                                propertyName="comDecision"
                            >
                                {(val) => {
                                    //console.log("Display Mode - COM Decision:", val);
                                    return (
                                        <Text data-is-focusable>
                                            {val || "-"}
                                        </Text>
                                    );
                                }}
                            </LiveText>
                        </GridCol>
                    </GridRow>
                    <GridRow>
                        <GridCol sm={12}>
                            <LiveText
                                label="Read Ahead Due Date"
                                {...liveProps}
                                propertyName="readAheadDueDate"
                            >
                                {(readAheadDueDate) => (
                                    <Text data-is-focusable>
                                        {readAheadDueDate
                                            ? readAheadDueDate.format(
                                                  "dddd, MMMM DD, YYYY"
                                              )
                                            : "-"}
                                    </Text>
                                )}
                            </LiveText>
                        </GridCol>
                    </GridRow>
                    <GridRow>
                        {refiners.map((refiner) => {
                            const transformer = {
                                transform: (values: RefinerValue[]) =>
                                    values.filter(
                                        (v) => v.refiner.get() === refiner
                                    ),
                                reverse: (values: RefinerValue[]) => values,
                            };

                            return (
                                <GridCol
                                    key={refiner.key}
                                    sm={12}
                                    md={6}
                                    lg={4}
                                >
                                    <LiveText
                                        label={refiner.displayName}
                                        {...liveProps}
                                        propertyName="refinerValues"
                                        transformer={transformer}
                                    >
                                        {(val) => (
                                            <Stack
                                                horizontal
                                                wrap
                                                verticalAlign="center"
                                                tokens={{ childrenGap: 6 }}
                                            >
                                                {val.map((refinerValue) => (
                                                    <RefinerValuePill
                                                        key={refinerValue.key}
                                                        refinerValue={
                                                            refinerValue
                                                        }
                                                    />
                                                ))}
                                            </Stack>
                                        )}
                                    </LiveText>
                                </GridCol>
                            );
                        })}
                    </GridRow>
                    <GridRow>
                        <GridCol sm={12}>
                            {this._renderModerationStatus()}
                        </GridCol>
                    </GridRow>
                    {confidentialFieldEnabled && (
                        <GridRow>
                            <GridCol sm={3}>
                                <LiveText
                                    label={strings.Field_Confidential.Label}
                                    {...liveProps}
                                    propertyName="isConfidential"
                                    tooltip={strings.Field_Confidential.Tooltip}
                                >
                                    {(val) => (
                                        <Text data-is-focusable>
                                            {val
                                                ? strings.Field_Confidential
                                                      .OnText
                                                : strings.Field_Confidential
                                                      .OffText}
                                        </Text>
                                    )}
                                </LiveText>
                            </GridCol>
                            <GridCol sm={9}>
                                {isConfidential && (
                                    <LiveText
                                        label={
                                            strings
                                                .Field_RestrictedToAccounts_Display
                                                .Label
                                        }
                                        {...liveProps}
                                        propertyName="restrictedToAccounts"
                                    >
                                        {(val) => (
                                            <Text data-is-focusable>
                                                {val
                                                    .map(({ title }) => title)
                                                    .join(", ") || "-"}
                                            </Text>
                                        )}
                                    </LiveText>
                                )}
                            </GridCol>
                        </GridRow>
                    )}
                    {!isRecurring && itemId > 0 &&
                        <GridRow>
                            <GridCol>
                                <EventAttachments
                                    itemId={itemId}
                                    isEditable={true}
                                />
                            </GridCol>
                        </GridRow>
                    }
                    {isRecurring && eventId > 0 &&
                        <GridRow>
                            <GridCol>
                                <EventAttachments
                                    itemId={eventId}
                                    isEditable={true}
                                />
                            </GridCol>
                        </GridRow>
                    } */}
                    <GridRow>
                        <GridCol sm={6}>
                            <Label></Label>
                            <LiveText label="Parking Assignment" {...liveProps} propertyName="parkingStalls">
                            {(val) => {
                                return (
                                <Text data-is-focusable>{val || "-"}</Text>
                                 );
                            }}
                            </LiveText>
                        </GridCol>
                        <GridCol sm={6}>
                            <LiveText label="Request Status" {...liveProps} propertyName="requestStatus">
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
                    <GridRow>
                        <GridCol sm={12}>
                            <ListItemTechnicals
                                entity={
                                    (this.isNew &&
                                        isSeriesException &&
                                        seriesMaster.get()) ||
                                    event
                                }
                            />
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
                        <LiveTextField
                            {...liveProps}
                            label={strings.Field_Title.Label}
                            propertyName='title'
                            required
                            rules={Event.TitleValidations}
                        />
                    </GridCol>
                </GridRow>
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
                                    />
                                </GridCol>
                                {/* <GridCol sm={4} lg={3}>
                                    <LiveToggle
                                        {...liveProps}
                                        label={strings.Field_AllDayEvent.Label}
                                        onText={strings.Field_AllDayEvent.OnText}
                                        offText={strings.Field_AllDayEvent.OffText}
                                        propertyName='isAllDay'
                                    />
                                </GridCol> */}
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
                                    />
                                </GridCol>
                                <GridCol sm={4} lg={3}>
                                    {!isAllDay && <>
                                        <Label>Duration</Label>
                                        <Text>{humanizeDuration(this.entity.duration)}</Text>
                                    </>}
                                </GridCol>
                            </GridRow>

                            
                        </ResponsiveGrid>
                    </GridCol>
                </GridRow>
                {/* {isSeriesException &&
                    <GridRow>
                        <GridCol>
                            <Label>{strings.Field_Recurring.Label}</Label>
                            <Text>{format(strings.ThisInstanceOccursOn, recurrenceExceptionInstanceDate.format('LL'))}</Text>
                            <br />
                            <Text>{humanizeRecurrencePattern(start, recurrence)}</Text>
                        </GridCol>
                    </GridRow>
                }
                {!isSeriesException &&
                    <GridRow>
                        <GridCol sm={12} lg={3}>
                            <LiveToggle
                                {...liveProps}
                                label={strings.Field_Recurring.Label}
                                onText={strings.Field_Recurring.OnText}
                                offText={strings.Field_Recurring.OffText}
                                propertyName='isRecurring'
                            />
                        </GridCol>
                        <GridCol sm={12} lg={9}>
                            {isRecurring &&
                                <LiveUpdate entity={event} propertyName='recurrence' renderValue={recur => humanizeRecurrencePattern(start, recur)} updateValue={recurrence => this.updateField(e => e.recurrence = recurrence)}>{renderLiveUpdateMark => {
                                    const { pattern } = recurrence;
                                    return (
                                        <Stack tokens={{ childrenGap: 16 }} styles={{ root: { marginTop: 6 } }}>
                                            {renderLiveUpdateMark()}
                                            <PatternChoiceGroup
                                                selectedKey={pattern.toString()}
                                                onChange={(ev, opt) => this.updateField(e => e.recurrence.pattern = parseInt(opt.key))}
                                            />
                                            {pattern === RecurPattern.daily &&
                                                <DailyEditor {...liveProps} />
                                            }
                                            {pattern === RecurPattern.weekly &&
                                                <WeeklyEditor {...liveProps} />
                                            }
                                            {pattern === RecurPattern.monthly &&
                                                <MonthlyEditor {...liveProps} />
                                            }
                                            {pattern === RecurPattern.yearly &&
                                                <YearlyEditor {...liveProps} />
                                            }
                                            <LiveDatePicker
                                                {...liveProps}
                                                label={strings.Field_StartDate.Label}
                                                propertyName='startDate'
                                                rules={Event.StartDateValidations}
                                                required
                                                allowTextInput
                                            />
                                            <UntilEditor {...liveProps} />
                                        </Stack>
                                    );
                                }}
                                </LiveUpdate>
                            }
                        </GridCol>
                        <GridCol sm={12}>
                            {this.entity.hasRecurrenceChanges() &&
                                <MessageBar messageBarType={MessageBarType.warning}>{strings.Recurrence.UpdateWarning}</MessageBar>
                            }
                        </GridCol>
                    </GridRow>
                } */}
                {/* <GridRow>
                    <GridCol sm={12}>
                        <LiveTextField
                            {...liveProps}
                            label={strings.Field_Location.Label}
                            propertyName='location'
                            rules={Event.LocationValidations}
                        />
                    </GridCol>
                </GridRow> */}
                {/* <GridRow>
                    <GridCol sm={12}>
                        <LiveTextField
                            {...liveProps}
                            label={strings.Field_Description.Label}
                            propertyName='description'
                            multiline
                            rows={3}
                        />
                    </GridCol>
                </GridRow>
                <GridRow>
                    <GridCol sm={12}>
                        <LiveUserPicker
                            {...liveProps}
                            label={strings.Field_Contacts.Label}
                            tooltip={strings.Field_Contacts.Tooltip}
                            propertyName='contacts'
                            restrictPrincipalType={PrincipalType.All}
                        />
                    </GridCol>
                </GridRow>
                <GridRow>
                    <GridCol sm={12}>
                    <LiveDropdown
                        {...liveProps}
                        label="COM Decision"
                        propertyName="comDecision"
                        options={[
                            { key: 'Undecided', text: 'Undecided' },
                            { key: 'Tentative', text: 'Tentative' },
                            { key: 'Hold', text: 'Hold' },
                            { key: 'Accept', text: 'Accept' }
                        ]}
                        required={false}
                        getKeyFromValue={(val) => val}  // This assumes that the value is the key itself
                    />
                    </GridCol>
                </GridRow>
                <GridRow>
                    <GridCol sm={12}>
                        <LiveDatePicker
                            {...liveProps}
                            label="Read Ahead Due Date"
                            propertyName='readAheadDueDate'                        
                            allowTextInput
                        />
                    </GridCol>
                </GridRow>
                
                <GridRow>
                    {refiners.filter(Entity.NotDeletedFilter).map(refiner => {
                        const { displayName, required, allowMultiselect } = refiner;
                        const rules = [this._refinerValueValidationRulesByRefiner.get(refiner)];

                        const transformer: ITransformer<RefinerValue[]> = {
                            transform: (values: RefinerValue[]) => {
                                return values.filter(v => v.refiner.get() === refiner);
                            },
                            reverse: (values: RefinerValue | RefinerValue[]) => {
                                return [
                                    ...event.refinerValues.filter(v => v.refiner.get() !== refiner),
                                    ...(values instanceof Array ? values : [values]).filter(v => v !== refiner.blankValue)
                                ].filter(Boolean);
                            }
                        };

                        const livePropsForRefinerDropdowns = {
                            entity: event,
                            showValidationFeedback,
                            updateField: (update: (event: Event) => void) => {
                                this.updateField(event => {
                                    update(event);
                                    event.moderationStatus = EventModerationStatus.Pending;
                                });
                            }
                        }

                        return (
                            <GridCol key={refiner.key} sm={12} md={6} lg={4}>
                                <Validation entity={event} rules={rules} active={showValidationFeedback}>
                                    {allowMultiselect
                                        ? <LiveMultiselectDropdown
                                            {...livePropsForRefinerDropdowns}
                                            transformer={transformer}
                                            propertyName='refinerValues'
                                            label={displayName}
                                            required={required}
                                            options={refinerValueOptionsByRefiner.get(refiner)}
                                            getKeyFromValue={val => val.key}
                                            renderValue={vals =>
                                                <Stack horizontal wrap verticalAlign="center" tokens={{ childrenGap: 6 }}>
                                                    {vals.map(v => <RefinerValuePill key={v.key} refinerValue={v} />)}
                                                </Stack>
                                            }
                                        />
                                        : <LiveDropdown
                                            {...livePropsForRefinerDropdowns}
                                            transformer={transformer}
                                            propertyName='refinerValues'
                                            label={displayName}
                                            required={required}
                                            options={refinerValueOptionsByRefiner.get(refiner)}
                                            getKeyFromValue={val => val?.key || 0}
                                            renderValue={val => val && val.length > 0 && <RefinerValuePill refinerValue={val[0]} />}
                                        />
                                    }
                                </Validation>
                            </GridCol>
                        );
                    })}
                </GridRow>
                <GridRow>
                    <GridCol sm={12}>
                        {this._renderModerationStatus()}
                    </GridCol>
                </GridRow>
                {confidentialFieldEnabled &&
                    (isSeriesException
                        ? <GridRow>
                            <GridCol sm={3}>
                                <LiveText label={strings.Field_Confidential.Label} {...liveProps} propertyName='isConfidential' tooltip={strings.Field_Confidential.Tooltip}>
                                    {val => val ? strings.Field_Confidential.OnText : strings.Field_Confidential.OffText}
                                </LiveText>
                            </GridCol>
                            <GridCol sm={9}>
                                {isConfidential &&
                                    <LiveText label={strings.Field_RestrictedToAccounts_Display.Label} {...liveProps} propertyName='restrictedToAccounts'>
                                        {val => val.map(({ title }) => title).join(', ') || "-"}
                                    </LiveText>
                                }
                            </GridCol>
                        </GridRow>
                        : <GridRow>
                            <GridCol sm={12} lg={3}>
                                <LiveToggle
                                    {...liveProps}
                                    label={strings.Field_Confidential.Label}
                                    onText={strings.Field_Confidential.OnText}
                                    offText={strings.Field_Confidential.OffText}
                                    tooltip={strings.Field_Confidential.Tooltip}
                                    propertyName='isConfidential'
                                />
                            </GridCol>
                            <GridCol sm={12} lg={9}>
                                {isConfidential &&
                                    <LiveUserPicker
                                        {...liveProps}
                                        label={strings.Field_RestrictedToAccounts_Edit.Label}
                                        propertyName='restrictedToAccounts'
                                    />
                                }
                            </GridCol>
                        </GridRow>
                    )}
                <GridRow>
                    <GridCol>
                        {!this.isNew && itemId ? (
                            <EventAttachments itemId={itemId} isEditable={true}/>
                        ) : (
                            <div/>
                        )}
                    </GridCol>
                </GridRow> */}
                <GridRow>
                    <GridCol sm={12}>
                        <DefaultButton
                        text="Click to load Available Parking"
                        onClick={async () => {
                            const start = this.entity.start;
                            const end = this.entity.end;

                            if (start && end) {
                            await this._loadAvailableParking(start.toDate(), end.toDate());
                            } else {
                            console.warn("Start and end dates must be set before checking room availability.");
                            }
                        }}
                        disabled={this.state.loadingSpots}
                        />
                    </GridCol>
                </GridRow>
                <GridRow>
                    <GridCol sm={6}>
                        <LiveDropdown
                        {...liveProps}
                        label="Parking Assignment"
                        propertyName="parkingStalls"
                        options={this.state.parkingStallsOptions}
                        getKeyFromValue={(val) => val}
                        />
                    </GridCol>
                    <GridCol sm={6}>
                        <LiveDropdown
                        {...liveProps}
                        label="Request Status"
                        propertyName="requestStatus"
                        options={[
                            { key: 'New Request', text: 'New Request' },
                            { key: 'Approve Request', text: 'Approve Request' },
                            { key: 'Cancel Request', text: 'Cancel Request' },
                            { key: 'Reject Request', text: 'Reject Request' }
                        ]}
                        required={false}
                        getKeyFromValue={(val) => val}
                        />
                    </GridCol>
                </GridRow>
                <GridRow>
                    <GridCol sm={6}>
                        <LiveDropdown
                        {...liveProps}
                        label="DV Pay Grade"
                        propertyName="dvPayGrade"
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
                            { key: 'SES-4', text: 'SES-4' }
                        ]}
                        required={false}
                        getKeyFromValue={(val) => val}
                        />
                    </GridCol>
                    <GridCol sm={6}>
                        <LiveTextField
                        {...liveProps}
                        label="DV Rank/Mr./Mrs./Dr."
                        propertyName="dvRank"
                        />
                    </GridCol>
                </GridRow>
                <GridRow>
                    <GridCol sm={6}>
                        <LiveTextField
                        {...liveProps}
                        label="DV First Name"
                        propertyName="dvFirstName"
                        />
                    </GridCol>
                    <GridCol sm={6}>
                        <LiveTextField
                        {...liveProps} 
                        label="DV Last Name (Surname)" 
                        propertyName="dvSurname"
                        />
                    </GridCol>
                </GridRow>
                <GridRow>
                    <GridCol sm={6}>
                        <LiveTextField
                        {...liveProps}
                        label="Which JDIR/Office is DV Visiting"
                        propertyName="jdirVisiting"
                        />
                    </GridCol>
                    <GridCol sm={6}>
                        <LiveTextField
                        {...liveProps}
                        label="Is DV visiting COM, DCOM or COS?"
                        propertyName="dvVisiting"
                        />
                    </GridCol>
                </GridRow>
                <GridRow>
                    <GridCol sm={6}>
                        <LiveTextField
                        {...liveProps}
                        label="Requestor Rank/Mr./Mrs./Dr."
                        propertyName="requestorRank"
                        />
                    </GridCol>
                    <GridCol sm={6}>
                        <LiveTextField
                        {...liveProps}
                        label="Requestor First Name"
                        propertyName="requestorFirstName"
                        />
                    </GridCol>
                </GridRow>
                <GridRow>
                    <GridCol sm={6}>
                        <LiveTextField
                        {...liveProps}
                        label="Requestor Last Name"
                        propertyName="requestorLastName"
                        />
                    </GridCol>
                    <GridCol sm={6}>
                        <LiveTextField
                        {...liveProps}
                        label="Requestor Office"
                        propertyName="requestorOffice"
                        />
                    </GridCol>
                </GridRow>
                <GridRow>
                    <GridCol sm={6}>
                        <LiveTextField
                        {...liveProps}
                        label="Requestor Duty Phone"
                        propertyName="requestorDutyPhone"
                        />
                    </GridCol>
                    <GridCol sm={6}>
                        <LiveTextField
                        {...liveProps}
                        label="Requestor Cell Phone"
                        propertyName="requestorCellPhone"
                        />
                    </GridCol>
                </GridRow>
                <GridRow>
                    <GridCol sm={6}>
                        <LiveTextField
                        {...liveProps}
                        label="Requestor Email"
                        propertyName="requestorEmail"
                        />
                    </GridCol>
                </GridRow>
                <GridRow>
                    <GridCol sm={12}>
                        <ListItemTechnicals entity={this.entity} />
                    </GridCol>
                </GridRow>
            </ResponsiveGrid>
        );
    }

    protected renderDisplayHeader(): JSX.Element {
        return <EventOverview className={styles.header} event={this.entity} />;
    }

    protected renderEditHeader(): JSX.Element {
        const event = this.entity;
        const { isSeriesException, recurrenceExceptionInstanceDate, seriesMaster } = event;
        const onEditSeries = () => { this.edit(seriesMaster.get()); };

        return <>
            <EventOverview className={styles.header} event={this.entity} />
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
        const {
            commands: { approve, reject, addToOutlook, addSeriesToOutlook, getLink },
            services: { [DirectoryService]: { currentUserIsSiteAdmin, currentUser, currentUserIsContributor } }
        } = this.props;
        const { isRecurring, isSeriesException, isSeriesMaster, seriesMaster, isDeleted, isNew, isApproved, creator } = this.entity;
        const onEdit = () => { this.edit(); };
        const onEditSeries = () => { this.edit(seriesMaster.get(), false); };
        const onDelete = () => { this.confirmDelete(); };
        const onDeleteSeries = () => {
            this.edit(seriesMaster.get(), false);
            this.confirmDelete();
        };
        const onApprove = () => { approve(this.entity); };
        const onReject = () => { reject(this.entity); };
        const onAddToOutlook = () => { addToOutlook(this.entity); };
        const onAddSeriesToOutlook = () => { addSeriesToOutlook(this.entity); };
        const onGetLink = () => { getLink(this.entity); };

        const editSingleCommand: ICommandBarItemProps = {
            key: 'edit',
            text: strings.Command_Edit.Text,
            iconProps: { iconName: 'Edit' },
            disabled: isDeleted,
            onClick: onEdit
        };

        const editSeriesCommand: ICommandBarItemProps = {
            key: 'edit',
            text: "Edit series",
            iconProps: { iconName: 'Edit' },
            disabled: isDeleted,
            onClick: onEdit
        };

        const editRecurringCommand: ICommandBarItemProps = {
            key: 'edit',
            text: strings.Command_Edit.Text,
            iconProps: { iconName: 'Edit' },
            disabled: isDeleted,
            subMenuProps: {
                items: [{
                    key: 'edit-series',
                    text: strings.Command_Edit_Recurring_Series.Text,
                    onClick: onEditSeries
                }, {
                    key: 'edit-occurrence',
                    text: strings.Command_Edit_Recurring_Instance.Text,
                    onClick: onEdit
                }]
            }
        };

        const moderationCommand: ICommandBarItemProps = {
            key: 'moderation',
            text: strings.Command_Approval.Text,
            iconProps: { iconName: 'EventAccepted' },
            disabled: isDeleted,
            subMenuProps: {
                items: [{
                    key: 'approve',
                    iconProps: { iconName: 'Accept' },
                    text: strings.Command_Approval_Approve.Text,
                    onClick: onApprove
                }, {
                    key: 'decline',
                    iconProps: { iconName: 'Clear' },
                    text: strings.Command_Approval_Reject.Text,
                    onClick: onReject
                }]
            }
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

        const addToOutlookSingleCommand: ICommandBarItemProps = {
            key: 'add-to-outlook',
            text: strings.Command_AddToOutlook.Text,
            iconProps: { iconName: 'AddEvent' },
            disabled: isDeleted,
            onClick: onAddToOutlook
        };

        const addToOutlookSeriesCommand: ICommandBarItemProps = {
            key: 'add-to-outlook',
            text: strings.Command_AddToOutlook.Text,
            iconProps: { iconName: 'AddEvent' },
            disabled: isDeleted,
            onClick: onAddSeriesToOutlook
        };

        const addToOutlookRecurringCommand: ICommandBarItemProps = {
            key: 'add-to-outlook',
            text: strings.Command_AddToOutlook.Text,
            iconProps: { iconName: 'AddEvent' },
            disabled: isDeleted,
            subMenuProps: {
                items: [{
                    key: 'add-to-outlook-series',
                    text: strings.Command_AddToOutlook_Recurring_Series.Text,
                    onClick: onAddSeriesToOutlook
                }, {
                    key: 'add-to-outlook-occurrence',
                    text: strings.Command_AddToOutlook_Recurring_Instance.Text,
                    onClick: onAddToOutlook
                }]
            }
        };

        const getLinkCommand: ICommandBarItemProps = {
            key: 'get-link',
            text: strings.Command_GetLink.Text,
            iconProps: { iconName: 'Link' },
            disabled: isDeleted,
            onClick: onGetLink
        };

        console.log("EventPanel line 885", currentUserIsContributor);

        const userCanApprove = currentUserIsSiteAdmin || this._currentUserIsAnApprover() || currentUserIsContributor;
        const userIsCreator = User.equal(creator, currentUser);
        const canEdit = userIsCreator || userCanApprove;
        const canModerate = !isApproved && userCanApprove;
        const canDelete = (!isNew || isSeriesException) && canEdit;
        const canAddToOutlook = (!isNew || isSeriesException) && isApproved;

        return [
            canEdit && (
                isRecurring
                    ? (isSeriesMaster
                        ? editSeriesCommand
                        : editRecurringCommand
                    )
                    : editSingleCommand
            ),
            canModerate && moderationCommand,
            canDelete && (
                isRecurring
                    ? (isSeriesMaster
                        ? deleteSeriesMasterCommand
                        : deleteRecurringCommand
                    )
                    : deleteSingleCommand
            ),
            canAddToOutlook && (
                isRecurring
                    ? (isSeriesMaster
                        ? addToOutlookSeriesCommand
                        : addToOutlookRecurringCommand
                    )
                    : addToOutlookSingleCommand
            ),
            getLinkCommand
        ].filter(Boolean);
    }

    protected buildEditHeaderCommands(): ICommandBarItemProps[] {
        const { [DirectoryService]: { currentUserIsSiteAdmin, currentUser } } = this.props.services;
        const { submitting } = this.state;
        const { isRecurring, isSeriesException, isSeriesMaster, seriesMaster, isDeleted, isNew, creator } = this.entity;
        const onSubmit = () => this.submit(() => { this.display(); });
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
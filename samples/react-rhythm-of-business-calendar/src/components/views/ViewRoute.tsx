import React, { FC, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { IComponentStyles } from '@uifabric/foundation';
import { useBoolean, useForceUpdate } from '@fluentui/react-hooks';
import { ActionButton, CommandBar, ICommandBarItemProps, IconButton, IIconProps, IStackItemSlots, IStackTokens, Panel, PanelType, Stack, StackItem, Text, TooltipHost } from '@fluentui/react';
import { BackEventListener } from 'common';
import { AsyncDataComponent, DateRotator } from 'common/components';
import { IEvent, RefinerValue } from 'model';
import { useConfigurationService, useDirectoryService, useEventsService } from 'services';
import { ApprovalDialog, ConfigureApproversPanel, MyApprovalsFilter, MyApprovalsPanel } from '../approvals';
import { useApprovals, useCopyLinkDialog, useExecuteEventDeepLink, useEventPanel, useRefinerPanel, useSettings, useRefinerValues, useWindowSize } from '../hooks';
import { Refiners, RefinerPanel } from '../refiners';
import { SettingsPanel } from '../settings';
import { EventFilter, EventPanel, IEventCommands } from '../events';
import { CopyLinkDialog, Rail, SwipedEvents, SwipeEventListener } from '../shared';
import { IViewCommands, useDataRotatorController, useView, ViewNav } from '.';
import { FilterConfigContext } from 'components/shared/FilterConfigContext';

import { ViewRoute as strings } from "ComponentStrings";

import styles from './ViewRoute.module.scss';

const RefinerRailPanelDisplayBreakpoint = 1024;

const rootStackTokens: IStackTokens = { childrenGap: 16 };
const refinerRailStackTokens: IStackTokens = { childrenGap: 16, padding: '10px 0 0 20px' };
const viewStackTokens: IStackTokens = { childrenGap: 8, padding: '10px 0' };

const calendarViewStackItemStyles: IComponentStyles<IStackItemSlots> = {
    root: { minWidth: 0 }
};

const addRefinerIconProps: IIconProps = { iconName: 'Add' };
const collapseRefinerRailIconProps: IIconProps = { iconName: 'ClosePaneMirrored' };
const expandRefinerRailIconProps: IIconProps = { iconName: 'ClosePane' };




const ViewRoute: FC = () => {
    const { active: config } = useConfigurationService();
    const { currentUserIsSiteAdmin } = useDirectoryService();

    const view = useView();
    const View = view.renderer;

    const [
        anchorDate,
        setAnchorDate,
        dateString,
        onRotatePreviousDate,
        onRotateNextDate,
    ] = useDataRotatorController(view.dateRotatorController);

    const dateRange = useMemo(
        () => view.dateRange(anchorDate, config),
        [view, anchorDate]
    );

    const { eventsAsync, refinersAsync, refinerValuesAsync, approversAsync } =
        useEventsService();
    const [asyncWatchers] = useState([
        eventsAsync,
        refinersAsync,
        refinerValuesAsync,
        approversAsync,
    ]);

    const [showOnlyCurrentMonth, setShowOnlyCurrentMonth] =
        useState<boolean>(false);

    const [hasRefiners, selectedRefinerValues, onSelectedRefinerValuesChanged] =
        useRefinerValues();

    const [
        userIsAnApprover,
        myApprovalsPanel,
        approvalDialog,
        openMyApprovalsPanel,
        ,
        approveEvent,
        rejectEvent,
    ] = useApprovals();

    const [eventPanel, newEvent, displayEvent] = useEventPanel(anchorDate);

    const [refinerPanel, newRefiner, editRefiner] = useRefinerPanel();

    const [
        userCanManageSettings,
        settingsPanel,
        configureApproversPanel,
        editSettings,
    ] = useSettings();

    const [copyLinkDialog, getLink] = useCopyLinkDialog();

    const { width } = useWindowSize();

    const useSwipeInRefiners = width <= RefinerRailPanelDisplayBreakpoint;
    const useRefinersRail = !useSwipeInRefiners;

    const [
        isRefinerRailExpanded,
        { setTrue: expandRail, setFalse: collapseRail },
    ] = useBoolean(false);
    const backEventListener = useMemo(
        () => new BackEventListener(collapseRail),
        [collapseRail]
    );
    useEffect(() => {
        return () => backEventListener.cleanup();
    }, [backEventListener]);

    const openRefinerRailPanel = useCallback(() => {
        backEventListener.listenForBack();
        expandRail();
    }, [backEventListener, expandRail]);

    const dismissRefinerRailPanel = useCallback(() => {
        backEventListener.cancelListeningForBack();
        collapseRail();
    }, [backEventListener, collapseRail]);

    const swipeHandler: SwipeEventListener = useCallback(
        ({ detail }) => {
            if (detail.dir === "right") {
                openRefinerRailPanel();
            }
        },
        [openRefinerRailPanel]
    );

    useExecuteEventDeepLink(displayEvent);

    const useRefiners =
        (currentUserIsSiteAdmin || hasRefiners) && config.useRefiners;

    const { filterButtons } = useContext(FilterConfigContext);

     // Use a ref to capture the full list after the hook is initialized.
  const fullRefinerValuesRef = useRef<RefinerValue[] | null>(null);

  useEffect(() => {
    console.log("selectedRefinerValues size:", selectedRefinerValues.size);
    if (!fullRefinerValuesRef.current ||
        selectedRefinerValues.size > fullRefinerValuesRef.current.length) {
      fullRefinerValuesRef.current = Array.from(selectedRefinerValues);
      console.log("Captured fullRefinerValuesRef:", fullRefinerValuesRef.current);
    }
  }, [selectedRefinerValues.size]);

    // Create dynamic command bar items for each filter button.
    const dynamicFilterButtons: ICommandBarItemProps[] = (
        filterButtons || []
    ).map((btn, index) => ({
        key: btn.key || `dynamic-filter-${index}`,
        text: btn.text,
        iconProps: { iconName: btn.iconName },
        onClick: () => {
            // Split the filterPrefixes string into an array.
            const prefixes = btn.filterPrefixes
                .split(";")
                .map((prefix) => prefix.trim());

            const fullValuesArray = fullRefinerValuesRef.current || Array.from(selectedRefinerValues);
            console.log('fullValuesArray: ' + fullValuesArray.length);

            // Reset the selected refiners to select all before filtering again below
            onSelectedRefinerValuesChanged({ added: Array.from(fullValuesArray), removed: [] });

            // Create a new set that filters refiner values based on the prefixes.
            const newSelectedSet = new Set<RefinerValue>(
                fullValuesArray.filter(
                    (val) =>
                        // Include the item if its title is falsy (or blank) or if it exactly matches any prefix.
                        !val.title ||
                        prefixes.some((prefix) => val.title === prefix)
                )
            );

            // Determine which items were removed from the original selection.
            const currentSelected = Array.from(selectedRefinerValues);
            const removed = currentSelected.filter(val => !newSelectedSet.has(val));
            // No items are explicitly added here.
            const added: RefinerValue[] = [];
            
            // Pass the new selection to your refiner values hook.
            onSelectedRefinerValuesChanged({ added, removed });
        },
    }));

    const commandBarItems = useCallback(
        (numberOfEventsNeedingApproval: number) => {
            const staticItems: ICommandBarItemProps[] = [
                {
                  key: 'new-event',
                  text: strings.Command_NewEvent.Text,
                  iconProps: { iconName: 'Add' },
                  onClick: () => newEvent()
                },
                userCanManageSettings && {
                  key: 'settings',
                  text: strings.Command_Settings.Text,
                  iconProps: { iconName: 'Settings' },
                  onClick: () => editSettings()
                },
                userIsAnApprover && {
                  key: 'approvals',
                  text: numberOfEventsNeedingApproval
                    ? `${strings.Command_Approvals.Text} (${numberOfEventsNeedingApproval})`
                    : strings.Command_Approvals.Text,
                  iconProps: { iconName: 'InboxCheck' },
                  onClick: () => openMyApprovalsPanel()
                },
                {
                  key: 'filter-current-month',
                  text: 'Hide events/trips outside current month',
                  iconProps: { iconName: showOnlyCurrentMonth ? 'CheckboxComposite' : 'Checkbox' },
                  onClick: () => setShowOnlyCurrentMonth(!showOnlyCurrentMonth)
                }
              ].filter(Boolean) as ICommandBarItemProps[];
            
              // Merge the dynamic filter buttons from context.
              return [...staticItems, ...dynamicFilterButtons];


        },
        [
            userCanManageSettings,
            userIsAnApprover,
            newEvent,
            editSettings,
            openMyApprovalsPanel,
            showOnlyCurrentMonth,
            refinerValuesAsync,
            onSelectedRefinerValuesChanged,
            dynamicFilterButtons
        ]
    );

    const events = useEventsService();
    const addEventToOutlook = (event: IEvent) => {
        events.addToOutlook(event.getExceptionOrEvent());
    };
    const addEventSeriesToOutlook = (event: IEvent) => {
        events.addToOutlook(event.getSeriesMaster());
    };

    const eventCommands = useMemo(() => {
        return {
            view: displayEvent,
            approve: approveEvent,
            reject: rejectEvent,
            addToOutlook: addEventToOutlook,
            addSeriesToOutlook: addEventSeriesToOutlook,
            getLink,
        } as IEventCommands;
    }, [displayEvent, approveEvent, rejectEvent]);

    const viewCommands = useMemo(() => {
        return {
            setAnchorDate,
            newEvent,
            activateEvent: displayEvent,
        } as IViewCommands;
    }, [setAnchorDate, newEvent]);

    return (
        <>
            <Panel
                type={PanelType.smallFluid}
                isOpen={isRefinerRailExpanded && useSwipeInRefiners}
                isBlocking={false}
                isLightDismiss
                onDismiss={dismissRefinerRailPanel}
                headerText={strings.RefinerRailLabel}
                hasCloseButton
            >
                <AsyncDataComponent hideSpinners dataAsync={refinersAsync}>
                    {(refiners) => (
                        <AsyncDataComponent dataAsync={refinerValuesAsync}>
                            {() => (
                                <Stack tokens={refinerRailStackTokens}>
                                    <Refiners
                                        editingEnabled={currentUserIsSiteAdmin}
                                        refiners={refiners}
                                        selectedValues={selectedRefinerValues}
                                        onSelectionChanged={
                                            onSelectedRefinerValuesChanged
                                        }
                                        onEditRefiner={editRefiner}
                                    />
                                    {currentUserIsSiteAdmin && (
                                        <ActionButton
                                            iconProps={addRefinerIconProps}
                                            onClick={newRefiner}
                                        >
                                            {strings.Command_AddRefiner.Text}
                                        </ActionButton>
                                    )}
                                </Stack>
                            )}
                        </AsyncDataComponent>
                    )}
                </AsyncDataComponent>
            </Panel>
            <SwipedEvents handler={swipeHandler}>
                <Stack
                    horizontal
                    tokens={rootStackTokens}
                    className={styles.root}
                >
                    {useRefiners && useRefinersRail && (
                        <StackItem disableShrink>
                            <Rail
                                name={strings.RefinerRailLabel}
                                initiallyExpanded={
                                    config.refinerRailInitiallyExpanded
                                }
                            >
                                {(collapseRail) => (
                                    <AsyncDataComponent
                                        hideSpinners
                                        dataAsync={refinersAsync}
                                    >
                                        {(refiners) => (
                                            <AsyncDataComponent
                                                dataAsync={refinerValuesAsync}
                                            >
                                                {() => (
                                                    <Stack
                                                        tokens={
                                                            refinerRailStackTokens
                                                        }
                                                    >
                                                        <Stack
                                                            horizontal
                                                            horizontalAlign="space-between"
                                                            verticalAlign="center"
                                                        >
                                                            <Text variant="large">
                                                                {
                                                                    strings.RefinerRailLabel
                                                                }
                                                            </Text>
                                                            <TooltipHost
                                                                content={
                                                                    strings
                                                                        .Command_CollapseRefinerRail
                                                                        .Tooltip
                                                                }
                                                            >
                                                                <IconButton
                                                                    autoFocus
                                                                    iconProps={
                                                                        collapseRefinerRailIconProps
                                                                    }
                                                                    onClick={
                                                                        collapseRail
                                                                    }
                                                                    ariaLabel={
                                                                        strings
                                                                            .Command_CollapseRefinerRail
                                                                            .AriaLabel
                                                                    }
                                                                />
                                                            </TooltipHost>
                                                        </Stack>
                                                        <Refiners
                                                            editingEnabled={
                                                                currentUserIsSiteAdmin
                                                            }
                                                            refiners={refiners}
                                                            selectedValues={
                                                                selectedRefinerValues
                                                            }
                                                            onSelectionChanged={
                                                                onSelectedRefinerValuesChanged
                                                            }
                                                            onEditRefiner={
                                                                editRefiner
                                                            }
                                                        />
                                                        {currentUserIsSiteAdmin && (
                                                            <ActionButton
                                                                iconProps={
                                                                    addRefinerIconProps
                                                                }
                                                                onClick={
                                                                    newRefiner
                                                                }
                                                            >
                                                                {
                                                                    strings
                                                                        .Command_AddRefiner
                                                                        .Text
                                                                }
                                                            </ActionButton>
                                                        )}
                                                    </Stack>
                                                )}
                                            </AsyncDataComponent>
                                        )}
                                    </AsyncDataComponent>
                                )}
                            </Rail>
                        </StackItem>
                    )}
                    <StackItem grow styles={calendarViewStackItemStyles}>
                        <AsyncDataComponent
                            dataAsync={approversAsync}
                            hideSpinners
                        >
                            {(approvers) => (
                                <AsyncDataComponent
                                    dataAsync={refinersAsync}
                                    hideSpinners
                                >
                                    {(refiners) => (
                                        <AsyncDataComponent
                                            dataAsync={eventsAsync}
                                        >
                                            {(events) => (
                                                <Stack tokens={viewStackTokens}>
                                                    <MyApprovalsFilter
                                                        events={events}
                                                        approvers={approvers}
                                                    >
                                                        {(events) => (
                                                            <Stack
                                                                horizontal
                                                                verticalAlign="center"
                                                            >
                                                                {useRefiners &&
                                                                    useSwipeInRefiners && (
                                                                        <IconButton
                                                                            title="Show refiners"
                                                                            iconProps={
                                                                                expandRefinerRailIconProps
                                                                            }
                                                                            onClick={
                                                                                openRefinerRailPanel
                                                                            }
                                                                        />
                                                                    )}
                                                                <CommandBar
                                                                    items={commandBarItems(
                                                                        events.length
                                                                    )}
                                                                />
                                                            </Stack>
                                                        )}
                                                    </MyApprovalsFilter>
                                                    <Stack
                                                        horizontal
                                                        wrap
                                                        horizontalAlign="space-between"
                                                        verticalAlign="center"
                                                    >
                                                        <DateRotator
                                                            date={anchorDate}
                                                            dateString={
                                                                dateString
                                                            }
                                                            previousIconProps={
                                                                view
                                                                    .dateRotatorController
                                                                    .previousIconProps
                                                            }
                                                            nextIconProps={
                                                                view
                                                                    .dateRotatorController
                                                                    .nextIconProps
                                                            }
                                                            onPrevious={
                                                                onRotatePreviousDate
                                                            }
                                                            onNext={
                                                                onRotateNextDate
                                                            }
                                                            onDateChanged={
                                                                setAnchorDate
                                                            }
                                                        />
                                                        <ViewNav />
                                                    </Stack>
                                                    <EventFilter
                                                        events={events}
                                                        dateRange={dateRange}
                                                        refiners={refiners}
                                                        selectedRefinerValues={
                                                            selectedRefinerValues
                                                        }
                                                        approvers={approvers}
                                                        showOnlyCurrentMonth={
                                                            showOnlyCurrentMonth
                                                        }
                                                        anchorDate={anchorDate}
                                                    >
                                                        {(cccurrences) => (
                                                            <View
                                                                anchorDate={
                                                                    anchorDate
                                                                }
                                                                cccurrences={
                                                                    cccurrences
                                                                }
                                                                refiners={
                                                                    refiners
                                                                }
                                                                selectedRefinerValues={
                                                                    selectedRefinerValues
                                                                }
                                                                eventCommands={
                                                                    eventCommands
                                                                }
                                                                viewCommands={
                                                                    viewCommands
                                                                }
                                                            />
                                                        )}
                                                    </EventFilter>

                                                    <Stack horizontal verticalAlign="center" horizontalAlign="end" >
                                                        <DateRotator
                                                        date={anchorDate}
                                                        dateString={dateString}
                                                        previousIconProps={view.dateRotatorController.previousIconProps}
                                                        nextIconProps={view.dateRotatorController.nextIconProps}
                                                        onPrevious={onRotatePreviousDate}
                                                        onNext={onRotateNextDate}
                                                        onDateChanged={setAnchorDate}
                                                        />
                                                        
                                                    </Stack>

                                                </Stack>
                                            )}
                                        </AsyncDataComponent>
                                    )}
                                </AsyncDataComponent>
                            )}
                        </AsyncDataComponent>
                    </StackItem>
                </Stack>
            </SwipedEvents>
            <MyApprovalsPanel
                componentRef={myApprovalsPanel}
                commands={eventCommands}
            />
            <EventPanel
                hasCloseButton
                componentRef={eventPanel}
                commands={eventCommands}
                asyncWatchers={asyncWatchers}
            />
            <ApprovalDialog
                asyncWatchers={asyncWatchers}
                componentRef={approvalDialog}
            />
            <RefinerPanel
                hasCloseButton
                componentRef={refinerPanel}
                refinersAsync={refinersAsync}
                asyncWatchers={asyncWatchers}
            />
            <SettingsPanel
                hasCloseButton
                componentRef={settingsPanel}
                onSettingsUpdated={useForceUpdate()}
                onNewRefiner={newRefiner}
                onEditRefiner={editRefiner}
                configureApproversPanel={configureApproversPanel}
                asyncWatchers={asyncWatchers}
            />
            <ConfigureApproversPanel componentRef={configureApproversPanel} />
            <CopyLinkDialog componentRef={copyLinkDialog} />
        </>
    );
};

export default ViewRoute;
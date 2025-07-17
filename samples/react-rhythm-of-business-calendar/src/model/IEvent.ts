import { Moment } from "moment-timezone";
import { Color, IManyToManyRelationship } from "common";
import { Event, Recurrence, RefinerValue } from "model";

export interface IEvent {
    readonly displayName: string;
    readonly title: string;
    readonly start: Moment;
    readonly end: Moment;
    readonly isAllDay: boolean;
    readonly location: string;
    readonly color: Color;
    readonly tag: string;
    readonly recurrence: Recurrence;
    readonly isPendingApproval: boolean;
    readonly isApproved: boolean;
    readonly isRejected: boolean;
    readonly isRecurring: boolean;
    readonly isSeriesMaster: boolean;
    readonly isSeriesException: boolean;
    readonly isConfidential: boolean;
    readonly refinerValues: IManyToManyRelationship<RefinerValue>;
    readonly comDecision: string;
    readonly readAheadDueDate: Moment;
    readonly parkingStalls: number;
    readonly requestStatus: string;
    readonly dvFirstName: string;
    readonly dvSurname: string;
    readonly dvRank: string;
    readonly dvPayGrade: string;
    readonly jdirVisiting: string;
    readonly dvVisiting: string;
    readonly requestorRank: string;
    readonly requestorFirstName: string;
    readonly requestorLastName: string;
    readonly requestorOffice: string;
    readonly requestorDutyPhone: string;
    readonly requestorCellPhone: string;
    readonly requestorEmail: string;
    readonly groupID: number;

    getWrappedEvent(): Event;
    getSeriesMaster(): Event;
    getExceptionOrEvent(): Event;
}
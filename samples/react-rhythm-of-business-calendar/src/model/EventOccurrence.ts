import { Comparer, momentAscComparer } from "common";
import { Moment } from "moment-timezone";
import { IEvent } from "./IEvent";
import { Event } from "./Event";
import { RefinerValue } from "./RefinerValue";

export class EventOccurrence implements IEvent {
    public static readonly StartAscComparer: Comparer<EventOccurrence> = (a, b) => {
        // Check if one of the events is an all-day event
        if (a.isAllDay && !b.isAllDay) return -1; // All-day events come first
        if (!a.isAllDay && b.isAllDay) return 1;  // Timed events come after all-day events

        // Both are either all-day or regular, so compare by start time
        return momentAscComparer(a.start, b.start);
    };

    constructor(
        public readonly event: Event,
        public readonly start: Moment = event.start.clone(),
        public readonly end: Moment = event.end.clone()
    ) {
    }

    public get id() { return this.event.id }
    public get displayName() { return this.event.displayName; }
    public get title() { return this.event.title; }
    public get isAllDay() { return this.event.isAllDay; }
    public get location() { return this.event.location; }
    public get color() { return this.event.color; }
    public get tag() { return this.event.tag; }
    public get recurrence() { return this.event.recurrence; }
    public get isPendingApproval() { return this.event.isPendingApproval; }
    public get isApproved() { return this.event.isApproved; }
    public get isRejected() { return this.event.isRejected; }
    public get isRecurring() { return this.event.isRecurring; }
    public get isSeriesMaster() { return false; } // an event occurrence is never the series master
    public get isSeriesException() { return this.event.isRecurring; } // an event occurrence is always an exception if the event is recurring
    public get isConfidential() { return this.event.isConfidential; }
    public get refinerValues() { return this.event.refinerValues; }
    public get comDecision() { return this.event.comDecision; }
    public get description() { return this.event.description; }
    public get readAheadDueDate() { return this.event.readAheadDueDate; }

    public get parkingStalls() { return this.event.parkingStalls; }
    public get requestStatus() { return this.event.requestStatus; }
    public get dvPayGrade() { return this.event.dvPayGrade; }
    public get dvRank() { return this.event.dvRank; }
    public get dvFirstName() { return this.event.dvFirstName; }
    public get dvSurname() { return this.event.dvSurname; }
    public get jdirVisiting() { return this.event.jdirVisiting; }
    public get dvVisiting() { return this.event.dvVisiting; }
    public get requestorRank() { return this.event.requestorRank; }
    public get requestorFirstName() { return this.event.requestorFirstName; }
    public get requestorLastName() { return this.event.requestorLastName; }
    public get requestorOffice() { return this.event.requestorOffice; }
    public get requestorDutyPhone() { return this.event.requestorDutyPhone; }
    public get requestorCellPhone() { return this.event.requestorCellPhone; }
    public get requestorEmail() { return this.event.requestorEmail; }
    public get groupID() { return this.event.groupID; }

    public getRefinerValuesForRefinerId(refinerId: number): RefinerValue[] {
        return this.event.refinerValues.filter(refinerValue => refinerValue.refiner.get()?.id === refinerId);
    }

    public getRefinerValuesForRefinerName(refinerName: string): RefinerValue[] {
        return this.event.refinerValues.filter(refinerValue => refinerValue.refiner.get()?.title === refinerName);
    }

    public getWrappedEvent(): Event {
        return this.event;
    }

    public getSeriesMaster(): Event {
        return this.event.getSeriesMaster();
    }

    public getExceptionOrEvent(): Event {
        if (this.event.isSeriesMaster) {
        const exception = this.event.createSeriesException(this.start, this.end);
        
        exception.title = this.event.title;
        exception.start = this.start;
        exception.end = this.end;
        exception.parkingStalls = this.event.parkingStalls;
        exception.requestStatus = this.event.requestStatus;
        exception.dvPayGrade = this.event.dvPayGrade;
        exception.dvRank = this.event.dvRank;
        exception.dvFirstName = this.event.dvFirstName;
        exception.dvSurname = this.event.dvSurname;
        exception.jdirVisiting = this.event.jdirVisiting;
        exception.dvVisiting = this.event.dvVisiting;
        exception.requestorRank = this.event.requestorRank;
        exception.requestorFirstName = this.event.requestorFirstName;
        exception.requestorLastName = this.event.requestorLastName;
        exception.requestorOffice = this.event.requestorOffice;
        exception.requestorDutyPhone = this.event.requestorDutyPhone;
        exception.requestorCellPhone = this.event.requestorCellPhone;
        exception.requestorEmail = this.event.requestorEmail;

        exception.seriesMaster.set(this.event);
        return exception;
        }

        else if (this.event.isSeriesException) {
            return this.event; 
        }

        return this.event;
    }
}
type EventPayload = Record<string, unknown>;

type EventName =
  | 'roomStatusUpdated'
  | 'bedOccupancyUpdated'
  | 'newAlert'
  | 'alertUpdated'
  | 'agentFeedUpdated'
  | 'taskUpdated'
  | 'newMessage'
  | 'messageUpdated'
  | 'cvEventIngested'
  | 'roomsUpdated'
  | 'bedsUpdated';

class RealtimeBus {
  private target = new EventTarget();

  emit(event: EventName, payload: EventPayload) {
    this.target.dispatchEvent(new CustomEvent(event, { detail: payload }));
  }

  on(event: EventName, handler: (payload: EventPayload) => void) {
    const listener = (evt: Event) => handler((evt as CustomEvent).detail as EventPayload);
    this.target.addEventListener(event, listener);
    return () => this.target.removeEventListener(event, listener);
  }
}

export const realtimeBus = new RealtimeBus();
export type { EventName, EventPayload };

import { injected, token } from "brandi";

export interface Timer {
    getCurrentTime(): number;
}

export class TimeImpl implements Timer {
    getCurrentTime(): number {
        return Math.round(Date.now() / 1000);
    }
}

injected(TimeImpl);

export const TIMER_TOKEN = token<Timer>("Timer");

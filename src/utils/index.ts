import { Container } from "brandi";
import { ID_GENERATOR_TOKEN, SnowflakeIDGenerator } from "./id";
import { initializeLogger, LOGGER_TOKEN } from "./logging";
import { TimeImpl, TIMER_TOKEN } from "./time";

export * from "./errors";
export * from "./logging";
export * from "./id";
export * from "./time";

export function bindToContainer(container: Container): void {
    container
        .bind(LOGGER_TOKEN)
        .toInstance(initializeLogger)
        .inSingletonScope();
    container
        .bind(ID_GENERATOR_TOKEN)
        .toInstance(SnowflakeIDGenerator)
        .inSingletonScope();
    container.bind(TIMER_TOKEN).toInstance(TimeImpl).inSingletonScope();
}

import { Container } from "brandi";
import {
    BINARY_CONVERTER_TOKEN,
    BinaryConverterImpl,
} from "./binary_converter";
import { ID_GENERATOR_TOKEN, SnowflakeIdGenerator } from "./id";
import { initializeLogger, LOGGER_TOKEN } from "./logging";
import { TimeImpl, TIMER_TOKEN } from "./time";

export * from "./errors";
export * from "./logging";
export * from "./id";
export * from "./time";
export * from "./double";
export * from "./binary_converter";

export function bindToContainer(container: Container): void {
    container
        .bind(LOGGER_TOKEN)
        .toInstance(initializeLogger)
        .inSingletonScope();
    container
        .bind(ID_GENERATOR_TOKEN)
        .toInstance(SnowflakeIdGenerator)
        .inSingletonScope();
    container.bind(TIMER_TOKEN).toInstance(TimeImpl).inSingletonScope();
    container
        .bind(BINARY_CONVERTER_TOKEN)
        .toInstance(BinaryConverterImpl)
        .inSingletonScope();
}

import { Container } from "brandi";
import * as producer from "./producer";
import { getKafkaInstance, KAFKA_INSTANCE_TOKEN } from "./kafka";

export * from "./producer";

export function bindToContainer(container: Container): void {
    container
        .bind(KAFKA_INSTANCE_TOKEN)
        .toInstance(getKafkaInstance)
        .inSingletonScope();
    producer.bindToContainer(container);
}

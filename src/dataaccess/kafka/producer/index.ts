import { Container } from "brandi";
import {
    ImageCreatedProducerImpl,
    IMAGE_CREATED_PRODUCER_TOKEN,
} from "./image_created";
import { getKafkaProducer, KAFKA_PRODUCER_TOKEN } from "./producer";

export * from "./image_created";

export function bindToContainer(container: Container): void {
    container
        .bind(KAFKA_PRODUCER_TOKEN)
        .toInstance(getKafkaProducer)
        .inSingletonScope();
    container
        .bind(IMAGE_CREATED_PRODUCER_TOKEN)
        .toInstance(ImageCreatedProducerImpl)
        .inSingletonScope();
}

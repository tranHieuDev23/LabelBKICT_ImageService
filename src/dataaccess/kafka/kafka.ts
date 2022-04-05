import { injected, token } from "brandi";
import { Kafka } from "kafkajs";
import { KafkaConfig, KAFKA_CONFIG_TOKEN } from "../../config";

export function getKafkaInstance(config: KafkaConfig): Kafka {
    return new Kafka({
        clientId: config.clientId,
        brokers: config.brokers,
    });
}

injected(getKafkaInstance, KAFKA_CONFIG_TOKEN);

export const KAFKA_INSTANCE_TOKEN = token<Kafka>("Kafka");

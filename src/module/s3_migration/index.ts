import { Container } from "brandi";
import { S3MigrationOperatorImpl, S3_MIGRATION_OPERATOR_TOKEN } from "./s3_migration_operator";

export * from "./s3_migration_operator";

export function bindToContainer(container: Container): void {
    container.bind(S3_MIGRATION_OPERATOR_TOKEN).toInstance(S3MigrationOperatorImpl).inSingletonScope();
}

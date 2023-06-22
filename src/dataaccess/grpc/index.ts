import { Container } from "brandi";
import { getModelServiceDM, MODEL_SERVICE_DM_TOKEN } from "./model_service";

export * from "./model_service";

export function bindToContainer(container: Container): void {
    container
        .bind(MODEL_SERVICE_DM_TOKEN)
        .toInstance(getModelServiceDM)
        .inSingletonScope();
}

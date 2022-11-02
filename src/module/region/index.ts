import { Container } from "brandi";
import {
    REGION_NORMALIZER_TOKEN,
    TurfRegionNormalizer,
} from "./polygon_normalizer";
import {
    RegionManagementOperatorImpl,
    REGION_MANAGEMENT_OPERATOR_TOKEN,
} from "./region_management_operator";

export * from "./region_management_operator";

export function bindToContainer(container: Container): void {
    container
        .bind(REGION_MANAGEMENT_OPERATOR_TOKEN)
        .toInstance(RegionManagementOperatorImpl)
        .inSingletonScope();
    container
        .bind(REGION_NORMALIZER_TOKEN)
        .toInstance(TurfRegionNormalizer)
        .inSingletonScope();
}

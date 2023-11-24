import { Container } from "brandi";
import {
    POINT_OF_INTEREST_MANAGEMENT_OPERATOR_TOKEN,
    PointOfInterestManagementOperatorImpl,
} from "./point_of_interest_management_operator";

export * from "./point_of_interest_management_operator";

export function bindToContainer(container: Container): void {
    container
        .bind(POINT_OF_INTEREST_MANAGEMENT_OPERATOR_TOKEN)
        .toInstance(PointOfInterestManagementOperatorImpl)
        .inSingletonScope();
}

import { Container } from "brandi";
import {
    BookmarkManagementOperatorImpl,
    BOOKMARK_MANAGEMENT_OPERATOR_TOKEN,
} from "./bookmark_management_operator";

export * from "./bookmark_management_operator";

export function bindToContainer(container: Container): void {
    container
        .bind(BOOKMARK_MANAGEMENT_OPERATOR_TOKEN)
        .toInstance(BookmarkManagementOperatorImpl)
        .inSingletonScope();
}

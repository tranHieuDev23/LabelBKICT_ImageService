import { Container } from "brandi";
import * as image from "./image";
import * as imageTag from "./image_tag";
import * as imageType from "./image_type";
import * as region from "./region";
import * as bookmark from "./bookmark";
import * as userCanManageUserImage from "./user_can_manage_user_image";
import * as userCanVerifyUserImage from "./user_can_verify_user_image";
import * as s3Migration from "./s3_migration";

export function bindToContainer(container: Container): void {
    image.bindToContainer(container);
    imageTag.bindToContainer(container);
    imageType.bindToContainer(container);
    region.bindToContainer(container);
    bookmark.bindToContainer(container);
    userCanManageUserImage.bindToContainer(container);
    userCanVerifyUserImage.bindToContainer(container);
    s3Migration.bindToContainer(container);
}

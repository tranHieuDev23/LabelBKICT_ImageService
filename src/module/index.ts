import { Container } from "brandi";
import * as image from "./image";
import * as imageTag from "./image_tag";
import * as imageType from "./image_type";
import * as region from "./region";
import * as bookmark from "./bookmark";
import * as userCanManageImage from "./user_can_manage_image";
import * as userCanVerifyImage from "./user_can_verify_image";
import * as pointOfInterest from "./point_of_interest";
import * as s3Migration from "./s3_migration";

export function bindToContainer(container: Container): void {
    image.bindToContainer(container);
    imageTag.bindToContainer(container);
    imageType.bindToContainer(container);
    region.bindToContainer(container);
    bookmark.bindToContainer(container);
    userCanManageImage.bindToContainer(container);
    userCanVerifyImage.bindToContainer(container);
    s3Migration.bindToContainer(container);
    pointOfInterest.bindToContainer(container);
}

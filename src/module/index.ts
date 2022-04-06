import { Container } from "brandi";
import * as image from "./image";
import * as imageTag from "./image_tag";
import * as imageType from "./image_type";
import * as region from "./region";
import * as bookmark from "./bookmark";

export function bindToContainer(container: Container): void {
    image.bindToContainer(container);
    imageTag.bindToContainer(container);
    imageType.bindToContainer(container);
    region.bindToContainer(container);
    bookmark.bindToContainer(container);
}

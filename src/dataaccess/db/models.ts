import { _ImageStatus_Values } from "../../proto/gen/ImageStatus";
import { _RegionOperationType_Values } from "../../proto/gen/RegionOperationType";

export class ImageType {
    constructor(
        public id: number,
        public displayName: string,
        public hasPredictiveModel: boolean
    ) {}
}

export class RegionLabel {
    constructor(
        public id: number,
        public ofImageTypeId: number,
        public displayName: string,
        public color: string
    ) {}
}

export class ImageTagGroup {
    constructor(
        public id: number,
        public displayName: string,
        public isSingleValue: boolean
    ) {}
}

export class ImageTag {
    constructor(
        public id: number,
        public ofImageTagGroupId: number,
        public displayName: string
    ) {}
}

export class Image {
    constructor(
        public id: number,
        public uploadedByUserId: number,
        public uploadTime: number,
        public publishedByUserId: number,
        public publishTime: number,
        public verifiedByUserId: number,
        public verifyTime: number,
        public originalFileName: string,
        public originalImageFilename: string,
        public thumbnailImageFilename: string,
        public description: string,
        public imageType: ImageType | null,
        public status: _ImageStatus_Values
    ) {}
}

export enum ImageListSortOrder {
    ID_ASCENDING = 0,
    ID_DESCENDING = 1,
    UPLOAD_TIME_ASCENDING = 2,
    UPLOAD_TIME_DESCENDING = 3,
    PUBLISH_TIME_ASCENDING = 4,
    PUBLISH_TIME_DESCENDING = 5,
    VERIFY_TIME_ASCENDING = 6,
    VERIFY_TIME_DESCENDING = 7,
}

export class Vertex {
    constructor(public x: number, public y: number) {}
}

export class Polygon {
    constructor(public vertices: Vertex[]) {}
}

export class Region {
    constructor(
        public id: number,
        public ofImageId: number,
        public drawnByUserId: number,
        public labeledByUserId: number,
        public border: Polygon,
        public holes: Polygon[],
        public label: RegionLabel | null
    ) {}
}

export class RegionOperationLog {
    constructor(
        public id: number,
        public ofRegionId: number,
        public byUserId: number,
        public operationTime: number,
        public operationType: _RegionOperationType_Values
    ) {}
}

export class RegionOperationLogDrawMetadata {
    constructor(
        public ofLogId: number,
        public oldBorder: Polygon | null,
        public oldHoles: Polygon[] | null,
        public newBorder: Polygon,
        public newHoles: Polygon[]
    ) {}
}

export class RegionOperationLogLabelMetadata {
    constructor(
        public ofLogId: number,
        public oldRegionLabel: RegionLabel | null,
        public newRegionLabel: RegionLabel | null
    ) {}
}

export class RegionSnapshot {
    constructor(
        public id: number,
        public drawnByUserId: number,
        public labeledByUserId: number,
        public border: Polygon,
        public holes: Polygon[],
        public label: RegionLabel | null
    ) {}
}

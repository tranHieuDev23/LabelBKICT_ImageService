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
        public ofImageTypeID: number,
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
        public ofImageTagGroupID: number,
        public displayName: string
    ) {}
}

export enum ImageStatus {
    UPLOADED = 0,
    PUBLISHED = 1,
    VERIFIED = 2,
    EXCLUDED = 3,
}

export class Image {
    constructor(
        public id: number,
        public uploadedByUserID: number,
        public uploadTime: number,
        public publishedByUserID: number,
        public publishTime: number,
        public verifiedByUserID: number,
        public verifyTime: number,
        public originalFileName: string,
        public imageURL: string,
        public thumbnailURL: string,
        public description: string,
        public imageType: ImageType | null,
        public status: ImageStatus
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
        public drawnByUserID: number,
        public labeledByUserID: number,
        public border: Polygon,
        public holes: Polygon[],
        public label: RegionLabel | null
    ) {}
}

export class RegionSnapshot {
    constructor(
        public id: number,
        public drawnByUserID: number,
        public labeledByUserID: number,
        public border: Polygon,
        public holes: Polygon[],
        public label: RegionLabel | null
    ) {}
}
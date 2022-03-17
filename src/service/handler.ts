import { injected, token } from "brandi";
import { sendUnaryData, status } from "@grpc/grpc-js";

import { ImageServiceHandlers } from "../proto/gen/ImageService";
import { ErrorWithStatus } from "../utils";

export class ImageServiceHandlersFactory {
    constructor() {}

    public getImageServiceHandlers(): ImageServiceHandlers {
        const handler: ImageServiceHandlers = {
            AddImageTypeToImageTagGroup: function (call, callback): void {
                throw new Error("Function not implemented.");
            },
            AddImageTagToImage: function (call, callback): void {
                throw new Error("Function not implemented.");
            },
            CreateImage: function (call, callback): void {
                throw new Error("Function not implemented.");
            },
            CreateImageTag: function (call, callback): void {
                throw new Error("Function not implemented.");
            },
            CreateImageTagGroup: function (call, callback): void {
                throw new Error("Function not implemented.");
            },
            CreateImageType: function (call, callback): void {
                throw new Error("Function not implemented.");
            },
            CreateRegion: function (call, callback): void {
                throw new Error("Function not implemented.");
            },
            CreateRegionLabel: function (call, callback): void {
                throw new Error("Function not implemented.");
            },
            CreateRegionList: function (call, callback): void {
                throw new Error("Function not implemented.");
            },
            DeleteImage: function (call, callback): void {
                throw new Error("Function not implemented.");
            },
            DeleteImageList: function (call, callback): void {
                throw new Error("Function not implemented.");
            },
            DeleteImageTag: function (call, callback): void {
                throw new Error("Function not implemented.");
            },
            DeleteImageTagGroup: function (call, callback): void {
                throw new Error("Function not implemented.");
            },
            DeleteImageType: function (call, callback): void {
                throw new Error("Function not implemented.");
            },
            DeleteRegion: function (call, callback): void {
                throw new Error("Function not implemented.");
            },
            DeleteRegionLabel: function (call, callback): void {
                throw new Error("Function not implemented.");
            },
            GetImage: function (call, callback): void {
                throw new Error("Function not implemented.");
            },
            GetImageList: function (call, callback): void {
                throw new Error("Function not implemented.");
            },
            GetImageTagGroupList: function (call, callback): void {
                throw new Error("Function not implemented.");
            },
            GetImageTagGroupListOfImageType: function (call, callback): void {
                throw new Error("Function not implemented.");
            },
            GetImageTypeList: function (call, callback): void {
                throw new Error("Function not implemented.");
            },
            GetRegionOperationLogList: function (call, callback): void {
                throw new Error("Function not implemented.");
            },
            GetRegionListOfImageAtPublishTime: function (call, callback): void {
                throw new Error("Function not implemented.");
            },
            GetRegionListOfImageAtVerifyTime: function (call, callback): void {
                throw new Error("Function not implemented.");
            },
            RemoveImageTagFromImage: function (call, callback): void {
                throw new Error("Function not implemented.");
            },
            RemoveImageTypeFromImageTagGroup: function (call, callback): void {
                throw new Error("Function not implemented.");
            },
            UpdateImageImageType: function (call, callback): void {
                throw new Error("Function not implemented.");
            },
            UpdateImageListImageType: function (call, callback): void {
                throw new Error("Function not implemented.");
            },
            UpdateImageMetadata: function (call, callback): void {
                throw new Error("Function not implemented.");
            },
            UpdateImageStatus: function (call, callback): void {
                throw new Error("Function not implemented.");
            },
            UpdateImageTag: function (call, callback): void {
                throw new Error("Function not implemented.");
            },
            UpdateImageTagGroup: function (call, callback): void {
                throw new Error("Function not implemented.");
            },
            UpdateImageType: function (call, callback): void {
                throw new Error("Function not implemented.");
            },
            UpdateRegion: function (call, callback): void {
                throw new Error("Function not implemented.");
            },
            UpdateRegionLabel: function (call, callback): void {
                throw new Error("Function not implemented.");
            },
        };
        return handler;
    }

    private handleError(e: unknown, callback: sendUnaryData<any>) {
        if (e instanceof ErrorWithStatus) {
            return callback({
                message: e.message,
                code: e.status,
            });
        } else if (e instanceof Error) {
            return callback({
                message: e.message,
                code: status.INTERNAL,
            });
        } else {
            return callback({
                code: status.INTERNAL,
            });
        }
    }
}

injected(ImageServiceHandlersFactory);

export const IMAGE_SERVICE_HANDLERS_FACTORY_TOKEN =
    token<ImageServiceHandlersFactory>("ImageServiceHandlersFactory");

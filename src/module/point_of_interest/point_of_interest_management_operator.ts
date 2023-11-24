import { Logger } from "winston";
import { PointOfInterest } from "../../proto/gen/PointOfInterest";
import { Vertex } from "../../proto/gen/Vertex";
import { IMAGE_PERMISSION_CHECKER_TOKEN, ImagePermissionChecker } from "../image";
import { POINT_OF_INTEREST_DATA_ACCESSOR_TOKEN, PointOfInterestDataAccessor } from "../../dataaccess/db";
import { ErrorWithStatus, LOGGER_TOKEN } from "../../utils";
import { status } from "@grpc/grpc-js";
import validator from "validator";
import { injected, token } from "brandi";
import { filterXSS } from "xss";

export interface PointOfInterestManagementOperator {
    createPointOfInterest(
        ofImageId: number,
        createdByUserId: number,
        coordinate: Vertex,
        description: string
    ): Promise<PointOfInterest>;
    updatePointOfInterest(
        id: number,
        ofImageId: number,
        createdByUserId: number,
        coordinate: Vertex,
        description: string
    ): Promise<PointOfInterest>;
    deletePointOfInterest(id: number, ofImageId: number, createdByUserId: number): Promise<void>;
}

export class PointOfInterestManagementOperatorImpl implements PointOfInterestManagementOperator {
    constructor(
        private readonly imagePermissionChecker: ImagePermissionChecker,
        private readonly pointOfInterestDM: PointOfInterestDataAccessor,
        private readonly logger: Logger
    ) {}

    public async createPointOfInterest(
        ofImageId: number,
        createdByUserId: number,
        coordinate: Vertex,
        description: string
    ): Promise<PointOfInterest> {
        const { canEditList } = await this.imagePermissionChecker.canUserManageImageList(createdByUserId, [ofImageId]);
        if (!canEditList[0]) {
            this.logger.error("user is not allowed to edit the image", { imageId: ofImageId, userId: createdByUserId });
            throw new ErrorWithStatus(
                `user with id ${createdByUserId} is not allowed to edit the image ${ofImageId}`,
                status.PERMISSION_DENIED
            );
        }

        description = this.sanitizeDescription(description);
        const poi = await this.pointOfInterestDM.createPointOfInterest(
            ofImageId,
            createdByUserId,
            { x: +(coordinate.x || 0), y: +(coordinate.y || 0) },
            description
        );

        return poi;
    }

    private sanitizeDescription(description: string): string {
        return filterXSS(validator.trim(description));
    }

    public async updatePointOfInterest(
        id: number,
        ofImageId: number,
        createdByUserId: number,
        coordinate: Vertex,
        description: string
    ): Promise<PointOfInterest> {
        const { canEditList } = await this.imagePermissionChecker.canUserManageImageList(createdByUserId, [ofImageId]);
        if (!canEditList[0]) {
            this.logger.error("user is not allowed to edit the image", { imageId: ofImageId, userId: createdByUserId });
            throw new ErrorWithStatus(
                `user with id ${createdByUserId} is not allowed to edit the image ${ofImageId}`,
                status.PERMISSION_DENIED
            );
        }

        description = this.sanitizeDescription(description);

        return this.pointOfInterestDM.withTransaction(async (pointOfInterestDM) => {
            const poi = await pointOfInterestDM.getPointOfInterestWithXLock(id);
            if (poi === null) {
                this.logger.error("no point of interest with id found", { id });
                throw new ErrorWithStatus(`no point of interest with id ${id} found`, status.NOT_FOUND);
            }

            if (poi.createdByUserId !== createdByUserId) {
                this.logger.error("user is not the creator of the point of interest", {
                    id: id,
                    userId: createdByUserId,
                });
                throw new ErrorWithStatus(
                    `user with id ${createdByUserId} is not the creator of the point of interest ${id}`,
                    status.PERMISSION_DENIED
                );
            }

            poi.coordinate = {
                x: +(coordinate.x || 0),
                y: +(coordinate.y || 0),
            };
            poi.description = description;

            return await pointOfInterestDM.updatePointOfInterest(poi);
        });
    }

    public async deletePointOfInterest(id: number, ofImageId: number, createdByUserId: number): Promise<void> {
        const { canEditList } = await this.imagePermissionChecker.canUserManageImageList(createdByUserId, [ofImageId]);
        if (!canEditList[0]) {
            this.logger.error("user is not allowed to edit the image", { imageId: ofImageId, userId: createdByUserId });
            throw new ErrorWithStatus(
                `user with id ${createdByUserId} is not allowed to edit the image ${ofImageId}`,
                status.PERMISSION_DENIED
            );
        }

        await this.pointOfInterestDM.withTransaction(async (pointOfInterestDM) => {
            const poi = await pointOfInterestDM.getPointOfInterestWithXLock(id);
            if (poi === null) {
                this.logger.error("no point of interest with id found", { id });
                throw new ErrorWithStatus(`no point of interest with id ${id} found`, status.NOT_FOUND);
            }

            if (poi.createdByUserId !== createdByUserId) {
                this.logger.error("user is not the creator of the point of interest", {
                    id: id,
                    userId: createdByUserId,
                });
                throw new ErrorWithStatus(
                    `user with id ${createdByUserId} is not the creator of the point of interest ${id}`,
                    status.PERMISSION_DENIED
                );
            }

            return await pointOfInterestDM.deletePointOfInterest(id);
        });
    }
}

injected(
    PointOfInterestManagementOperatorImpl,
    IMAGE_PERMISSION_CHECKER_TOKEN,
    POINT_OF_INTEREST_DATA_ACCESSOR_TOKEN,
    LOGGER_TOKEN
);

export const POINT_OF_INTEREST_MANAGEMENT_OPERATOR_TOKEN = token<PointOfInterestManagementOperator>(
    "PointOfInterestManagementOperator"
);

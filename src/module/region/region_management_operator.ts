import { _ImageStatus_Values } from "../../proto/gen/ImageStatus";
import { Polygon } from "../../proto/gen/Polygon";
import { Region } from "../../proto/gen/Region";
import { RegionOperationLog } from "../../proto/gen/RegionOperationLog";

export interface RegionManagementOperator {
    createRegion(
        ofImageID: number,
        drawnByUserID: number,
        labeledByUserId: number,
        border: Polygon,
        holes: Polygon[],
        labelID: number | undefined
    ): Promise<Region>;
    getRegionOperationLogList(
        ofImageID: number,
        regionID: number
    ): Promise<RegionOperationLog[]>;
    updateRegion(
        ofImageID: number,
        regionID: number,
        drawnByUserID: number | undefined,
        labeledByUserId: number | undefined,
        border: Polygon | undefined,
        holes: Polygon[] | undefined,
        labelID: number | undefined
    ): Promise<Region>;
    deleteRegion(ofImageID: number, regionID: number): Promise<void>;
    getRegionSnapshotListOfImage(
        ofImageID: number,
        atStatus: _ImageStatus_Values
    ): Promise<Region[]>;
}

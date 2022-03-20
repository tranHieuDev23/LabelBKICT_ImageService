import {
    Polygon as TurfPolygon,
    MultiPolygon as TurfMultiPolygon,
    polygon as toTurfPolygon,
    multiPolygon as toTurfMultiPolygon,
    cleanCoords,
    union,
    intersect,
} from "@turf/turf";
import { injected, token } from "brandi";
import { Polygon } from "../../proto/gen/Polygon";
import { convertProtoDoubleToNumber } from "../../utils";

export interface RegionNormalizer {
    normalizeRegion(
        border: Polygon,
        holes: Polygon[]
    ): {
        border: Polygon;
        holes: Polygon[];
    };
}

export class TurfRegionNormalizer implements RegionNormalizer {
    public normalizeRegion(
        border: Polygon,
        holes: Polygon[]
    ): {
        border: Polygon;
        holes: Polygon[];
    } {
        let turfBorder = this.convertProtoPolygonToTurfPolygon(border);
        let turfHoles = holes.map((hole) =>
            this.convertProtoPolygonToTurfPolygon(hole)
        );

        // Remove redundant vertices
        turfBorder = cleanCoords(turfBorder);
        turfHoles = turfHoles.map((hole) => cleanCoords(hole));

        // Join all common area between holes
        if (turfHoles.length > 1) {
            let joinedTurfHoles = [turfHoles[0]];
            for (let i = 1; i < turfHoles.length; i++) {
                joinedTurfHoles =
                    this.calculateUnionOfTurfPolygonListAndTurfPolygon(
                        joinedTurfHoles,
                        turfHoles[i]
                    );
            }
            turfHoles = joinedTurfHoles;
        }

        // Take only the intersect between the holes and the border
        if (turfHoles.length > 0) {
            turfHoles =
                this.calculateIntersectionOfTurfPolygonListAndTurfPolygon(
                    turfHoles,
                    turfBorder
                );
        }

        return {
            border: this.convertTurfPolygonToProtoPolygon(turfBorder),
            holes: turfHoles.map((hole) =>
                this.convertTurfPolygonToProtoPolygon(hole)
            ),
        };
    }

    private convertProtoPolygonToTurfPolygon(polygon: Polygon): TurfPolygon {
        const vertices = polygon.vertices || [];
        const coordinateList: number[][] = [];
        for (const vertex of vertices) {
            coordinateList.push([
                convertProtoDoubleToNumber(vertex.x),
                convertProtoDoubleToNumber(vertex.y),
            ]);
        }
        coordinateList.push([
            convertProtoDoubleToNumber(vertices[0].x),
            convertProtoDoubleToNumber(vertices[0].y),
        ]);
        return toTurfPolygon([coordinateList]).geometry;
    }

    private convertTurfPolygonToProtoPolygon(polygon: TurfPolygon): Polygon {
        return {
            vertices: polygon.coordinates[0].map((position) => {
                return {
                    x: position[0],
                    y: position[1],
                };
            }),
        };
    }

    private calculateUnionOfTurfPolygonListAndTurfPolygon(
        polygonList: TurfPolygon[],
        polygon: TurfPolygon
    ): TurfPolygon[] {
        const turfMultiPolygon =
            this.convertTuftPolygonListToTurfMultiPolygon(polygonList);
        const unionTurfPolygon = union(turfMultiPolygon, polygon);
        if (unionTurfPolygon === null) {
            return [];
        }
        if (unionTurfPolygon.geometry.type === "Polygon") {
            return [unionTurfPolygon.geometry];
        } else {
            return this.convertTurfMultiPolygonToTurfPolygonList(
                unionTurfPolygon.geometry
            );
        }
    }

    private calculateIntersectionOfTurfPolygonListAndTurfPolygon(
        polygonList: TurfPolygon[],
        polygon: TurfPolygon
    ): TurfPolygon[] {
        const turfMultiPolygon =
            this.convertTuftPolygonListToTurfMultiPolygon(polygonList);
        const unionTurfPolygon = intersect(turfMultiPolygon, polygon);
        if (unionTurfPolygon === null) {
            return [];
        }
        if (unionTurfPolygon.geometry.type === "Polygon") {
            return [unionTurfPolygon.geometry];
        } else {
            return this.convertTurfMultiPolygonToTurfPolygonList(
                unionTurfPolygon.geometry
            );
        }
    }

    private convertTuftPolygonListToTurfMultiPolygon(
        polygonList: TurfPolygon[]
    ): TurfMultiPolygon {
        const coordinateList = [];
        for (const item of polygonList) {
            coordinateList.push(item.coordinates);
        }
        return toTurfMultiPolygon(coordinateList).geometry;
    }

    private convertTurfMultiPolygonToTurfPolygonList(
        multiPolygon: TurfMultiPolygon
    ): TurfPolygon[] {
        const polygonList: TurfPolygon[] = [];
        for (const coordinateList of multiPolygon.coordinates) {
            polygonList.push(toTurfPolygon(coordinateList).geometry);
        }
        return polygonList;
    }
}

injected(TurfRegionNormalizer);

export const REGION_NORMALIZER_TOKEN =
    token<RegionNormalizer>("RegionNormalizer");

import {
    Polygon as TurfPolygon,
    MultiPolygon as TurfMultiPolygon,
    polygon as toTurfPolygon,
    multiPolygon as toTurfMultiPolygon,
    cleanCoords,
    kinks,
    unkinkPolygon,
    area,
    union,
    intersect,
    Position,
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
        let turfHoles = holes.map((hole) => this.convertProtoPolygonToTurfPolygon(hole));

        // Fix out-of-bound vertices
        turfBorder = this.fixTurfPolygonOutOfBound(turfBorder);
        turfHoles = turfHoles.map((hole) => this.fixTurfPolygonOutOfBound(hole));

        // Remove redundant vertices
        turfBorder = cleanCoords(turfBorder);
        turfHoles = turfHoles.map((hole) => cleanCoords(hole));

        // Fix self-intersection
        turfBorder = this.fixSelfIntersectedTurfPolygon(turfBorder);
        turfHoles = turfHoles.map((hole) => this.fixSelfIntersectedTurfPolygon(hole));

        // Join all common area between holes
        if (turfHoles.length > 1) {
            let joinedTurfHoles = [turfHoles[0]];
            for (let i = 1; i < turfHoles.length; i++) {
                joinedTurfHoles = this.calculateUnionOfTurfPolygonListAndTurfPolygon(joinedTurfHoles, turfHoles[i]);
            }
            turfHoles = joinedTurfHoles;
        }

        // Take only the intersect between the holes and the border
        if (turfHoles.length > 0) {
            turfHoles = this.calculateIntersectionOfTurfPolygonListAndTurfPolygon(turfHoles, turfBorder);
        }

        return {
            border: this.convertTurfPolygonToProtoPolygon(turfBorder),
            holes: turfHoles.map((hole) => this.convertTurfPolygonToProtoPolygon(hole)),
        };
    }

    private convertProtoPolygonToTurfPolygon(polygon: Polygon): TurfPolygon {
        const vertices = polygon.vertices || [];
        const coordinateList: number[][] = [];
        for (const vertex of vertices) {
            coordinateList.push([convertProtoDoubleToNumber(vertex.x), convertProtoDoubleToNumber(vertex.y)]);
        }
        coordinateList.push([convertProtoDoubleToNumber(vertices[0].x), convertProtoDoubleToNumber(vertices[0].y)]);
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

    private fixTurfPolygonOutOfBound(polygon: TurfPolygon): TurfPolygon {
        const boundedPointList = polygon.coordinates[0].map((position) => {
            const [x, y] = position;
            return [Math.max(0, Math.min(1, x)), Math.max(0, Math.min(1, y))];
        });
        return toTurfPolygon([boundedPointList]).geometry;
    }

    private fixSelfIntersectedTurfPolygon(polygon: TurfPolygon): TurfPolygon {
        const kinkPointList = kinks(polygon).features.map((point) => {
            return point.geometry.coordinates;
        });

        /**
         * HACK: unkinkPolygon() will cause error if there is an intersection that lies directly on a vertex.
         * To prevent that, we will just remove these vertices.
         */
        const verticesFarFromKinkList = polygon.coordinates[0].filter((vertex) => {
            return kinkPointList.every((kinkPoint) => {
                return vertex[0] !== kinkPoint[0] || vertex[1] !== kinkPoint[1];
            });
        });

        const unKinkedPolygonList = unkinkPolygon(
            toTurfPolygon([this.ensureStartEndVertexEqual(verticesFarFromKinkList)])
        );

        // Only keep the polygon with the maximum area
        let maxArea = -1;
        let maxAreaIndex = -1;
        unKinkedPolygonList.features.forEach((polygon, index) => {
            const itemArea = area(polygon);
            if (itemArea > maxArea) {
                maxArea = itemArea;
                maxAreaIndex = index;
            }
        });

        return unKinkedPolygonList.features[maxAreaIndex].geometry;
    }

    private calculateUnionOfTurfPolygonListAndTurfPolygon(
        polygonList: TurfPolygon[],
        polygon: TurfPolygon
    ): TurfPolygon[] {
        const turfMultiPolygon = this.convertTuftPolygonListToTurfMultiPolygon(polygonList);
        const unionTurfPolygon = union(turfMultiPolygon, polygon);
        if (unionTurfPolygon === null) {
            return [];
        }
        if (unionTurfPolygon.geometry.type === "Polygon") {
            return [unionTurfPolygon.geometry];
        } else {
            return this.convertTurfMultiPolygonToTurfPolygonList(unionTurfPolygon.geometry);
        }
    }

    private calculateIntersectionOfTurfPolygonListAndTurfPolygon(
        polygonList: TurfPolygon[],
        polygon: TurfPolygon
    ): TurfPolygon[] {
        const turfMultiPolygon = this.convertTuftPolygonListToTurfMultiPolygon(polygonList);
        const unionTurfPolygon = intersect(turfMultiPolygon, polygon);
        if (unionTurfPolygon === null) {
            return [];
        }
        if (unionTurfPolygon.geometry.type === "Polygon") {
            return [unionTurfPolygon.geometry];
        } else {
            return this.convertTurfMultiPolygonToTurfPolygonList(unionTurfPolygon.geometry);
        }
    }

    private convertTuftPolygonListToTurfMultiPolygon(polygonList: TurfPolygon[]): TurfMultiPolygon {
        const coordinateList = [];
        for (const item of polygonList) {
            coordinateList.push(item.coordinates);
        }
        return toTurfMultiPolygon(coordinateList).geometry;
    }

    private convertTurfMultiPolygonToTurfPolygonList(multiPolygon: TurfMultiPolygon): TurfPolygon[] {
        const polygonList: TurfPolygon[] = [];
        for (const coordinateList of multiPolygon.coordinates) {
            polygonList.push(toTurfPolygon(coordinateList).geometry);
        }
        return polygonList;
    }

    private ensureStartEndVertexEqual(positionList: Position[]): Position[] {
        const lastIndex = positionList.length - 1;
        if (positionList[0][0] === positionList[lastIndex][0] && positionList[0][1] === positionList[lastIndex][1]) {
            return positionList;
        }
        return [...positionList, positionList[0]];
    }
}

injected(TurfRegionNormalizer);

export const REGION_NORMALIZER_TOKEN = token<RegionNormalizer>("RegionNormalizer");

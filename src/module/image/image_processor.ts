import { injected, token } from "brandi";
import { writeFile, unlink } from "fs";
import sharp from "sharp";

export interface ImageProcessor {
    resizeImage(
        imageData: Buffer,
        minWidth: number,
        minHeigh: number
    ): Promise<Buffer>;
    saveImageFile(filename: string, imageData: Buffer): Promise<void>;
    deleteImageFile(filename: string): Promise<void>;
}

export class ImageProcessorImpl implements ImageProcessor {
    public async resizeImage(
        imageData: Buffer,
        minWidth: number,
        minHeigh: number
    ): Promise<Buffer> {
        let image = sharp(imageData);
        const imageMetadata = await image.metadata();
        if (
            this.checkImageNeedResizing(
                imageMetadata.width || 0,
                imageMetadata.height || 0,
                minWidth,
                minHeigh
            )
        ) {
            image = image.resize(minWidth, minHeigh, { fit: "outside" });
        }
        return image.rotate().toBuffer();
    }

    private checkImageNeedResizing(
        imageWidth: number,
        imageHeight: number,
        minWidth: number,
        minHeight: number
    ): boolean {
        if (imageWidth < minWidth) return false;
        if (imageHeight < minHeight) return false;
        return true;
    }

    public async saveImageFile(
        filename: string,
        imageData: Buffer
    ): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            writeFile(filename, imageData, (error) => {
                if (error) {
                    return reject(error);
                }
                resolve();
            });
        });
    }

    public async deleteImageFile(filename: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            unlink(filename, (error) => {
                if (error) {
                    return reject(error);
                }
                resolve();
            });
        });
    }
}

injected(ImageProcessorImpl);

export const IMAGE_PROCESSOR_TOKEN = token<ImageProcessor>("ImageProcessor");

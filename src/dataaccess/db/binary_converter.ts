import { injected, token } from "brandi";

export interface BinaryConverter {
    toBuffer<T = any>(data: T): Buffer;
    fromBuffer<T = any>(buffer: Buffer): T;
}

export class BinaryConverterImpl implements BinaryConverter {
    public toBuffer<T = any>(data: T): Buffer {
        return Buffer.from(JSON.stringify(data));
    }

    public fromBuffer<T = any>(buffer: Buffer): T {
        return JSON.parse(buffer.toString());
    }
}

injected(BinaryConverterImpl);

export const BINARY_CONVERTER_TOKEN = token<BinaryConverter>("BinaryConverter");

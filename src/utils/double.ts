export function convertProtoDoubleToNumber(
    value: number | string | undefined
): number {
    return +(value || 0);
}

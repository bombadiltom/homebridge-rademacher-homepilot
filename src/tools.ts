export function reversePercentage(p: number): number {
    const min = 0;
    const max = 100;
    return (min + max) - p;
}

export function duofernTemp2HomekitTemp(t: number): number {
    // TODO round
    return t / 10;
}

export function homekitTemp2DuofernTemp(t: number): number {
    // TODO round
    return t * 10;
}

export const MODULE_VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

type ParsedModuleVersion = {
    core: bigint[];
    prerelease: string[] | null;
};

function parseModuleVersion(value: string): ParsedModuleVersion | null {
    if (!MODULE_VERSION_PATTERN.test(value)) return null;
    const [coreValue, prereleaseValue] = value.split('-', 2);
    return {
        core: coreValue.split('.').map((part) => BigInt(part)),
        prerelease: prereleaseValue ? prereleaseValue.split('.') : null,
    };
}

export function compareModuleVersions(left: string, right: string) {
    const parsedLeft = parseModuleVersion(left);
    const parsedRight = parseModuleVersion(right);
    if (!parsedLeft || !parsedRight) return null;

    for (let index = 0; index < 3; index += 1) {
        if (parsedLeft.core[index] > parsedRight.core[index]) return 1;
        if (parsedLeft.core[index] < parsedRight.core[index]) return -1;
    }

    if (!parsedLeft.prerelease && !parsedRight.prerelease) return 0;
    if (!parsedLeft.prerelease) return 1;
    if (!parsedRight.prerelease) return -1;

    const length = Math.max(parsedLeft.prerelease.length, parsedRight.prerelease.length);
    for (let index = 0; index < length; index += 1) {
        const leftPart = parsedLeft.prerelease[index];
        const rightPart = parsedRight.prerelease[index];
        if (leftPart === undefined) return -1;
        if (rightPart === undefined) return 1;
        if (leftPart === rightPart) continue;
        const leftNumeric = /^\d+$/.test(leftPart);
        const rightNumeric = /^\d+$/.test(rightPart);
        if (leftNumeric && rightNumeric) return BigInt(leftPart) > BigInt(rightPart) ? 1 : -1;
        if (leftNumeric !== rightNumeric) return leftNumeric ? -1 : 1;
        return leftPart > rightPart ? 1 : -1;
    }
    return 0;
}

export function isModuleVersionGreater(candidate: string, current: string) {
    return compareModuleVersions(candidate, current) === 1;
}

export function suggestNextModuleVersion(current: string) {
    const parsed = parseModuleVersion(current);
    if (!parsed) return current;
    return `${parsed.core[0]}.${parsed.core[1]}.${parsed.core[2] + 1n}`;
}

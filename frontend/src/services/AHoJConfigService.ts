import { Pocket, Point3D, MolstarResidue } from "../types";

export const calculatePocketQuery = (pocket: Pocket, coordinates: Point3D[], structureId: string, getResidueInfo: (residueId: string) => MolstarResidue | undefined) => {
    const points: Array<Array<number>> = coordinates.map(coord => [coord.x, coord.y, coord.z]);

    // Calculate the average of the coordinates
    const middleResidue = points.reduce((acc, val) => {
        return {
            x: acc.x + val[0],
            y: acc.y + val[1],
            z: acc.z + val[2]
        };
    }, { x: 0, y: 0, z: 0 });

    middleResidue.x /= points.length;
    middleResidue.y /= points.length;
    middleResidue.z /= points.length;

    // Find the nearest coordinate to the average
    let nearestCoord = points[0];
    let minDistance = Number.MAX_VALUE;

    points.forEach(coord => {
        const distance = Math.sqrt(
            Math.pow(coord[0] - middleResidue.x, 2) +
            Math.pow(coord[1] - middleResidue.y, 2) +
            Math.pow(coord[2] - middleResidue.z, 2)
        );

        if (distance < minDistance) {
            minDistance = distance;
            nearestCoord = coord;
        }
    });

    const coordsIdx = coordinates.findIndex(coord =>
        coord.x === nearestCoord[0] && coord.y === nearestCoord[1] && coord.z === nearestCoord[2]
    );
    const residue = pocket.residue_ids[coordsIdx];
    const residueWithData = getResidueInfo(residue);

    return `${structureId} ${residueWithData?.chain.authAsymId} ${residueWithData?.authName} ${residueWithData?.authSeqNumber}`;
};

export const createAHoJJobConfiguration = (query: string) => {
    return `{
        "job_name": "CryptoShow ${query}",
        "queries": "${query}",
        "options": { }
    }`;
};

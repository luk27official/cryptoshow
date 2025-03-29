import { getResidueCoordinates, getResidueInformation } from "../components/MolstarComponent";
import { AHoJResponse, Pocket } from "../types";
import { PluginUIContext } from "molstar/lib/mol-plugin-ui/context";
import { getApiUrl } from "../utils";

export function getAHoJJobConfiguration(pocket: Pocket, plugin: PluginUIContext, structureId: string) {
    const query = getAHoJQuery(pocket, plugin, structureId);

    return `{
        "job_name": "CryptoShow ${query}",
        "queries": "${query}",
        "options": { }
    }`;
}

export function getAHoJQuery(pocket: Pocket, plugin: PluginUIContext, structureId: string) {
    const coords = getResidueCoordinates(plugin, pocket.residue_ids);

    const points: Array<Array<number>> = [];
    coords.forEach(coord => points.push([coord.x, coord.y, coord.z]));

    // calculate the average of the coordinates
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

    // calculate the nearest coordinate to the average
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

    const coordsIdx = coords.findIndex(coord => coord.x === nearestCoord[0] && coord.y === nearestCoord[1] && coord.z === nearestCoord[2]);
    const residue = pocket.residue_ids[coordsIdx];

    const residue_with_data = getResidueInformation(plugin, residue);
    const query = `${structureId} ${residue_with_data?.chain.authAsymId} ${residue_with_data?.authName} ${residue_with_data?.authSeqNumber}`;

    return query;
};

export async function submitAHoJJob(config: string) {
    try {
        const response = await fetch(getApiUrl("/proxy/ahoj/job"), {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: config
        });

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error("Error submitting AHoJ job:", error);
        return null;
    }
}

export async function getAHoJJobStatus(jobId: string): Promise<AHoJResponse | null> {
    try {
        const response = await fetch(getApiUrl(`/proxy/ahoj/job/${jobId}`));

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error("Error fetching AHoJ job status:", error);
        return null;
    }
}

export async function pollAHoJJobStatus(jobId: string, interval: number = 5000): Promise<AHoJResponse> {
    return new Promise((resolve) => {
        const intervalId = setInterval(async () => {
            const status = await getAHoJJobStatus(jobId);
            if (status) {
                if (status.done) {
                    clearInterval(intervalId);
                    resolve(status);
                }
            } else {
                console.error("Failed to fetch AHoJ job status, jobId:", jobId);
            }
        }, interval);
    });
}
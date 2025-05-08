import { Pocket } from "../types";
import { useAppContext } from "../hooks/useApp";
import "./PocketDetails.css";

interface PocketDetailsProps {
    pocket: Pocket;
}

const PocketDetails = ({ pocket }: PocketDetailsProps) => {
    const predictionString = pocket.prediction.map((e) => e.toFixed(3)).join(", ");
    const residueIds = pocket.residue_ids.join(", ");

    const { cryptoBenchResult } = useAppContext();
    const structureName = cryptoBenchResult!.structure_name;

    const residuesByChain: { [key: string]: string[]; } = {};
    pocket.residue_ids.forEach(residueId => {
        const [chain, resNum] = residueId.split("_");
        if (!residuesByChain[chain]) {
            residuesByChain[chain] = [];
        }
        residuesByChain[chain].push(resNum);
    });

    const chainSelectors = Object.entries(residuesByChain)
        .map(([chain, resNums]) => `(chain ${chain} and resi ${resNums.join("+")})`);

    const pymolCommand = `select s, ${structureName} and ( ${chainSelectors.join(" or ")} )`;

    return (
        <div className="pocket-details">
            <div className="pocket-info">
                <div className="prediction-values">
                    <span className="info-label">Predictions:</span>
                    <span className="info-value">{predictionString}</span>
                </div>
                <div className="residue-ids">
                    <span className="info-label">Residue IDs:</span>
                    <span className="info-value truncate-text">{residueIds}</span>
                </div>
                <div className="pymol-export">
                    <span className="info-label">PyMOL visualization:</span>
                    <span className="info-value code-block">{pymolCommand}</span>
                </div>
            </div>
        </div>
    );
};

export default PocketDetails;

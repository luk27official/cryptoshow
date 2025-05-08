import { Pocket, AHoJResponse } from "../types";
import AHoJResults from "./AHoJResults";
import "./AHoJSection.css";

interface AHoJSectionProps {
    pocket: Pocket;
    index: number;
    ahoJJobId: string | null;
    ahoJJobResult: AHoJResponse | null;
    onAHoJClick: (pocket: Pocket, index: number) => void;
}

const AHoJSection = ({
    pocket,
    index,
    ahoJJobId,
    ahoJJobResult,
    onAHoJClick,
}: AHoJSectionProps) => (
    <div className="ahoj-section">
        <div className="ahoj-controls">
            <button
                className="ahoj-button"
                onClick={() => onAHoJClick(pocket, index)}
                disabled={!!ahoJJobId || !!ahoJJobResult}
            >
                {ahoJJobResult ? "Job Completed" : ahoJJobId ? "Loading..." : "Run AHoJ"}
            </button>

            {ahoJJobId && <a href={`https://apoholo.cz/job/${ahoJJobId}`} target="_blank" rel="noopener noreferrer" className="job-id">AHoJ Job ID: {ahoJJobId}</a>}
        </div>

        {ahoJJobResult && <AHoJResults pocket={pocket} ahoJJobResult={ahoJJobResult} />}
    </div>
);

export default AHoJSection;

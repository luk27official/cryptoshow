import { Pocket, AHoJResponse } from "../types";
import { useState } from "react";
import { useAppContext } from "../hooks/useApp";
import PocketHeader from "./PocketHeader";
import PocketDetails from "./PocketDetails";
import AHoJSection from "./AHoJSection";

import "./ResultTableRow.css";

interface ResultTableRowProps {
    pocket: Pocket;
    index: number;
    ahoJJobId: string | null;
    ahoJJobResult: AHoJResponse | null;
    onAHoJClick: (pocket: Pocket, index: number) => void;
}

const ResultTableRow = ({
    pocket,
    index,
    ahoJJobId,
    ahoJJobResult,
    onAHoJClick,
}: ResultTableRowProps) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const { cryptoBenchResult } = useAppContext();

    const toggleExpand = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsExpanded(!isExpanded);
    };

    return (
        <div className={`result-row ${isExpanded ? "expanded" : "collapsed"}`}>
            <PocketHeader
                pocket={pocket}
                isExpanded={isExpanded}
                toggleExpand={toggleExpand}
            />

            {isExpanded && (
                <div className="pocket-content">
                    <PocketDetails pocket={pocket} />

                    {cryptoBenchResult!.structure_name !== "custom" && (
                        <AHoJSection
                            pocket={pocket}
                            index={index}
                            ahoJJobId={ahoJJobId}
                            ahoJJobResult={ahoJJobResult}
                            onAHoJClick={onAHoJClick}
                        />
                    )}
                </div>
            )}
        </div>
    );
};

export default ResultTableRow;
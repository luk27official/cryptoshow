import "./InputTable.css";

interface InputTableProps {
    pdbCode: string;
    fileData: File | null;
    isLoading: boolean;
    setPdbCode: (code: string) => void;
    setFileData: (file: File | null) => void;
    handleSubmit: () => void;
}

const InputTable: React.FC<InputTableProps> = ({
    pdbCode,
    fileData,
    isLoading,
    setPdbCode,
    setFileData,
    handleSubmit,
}) => {
    const onSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!isLoading && (pdbCode || fileData)) {
            handleSubmit();
        }
    };

    return (
        <form onSubmit={onSubmit}>
            <table className="input-table">
                <tbody>
                    <tr>
                        <td>PDB/AF ID:</td>
                        <td>
                            <input
                                type="text"
                                value={pdbCode}
                                onChange={(e) => setPdbCode(e.target.value.trim())}
                                disabled={isLoading}
                                placeholder="Enter a PDB/AlphaFold ID (e.g., 2RFC)"
                            />
                        </td>
                    </tr>
                    <tr>
                        <td>or upload a file:</td>
                        <td>
                            <input
                                type="file"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                        setPdbCode("");
                                        setFileData(file);
                                    }
                                }}
                                disabled={isLoading}
                                accept=".pdb,.cif,.pdb1"
                            />
                        </td>
                    </tr>
                    <tr>
                        <td></td>
                        <td style={{ textAlign: "center", display: "flex" }}>
                            <button
                                type="submit"
                                disabled={isLoading || (!pdbCode && !fileData)}
                            >
                                {isLoading ? "Processing..." : "Submit"}
                            </button>
                        </td>
                    </tr>
                </tbody>
            </table>
        </form>
    );
};

export default InputTable;
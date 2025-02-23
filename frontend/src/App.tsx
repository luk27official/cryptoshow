import { useState } from 'react';
import './App.css';

function App() {

  const [pdbCode, setPdbCode] = useState('');
  const [taskId, setTaskId] = useState('');
  const [resultData, setResultData] = useState<any>({}); // TODO: add proper types

  const handleSubmit = async () => {
    const data = await fetch(`./api/calculate/${pdbCode}`)
      .then(response => response.json()); // TODO: add proper types and error handling

    console.log("submitting...", data);

    setTaskId(data["task_id"]);
    poll(data["task_id"]);
  };

  const poll = async (tId: string) => {
    const data = await fetch(`./api/task-status/${tId}`)
      .then(response => response.json()); // TODO add proper types and error handling

    console.log("polling...", data);

    if (data["status"] === 'SUCCESS') { // TODO: add more status, enable showing intermediate results
      setResultData(data["result"]);
    } else if (data["status"] === 'PENDING') {
      setTimeout(() => poll(tId), 1000);
    } else {
      setResultData(data["status"]);
    }
  };

  return (
    <>
      <div>
        <h2>CryptoShow</h2>
      </div>
      <div>
        <span>Input a PDB code: </span>
        <input type="text" value={pdbCode} onChange={(e) => setPdbCode(e.target.value)} />
        &nbsp;
        <button onClick={() => handleSubmit()}>Submit</button>
      </div>
      {taskId &&
        <div>
          <h3>Task ID:</h3>
          <p>{taskId}</p>
        </div>
      }
      {resultData["status"] &&
        <div>
          <h3>Result:</h3>
          <p>{resultData["status"]}</p>
          <ul>
            {resultData["prediction"].map((value: number, index: number) => (
              <li key={index}>{value.toFixed(5)}</li>
            ))}
          </ul>
        </div>
      }
    </>
  );
}

export default App;

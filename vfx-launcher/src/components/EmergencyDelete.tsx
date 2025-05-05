import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

const EmergencyDelete = () => {
  const [projectId, setProjectId] = useState<number>(1);
  const [status, setStatus] = useState<string>('Ready');
  const [log, setLog] = useState<string[]>([]);

  // Helper function to add log entries
  const addLog = (message: string) => {
    setLog(prev => [...prev, message]);
  };

  // Clear the log
  const clearLog = () => {
    setLog([]);
  };

  // Attempt to delete via basic command
  const handleDelete = async () => {
    clearLog();
    setStatus('Working...');
    
    try {
      addLog(`Attempting to delete project ${projectId}...`);

      // Changing parameter name to match the error message
      const result = await invoke('emergency_delete_project', { 
        projectId: projectId  // Using camelCase as suggested by the error
      });
      
      addLog(`Success: ${result}`);
      setStatus('Success');
    } catch (error) {
      addLog(`Error: ${error}`);
      setStatus('Failed');
    }
  };

  return (
    <div style={{
      position: 'fixed',
      zIndex: 9999,
      top: 10,
      left: 10,
      right: 10,
      padding: '15px',
      backgroundColor: '#800000',
      color: 'white',
      borderRadius: '5px',
      boxShadow: '0 4px 8px rgba(0,0,0,0.5)',
    }}>
      <h2 style={{ margin: '0 0 10px 0' }}>🚨 EMERGENCY DELETE 🚨</h2>
      
      <div style={{ marginBottom: '10px', display: 'flex', gap: '10px', alignItems: 'center' }}>
        <label>
          Project ID:
          <input 
            type="number"
            value={projectId}
            onChange={e => setProjectId(parseInt(e.target.value) || 1)}
            style={{ 
              margin: '0 10px',
              padding: '5px',
              width: '60px',
              backgroundColor: '#222',
              color: 'white',
              border: '1px solid #555'
            }}
          />
        </label>
        
        <button
          onClick={handleDelete}
          style={{
            padding: '8px 16px',
            backgroundColor: '#ff0000',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontWeight: 'bold',
            cursor: 'pointer',
          }}
        >
          DELETE PROJECT
        </button>
        
        <span style={{ marginLeft: '10px', fontWeight: 'bold' }}>
          Status: {status}
        </span>
      </div>
      
      <div style={{
        backgroundColor: '#222',
        padding: '10px',
        maxHeight: '100px',
        overflow: 'auto',
        fontFamily: 'monospace',
        fontSize: '12px'
      }}>
        {log.map((line, i) => (
          <div key={i}>{line}</div>
        ))}
      </div>
    </div>
  );
};

export default EmergencyDelete;

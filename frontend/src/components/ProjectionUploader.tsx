// Component for uploading CSV files to generate financial projections
import React, { useState } from 'react';

interface ProjectionUploaderProps {
  onProjectionSuccess: (
    dataset: string, 
    data: any[], 
    time_data: { period: string; pending_spend: number }[]
  ) => void;
  onClearProjection: () => void;
  hasActiveProjection: boolean;
}

/*
 * ProjectionUploader Component
 * Handles the selection of a CSV file and dataset type, sending it to the 
 * in-memory projection API. On success, it passes the aggregated financial 
 * objects back to the parent dashboard for merging.
*/
export function ProjectionUploader({ onProjectionSuccess, onClearProjection, hasActiveProjection }: ProjectionUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [dataset, setDataset] = useState<string>('amazon');
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // State to track if we successfully auto-detected the CSV type
  const [wasAutoDetected, setWasAutoDetected] = useState(false);

  // --- SMART AUTO-DETECTION ---
  const detectDatasetFromHeaders = (file: File) => {
    // Read only the first 1024 bytes to grab the header row instantly
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) return;

      const firstLine = text.split('\n')[0].toLowerCase();

      // Look for signature columns based on our Pandas backend logic
      if (firstLine.includes('order date') || firstLine.includes('seller')) {
        setDataset('amazon');
        setWasAutoDetected(true);
        console.log("[OK] Auto-detected Amazon CSV");
      } else if (firstLine.includes('po date') || firstLine.includes('extended price')) {
        setDataset('cruzbuy');
        setWasAutoDetected(true);
        console.log("[OK] Auto-detected CruzBuy CSV");
      } else if (firstLine.includes('transaction description') || firstLine.includes('merchant')) {
        setDataset('onecard');
        setWasAutoDetected(true);
        console.log("[OK] Auto-detected OneCard CSV");
      } else if (firstLine.includes('product category') || firstLine.includes('item,date,quantity')) {
        setDataset('bookstore');
        setWasAutoDetected(true);
        console.log("[OK] Auto-detected Bookstore CSV");
      } else {
        // Reset if we can't identify it, letting the user pick manually
        setWasAutoDetected(false); 
      }
    };
    reader.readAsText(file.slice(0, 1024));
  };

  // --- UPLOAD HANDLER ---
  // Handles the file upload and sends it to the projection API
  const handleUpload = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    if (!file) return;

    setIsUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('dataset', dataset);

    try {
      const response = await fetch('http://127.0.0.1:8000/api/analytics/project', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Failed to process projection data');

      const result = await response.json();
      console.log(`[OK] Projection successful for ${dataset}`, result.data);
      
      onProjectionSuccess(result.dataset, result.data, result.time_data);
      setFile(null);
      setWasAutoDetected(false); // reset the badge on success
    } catch (err: any) {
      console.error("[ERROR] Projection upload failed:", err);
      setError(err.message || 'An error occurred during projection.');
    } finally {
      setIsUploading(false);
    }
  };

  if (hasActiveProjection) {
    return (
      <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl flex justify-between items-center shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="w-3 h-3 rounded-full bg-purple-500 animate-pulse" />
          <span className="font-bold text-purple-900">Projection Active</span>
        </div>
        <button 
          onClick={onClearProjection}
          className="px-4 py-2 bg-white border border-purple-200 text-purple-700 rounded-lg text-sm font-bold shadow-sm hover:bg-purple-50 transition-colors"
        >
          Clear Projection
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleUpload} className="p-4 bg-gray-50 border border-gray-200 rounded-xl flex flex-wrap gap-4 items-center shadow-sm">
      <div className="flex items-center gap-2 font-semibold text-sm text-gray-700">
        Project New Data:
        {wasAutoDetected && (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
            Auto-detected
          </span>
        )}
      </div>
      
      <select 
        value={dataset} 
        onChange={(e) => {
          setDataset(e.target.value);
          setWasAutoDetected(false); // clear badge if user manually overrides
        }}
        className="text-sm border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2"
      >
        <option value="amazon">Amazon</option>
        <option value="cruzbuy">CruzBuy</option>
        <option value="onecard">OneCard</option>
        <option value="bookstore">Bookstore</option>
      </select>

      <input 
        type="file" 
        accept=".csv"
        onChange={(e) => {
          const selectedFile = e.target.files?.[0];
          if (selectedFile) {
            setFile(selectedFile);
            detectDatasetFromHeaders(selectedFile); // trigger detection
          } else {
            setFile(null);
            setWasAutoDetected(false);
          }
        }}
        className="text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
      />

      <button 
        type="submit" 
        disabled={!file || isUploading}
        className="px-4 py-2 bg-white border rounded-lg text-sm font-bold shadow-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {isUploading ? 'Calculating...' : 'Run Projection'}
      </button>

      {error && <div className="w-full text-xs text-red-600 font-semibold">{error}</div>}
    </form>
  );
}

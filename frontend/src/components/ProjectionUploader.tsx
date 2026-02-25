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

/**
 * ProjectionUploader Component
 * * Handles the selection of a CSV file and dataset type, sending it to the 
 * in-memory projection API. On success, it passes the aggregated financial 
 * objects back to the parent dashboard for merging.
 */
export function ProjectionUploader({ onProjectionSuccess, onClearProjection, hasActiveProjection }: ProjectionUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [dataset, setDataset] = useState<string>('amazon');
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async (e: React.FormEvent) => {
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
          <span className="font-bold text-purple-900">What-If Projection Active</span>
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
      <div className="font-semibold text-sm text-gray-700">Project New Data:</div>
      
      <select 
        value={dataset} 
        onChange={(e) => setDataset(e.target.value)}
        className="text-sm border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2"
      >
        <option value="amazon">Amazon</option>
        <option value="cruzbuy">OneBuy</option>
        <option value="pcard">ProCard</option>
        <option value="baytree">BayTree</option>
      </select>

      <input 
        type="file" 
        accept=".csv"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
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
import React, { useState, useEffect } from 'react';
import { HardDrive, Database, FileCog, AlertCircle, RefreshCw, X, Loader2, Clock, ServerCrash, ChevronDown, ChevronUp, FileText, Sparkles } from 'lucide-react';

interface DatasetStatus {
    dataset: string;
    in_drive: boolean | null;
    is_cleaned: boolean;
    is_pushed: boolean;
    status_label: string;
    pending_files?: string[];
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onConfirmRefresh: () => void;
    isRefreshing: boolean;
}

export function RefreshModal({ isOpen, onClose, onConfirmRefresh, isRefreshing }: Props) {
    const [statuses, setStatuses] = useState<DatasetStatus[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [rawDriveFiles, setRawDriveFiles] = useState<string[]>([]);
    const [rawDBDocs, setRawDBDocs] = useState<string[]>([]);
    const [showDiagnostics, setShowDiagnostics] = useState(false);

    // fetch the status when the modal opens
    useEffect(() => {
        if (isOpen) {
        setIsLoading(true);
        setError(null);
        setShowDiagnostics(false);  // reset diagnostics view on open
        fetch('/api/system/sync-status')
        .then((res) => {
          if (!res.ok) throw new Error("Server responded with an error");
          return res.json();
        })
        .then((data) => {
          setStatuses(data.datasets || []);
          setRawDriveFiles(data.raw_drive_files || []);
          setRawDBDocs(data.raw_db_docs || []);
          setIsLoading(false);
        })
        .catch((err) => {
          console.error("Failed to fetch sync status", err);
          setError("Unable to connect to the server. Please check if the backend is running.");
          setIsLoading(false);
        });
    }
    }, [isOpen]);

  if (!isOpen) return null;

  const getStatusColor = (label: string) => {
    switch (label) {
      case 'Pushed & Synced': 
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'In Drive, Needs Cleaning': 
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'Update Available': 
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'Awaiting Processing': 
        return 'bg-slate-100 text-slate-600 border-slate-300 border-dashed';
      default: 
        return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  }

  const getStatusIcon = (label: string) => {
    switch (label) {
      case 'Pushed & Synced': 
        return <Database className="size-4 text-emerald-600" />;
      case 'Cleaned, Pending Push': 
        return <FileCog className="size-4 text-blue-600" />;
      case 'In Drive, Needs Cleaning': 
        return <HardDrive className="size-4 text-amber-600" />;
      case 'Update Available': 
        return <Sparkles className="size-4 text-purple-600" />;
      case 'Awaiting Processing': 
        return <Clock className="size-4 text-slate-500" />;
      default: 
        return <AlertCircle className="size-4 text-slate-400" />;
    }
  };


return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50 rounded-t-2xl">
          <h2 className="text-xl font-bold text-[#003c6c] flex items-center gap-2">
            <RefreshCw className="size-5" /> Data Synchronization
          </h2>
          <button onClick={onClose} disabled={isRefreshing} className="text-slate-400 hover:text-slate-700 transition-colors">
            <X className="size-5" />
          </button>
        </div>

        {/* Body (Scrollable) */}
        <div className="p-6 overflow-y-auto">
          <p className="text-sm text-slate-600 mb-6">
            Review the current state of your data pipeline. Clicking 'Start Refresh' will download available files, run the cleaning algorithms, and push updates to BigQuery and Firestore.
          </p>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-8 animate-spin text-[#2d66ae]" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center p-6 text-center border-2 border-red-100 bg-red-50 rounded-xl">
              <ServerCrash className="size-10 text-red-500 mb-3" />
              <p className="text-sm font-semibold text-red-800">Connection Failed</p>
              <p className="text-xs text-red-600 mt-1">{error}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Main Status Cards */}
              <div className="space-y-2">
                {statuses.map((s) => (
                  <div key={s.dataset} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-white">
                    <div className="font-semibold text-slate-800">{s.dataset}</div>
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold uppercase tracking-wider ${getStatusColor(s.status_label)}`}>
                      {getStatusIcon(s.status_label)}
                      {s.status_label}
                    </div>
                  </div>
                ))}
              </div>

              {/* Collapsible Diagnostics Section */}
              <div className="mt-4 border border-slate-200 rounded-lg overflow-hidden">
                <button 
                  onClick={() => setShowDiagnostics(!showDiagnostics)}
                  className="w-full flex items-center justify-between p-3 bg-slate-50 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <FileText className="size-4 text-slate-500" />
                    View Detected Files & Database Records
                  </span>
                  {showDiagnostics ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                </button>
                
                {showDiagnostics && (
                  <div className="p-4 bg-white border-t border-slate-200 grid grid-cols-2 gap-4">
                    {/* Google Drive List */}
                    <div>
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <HardDrive className="size-3.5" /> Found in Drive
                      </h4>
                      {rawDriveFiles.length > 0 ? (
                        <ul className="space-y-1">
                          {rawDriveFiles.map((file, i) => {
                            // Check if this specific file is marked as pending across any dataset
                            const isPending = statuses.some(s => s.pending_files?.includes(file));
                            
                            return (
                              <li 
                                key={i} 
                                className={`text-xs font-mono truncate px-2 py-1 rounded ${
                                  isPending 
                                    ? 'bg-purple-50 text-purple-700 border border-purple-100'
                                    : 'bg-slate-50 text-slate-600'
                                }`} 
                                title={file}
                              >
                                {file}
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <p className="text-xs text-slate-400 italic">No valid files found.</p>
                      )}
                    </div>

                    {/* Firestore List */}
                    <div>
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Database className="size-3.5" /> Pushed to DB
                      </h4>
                      {rawDBDocs.length > 0 ? (
                        <ul className="space-y-1">
                          {rawDBDocs.map((doc, i) => (
                            <li key={i} className="text-xs text-emerald-700 font-mono bg-emerald-50 px-2 py-1 rounded">
                              {doc}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-slate-400 italic">No collections pushed yet.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4 bg-slate-50 rounded-b-2xl">
          <button
            onClick={onClose}
            disabled={isRefreshing}
            className="px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirmRefresh}
            disabled={isRefreshing || isLoading || !!error}
            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-[#2d66ae] rounded-lg hover:bg-[#003c6c] disabled:opacity-50 transition-colors"
          >
            {isRefreshing ? (
              <><Loader2 className="size-4 animate-spin" /> Syncing Data...</>
            ) : (
              <><RefreshCw className="size-4" /> Start Refresh</>
            )}
          </button>
        </div>

      </div>
    </div>
  );

}
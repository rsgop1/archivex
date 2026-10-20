import React, { useState, useRef } from 'react';
import {
  Upload,
  X,
  FileVideo,
  FileText,
  File,
  CheckCircle2,
  AlertCircle,
  HardDrive,
  Sparkles,
} from 'lucide-react';
import { formatBytes } from '../utils/sanitize.ts';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: () => void;
}

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  onUploadSuccess,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setErrorMsg(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
      setErrorMsg(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setUploadProgress(20);
    setUploadStatus('Streaming media to local storage engine...');
    setErrorMsg(null);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      setUploadProgress(50);
      setUploadStatus('Computing cryptographic SHA-256 checksum...');

      const res = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Upload failed');
      }

      setUploadProgress(100);
      setUploadStatus('Verified and registered into archive database!');
      setTimeout(() => {
        onUploadSuccess();
        onClose();
        setSelectedFile(null);
        setUploading(false);
        setUploadProgress(0);
      }, 1000);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to upload media file');
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-indigo-400" />
            <h3 className="text-base font-bold text-white">Ingest Local Media to Vault</h3>
          </div>
          <button
            onClick={onClose}
            disabled={uploading}
            className="text-slate-400 hover:text-white p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drag and Drop Zone */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="p-8 border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-2xl bg-slate-950/60 text-center space-y-3 cursor-pointer transition-colors"
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
          />
          <div className="w-12 h-12 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center mx-auto">
            <Upload className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-200">
              {selectedFile ? selectedFile.name : 'Click to select or drag and drop a file'}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              Supports MP4, MKV, PDF, DOCX, ZIP, MP3, PNG, JPG up to 2GB
            </p>
          </div>
        </div>

        {/* Selected file preview */}
        {selectedFile && (
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between text-xs">
            <div className="flex items-center gap-2.5 truncate">
              {selectedFile.type.startsWith('video') ? (
                <FileVideo className="w-4 h-4 text-indigo-400 shrink-0" />
              ) : selectedFile.type.includes('pdf') ? (
                <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <File className="w-4 h-4 text-slate-400 shrink-0" />
              )}
              <span className="truncate font-semibold text-slate-200">{selectedFile.name}</span>
            </div>
            <span className="font-mono text-slate-400 shrink-0 ml-2">
              {formatBytes(selectedFile.size)}
            </span>
          </div>
        )}

        {/* Progress & Status */}
        {uploading && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-mono text-slate-400">
              <span>{uploadStatus}</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Error notification */}
        {errorMsg && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-2 text-rose-300 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            disabled={uploading}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={uploading || !selectedFile}
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 cursor-pointer"
          >
            {uploading ? 'Processing Ingestion...' : 'Ingest & Verify File'}
          </button>
        </div>
      </div>
    </div>
  );
};

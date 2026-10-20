import React, { useState } from 'react';
import {
  Search,
  Filter,
  Grid,
  List,
  FileVideo,
  FileText,
  FileImage,
  FileAudio,
  File,
  Copy,
  Check,
  Trash2,
  Edit2,
  ExternalLink,
  ShieldAlert,
  Play,
  Upload,
  Clock,
  Sparkles,
  ArrowUpDown,
  Tag,
  X,
} from 'lucide-react';
import { FileRecord, FileCategory } from '../types/index.ts';
import { formatBytes } from '../utils/sanitize.ts';

interface MediaLibraryViewProps {
  files: FileRecord[];
  onRefresh: () => void;
  onOpenUpload: () => void;
}

export const MediaLibraryView: React.FC<MediaLibraryViewProps> = ({
  files,
  onRefresh,
  onOpenUpload,
}) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [sortBy, setSortBy] = useState<'date' | 'size' | 'name'>('date');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [selectedFile, setSelectedFile] = useState<FileRecord | null>(null);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editTags, setEditTags] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Filter and sort files locally for instant UI responsiveness
  let filtered = files.filter((f) => {
    if (selectedCategory !== 'all' && f.category !== selectedCategory) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchName = f.original_name.toLowerCase().includes(q);
      const matchTags = f.tags.some((t) => t.toLowerCase().includes(q));
      const matchHash = f.sha256_hash.toLowerCase().includes(q);
      const matchSource = f.source_description.toLowerCase().includes(q);
      if (!matchName && !matchTags && !matchHash && !matchSource) return false;
    }
    return true;
  });

  filtered.sort((a, b) => {
    let cmp = 0;
    if (sortBy === 'size') cmp = a.size_bytes - b.size_bytes;
    else if (sortBy === 'name') cmp = a.original_name.localeCompare(b.original_name);
    else cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    return sortOrder === 'desc' ? -cmp : cmp;
  });

  const copyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const getCategoryIcon = (category: FileCategory) => {
    switch (category) {
      case 'videos':
        return <FileVideo className="w-5 h-5 text-indigo-400" />;
      case 'documents':
        return <FileText className="w-5 h-5 text-emerald-400" />;
      case 'images':
        return <FileImage className="w-5 h-5 text-purple-400" />;
      case 'audio':
        return <FileAudio className="w-5 h-5 text-amber-400" />;
      default:
        return <File className="w-5 h-5 text-slate-400" />;
    }
  };

  const openFileDetail = (file: FileRecord) => {
    setSelectedFile(file);
    setEditName(file.original_name);
    setEditTags(file.tags.join(', '));
    setIsEditing(false);
  };

  const handleSaveMetadata = async () => {
    if (!selectedFile) return;
    try {
      const res = await fetch(`/api/files/${selectedFile.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          original_name: editName,
          tags: editTags.split(',').map((t) => t.trim()).filter(Boolean),
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setSelectedFile(updated);
        setIsEditing(false);
        onRefresh();
      }
    } catch (err) {
      console.error('Failed to update file:', err);
    }
  };

  const handleDeleteFile = async (id: string) => {
    try {
      const res = await fetch(`/api/files/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setDeleteConfirmId(null);
        if (selectedFile?.id === id) {
          setSelectedFile(null);
        }
        onRefresh();
      }
    } catch (err) {
      console.error('Failed to delete file:', err);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white">Media Library Vault</h1>
          <p className="text-xs text-slate-400">
            Immutable originals, SHA-256 deduplication, and metadata inspection
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onOpenUpload}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-all shadow-lg shadow-indigo-600/20 cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>Ingest Media</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 space-y-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, tag, or SHA-256..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Sort & View Mode */}
          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
            <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent text-slate-300 focus:outline-none cursor-pointer"
              >
                <option value="date" className="bg-slate-900">Date Added</option>
                <option value="size" className="bg-slate-900">File Size</option>
                <option value="name" className="bg-slate-900">File Name</option>
              </select>
              <button
                onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                className="text-slate-400 hover:text-white px-1 font-mono"
              >
                {sortOrder === 'desc' ? '↓' : '↑'}
              </button>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-colors ${
                  viewMode === 'grid' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
                aria-label="Grid view"
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg transition-colors ${
                  viewMode === 'table' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
                aria-label="Table view"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {['all', 'videos', 'documents', 'images', 'audio', 'other'].map((cat) => {
            const active = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize whitespace-nowrap transition-colors ${
                  active
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                {cat === 'documents' ? 'PDFs & Docs' : cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid View */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((file) => (
            <div
              key={file.id}
              onClick={() => openFileDetail(file)}
              className="group bg-slate-900/70 border border-slate-800 hover:border-indigo-500/40 rounded-2xl p-5 flex flex-col justify-between transition-all hover:shadow-xl hover:shadow-indigo-500/5 cursor-pointer"
            >
              <div>
                {/* Media Icon & Size Badge */}
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                    {getCategoryIcon(file.category)}
                  </div>
                  <span className="font-mono text-xs font-bold text-slate-300 bg-slate-950/80 px-2.5 py-1 rounded-lg border border-slate-800">
                    {formatBytes(file.size_bytes)}
                  </span>
                </div>

                {/* File Title */}
                <h3 className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors line-clamp-2 mb-2">
                  {file.original_name}
                </h3>

                {/* Metadata details */}
                <div className="space-y-1.5 text-[11px] text-slate-400 mb-4">
                  {file.resolution && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-500">Res:</span>
                      <span className="text-slate-300 font-mono">{file.resolution}</span>
                    </div>
                  )}
                  {file.duration_seconds && (
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3 h-3 text-slate-500" />
                      <span>{Math.floor(file.duration_seconds / 60)}m {file.duration_seconds % 60}s</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500">Source:</span>
                    <span className="text-slate-300 truncate max-w-[200px]">{file.source_description}</span>
                  </div>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {file.tags.slice(0, 3).map((tag, i) => (
                    <span
                      key={i}
                      className="text-[10px] px-2 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800/80"
                    >
                      #{tag}
                    </span>
                  ))}
                  {file.tags.length > 3 && (
                    <span className="text-[10px] text-slate-500">+{file.tags.length - 3}</span>
                  )}
                </div>
              </div>

              {/* Footer: SHA-256 preview */}
              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5 font-mono text-slate-500">
                  <span>SHA:</span>
                  <span className="text-slate-400">{file.sha256_hash.substring(0, 10)}...</span>
                </div>
                <span className="text-indigo-400 font-semibold group-hover:underline">
                  Inspect →
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Table View */
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 text-slate-400 uppercase font-semibold border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Original Name</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Size</th>
                  <th className="px-4 py-3">Duration/Res</th>
                  <th className="px-4 py-3">SHA-256</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filtered.map((file) => (
                  <tr
                    key={file.id}
                    onClick={() => openFileDetail(file)}
                    className="hover:bg-slate-800/40 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3.5 font-medium text-slate-200">
                      <div className="flex items-center gap-2 max-w-xs truncate">
                        {getCategoryIcon(file.category)}
                        <span className="truncate">{file.original_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="capitalize px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[11px]">
                        {file.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-300">{formatBytes(file.size_bytes)}</td>
                    <td className="px-4 py-3 text-slate-400">
                      {file.resolution || (file.duration_seconds ? `${Math.floor(file.duration_seconds / 60)}m` : '—')}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-500 text-[11px]">
                      {file.sha256_hash.substring(0, 10)}...
                    </td>
                    <td className="px-4 py-3 text-slate-400 max-w-xs truncate">
                      {file.source_description}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openFileDetail(file);
                        }}
                        className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* File Detail Drawer / Modal */}
      {selectedFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Drawer Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                {getCategoryIcon(selectedFile.category)}
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  File Details & Integrity
                </span>
              </div>
              <button
                onClick={() => setSelectedFile(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Media Player / Preview if video */}
            {selectedFile.category === 'videos' && (
              <div className="bg-slate-950 rounded-xl overflow-hidden border border-slate-800">
                <video
                  controls
                  className="w-full max-h-64 object-contain"
                  src={`/api/files/${selectedFile.id}/stream`}
                />
              </div>
            )}

            {/* Name / Metadata Editing Form */}
            {isEditing ? (
              <div className="space-y-3 p-4 bg-slate-950/80 rounded-xl border border-slate-800">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400">File Name</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400">Tags (comma separated)</label>
                  <input
                    type="text"
                    value={editTags}
                    onChange={(e) => setEditTags(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveMetadata}
                    className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-white break-words">
                    {selectedFile.original_name}
                  </h2>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 ml-2"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>
                </div>
                <p className="text-xs text-slate-400">{selectedFile.source_description}</p>
              </div>
            )}

            {/* Properties Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-500 block text-[11px]">Size</span>
                <span className="font-mono font-bold text-slate-200">
                  {formatBytes(selectedFile.size_bytes)}
                </span>
              </div>
              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-500 block text-[11px]">Category</span>
                <span className="capitalize font-semibold text-indigo-400">
                  {selectedFile.category}
                </span>
              </div>
              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-500 block text-[11px]">MIME Type</span>
                <span className="font-mono text-slate-300 truncate block">
                  {selectedFile.mime_type}
                </span>
              </div>
              {selectedFile.resolution && (
                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                  <span className="text-slate-500 block text-[11px]">Resolution</span>
                  <span className="font-mono text-slate-200">{selectedFile.resolution}</span>
                </div>
              )}
              {selectedFile.duration_seconds && (
                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                  <span className="text-slate-500 block text-[11px]">Duration</span>
                  <span className="text-slate-200">
                    {Math.floor(selectedFile.duration_seconds / 60)}m {selectedFile.duration_seconds % 60}s
                  </span>
                </div>
              )}
              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-500 block text-[11px]">Storage Path</span>
                <span className="font-mono text-slate-400 text-[10px] truncate block">
                  {selectedFile.storage_path}
                </span>
              </div>
            </div>

            {/* Full SHA-256 Checksum with Copy */}
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-slate-400">SHA-256 Integrity Hash</span>
              <div className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded-xl">
                <code className="text-[11px] text-emerald-400 font-mono break-all select-all">
                  {selectedFile.sha256_hash}
                </code>
                <button
                  onClick={() => copyHash(selectedFile.sha256_hash)}
                  className="p-1.5 text-slate-400 hover:text-white ml-2 shrink-0"
                  title="Copy SHA-256 Checksum"
                >
                  {copiedHash === selectedFile.sha256_hash ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Danger Actions: Quarantine / Delete */}
            <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
              {deleteConfirmId === selectedFile.id ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-rose-400 font-semibold">Move to quarantine?</span>
                  <button
                    onClick={() => handleDeleteFile(selectedFile.id)}
                    className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold"
                  >
                    Confirm Quarantine
                  </button>
                  <button
                    onClick={() => setDeleteConfirmId(null)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setDeleteConfirmId(selectedFile.id)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-rose-400 hover:bg-rose-500/10 text-xs font-semibold transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Quarantine / Delete</span>
                </button>
              )}

              <a
                href={`/api/files/${selectedFile.id}/stream`}
                download={selectedFile.original_name}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold flex items-center gap-1.5"
              >
                <span>Download Local File</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import { useState, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const API = '/api';

export default function ScriptUpload() {
  const { projectId } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();

  const [scriptText, setScriptText] = useState('');
  const [filename, setFilename] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const handleFile = useCallback((file) => {
    setFilename(file.name);
    setError('');

    const ext = file.name.split('.').pop().toLowerCase();
    if (!['txt', 'fdx', 'pdf'].includes(ext)) {
      setError('Unsupported format. Please use .txt, .fdx, or .pdf files.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => setScriptText(e.target.result);
    reader.onerror = () => setError('Failed to read file');
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => setDragOver(false), []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!scriptText.trim()) {
      setError('Please enter or upload a screenplay');
      return;
    }

    setUploading(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch(`${API}/scripts/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ project_id: projectId, script_text: scriptText, filename }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      setResult(data.summary);
      setTimeout(() => navigate(`/projects/${projectId}/breakdown`), 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-950">
      <header className="border-b border-surface-800 bg-surface-900/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <button onClick={() => navigate('/dashboard')} className="text-surface-400 hover:text-surface-200 text-sm flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
            Back to Dashboard
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Upload Screenplay</h1>
          <p className="text-surface-400 text-sm mt-1">Paste your screenplay or upload a file. We support .txt, .fdx, and .pdf formats.</p>
        </div>

        {error && (
          <div className="p-4 rounded-lg bg-red-900/30 border border-red-800/40 text-red-400 text-sm mb-6">{error}</div>
        )}

        {result && (
          <div className="p-4 rounded-lg bg-green-900/30 border border-green-800/40 text-green-400 text-sm mb-6">
            Script parsed successfully! {result.total_scenes} scenes, {result.total_characters} characters found.
            Redirecting to breakdown...
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`border-2 border-dashed rounded-xl p-10 text-center transition-all duration-200 cursor-pointer ${
              dragOver
                ? 'border-primary-500 bg-primary-950/30'
                : 'border-surface-700 hover:border-surface-500 bg-surface-900/50'
            }`}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.fdx,.pdf"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            <div className="w-14 h-14 rounded-2xl bg-surface-800 border border-surface-700 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-surface-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
              </svg>
            </div>
            <p className="text-surface-300 font-medium">
              {dragOver ? 'Drop your file here' : 'Drag & drop your screenplay here'}
            </p>
            <p className="text-surface-500 text-sm mt-1">or click to browse (.txt, .fdx, .pdf)</p>
            {filename && (
              <p className="text-primary-400 text-sm mt-3 font-medium">Selected: {filename}</p>
            )}
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-surface-700" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-3 bg-surface-950 text-surface-400">or paste your screenplay</span>
            </div>
          </div>

          {/* Textarea */}
          <div>
            <textarea
              value={scriptText}
              onChange={(e) => setScriptText(e.target.value)}
              placeholder={`Paste your screenplay here...

Example:
INT. COFFEE SHOP - DAY

The morning rush is in full swing. Steam rises from espresso machines.

JESSICA (20s, barista)
What can I get started for you?

MARK (30s, nervous)
Just a black coffee, thanks.

Jessica nods and moves to the register.
`}
              rows={12}
              className="w-full px-4 py-3 rounded-xl bg-surface-900 border border-surface-700 text-surface-100 placeholder:text-surface-500 font-mono text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all resize-y"
            />
          </div>

          <div className="flex items-center gap-3">
            <button type="submit" disabled={uploading || !scriptText.trim()} className="btn-primary">
              {uploading ? (
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Parsing script...
                </span>
              ) : (
                'Parse Screenplay'
              )}
            </button>
            <button type="button" onClick={() => { setScriptText(''); setFilename(''); setError(''); }} className="btn-secondary">
              Clear
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
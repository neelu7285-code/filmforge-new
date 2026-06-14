import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const API = '/api';

export default function Dashboard() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const fetchProjects = async () => {
    try {
      const res = await fetch(`${API}/projects`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, [token]);

  const createProject = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    try {
      const res = await fetch(`${API}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: newTitle, description: newDesc }),
      });
      if (res.ok) {
        setNewTitle('');
        setNewDesc('');
        setShowCreate(false);
        fetchProjects();
      }
    } catch {
      // ignore
    }
  };

  const deleteProject = async (id) => {
    if (!confirm('Delete this project?')) return;
    try {
      await fetch(`${API}/projects/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchProjects();
    } catch {
      // ignore
    }
  };

  const statusColor = (status) => {
    const colors = { draft: 'bg-surface-600', breakdown: 'bg-primary-600', scheduled: 'bg-accent-600', complete: 'bg-green-600' };
    return colors[status] || 'bg-surface-600';
  };

  return (
    <div className="min-h-screen bg-surface-950">
      {/* Top bar */}
      <header className="border-b border-surface-800 bg-surface-900/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary-500 to-accent-600 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
              </svg>
            </div>
            <span className="font-bold bg-gradient-to-r from-primary-400 to-accent-400 bg-clip-text text-transparent">FilmForge</span>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm text-surface-400">{user?.email}</span>
            <button onClick={logout} className="text-sm text-surface-400 hover:text-surface-200 transition-colors">Sign out</button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Projects</h1>
            <p className="text-surface-400 text-sm mt-1">{projects.length} project{projects.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={() => setShowCreate(true)} className="btn-primary text-sm !px-4 !py-2">
            <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Project
          </button>
        </div>

        {/* Create project form */}
        {showCreate && (
          <form onSubmit={createProject} className="card mb-8 border-primary-700/40">
            <h3 className="text-white font-semibold mb-4">New Project</h3>
            <div className="space-y-3">
              <input type="text" className="input-field" placeholder="Project title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} required autoFocus />
              <input type="text" className="input-field" placeholder="Description (optional)" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
            </div>
            <div className="flex gap-2 mt-4">
              <button type="submit" className="btn-primary text-sm !px-4 !py-2">Create</button>
              <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary text-sm !px-4 !py-2">Cancel</button>
            </div>
          </form>
        )}

        {/* Projects list */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : projects.length === 0 ? (
          <div className="card text-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-surface-800 border border-surface-700 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-surface-500" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-1">No projects yet</h3>
            <p className="text-surface-400 text-sm mb-6">Create your first project to start breaking down scripts.</p>
            <button onClick={() => setShowCreate(true)} className="btn-primary">Create Your First Project</button>
          </div>
        ) : (
          <div className="grid gap-4">
            {projects.map((project) => (
              <div key={project.id} className="card flex items-center justify-between group hover:border-surface-600 transition-colors">
                <div className="flex items-center gap-4">
                  <div className={`w-2.5 h-2.5 rounded-full ${statusColor(project.status)}`} title={project.status} />
                  <div>
                    <Link to={`/projects/${project.id}`} className="text-white font-medium hover:text-primary-400 transition-colors">
                      {project.title}
                    </Link>
                    {project.description && (
                      <p className="text-surface-400 text-sm mt-0.5">{project.description}</p>
                    )}
                    <p className="text-surface-500 text-xs mt-1">Status: <span className="capitalize">{project.status}</span></p>
                  </div>
                </div>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => deleteProject(project.id)} className="p-2 text-surface-500 hover:text-red-400 transition-colors" title="Delete project">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
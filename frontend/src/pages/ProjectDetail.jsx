import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const API = '/api';

export default function ProjectDetail() {
  const { projectId } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('scenes');
  const [budget, setBudget] = useState(null);
  const [budgetLoading, setBudgetLoading] = useState(false);

  useEffect(() => {
    const fetchBreakdown = async () => {
      try {
        const res = await fetch(`${API}/scripts/${projectId}/breakdown`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    fetchBreakdown();
  }, [projectId, token]);

  const fetchBudget = useCallback(async () => {
    if (budget || budgetLoading) return;
    setBudgetLoading(true);
    try {
      const res = await fetch(`${API}/scripts/${projectId}/budget`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setBudget(json);
      }
    } catch {
      // ignore
    } finally {
      setBudgetLoading(false);
    }
  }, [projectId, token, budget, budgetLoading]);

  // Fetch budget when tab changes to budget
  useEffect(() => {
    if (activeTab === 'budget') fetchBudget();
  }, [activeTab, fetchBudget]);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-surface-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-surface-400 mb-4">Breakdown not found</p>
          <button onClick={() => navigate('/dashboard')} className="btn-primary">Back to Dashboard</button>
        </div>
      </div>
    );
  }

  const { project, scenes, characters } = data;

  const parseJson = (val) => {
    try { return JSON.parse(val || '[]'); } catch { return []; }
  };

  const settingBadge = (setting) => {
    const colors = { INT: 'bg-amber-600/20 text-amber-400 border-amber-700/40', EXT: 'bg-sky-600/20 text-sky-400 border-sky-700/40' };
    return colors[setting] || 'bg-surface-600/20 text-surface-400 border-surface-700/40';
  };

  const timeBadge = (time) => {
    const colors = { DAY: 'bg-yellow-600/20 text-yellow-400', NIGHT: 'bg-indigo-600/20 text-indigo-400', DAWN: 'bg-orange-600/20 text-orange-400', DUSK: 'bg-purple-600/20 text-purple-400' };
    return colors[time] || 'bg-surface-600/20 text-surface-400';
  };

  // Aggregate props across all scenes
  const allProps = (scenes || []).reduce((acc, scene) => {
    const props = parseJson(scene.props);
    props.forEach((p) => {
      const existing = acc.find((x) => x.name === p);
      if (existing) {
        existing.scenes.push(scene.scene_number);
        existing.count++;
      } else {
        acc.push({ name: p, scenes: [scene.scene_number], count: 1 });
      }
    });
    return acc;
  }, []).sort((a, b) => b.count - a.count);

  // Aggregate costumes across all scenes
  const allCostumes = (scenes || []).reduce((acc, scene) => {
    const costumes = parseJson(scene.costumes);
    costumes.forEach((c) => {
      const existing = acc.find((x) => x.name === c);
      if (existing) {
        existing.scenes.push(scene.scene_number);
        existing.count++;
      } else {
        acc.push({ name: c, scenes: [scene.scene_number], count: 1 });
      }
    });
    return acc;
  }, []).sort((a, b) => b.count - a.count);

  // Aggregate locations
  const locations = (scenes || []).reduce((acc, scene) => {
    const loc = scene.location || 'Unknown';
    const existing = acc.find((x) => x.name === loc);
    if (existing) {
      existing.scenes.push(scene.scene_number);
      existing.count++;
      if (!existing.settings.includes(scene.setting)) existing.settings.push(scene.setting);
    } else {
      acc.push({ name: loc, scenes: [scene.scene_number], count: 1, settings: [scene.setting] });
    }
    return acc;
  }, []).sort((a, b) => b.count - a.count);

  const tabs = [
    { id: 'scenes', label: 'Scenes', icon: 'M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z' },
    { id: 'characters', label: 'Characters', icon: 'M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z' },
    { id: 'props', label: 'Props', icon: 'M9.53 16.122a3 3 0 0 0-5.78 1.128 2.25 2.25 0 0 0 2.4 2.245 4.5 4.5 0 0 0 8.4-2.245c0-.399-.078-.78-.22-1.128m0 0a15.998 15.998 0 0 0 3.388-1.62m-5.043-.025a15.994 15.994 0 0 1 1.622-3.395m3.42 3.42a15.995 15.995 0 0 0 4.764-4.648l3.876-5.814a1.151 1.151 0 0 0-1.597-1.597L14.146 6.32a15.996 15.996 0 0 0-4.649 4.763m3.42 3.42a6.776 6.776 0 0 0-3.42-3.42Z' },
    { id: 'costumes', label: 'Costumes', icon: 'M15.75 10.5l4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z' },
    { id: 'locations', label: 'Locations', icon: 'M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z' },
    { id: 'budget', label: 'Budget', icon: 'M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z' },
  ];

  return (
    <div className="min-h-screen bg-surface-950">
      {/* Header */}
      <header className="border-b border-surface-800 bg-surface-900/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/dashboard')} className="text-surface-400 hover:text-surface-200">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
              </svg>
            </button>
            <h1 className="text-lg font-semibold text-white truncate">{project?.title || 'Project'}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn-secondary text-xs !px-3 !py-1.5" disabled>Export PDF</button>
            <button className="btn-secondary text-xs !px-3 !py-1.5" disabled>Export Excel</button>
          </div>
        </div>
      </header>

      {/* Summary bar */}
      <div className="border-b border-surface-800 bg-surface-900/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex gap-6 text-sm">
          <div><span className="text-surface-400">Scenes:</span> <span className="text-white font-medium">{scenes?.length || 0}</span></div>
          <div><span className="text-surface-400">Characters:</span> <span className="text-white font-medium">{characters?.length || 0}</span></div>
          <div><span className="text-surface-400">Props:</span> <span className="text-white font-medium">{allProps.length}</span></div>
          <div><span className="text-surface-400">Locations:</span> <span className="text-white font-medium">{locations.length}</span></div>
          <div><span className="text-surface-400">Pages:</span> <span className="text-white font-medium">~{project?.script_text ? Math.ceil(project.script_text.length / 2500) : '-'}</span></div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-surface-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex gap-0 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-400'
                  : 'border-transparent text-surface-400 hover:text-surface-200'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} />
              </svg>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {/* === SCENES TAB === */}
        {activeTab === 'scenes' && (
          <div className="space-y-3">
            {(!scenes || scenes.length === 0) ? (
              <div className="card text-center py-12">
                <p className="text-surface-400">No scenes found. Upload a script first.</p>
              </div>
            ) : (
              scenes.map((scene) => {
                const sceneChars = parseJson(scene.characters);
                const sceneProps = parseJson(scene.props);
                const sceneCostumes = parseJson(scene.costumes);
                return (
                  <div key={scene.id} className="card hover:border-surface-600 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className="w-7 h-7 rounded-lg bg-primary-900/40 border border-primary-700/30 flex items-center justify-center text-xs font-bold text-primary-400">
                          {scene.scene_number}
                        </span>
                        <div>
                          <h3 className="text-white font-medium">{scene.header}</h3>
                          <p className="text-surface-400 text-xs mt-0.5">{scene.location}</p>
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium border ${settingBadge(scene.setting)}`}>
                          {scene.setting}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${timeBadge(scene.time_of_day)}`}>
                          {scene.time_of_day}
                        </span>
                      </div>
                    </div>
                    {scene.synopsis && (
                      <p className="text-surface-400 text-sm italic mb-3">"{scene.synopsis}"</p>
                    )}
                    {sceneChars.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {sceneChars.map((c, i) => (
                          <span key={i} className="px-2 py-0.5 rounded-full bg-surface-800 text-surface-300 text-xs border border-surface-700">
                            {c}
                          </span>
                        ))}
                      </div>
                    )}
                    {(sceneProps.length > 0 || sceneCostumes.length > 0) && (
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-surface-500">
                        {sceneProps.length > 0 && <span>Props: {sceneProps.join(', ')}</span>}
                        {sceneCostumes.length > 0 && <span>Costumes: {sceneCostumes.join(', ')}</span>}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* === CHARACTERS TAB === */}
        {activeTab === 'characters' && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(!characters || characters.length === 0) ? (
              <div className="card text-center py-12 col-span-full">
                <p className="text-surface-400">No characters found. Upload a script first.</p>
              </div>
            ) : (
              characters.map((char) => {
                const scenesAppeared = parseJson(char.scenes_appeared);
                return (
                  <div key={char.id} className="card hover:border-surface-600 transition-colors">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-600 to-accent-600 flex items-center justify-center text-white text-sm font-bold">
                        {char.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="text-white font-medium">{char.name}</h3>
                        {char.cast_type && <span className="text-xs text-surface-400 capitalize">{char.cast_type}</span>}
                      </div>
                    </div>
                    {char.description && <p className="text-surface-400 text-sm mb-2">{char.description}</p>}
                    <div className="flex gap-3 text-xs text-surface-500">
                      <span>{char.dialogue_count || 0} lines</span>
                      <span>{scenesAppeared.length} scenes</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* === PROPS TAB === */}
        {activeTab === 'props' && (
          <div>
            {allProps.length === 0 ? (
              <div className="card text-center py-12">
                <p className="text-surface-400">No props found in this script.</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {allProps.map((prop, i) => (
                  <div key={i} className="card hover:border-surface-600 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-white font-medium">{prop.name}</h3>
                      <span className="px-2 py-0.5 rounded-full bg-primary-900/30 text-primary-400 text-xs font-medium border border-primary-700/30">
                        x{prop.count}
                      </span>
                    </div>
                    <p className="text-surface-500 text-xs">
                      Appears in {prop.scenes.length} scene{prop.scenes.length !== 1 ? 's' : ''}: Scene {prop.scenes.join(', ')}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* === COSTUMES TAB === */}
        {activeTab === 'costumes' && (
          <div>
            {allCostumes.length === 0 ? (
              <div className="card text-center py-12">
                <p className="text-surface-400">No costumes found in this script.</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {allCostumes.map((costume, i) => (
                  <div key={i} className="card hover:border-surface-600 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-white font-medium">{costume.name}</h3>
                      <span className="px-2 py-0.5 rounded-full bg-accent-900/30 text-accent-400 text-xs font-medium border border-accent-700/30">
                        x{costume.count}
                      </span>
                    </div>
                    <p className="text-surface-500 text-xs">
                      Appears in {costume.scenes.length} scene{costume.scenes.length !== 1 ? 's' : ''}: Scene {costume.scenes.join(', ')}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* === LOCATIONS TAB === */}
        {activeTab === 'locations' && (
          <div>
            {locations.length === 0 ? (
              <div className="card text-center py-12">
                <p className="text-surface-400">No locations found in this script.</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {locations.map((loc, i) => (
                  <div key={i} className="card hover:border-surface-600 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="text-white font-medium">{loc.name}</h3>
                        <div className="flex gap-1.5 mt-1">
                          {loc.settings.filter(Boolean).map((s, j) => (
                            <span key={j} className={`px-2 py-0.5 rounded text-xs font-medium border ${settingBadge(s)}`}>
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                      <span className="text-surface-400 text-sm font-medium">{loc.count} scene{loc.count !== 1 ? 's' : ''}</span>
                    </div>
                    <p className="text-surface-500 text-xs">
                      Scenes: {loc.scenes.join(', ')}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* === BUDGET TAB === */}
        {activeTab === 'budget' && (
          <div>
            {budgetLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : budget ? (
              <div className="space-y-6">
                {/* Total estimate card */}
                <div className="card border-primary-700/30 bg-gradient-to-br from-primary-950/40 to-accent-950/40">
                  <p className="text-surface-400 text-sm font-medium mb-1">Estimated Budget Range</p>
                  <p className="text-3xl font-bold text-white">
                    ${Number(budget.total_range_low || 0).toLocaleString()} — ${Number(budget.total_range_high || 0).toLocaleString()}
                  </p>
                  <p className="text-surface-500 text-xs mt-1">{budget.currency || 'USD'}</p>
                  {budget.note && (
                    <p className="text-surface-500 text-xs mt-2 italic">{budget.note}</p>
                  )}
                </div>

                {/* Details grid */}
                <div className="grid gap-4 sm:grid-cols-3">
                  {budget.shooting_days_estimate > 0 && (
                    <div className="card text-center">
                      <p className="text-surface-400 text-xs font-medium mb-1">Shooting Days</p>
                      <p className="text-2xl font-bold text-white">{budget.shooting_days_estimate}</p>
                    </div>
                  )}
                  {budget.crew_size_estimate > 0 && (
                    <div className="card text-center">
                      <p className="text-surface-400 text-xs font-medium mb-1">Crew Size</p>
                      <p className="text-2xl font-bold text-white">{budget.crew_size_estimate}</p>
                    </div>
                  )}
                  <div className="card text-center">
                    <p className="text-surface-400 text-xs font-medium mb-1">Scenes</p>
                    <p className="text-2xl font-bold text-white">{scenes?.length || 0}</p>
                  </div>
                </div>

                {/* Budget breakdown */}
                {budget.above_the_line && Object.keys(budget.above_the_line).length > 0 && (
                  <div className="card">
                    <h3 className="text-white font-semibold mb-3">Above the Line</h3>
                    <div className="space-y-2">
                      {Object.entries(budget.above_the_line).map(([key, val]) => (
                        <div key={key} className="flex justify-between text-sm">
                          <span className="text-surface-400 capitalize">{key.replace(/_/g, ' ')}</span>
                          <span className="text-white font-medium">${Number(val).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {budget.below_the_line && Object.keys(budget.below_the_line).length > 0 && (
                  <div className="card">
                    <h3 className="text-white font-semibold mb-3">Below the Line</h3>
                    <div className="space-y-2">
                      {Object.entries(budget.below_the_line).map(([key, val]) => (
                        <div key={key} className="flex justify-between text-sm">
                          <span className="text-surface-400 capitalize">{key.replace(/_/g, ' ')}</span>
                          <span className="text-white font-medium">${Number(val).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="card text-center py-12">
                <p className="text-surface-400">Unable to load budget estimate. Upload and parse a script first.</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
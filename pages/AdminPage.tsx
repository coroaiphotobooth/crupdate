
import React, { useState, useRef, useEffect } from 'react';
import { Concept, PhotoboothSettings, AspectRatio } from '../types';
import { 
  uploadOverlayToGas, 
  uploadBackgroundToGas,
  saveSettingsToGas, 
  saveConceptsToGas
} from '../lib/appsScript';
import { DEFAULT_GAS_URL } from '../constants';

interface AdminPageProps {
  settings: PhotoboothSettings;
  concepts: Concept[];
  onSaveSettings: (settings: PhotoboothSettings) => void;
  onSaveConcepts: (concepts: Concept[]) => void;
  onBack: () => void;
}

const AdminPage: React.FC<AdminPageProps> = ({ settings, concepts, onSaveSettings, onSaveConcepts, onBack }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pin, setPin] = useState('');
  const [localSettings, setLocalSettings] = useState(settings);
  const [localConcepts, setLocalConcepts] = useState(concepts);
  const [gasUrl, setGasUrl] = useState('');
  const [activeTab, setActiveTab] = useState<'settings' | 'concepts'>('settings');
  const [isUploadingOverlay, setIsUploadingOverlay] = useState(false);
  const [isUploadingBackground, setIsUploadingBackground] = useState(false);
  const [isSavingConcepts, setIsSavingConcepts] = useState(false);

  const overlayInputRef = useRef<HTMLInputElement>(null);
  const backgroundInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const savedUrl = localStorage.getItem('APPS_SCRIPT_BASE_URL') || DEFAULT_GAS_URL;
    setGasUrl(savedUrl);
    setLocalConcepts(concepts);
    // Ensure defaults
    if (settings.cameraRotation === undefined) {
      setLocalSettings(prev => ({...prev, cameraRotation: 0}));
    }
    if (!settings.selectedModel) {
      setLocalSettings(prev => ({...prev, selectedModel: 'gemini-2.5-flash-image'}));
    }
    if (!settings.outputRatio) {
      setLocalSettings(prev => ({...prev, outputRatio: '9:16'}));
    }
    if (settings.folderId === undefined) {
      setLocalSettings(prev => ({...prev, folderId: ''}));
    }
  }, [concepts, settings]);

  const handleLogin = () => {
    if (pin === settings.adminPin) {
      setIsAuthenticated(true);
    } else {
      alert('INVALID SECURITY PIN');
      setPin('');
    }
  };

  const handleSaveSettings = async () => {
    localStorage.setItem('APPS_SCRIPT_BASE_URL', gasUrl);
    const ok = await saveSettingsToGas(localSettings, settings.adminPin);
    if (ok) {
      onSaveSettings(localSettings);
      alert('Settings saved and synced to cloud');
    } else {
        onSaveSettings(localSettings);
        alert('Settings saved locally (Cloud sync might have failed)');
    }
  };

  const handleRatioChange = (ratio: AspectRatio) => {
    // Auto set orientation based on ratio
    const isPortrait = ratio === '9:16' || ratio === '2:3';
    setLocalSettings({
      ...localSettings,
      outputRatio: ratio,
      orientation: isPortrait ? 'portrait' : 'landscape'
    });
  };

  const handleAddConcept = () => {
    const newId = `concept_${Date.now()}`;
    const newConcept: Concept = {
      id: newId,
      name: 'NEW CONCEPT',
      prompt: 'Describe the transformation here...',
      thumbnail: 'https://picsum.photos/seed/' + newId + '/300/500'
    };
    setLocalConcepts([...localConcepts, newConcept]);
  };

  const handleDeleteConcept = (id: string) => {
    if (window.confirm('Are you sure you want to delete this concept?')) {
      setLocalConcepts(localConcepts.filter(c => c.id !== id));
    }
  };

  const handleSyncConcepts = async () => {
    setIsSavingConcepts(true);
    try {
      const ok = await saveConceptsToGas(localConcepts, settings.adminPin);
      if (ok) {
        onSaveConcepts(localConcepts);
        alert('All concepts updated on cloud and local archive');
      } else {
        alert('Cloud sync failed. Check your Apps Script URL.');
      }
    } finally {
      setIsSavingConcepts(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="w-full min-h-screen flex flex-col items-center justify-center p-6 bg-[#050505]">
        <h2 className="text-3xl font-heading mb-10 neon-text italic uppercase">SECURE ACCESS</h2>
        <div className="glass-card p-8 flex flex-col items-center gap-8 w-full max-w-sm">
          <input 
            type="password" 
            placeholder="PIN" 
            className="bg-black/50 border-2 border-white/5 px-6 py-5 text-center text-3xl outline-none focus:border-purple-500 w-full font-mono"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
          />
          <button onClick={handleLogin} className="w-full py-5 bg-purple-600 font-heading tracking-widest uppercase">AUTHORIZE</button>
          <button onClick={onBack} className="text-gray-500 uppercase text-[10px] tracking-widest">Back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen flex flex-col p-6 md:p-10 bg-[#050505] overflow-y-auto">
      <div className="flex flex-col md:flex-row justify-between items-center mb-10 max-w-7xl mx-auto w-full border-b border-white/5 pb-10 gap-8">
        <h2 className="text-2xl font-heading text-white neon-text italic uppercase">SYSTEM_ROOT</h2>
        <div className="flex bg-white/5 p-1 rounded-xl">
          {(['settings', 'concepts'] as const).map(tab => (
            <button 
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 rounded-lg text-[10px] font-bold tracking-[0.3em] uppercase transition-all ${activeTab === tab ? 'bg-purple-600 text-white shadow-xl shadow-purple-900/40' : 'text-gray-500 hover:text-white'}`}
            >
              {tab}
            </button>
          ))}
        </div>
        <button onClick={() => setIsAuthenticated(false)} className="px-10 py-4 border-2 border-red-900/40 text-red-500 uppercase tracking-widest text-xs italic">Disconnect</button>
      </div>

      <div className="max-w-7xl mx-auto w-full pb-24">
        {activeTab === 'settings' && (
          <div className="flex flex-col gap-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              <div className="glass-card p-6 md:p-10 flex flex-col gap-8 h-fit">
                <h3 className="font-heading text-xl text-purple-400 border-b border-white/5 pb-4 uppercase italic">Global Identity</h3>
                
                <div className="flex flex-col gap-3">
                  <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Event Name</label>
                  <input 
                    className="bg-black/50 border border-white/10 p-4 font-mono text-xs text-white focus:border-purple-500 outline-none transition-colors" 
                    value={localSettings.eventName} 
                    onChange={e => setLocalSettings({...localSettings, eventName: e.target.value})}
                    placeholder="CORO AI PHOTOBOOTH"
                  />
                </div>

                <div className="flex flex-col gap-3">
                  <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Event Description</label>
                  <input 
                    className="bg-black/50 border border-white/10 p-4 font-mono text-xs text-white focus:border-purple-500 outline-none transition-colors" 
                    value={localSettings.eventDescription} 
                    onChange={e => setLocalSettings({...localSettings, eventDescription: e.target.value})}
                    placeholder="Transform Your Reality"
                  />
                </div>

                <div className="flex flex-col gap-3">
                  <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Google Drive Folder ID</label>
                  <input 
                    className="bg-black/50 border border-white/10 p-4 font-mono text-xs text-purple-300 focus:border-purple-500 outline-none transition-colors" 
                    value={localSettings.folderId} 
                    onChange={e => setLocalSettings({...localSettings, folderId: e.target.value})}
                    placeholder="Folder ID (e.g. 1knqeFC...)"
                  />
                  <p className="text-[8px] text-gray-600 font-mono">From URL: drive.google.com/drive/folders/<b>YOUR_ID</b></p>
                </div>

                <h3 className="font-heading text-xl text-purple-400 border-b border-white/5 pb-4 mt-6 uppercase italic">Output Configuration</h3>

                <div className="flex flex-col gap-3">
                  <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Output Aspect Ratio</label>
                  <div className="grid grid-cols-2 gap-3">
                    {(['9:16', '16:9', '2:3', '3:2'] as AspectRatio[]).map(r => (
                      <button
                        key={r}
                        onClick={() => handleRatioChange(r)}
                        className={`py-4 border border-white/10 rounded font-mono text-xs transition-all flex flex-col items-center gap-1 ${localSettings.outputRatio === r ? 'bg-purple-600 text-white shadow-lg border-purple-400' : 'bg-black/50 text-gray-400 hover:bg-white/5'}`}
                      >
                        <span className="text-sm font-bold">{r}</span>
                        <span className="text-[8px] opacity-70 uppercase">
                          {r === '9:16' ? 'Portrait' : r === '16:9' ? 'Landscape' : r === '2:3' ? 'Photo Portrait' : 'Photo Landscape'}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <h3 className="font-heading text-xl text-purple-400 border-b border-white/5 pb-4 mt-6 uppercase italic">AI Configuration</h3>

                <div className="flex flex-col gap-3">
                  <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">AI Model Selection</label>
                  <select
                    className="bg-black/50 border border-white/10 p-4 font-mono text-xs text-white focus:border-purple-500 outline-none transition-colors appearance-none"
                    value={localSettings.selectedModel || 'gemini-2.5-flash-image'}
                    onChange={e => setLocalSettings({...localSettings, selectedModel: e.target.value})}
                  >
                    <option value="gemini-2.5-flash-image">Gemini 2.5 Flash (Fast & Free Tier)</option>
                    <option value="gemini-3-pro-image-preview">Gemini 3 Pro (High Quality - Paid)</option>
                  </select>
                </div>

                <div className="flex flex-col gap-3">
                  <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Apps Script URL</label>
                  <input 
                    className="bg-black/50 border border-white/10 p-4 font-mono text-[10px] text-purple-300 focus:border-purple-500 outline-none" 
                    value={gasUrl} 
                    onChange={e => setGasUrl(e.target.value)} 
                  />
                </div>

                <h3 className="font-heading text-xl text-purple-400 border-b border-white/5 pb-4 mt-6 uppercase italic">Hardware Config</h3>
                
                <div className="flex flex-col gap-3">
                  <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Webcam Rotation</label>
                  <div className="flex gap-2">
                    {[0, 90, 180, 270].map(deg => (
                      <button 
                        key={deg}
                        onClick={() => setLocalSettings({...localSettings, cameraRotation: deg})}
                        className={`flex-1 py-3 border border-white/10 ${localSettings.cameraRotation === deg ? 'bg-purple-600 text-white shadow-lg' : 'bg-black/50 text-gray-400 hover:bg-white/5'} rounded font-mono text-xs transition-all`}
                      >
                        {deg}°
                      </button>
                    ))}
                  </div>
                </div>

                <button onClick={handleSaveSettings} className="w-full py-6 bg-green-800 hover:bg-green-700 text-white font-heading tracking-widest uppercase italic mt-6 transition-all">SAVE SETTINGS</button>
              </div>

              <div className="flex flex-col gap-8">
                {/* Overlay Asset Card */}
                <div className="glass-card p-6 md:p-10 flex flex-col gap-8 border-white/10 h-fit text-center">
                  <h3 className="font-heading text-xl text-purple-400 border-b border-white/5 pb-4 uppercase italic">Overlay Asset (PNG)</h3>
                  <div className="flex flex-col gap-6">
                    <div 
                      className="bg-white/5 border border-white/10 rounded-lg flex items-center justify-center overflow-hidden mx-auto shadow-2xl transition-all duration-300"
                      style={{
                        width: '180px',
                        aspectRatio: localSettings.outputRatio === '16:9' ? '16/9' : localSettings.outputRatio === '3:2' ? '3/2' : localSettings.outputRatio === '2:3' ? '2/3' : '9/16'
                      }}
                    >
                      {localSettings.overlayImage ? (
                        <img src={localSettings.overlayImage} className="w-full h-full object-contain" alt="Overlay" />
                      ) : (
                        <span className="text-[10px] text-gray-700 font-mono">NO_OVERLAY</span>
                      )}
                    </div>
                    <input type="file" accept="image/png" className="hidden" ref={overlayInputRef} onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setIsUploadingOverlay(true);
                      const reader = new FileReader();
                      reader.onload = async () => {
                        const res = await uploadOverlayToGas(reader.result as string, settings.adminPin);
                        if (res.ok) {
                          setLocalSettings({...localSettings, overlayImage: res.url});
                          alert('Overlay updated');
                        }
                        setIsUploadingOverlay(false);
                      };
                      reader.readAsDataURL(file);
                    }} />
                    <button onClick={() => overlayInputRef.current?.click()} disabled={isUploadingOverlay} className="w-full py-4 border-2 border-white/10 hover:border-purple-500 text-[10px] tracking-widest font-bold uppercase transition-all bg-white/5">
                      {isUploadingOverlay ? 'UPLOADING...' : 'CHANGE PNG OVERLAY'}
                    </button>
                  </div>
                </div>

                {/* Background Asset Card */}
                <div className="glass-card p-6 md:p-10 flex flex-col gap-8 border-white/10 h-fit text-center">
                  <h3 className="font-heading text-xl text-purple-400 border-b border-white/5 pb-4 uppercase italic">Menu Background (JPG)</h3>
                  <div className="flex flex-col gap-6">
                    <div className="w-full aspect-video bg-white/5 border border-white/10 rounded-lg flex items-center justify-center overflow-hidden mx-auto shadow-2xl">
                      {localSettings.backgroundImage ? (
                        <img src={localSettings.backgroundImage} className="w-full h-full object-cover" alt="Background" />
                      ) : (
                        <span className="text-[10px] text-gray-700 font-mono">DEFAULT_DARK</span>
                      )}
                    </div>
                    <input type="file" accept="image/jpeg,image/png" className="hidden" ref={backgroundInputRef} onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setIsUploadingBackground(true);
                      const reader = new FileReader();
                      reader.onload = async () => {
                        const res = await uploadBackgroundToGas(reader.result as string, settings.adminPin);
                        if (res.ok) {
                          setLocalSettings({...localSettings, backgroundImage: res.url});
                          alert('Background updated');
                        }
                        setIsUploadingBackground(false);
                      };
                      reader.readAsDataURL(file);
                    }} />
                    <button onClick={() => backgroundInputRef.current?.click()} disabled={isUploadingBackground} className="w-full py-4 border-2 border-white/10 hover:border-purple-500 text-[10px] tracking-widest font-bold uppercase transition-all bg-white/5">
                      {isUploadingBackground ? 'UPLOADING...' : 'CHANGE MENU BACKGROUND'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'concepts' && (
          <div className="flex flex-col gap-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {localConcepts.map((concept, index) => (
                <div key={concept.id} className="glass-card p-6 flex flex-col sm:flex-row gap-8 relative group">
                  <button 
                    onClick={() => handleDeleteConcept(concept.id)}
                    className="absolute top-4 right-4 text-red-900/40 hover:text-red-500 transition-colors p-2 z-10"
                    title="Delete Concept"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </button>

                  <div className="w-24 aspect-[9/16] bg-white/5 border border-white/10 rounded-xl shrink-0 overflow-hidden relative group/thumb shadow-lg">
                    <img src={concept.thumbnail} className="w-full h-full object-cover" />
                    <label className="absolute inset-0 bg-purple-600/80 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center cursor-pointer text-[10px] uppercase font-bold text-white transition-opacity">
                      Update
                      <input type="file" className="hidden" onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = () => {
                            const nc = [...localConcepts];
                            nc[index].thumbnail = reader.result as string;
                            setLocalConcepts(nc);
                          };
                          reader.readAsDataURL(file);
                        }
                      }} />
                    </label>
                  </div>
                  <div className="flex-1 flex flex-col gap-4">
                    <input 
                      className="bg-transparent border-b border-white/10 p-2 font-heading uppercase italic text-white outline-none focus:border-purple-500 w-full" 
                      value={concept.name} 
                      onChange={e => {
                        const nc = [...localConcepts];
                        nc[index].name = e.target.value;
                        setLocalConcepts(nc);
                      }} 
                    />
                    <textarea 
                      className="bg-black/30 border border-white/5 p-3 text-[10px] font-mono h-24 text-gray-400 outline-none focus:border-white/20 resize-none w-full" 
                      value={concept.prompt} 
                      onChange={e => {
                        const nc = [...localConcepts];
                        nc[index].prompt = e.target.value;
                        setLocalConcepts(nc);
                      }} 
                    />
                  </div>
                </div>
              ))}

              <button 
                onClick={handleAddConcept}
                className="glass-card p-6 flex flex-col items-center justify-center gap-4 border-2 border-dashed border-white/10 hover:border-purple-500/50 hover:bg-white/5 transition-all min-h-[200px]"
              >
                <div className="w-12 h-12 rounded-full border-2 border-white/20 flex items-center justify-center text-white/50 group-hover:text-purple-500 group-hover:border-purple-500 transition-colors">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <span className="font-heading text-xs tracking-[0.3em] text-white/40 uppercase italic">ADD_NEW_CONCEPT</span>
              </button>
            </div>

            <div className="flex justify-center mt-10">
              <button 
                onClick={handleSyncConcepts} 
                disabled={isSavingConcepts}
                className="px-20 py-6 bg-purple-600 font-heading tracking-widest uppercase italic shadow-2xl hover:bg-purple-500 transition-all disabled:opacity-50"
              >
                {isSavingConcepts ? 'SINKRONISASI...' : 'SYNC ALL CONCEPTS TO CLOUD'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPage;

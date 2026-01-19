
import React, { useEffect, useState, useRef } from 'react';
import { Concept, PhotoboothSettings, AspectRatio } from '../types';
import { generateAIImage } from '../lib/gemini';
import { uploadToDrive } from '../lib/appsScript';

interface ResultPageProps {
  capturedImage: string;
  concept: Concept;
  settings: PhotoboothSettings;
  onDone: () => void;
  onGallery: () => void;
}

const ResultPage: React.FC<ResultPageProps> = ({ capturedImage, concept, settings, onDone, onGallery }) => {
  const [isProcessing, setIsProcessing] = useState(true);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadData, setUploadData] = useState<{ downloadUrl: string; shareUrl: string } | null>(null);
  const [showQR, setShowQR] = useState(false);
  const [progress, setProgress] = useState("AI_CORE_PROCESSING");
  const [timer, setTimer] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Determine Target Dimensions for Canvas Processing (High Res)
  let targetWidth = 1080;
  let targetHeight = 1920;
  let displayAspectRatio = '9/16';

  const outputRatio: AspectRatio = settings.outputRatio || '9:16';

  switch (outputRatio) {
    case '16:9':
      targetWidth = 1920;
      targetHeight = 1080;
      displayAspectRatio = '16/9';
      break;
    case '9:16':
      targetWidth = 1080;
      targetHeight = 1920;
      displayAspectRatio = '9/16';
      break;
    case '3:2':
      targetWidth = 1800;
      targetHeight = 1200;
      displayAspectRatio = '3/2';
      break;
    case '2:3':
      targetWidth = 1200;
      targetHeight = 1800;
      displayAspectRatio = '2/3';
      break;
  }

  useEffect(() => {
    timerRef.current = setInterval(() => setTimer(prev => prev + 1), 1000);

    const processFlow = async () => {
      try {
        // 1. Generate AI Image
        setProgress("Processing...");
        const aiOutput = await generateAIImage(capturedImage, concept.prompt, outputRatio);
        
        // 2. Tempel Overlay PNG & Crop
        setProgress("APPLYING_FRAME_OVERLAY...");
        const finalImage = await applyOverlay(aiOutput, settings.overlayImage);
        
        // 3. Update UI
        setResultImage(finalImage);
        setIsProcessing(false);
        if (timerRef.current) clearInterval(timerRef.current);
        
        // 4. Upload ke Google Drive
        setProgress("UPLOADING_TO_ARCHIVE...");
        const res = await uploadToDrive(finalImage, {
          conceptName: concept.name,
          eventName: settings.eventName,
          eventId: settings.activeEventId,
          folderId: settings.folderId
        });
        
        if (res.ok) {
          setUploadData({ downloadUrl: res.imageUrl, shareUrl: res.viewUrl });
        } else {
          console.error("Upload failed but image is shown locally.");
        }
      } catch (err: any) {
        console.error("Process Flow Error:", err);
        setError(err.message || "Transformation failed. Neural link unstable.");
        setIsProcessing(false);
        if (timerRef.current) clearInterval(timerRef.current);
      }
    };

    processFlow();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [capturedImage, concept, settings, outputRatio]);

  const applyOverlay = (base64AI: string, overlayUrl: string | null): Promise<string> => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject("Canvas context unavailable");

      const baseImg = new Image();
      baseImg.onload = () => {
        // Center Crop / Object Cover Logic
        const scale = Math.max(targetWidth / baseImg.width, targetHeight / baseImg.height);
        const x = (targetWidth / 2) - (baseImg.width / 2) * scale;
        const y = (targetHeight / 2) - (baseImg.height / 2) * scale;
        
        ctx.drawImage(baseImg, x, y, baseImg.width * scale, baseImg.height * scale);
        
        if (!overlayUrl || overlayUrl.trim() === '') {
          return resolve(canvas.toDataURL('image/jpeg', 0.92));
        }
        
        const ovrImg = new Image();
        ovrImg.crossOrigin = "anonymous";
        ovrImg.onload = () => {
          ctx.drawImage(ovrImg, 0, 0, targetWidth, targetHeight);
          resolve(canvas.toDataURL('image/jpeg', 0.92));
        };
        ovrImg.onerror = (err) => {
          console.warn("Overlay failed to load.", err);
          resolve(canvas.toDataURL('image/jpeg', 0.92));
        };
        const cacheBuster = overlayUrl.includes('?') ? `&t=${Date.now()}` : `?t=${Date.now()}`;
        ovrImg.src = overlayUrl + cacheBuster;
      };
      
      baseImg.onerror = () => reject("Base image failed to load");
      baseImg.src = base64AI;
    });
  };

  if (isProcessing) {
    return (
      <div className="w-full h-[100dvh] flex flex-col items-center justify-center relative p-6 text-center overflow-hidden bg-black">
        <div className="absolute inset-0 z-0 flex items-center justify-center p-4">
          <img src={capturedImage} className="max-w-full max-h-full object-contain opacity-50 blur-lg" alt="Preview" />
          <div className="absolute inset-0 bg-black/60" />
        </div>
        <div className="relative z-10 flex flex-col items-center">
          <div className="relative w-40 h-40 md:w-64 md:h-64 mb-8 shrink-0">
            <div className="absolute inset-0 border-[6px] border-white/5 rounded-full" />
            <div className="absolute inset-0 border-[6px] border-t-purple-500 rounded-full animate-spin shadow-[0_0_30px_rgba(188,19,254,0.4)]" />
            <div className="absolute inset-0 flex items-center justify-center flex-col">
              <span className="text-[10px] tracking-[0.3em] text-purple-400 font-bold mb-1 uppercase italic">Processing</span>
              <span className="text-3xl md:text-5xl font-heading text-white italic">{timer}S</span>
            </div>
          </div>
          <div className="max-w-md bg-black/40 backdrop-blur-xl p-6 rounded-3xl border border-white/10 shadow-2xl">
            <h2 className="text-xl md:text-2xl font-heading mb-3 neon-text italic uppercase tracking-tighter">{progress}</h2>
            <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden mb-3">
              <div className="bg-purple-500 h-full animate-[progress_10s_ease-in-out_infinite]" style={{width: '60%'}} />
            </div>
            <p className="text-gray-400 font-mono text-[9px] tracking-[0.2em] uppercase leading-relaxed">
              Synthesizing digital persona...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-[100dvh] flex flex-col items-center justify-center p-6 text-center bg-[#050505]">
        <div className="w-20 h-20 border-2 border-red-500/50 rounded-full flex items-center justify-center mb-8">
          <span className="text-red-500 text-4xl font-bold">!</span>
        </div>
        <h2 className="text-red-500 text-2xl font-heading mb-4 uppercase italic">Neural_Link_Severed</h2>
        <p className="text-gray-500 mb-10 max-w-xs font-mono text-xs uppercase tracking-widest">{error}</p>
        <button onClick={onDone} className="px-16 py-6 bg-white text-black font-heading font-bold uppercase italic tracking-[0.3em] hover:bg-purple-500 hover:text-white transition-all">REBOOT_SESSION</button>
      </div>
    );
  }

  return (
    <div className="w-full h-[100dvh] flex flex-col bg-[#050505] overflow-hidden relative font-sans">
      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/10 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/10 blur-[120px] rounded-full animate-pulse" style={{animationDelay: '1s'}} />
      </div>

      {/* Main Container - Uses Flex to fit screen */}
      <div className="relative z-10 w-full h-full flex flex-col items-center p-4 md:p-6 lg:p-8 gap-4 md:gap-6">
        
        {/* Image Area: Flex-1 takes all available space, min-h-0 prevents overflow issues */}
        <div className="flex-1 w-full min-h-0 flex items-center justify-center">
          <div 
            className={`relative border-4 border-white/5 shadow-[0_0_50px_rgba(0,0,0,0.7)] bg-gray-900 rounded-xl overflow-hidden group transition-all duration-300`}
            style={{
              aspectRatio: displayAspectRatio,
              maxHeight: '100%',
              maxWidth: '100%'
            }}
          >
            <img src={resultImage!} alt="Final Composition" className="w-full h-full object-cover" />
            
            {/* Hover Gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            
            {/* Download Button (Overlay) */}
            {!showQR && (
              <div className="absolute bottom-6 left-0 right-0 flex justify-center z-30 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <button 
                  onClick={() => setShowQR(true)} 
                  className="bg-purple-600 hover:bg-purple-500 text-white px-8 py-3 rounded-full font-heading text-[10px] md:text-xs tracking-[0.3em] uppercase italic transition-all shadow-[0_10px_30px_rgba(188,19,254,0.4)] animate-bounce active:scale-95 border border-purple-400/30"
                >
                  DOWNLOAD
                </button>
              </div>
            )}

            {/* QR Code Overlay (Inside Image Frame) */}
            {showQR && (
              <div className="absolute inset-0 bg-black/90 backdrop-blur-xl p-6 flex flex-col items-center justify-center border-t border-white/10 animate-in fade-in duration-300 z-40">
                <button onClick={() => setShowQR(false)} className="absolute top-4 right-4 text-white/30 text-2xl font-mono hover:text-white transition-colors">×</button>
                
                <div className="bg-white p-3 rounded-xl shadow-[0_0_40px_rgba(255,255,255,0.1)] mb-6 border-4 border-purple-500/20">
                  {uploadData ? (
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(uploadData.shareUrl)}`} 
                      alt="Download QR" 
                      className="w-40 h-40 md:w-56 md:h-56 object-contain" 
                    />
                  ) : (
                    <div className="w-40 h-40 md:w-56 md:h-56 flex flex-col items-center justify-center">
                      <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mb-2" />
                      <span className="text-black/40 font-mono text-[8px] uppercase tracking-widest">Generating...</span>
                    </div>
                  )}
                </div>
                
                <div className="text-center">
                  <p className="text-white font-heading text-xs tracking-[0.2em] mb-1 uppercase italic">SCAN_TO_DOWNLOAD</p>
                  <p className="text-white/40 text-[8px] font-mono tracking-widest uppercase italic">Secure Transmission Ready</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Buttons: Fixed height, never shrinks */}
        <div className="w-full max-w-lg shrink-0 flex gap-4 md:gap-6 z-20 pb-safe">
          <button 
            onClick={onDone} 
            className="flex-1 py-4 md:py-5 bg-white/5 border border-white/10 text-white font-heading tracking-[0.3em] hover:bg-white hover:text-black transition-all text-xs uppercase italic rounded-lg"
          >
            FINISH
          </button>
          <button 
            onClick={onGallery} 
            className="flex-1 py-4 md:py-5 bg-purple-600/10 border border-purple-500/30 text-purple-400 font-heading tracking-[0.3em] hover:bg-purple-600/30 hover:text-purple-200 transition-all text-xs uppercase italic rounded-lg"
          >
            GALLERY
          </button>
        </div>

      </div>
      
      <style>{`
        @keyframes progress {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        .pb-safe {
          padding-bottom: env(safe-area-inset-bottom, 20px);
        }
      `}</style>
    </div>
  );
};

export default ResultPage;

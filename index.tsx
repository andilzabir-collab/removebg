
import React, { useState, useRef, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { GoogleGenAI } from "@google/genai";

// Icons & UI Elements
const Spinner = () => (
  <div className="flex flex-col items-center space-y-4">
    <svg className="animate-spin h-10 w-10 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
    <p className="text-white font-bold animate-pulse text-sm">Sedang Memotong Subjek...</p>
  </div>
);

const TransparentIcon = () => (
  <svg className="w-6 h-6 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <circle cx="12" cy="12" r="10" />
    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
  </svg>
);

const ColorPickerIcon = () => (
  <div className="w-full h-full rounded-lg bg-[conic-gradient(from_0deg,#ff0000,#ff8000,#ffff00,#00ff00,#00ffff,#0000ff,#7f00ff,#ff00ff,#ff0000)]" />
);

const CameraIcon = () => (
  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
);

const UploadIcon = () => (
  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
);

const PresetColors = [
  "#f44336", "#e91e63", "#9c27b0",
  "#673ab7", "#3f51b5", "#2196f3",
  "#03a9f4", "#00bcd4", "#009688",
  "#4caf50", "#8bc34a", "#cddc39",
  "#ffeb3b", "#ffc107", "#ff9800",
  "#ff5722", "#795548", "#9e9e9e",
  "#607d8b", "#000000", "#ffffff"
];

const App = () => {
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  
  const [activeTab, setActiveTab] = useState<'magic' | 'photo' | 'color'>('color');
  const [bgType, setBgType] = useState<'transparent' | 'color' | 'image'>('transparent');
  const [bgColor, setBgColor] = useState('#ffffff');
  const [customBgImage, setCustomBgImage] = useState<string | null>(null);
  const [blurAmount, setBlurAmount] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);
  const colorPickerRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Auto-process effect
  useEffect(() => {
    if (originalImage && !processedImage && !loading) {
      handleRemoveBackground();
    }
  }, [originalImage]);

  const processFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Hanya file gambar yang didukung.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      setOriginalImage(e.target?.result as string);
      setProcessedImage(null);
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const startCamera = async () => {
    setShowCamera(true);
    setError(null);
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
            videoRef.current.srcObject = stream;
        }
    } catch (err) {
        setError("Gagal mengakses kamera. Pastikan izin kamera diberikan di browser Anda.");
        setShowCamera(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
    }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
        const canvas = document.createElement("canvas");
        const video = videoRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        
        // Mirror the capture to match the preview
        if (ctx) {
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
            ctx.drawImage(video, 0, 0);
        }
        
        const dataUrl = canvas.toDataURL("image/png");
        setOriginalImage(dataUrl);
        setProcessedImage(null);
        setError(null);
        stopCamera();
    }
  };

  /**
   * Chroma Key Processing - Improved
   * Fitur baru: 'Despill' untuk menghilangkan garis merah/magenta tipis di tepi.
   */
  const processChromaKey = (imgSrc: string): Promise<string> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = imgSrc;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) return resolve(imgSrc);

            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            
            // 1. Cek Warna Pojok untuk menentukan apakah AI memberikan background Magenta
            const cornerR = data[0];
            const cornerG = data[1];
            const cornerB = data[2];
            
            // Deteksi Magenta (R Tinggi, G Rendah, B Tinggi)
            const isMagentaKey = (cornerR > 180 && cornerG < 80 && cornerB > 180);
            
            // Fallback tolerance untuk background solid biasa (misal putih/hitam jika AI error)
            const tolerance = 60; 

            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i+1];
                const b = data[i+2];

                if (isMagentaKey) {
                    // --- STEP 1: PENGHAPUSAN BACKGROUND (HARD CUT) ---
                    // Menggunakan threshold yang lebih agresif (120) untuk memotong bagian anti-aliasing yang gelap.
                    // Math.abs(r - b) < 60 memastikan kita hanya menghapus warna yang seimbang antara Merah dan Biru (Magenta).
                    if (r > 120 && g < 100 && b > 120 && Math.abs(r - b) < 60) {
                        data[i+3] = 0; // Transparan total
                        continue;
                    }

                    // --- STEP 2: DESPILL / PENGHILANGAN GARIS MERAH (SOFT CORRECTION) ---
                    // Jika pixel tidak dihapus, kita cek apakah ada "kebocoran" warna Magenta.
                    // Ciri Magenta Spill: Red > Green DAN Blue > Green.
                    // CATATAN: Warna kulit biasanya memiliki Red > Green, TAPI Blue < Green.
                    // Jadi kondisi (b > g) sangat aman untuk membedakan kulit vs spill magenta.
                    if (r > g && b > g) {
                        const limit = g + 20; // Berikan sedikit toleransi agar tidak terlalu abu-abu
                        
                        if (r > limit && b > limit) {
                            // Ini adalah pixel tepi yang terkena pantulan/anti-aliasing magenta.
                            // Kita "clamp" nilai Red dan Blue mendekati Green.
                            // Efek: Garis merah menyala berubah menjadi garis gelap/bayangan natural.
                            data[i] = limit;     // Red dikurangi
                            data[i+2] = limit;   // Blue dikurangi
                        }
                    }

                } else {
                    // Fallback Algorithm (Jika AI memberikan background putih/lainnya)
                    if (
                        Math.abs(r - cornerR) < tolerance &&
                        Math.abs(g - cornerG) < tolerance &&
                        Math.abs(b - cornerB) < tolerance
                    ) {
                        data[i+3] = 0;
                    }
                }
            }

            ctx.putImageData(imageData, 0, 0);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => resolve(imgSrc);
    });
  };

  const handleRemoveBackground = async () => {
    if (!originalImage) return;
    setLoading(true);
    setError(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const [mimePart, base64Data] = originalImage.split(",");
      const mimeType = mimePart.match(/:(.*?);/)?.[1] || 'image/png';

      // Strategi: Minta background Magenta Solid (#FF00FF).
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            { inlineData: { data: base64Data, mimeType: mimeType } },
            { text: "Extract the main subject from this image. Place the subject on a solid PURE MAGENTA background (Hex Color #FF00FF). Ensure hard edges if possible. Do NOT use a checkerboard pattern. Do NOT use white." },
          ],
        },
      });

      const parts = response.candidates?.[0]?.content?.parts;
      const imgPart = parts?.find(p => p.inlineData);
      const textPart = parts?.find(p => p.text);

      if (imgPart?.inlineData) {
        let rawImage = `data:image/png;base64,${imgPart.inlineData.data}`;
        
        // Proses penghapusan background Magenta & perbaikan tepi
        const cleanedImage = await processChromaKey(rawImage);

        setProcessedImage(cleanedImage);
        if (bgType === 'transparent') setBgType('transparent');
      } else {
        console.error("AI Text Response:", textPart?.text);
        throw new Error(textPart?.text || "AI gagal memisahkan subjek. Pastikan subjek terlihat jelas.");
      }
    } catch (err: any) {
      console.error(err);
      const msg = err.message || "";
      if (msg.includes("403")) {
          setError("Izin API ditolak. Pastikan API Key valid.");
      } else {
          setError("Gagal memproses gambar. Silakan coba lagi.");
      }
    } finally {
      setLoading(false);
    }
  };

  const downloadImage = async () => {
    if (!processedImage) return;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const fgImg = new Image();
    fgImg.src = processedImage;
    
    await new Promise(r => fgImg.onload = r);
    canvas.width = fgImg.naturalWidth;
    canvas.height = fgImg.naturalHeight;

    // Render Background
    if (bgType === 'color') {
      ctx!.fillStyle = bgColor;
      ctx!.fillRect(0, 0, canvas.width, canvas.height);
    } else if (bgType === 'image' && customBgImage) {
      const bgImg = new Image();
      bgImg.src = customBgImage;
      await new Promise(r => bgImg.onload = r);
      if (blurAmount > 0) ctx!.filter = `blur(${blurAmount}px)`;
      
      const bgAspect = bgImg.naturalWidth / bgImg.naturalHeight;
      const canvasAspect = canvas.width / canvas.height;
      let dw, dh, dx, dy;
      if (bgAspect > canvasAspect) {
        dh = canvas.height; dw = canvas.height * bgAspect; dx = (canvas.width - dw) / 2; dy = 0;
      } else {
        dw = canvas.width; dh = canvas.width / bgAspect; dx = 0; dy = (canvas.height - dh) / 2;
      }
      ctx!.drawImage(bgImg, dx, dy, dw, dh);
      ctx!.filter = 'none';
    }

    // Render Foreground
    ctx!.shadowColor = "rgba(0,0,0,0.3)";
    ctx!.shadowBlur = 20;
    ctx!.shadowOffsetX = 0;
    ctx!.shadowOffsetY = 5;
    ctx!.drawImage(fgImg, 0, 0);
    
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `remove-bg-pro-${Date.now()}.png`;
    link.click();
  };

  const changeBgColor = (color: string) => {
    setBgColor(color);
    setBgType('color');
  };

  return (
    <div className="min-h-screen bg-[#f8f9fb] text-gray-800 font-sans">
      {/* Navbar */}
      <nav className="bg-white border-b px-8 py-4 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => window.location.reload()}>
            <div className="bg-blue-600 p-2 rounded-xl shadow-lg shadow-blue-100">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </div>
            <h1 className="font-black text-2xl tracking-tighter text-slate-800">remove<span className="text-slate-400">bg</span><span className="ml-1 text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full uppercase">Pro</span></h1>
        </div>
        <div className="flex items-center space-x-4">
            <button className="text-sm font-bold text-slate-500 hover:text-blue-600 transition-colors hidden md:block">Harga</button>
            <button 
                onClick={downloadImage}
                disabled={!processedImage}
                className={`px-8 py-2.5 rounded-full font-black text-sm transition-all shadow-xl ${processedImage ? 'bg-blue-600 text-white hover:bg-blue-700 hover:scale-105 active:scale-95 shadow-blue-200' : 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none'}`}
            >
                Download
            </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-4 md:p-12">
        {!originalImage ? (
            <div className="flex flex-col items-center justify-center py-20 animate-in fade-in slide-in-from-bottom-4 duration-1000">
                
                {showCamera ? (
                   <div className="w-full max-w-2xl bg-black rounded-[40px] overflow-hidden shadow-2xl relative animate-in zoom-in-95 duration-300">
                       <video 
                         ref={videoRef} 
                         autoPlay 
                         playsInline 
                         className="w-full h-[500px] object-cover transform scale-x-[-1]" 
                       />
                       <div className="absolute bottom-8 left-0 right-0 flex justify-center items-center space-x-6 z-20">
                          <button 
                            onClick={stopCamera} 
                            className="bg-white/20 backdrop-blur-md text-white px-8 py-4 rounded-full font-bold hover:bg-white/30 transition-all"
                          >
                            Batal
                          </button>
                          <button 
                            onClick={capturePhoto} 
                            className="w-20 h-20 rounded-full bg-white border-4 border-gray-300 flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all"
                          >
                             <div className="w-16 h-16 rounded-full bg-red-600 border-2 border-white"></div>
                          </button>
                       </div>
                   </div>
                ) : (
                   <div 
                      className="w-full max-w-2xl bg-white rounded-[48px] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] p-16 text-center border-4 border-dashed border-slate-100 hover:border-blue-400 hover:bg-blue-50/20 transition-all cursor-pointer group flex flex-col items-center"
                      onClick={() => fileInputRef.current?.click()}
                  >
                      <div className="bg-blue-600 w-24 h-24 rounded-full flex items-center justify-center mb-8 group-hover:scale-110 transition-transform shadow-2xl shadow-blue-200">
                          <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" /></svg>
                      </div>
                      <h2 className="text-4xl font-black mb-4 text-slate-800 tracking-tight">Hapus Latar Belakang</h2>
                      <p className="text-slate-400 text-lg mb-12 font-medium">Unggah foto atau gunakan kamera</p>
                      
                      <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
                          <button className="flex items-center justify-center bg-blue-600 text-white px-8 py-4 rounded-full font-black text-lg shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95 flex-1 max-w-xs">
                             <UploadIcon />
                             Pilih File
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); startCamera(); }}
                            className="flex items-center justify-center bg-white text-blue-600 border-2 border-blue-100 px-8 py-4 rounded-full font-black text-lg hover:bg-blue-50 hover:border-blue-200 transition-all active:scale-95 flex-1 max-w-xs"
                          >
                             <CameraIcon />
                             Kamera
                          </button>
                      </div>
                      
                      <input ref={fileInputRef} type="file" className="sr-only" accept="image/*" onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])} />
                  </div>
                )}

                <div className="mt-12 flex space-x-12 grayscale opacity-40">
                  <span className="font-bold text-slate-400 uppercase tracking-widest text-xs">JPG</span>
                  <span className="font-bold text-slate-400 uppercase tracking-widest text-xs">PNG</span>
                  <span className="font-bold text-slate-400 uppercase tracking-widest text-xs">WEBP</span>
                </div>
            </div>
        ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start animate-in fade-in duration-500">
                
                {/* PREVIEW PANEL */}
                <div className="lg:col-span-8">
                    <div className="bg-[#111116] rounded-[40px] overflow-hidden shadow-2xl relative min-h-[600px] flex items-center justify-center border border-white/5 ring-1 ring-black">
                        {loading && (
                            <div className="absolute inset-0 bg-black/90 z-50 flex items-center justify-center backdrop-blur-xl">
                                <Spinner />
                            </div>
                        )}

                        <div className="relative w-full h-full flex items-center justify-center p-8 lg:p-16">
                            {/* Layer Container */}
                            <div className="relative shadow-[0_50px_100px_rgba(0,0,0,0.8)] rounded-2xl overflow-hidden bg-transparent transition-all duration-700 group">
                                
                                {/* 1. Base Transparent Checkerboard (z-0) */}
                                <div 
                                    className="absolute inset-0 z-0" 
                                    style={{
                                        backgroundColor: '#f9fafb', // Lighter bg
                                        backgroundImage: `
                                            linear-gradient(45deg, #e5e7eb 25%, transparent 25%, transparent 75%, #e5e7eb 75%, #e5e7eb),
                                            linear-gradient(45deg, #e5e7eb 25%, transparent 25%, transparent 75%, #e5e7eb 75%, #e5e7eb)
                                        `,
                                        backgroundPosition: '0 0, 10px 10px',
                                        backgroundSize: '20px 20px'
                                    }}
                                ></div>
                                
                                {/* 2. Color Layer (z-1) - Wajib lebih tinggi dari checkerboard */}
                                <div 
                                    className={`absolute inset-0 z-[1] transition-opacity duration-300 ${bgType === 'color' ? 'opacity-100' : 'opacity-0'}`} 
                                    style={{ backgroundColor: bgColor }}
                                ></div>
                                
                                {/* 3. Image Background Layer (z-2) */}
                                {customBgImage && (
                                    <div 
                                        className={`absolute inset-0 z-[2] bg-cover bg-center transition-opacity duration-300 ${bgType === 'image' ? 'opacity-100' : 'opacity-0'}`} 
                                        style={{ 
                                          backgroundImage: `url(${customBgImage})`,
                                          filter: `blur(${blurAmount}px)` 
                                        }}
                                    ></div>
                                )}
                                
                                {/* 4. Processed Subject (z-10) - Paling atas */}
                                {processedImage ? (
                                    <img 
                                      src={processedImage} 
                                      className="relative z-[10] max-h-[65vh] w-auto block animate-in zoom-in-95 duration-700 drop-shadow-[0_20px_50px_rgba(0,0,0,0.4)] pointer-events-none" 
                                      alt="Result" 
                                      draggable={false}
                                    />
                                ) : (
                                    <img src={originalImage} className="max-h-[65vh] w-auto block opacity-20 blur-2xl saturate-0" alt="Processing" />
                                )}
                            </div>
                        </div>
                        
                        <button 
                            onClick={() => {setOriginalImage(null); setProcessedImage(null); setBgType('transparent');}}
                            className="absolute top-8 left-8 bg-white/10 hover:bg-white/20 text-white p-4 rounded-2xl transition-all z-[60] backdrop-blur-xl border border-white/10 group active:scale-95"
                        >
                            <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" /></svg>
                        </button>
                    </div>
                </div>

                {/* CONTROL PANEL */}
                <div className="lg:col-span-4 bg-white rounded-[40px] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] overflow-hidden flex flex-col border border-slate-100 min-h-[600px] sticky top-24">
                    {/* Tab Navigation */}
                    <div className="flex p-6 border-b border-slate-50 bg-slate-50/50">
                        {['magic', 'photo', 'color'].map((tab) => (
                          <button 
                              key={tab}
                              onClick={() => setActiveTab(tab as any)}
                              className={`flex-1 py-3 text-[11px] font-black uppercase tracking-[0.15em] rounded-2xl transition-all duration-300 ${activeTab === tab ? 'bg-white shadow-xl text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                          >
                              {tab}
                          </button>
                        ))}
                    </div>

                    <div className="p-8 flex-grow overflow-y-auto max-h-[480px]">
                        {activeTab === 'color' && (
                            <div className="grid grid-cols-3 gap-5">
                                <button 
                                    onClick={() => setBgType('transparent')}
                                    className={`aspect-square rounded-[24px] flex items-center justify-center border-2 transition-all hover:scale-105 active:scale-95 ${bgType === 'transparent' ? 'border-blue-600 bg-blue-50 shadow-inner' : 'border-slate-100 bg-slate-50'}`}
                                >
                                    <TransparentIcon />
                                </button>

                                <button 
                                    onClick={() => colorPickerRef.current?.click()}
                                    className={`aspect-square rounded-[24px] p-1 border-2 transition-all hover:scale-105 active:scale-95 ${bgType === 'color' && !PresetColors.includes(bgColor) ? 'border-blue-600 shadow-xl' : 'border-slate-100'}`}
                                >
                                    <ColorPickerIcon />
                                    <input 
                                        ref={colorPickerRef}
                                        type="color" 
                                        className="sr-only" 
                                        value={bgColor} 
                                        onChange={(e) => {setBgColor(e.target.value); setBgType('color');}} 
                                    />
                                </button>

                                {PresetColors.map((c, i) => (
                                    <button 
                                        key={i}
                                        onClick={() => changeBgColor(c)}
                                        className={`aspect-square rounded-[24px] border-2 transition-all hover:scale-105 active:scale-95 ${bgType === 'color' && bgColor === c ? 'border-blue-600 shadow-xl scale-110 z-10' : 'border-slate-100 shadow-sm'}`}
                                        style={{ backgroundColor: c }}
                                    />
                                ))}
                            </div>
                        )}

                        {activeTab === 'photo' && (
                            <div className="grid grid-cols-3 gap-5">
                                <button 
                                    onClick={() => bgInputRef.current?.click()}
                                    className="aspect-square rounded-[24px] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center hover:border-blue-400 hover:bg-blue-50 transition-all group"
                                >
                                    <svg className="w-8 h-8 text-slate-300 group-hover:text-blue-500 mb-2 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter group-hover:text-blue-600">Unggah</span>
                                    <input ref={bgInputRef} type="file" className="sr-only" accept="image/*" onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                            const r = new FileReader();
                                            r.onload = (ev) => { setCustomBgImage(ev.target?.result as string); setBgType('image'); };
                                            r.readAsDataURL(file);
                                        }
                                    }} />
                                </button>

                                {customBgImage && (
                                    <button 
                                        onClick={() => setBgType('image')}
                                        className={`aspect-square rounded-[24px] border-2 overflow-hidden transition-all hover:scale-105 active:scale-95 ${bgType === 'image' ? 'border-blue-600 shadow-xl scale-110 z-10' : 'border-slate-100'}`}
                                    >
                                        <img src={customBgImage} className="w-full h-full object-cover" alt="Preview" />
                                    </button>
                                )}
                            </div>
                        )}

                        {activeTab === 'magic' && (
                          <div className="space-y-10 py-4">
                              <div className="bg-slate-50 p-6 rounded-[24px] border border-slate-100">
                                  <div className="flex justify-between items-center mb-6">
                                    <p className="text-[11px] font-black uppercase text-slate-400 tracking-widest">Kekuatan Blur</p>
                                    <span className="text-blue-600 font-black text-xs">{blurAmount}px</span>
                                  </div>
                                  <input 
                                    type="range" 
                                    min="0" 
                                    max="40" 
                                    value={blurAmount} 
                                    onChange={(e) => setBlurAmount(parseInt(e.target.value))}
                                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                  />
                                  <div className="flex justify-between mt-3">
                                    <span className="text-[9px] font-bold text-slate-300">Tajam</span>
                                    <span className="text-[9px] font-bold text-slate-300">Sangat Blur</span>
                                  </div>
                              </div>

                              <div className="bg-blue-600/5 p-6 rounded-[24px] border border-blue-100/50">
                                <h4 className="text-xs font-black text-blue-600 mb-2 uppercase tracking-wide">Pencocokan Cahaya</h4>
                                <p className="text-[11px] text-slate-500 leading-relaxed font-medium">Fitur ini secara otomatis menyesuaikan warna subjek agar menyatu sempurna dengan latar belakang yang Anda pilih.</p>
                                <div className="mt-4 flex items-center">
                                  <div className="w-10 h-5 bg-blue-600 rounded-full relative shadow-inner">
                                    <div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full shadow-sm"></div>
                                  </div>
                                  <span className="ml-3 text-[10px] font-bold text-blue-600 uppercase">Aktif</span>
                                </div>
                              </div>
                          </div>
                        )}
                    </div>

                    <div className="p-10 bg-slate-50/50 border-t border-slate-100">
                        <button 
                            onClick={downloadImage}
                            disabled={!processedImage || loading}
                            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 text-white font-black py-5 rounded-[24px] shadow-2xl shadow-blue-200 transition-all active:scale-95 disabled:shadow-none text-lg flex items-center justify-center space-x-3"
                        >
                            <span>Simpan Hasil</span>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                        </button>
                        <p className="mt-5 text-[9px] text-slate-400 text-center font-black uppercase tracking-[0.2em]">Kualitas HD • Tanpa Watermark</p>
                    </div>
                </div>
            </div>
        )}
      </main>

      {error && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-red-600 text-white px-10 py-5 rounded-[24px] shadow-2xl z-[100] animate-bounce font-black text-sm flex items-center space-x-3">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            <span>{error}</span>
        </div>
      )}
    </div>
  );
};

const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}

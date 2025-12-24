import { Float, OrbitControls, Stars } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

// --- Utility: Format Time ---
const formatTime = (seconds) => {
  if (!seconds || isNaN(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// --- Component: 3D Frequency Bars ---
const FrequencyBars = ({ analyzer }) => {
  const barsRef = useRef([]);
  const circleRef = useRef();

  // Configuration
  const barCount = 64;
  const radius = 12;

  useFrame(() => {
    if (!analyzer) return;

    const dataArray = new Uint8Array(analyzer.frequencyBinCount);
    analyzer.getByteFrequencyData(dataArray);

    // Rotate the entire ring slowly
    if (circleRef.current) {
      circleRef.current.rotation.y -= 0.002;
    }

    barsRef.current.forEach((bar, i) => {
      if (!bar) return;

      // Map audio data to scale
      // We focus on the lower-mid frequencies for better visual impact
      const index = Math.floor((i / barCount) * (dataArray.length / 2));
      const frequencyValue = dataArray[index];

      const targetScale = Math.max(0.4, (frequencyValue / 255) * 8); // Scale between 0.4 and 8

      // Smooth interpolation for height
      bar.scale.y = THREE.MathUtils.lerp(bar.scale.y, targetScale, 0.15);

      // Dynamic Color calculation based on height and position
      // hue moves from cyan (0.5) to purple (0.8) based on intensity
      const hue = 0.5 + (frequencyValue / 255) * 0.4;
      const lightness = 0.3 + (frequencyValue / 255) * 0.4;

      bar.material.color.setHSL(hue, 0.9, lightness);
      bar.material.emissive.setHSL(hue, 1, 0.2);
    });
  });

  return (
    <group ref={circleRef}>
      {[...Array(barCount)].map((_, i) => {
        const angle = (i / barCount) * Math.PI * 2;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;

        return (
          <mesh
            key={i}
            position={[x, 0, z]}
            rotation={[0, -angle, 0]}
            ref={(el) => (barsRef.current[i] = el)}
          >
            {/* Slimmer bars for a more refined look */}
            <boxGeometry args={[0.3, 1, 0.3]} />
            <meshStandardMaterial
              color="cyan"
              roughness={0.2}
              metalness={0.8}
            />
          </mesh>
        );
      })}
    </group>
  );
};

// --- Component: Main Application ---
const AudioVisualizer = () => {
  const [analyzer, setAnalyzer] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [inputMode, setInputMode] = useState('file'); // 'file' or 'mic'
  const [fileName, setFileName] = useState(null);
  const [isMicActive, setIsMicActive] = useState(false);

  const audioContextRef = useRef(null);
  const audioElementRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const fileInputRef = useRef(null);

  // --- Cleanup Logic ---
  const cleanupAudio = () => {
    setIsPlaying(false);
    setIsMicActive(false);

    // Stop File Audio
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      if (audioElementRef.current.src.startsWith('blob:')) {
        URL.revokeObjectURL(audioElementRef.current.src);
      }
      audioElementRef.current = null;
    }

    // Stop Microphone Stream
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    // Close Context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  };

  // --- Cleanup on Unmount ---
  useEffect(() => {
    return () => {
      cleanupAudio();
    };
  }, []);

  // --- Initialize Audio Context ---
  const initAudioContext = () => {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const audioCtx = new AudioContext();
    audioContextRef.current = audioCtx;

    const newAnalyzer = audioCtx.createAnalyser();
    newAnalyzer.fftSize = 256;
    newAnalyzer.smoothingTimeConstant = 0.8; // Smooths the bars
    setAnalyzer(newAnalyzer);

    return { audioCtx, newAnalyzer };
  };

  // --- Handle File Input ---
  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    cleanupAudio();
    const { audioCtx, newAnalyzer } = initAudioContext();

    setFileName(file.name.replace(/\.[^/.]+$/, ""));
    setInputMode('file');

    const audioUrl = URL.createObjectURL(file);
    const audio = new Audio(audioUrl);
    audioElementRef.current = audio;

    audio.addEventListener('loadedmetadata', () => {
      setDuration(audio.duration);
      audio.play().then(() => setIsPlaying(true)).catch(console.error);
    });

    audio.addEventListener('timeupdate', () => setCurrentTime(audio.currentTime));
    audio.addEventListener('ended', () => setIsPlaying(false));

    // Connect: Source -> Analyzer -> Speakers
    const source = audioCtx.createMediaElementSource(audio);
    source.connect(newAnalyzer);
    newAnalyzer.connect(audioCtx.destination);
  };

  // --- Handle Microphone Input ---
  const handleMicInput = async () => {
    try {
      cleanupAudio();
      setFileName("Live Microphone Input");
      setInputMode('mic');

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      mediaStreamRef.current = stream;
      setIsMicActive(true);

      const { audioCtx, newAnalyzer } = initAudioContext();

      // Connect: Mic -> Analyzer (NOT to speakers, to avoid feedback)
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(newAnalyzer);

      // We don't connect to destination, so no feedback loop!

    } catch (err) {
      console.error("Microphone access denied:", err);
      alert("Microphone access denied. Please check permission.");
    }
  };

  // --- Controls ---
  const togglePlay = () => {
    if (inputMode === 'mic') {
      // Toggle mic on/off by re-running or cleaning up
      if (isMicActive) cleanupAudio();
      else handleMicInput();
      return;
    }

    if (!audioElementRef.current) return;
    if (audioContextRef.current?.state === 'suspended') audioContextRef.current.resume();

    if (isPlaying) {
      audioElementRef.current.pause();
    } else {
      audioElementRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e) => {
    if (inputMode === 'mic') return;
    const newTime = Number(e.target.value);
    if (!audioElementRef.current) return;
    audioElementRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  return (
    <div className="relative w-full h-screen bg-[#050510] text-white overflow-hidden font-sans selection:bg-cyan-500/30">

      {/* --- UI Layer --- */}
      <div className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-between p-8">

        {/* Header */}
        <header className="flex justify-between items-start pointer-events-auto">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full bg-gradient-to-tr from-cyan-400 to-blue-600 ${isPlaying || isMicActive ? 'animate-pulse' : ''}`} />
            <div>
              <h1 className="text-xl font-bold tracking-tight">SONIC WAVES</h1>
              <p className="text-xs text-white/50 tracking-wider uppercase">Audio Environment</p>
            </div>
          </div>

          {/* Input Controls */}
          <div className="flex gap-4">
            {/* Upload Button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-5 py-2 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 backdrop-blur-md transition-all text-sm font-medium flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
              Upload File
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              onChange={handleFileChange}
              className="hidden"
            />

            {/* Mic Button */}
            <button
              onClick={handleMicInput}
              className={`px-5 py-2 rounded-full border backdrop-blur-md transition-all text-sm font-medium flex items-center gap-2 ${isMicActive ? 'bg-red-500/20 border-red-500 text-red-300' : 'bg-white/10 hover:bg-white/20 border-white/10'}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></svg>
              {isMicActive ? 'Mic Active' : 'Use Mic'}
            </button>
          </div>
        </header>

        {/* Center Welcome Message */}
        {!analyzer && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-auto">
            <h2 className="text-5xl md:text-7xl font-light tracking-tighter mb-6 bg-gradient-to-b from-white to-white/20 bg-clip-text text-transparent">
              Feel the <br /> <span className="font-bold">Music</span>
            </h2>
            <p className="text-lg text-white/40 mb-8 max-w-md mx-auto">
              Play music from a file or use your microphone to generate <br /> a real-time 3D audio landscape.
            </p>
          </div>
        )}

        {/* Player Bar (Only when active) */}
        <div className={`transition-all duration-500 transform ${analyzer ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0'}`}>
          <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-4 md:p-6 pointer-events-auto max-w-4xl mx-auto flex items-center gap-6">

            {/* Play/Stop Button */}
            <button
              onClick={togglePlay}
              className={`w-12 h-12 flex-shrink-0 rounded-full flex items-center justify-center text-black hover:scale-105 active:scale-95 transition-all shadow-[0_0_20px_rgba(6,182,212,0.4)] ${isMicActive ? 'bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.4)]' : 'bg-gradient-to-br from-cyan-400 to-blue-600'}`}
            >
              {isPlaying || isMicActive ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
              )}
            </button>

            {/* Info & Progress */}
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-end mb-2">
                <div className="truncate pr-4">
                  <h3 className="text-white font-medium truncate">{fileName || "Unknown Track"}</h3>
                  <p className="text-xs text-cyan-400">{isMicActive ? 'Live Input' : 'Now Playing'}</p>
                </div>
                {!isMicActive && (
                  <div className="text-xs font-mono text-white/50 shrink-0">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </div>
                )}
              </div>

              {/* Seeker (Only for Files) */}
              {!isMicActive ? (
                <div className="relative h-1.5 bg-white/10 rounded-full group cursor-pointer">
                  <input
                    type="range"
                    min="0"
                    max={duration || 0}
                    value={currentTime || 0}
                    onChange={handleSeek}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div
                    className="absolute top-0 left-0 h-full bg-cyan-400 rounded-full transition-all group-hover:bg-cyan-300"
                    style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                  />
                </div>
              ) : (
                // Mic Visualizer Line
                <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden relative">
                  <div className="absolute inset-0 bg-red-500/50 animate-pulse" style={{ width: '100%' }} />
                </div>
              )}
            </div>

          </div>
        </div>

      </div>

      {/* --- 3D Scene --- */}
      <div className="absolute inset-0 z-0">
        <Canvas camera={{ position: [0, 20, 35], fov: 45 }}>
          <color attach="background" args={['#050510']} />
          <fog attach="fog" args={['#050510', 20, 80]} />

          <ambientLight intensity={0.4} />
          <pointLight position={[10, 10, 10]} intensity={1} color="#00ffff" />
          <pointLight position={[-10, 5, -10]} intensity={0.5} color="#ff00ff" />

          <Stars radius={100} depth={50} count={3000} factor={4} saturation={0} fade speed={1.5} />

          {analyzer && <FrequencyBars analyzer={analyzer} />}

          {!analyzer && (
            <Float speed={2} rotationIntensity={0.5} floatIntensity={1}>
              <mesh rotation={[Math.PI / 4, Math.PI / 4, 0]}>
                <icosahedronGeometry args={[4, 0]} />
                <meshStandardMaterial
                  color="#1a1a1a"
                  wireframe
                  emissive="#00ffff"
                  emissiveIntensity={0.2}
                />
              </mesh>
            </Float>
          )}

          <OrbitControls
            enablePan={false}
            enableZoom={false}
            maxPolarAngle={Math.PI / 2}
            minPolarAngle={Math.PI / 3}
            autoRotate={!isPlaying && !isMicActive}
            autoRotateSpeed={0.5}
          />
        </Canvas>
      </div>

    </div>
  );
};

export default AudioVisualizer;

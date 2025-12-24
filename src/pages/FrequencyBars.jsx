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
  const [fileName, setFileName] = useState(null);

  const audioContextRef = useRef(null);
  const audioElementRef = useRef(null);
  const fileInputRef = useRef(null);

  // --- Audio Cleanup on Unmount ---
  useEffect(() => {
    return () => {
      audioContextRef.current?.close();
      if (audioElementRef.current) {
        audioElementRef.current.pause();
        audioElementRef.current.src = '';
      }
    };
  }, []);

  // --- File Handling ---
  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Reset State
    setFileName(file.name.replace(/\.[^/.]+$/, "")); // Remove extension
    setIsPlaying(false);

    // Cleanup old audio
    if (audioContextRef.current) audioContextRef.current.close();
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      URL.revokeObjectURL(audioElementRef.current.src);
    }

    // Init Audio Context
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const audioCtx = new AudioContext();
    audioContextRef.current = audioCtx;

    const newAnalyzer = audioCtx.createAnalyser();
    newAnalyzer.fftSize = 256; // Smaller FFT size = chunkier bars, larger = smoother
    setAnalyzer(newAnalyzer);

    // Init Audio Element
    const audioUrl = URL.createObjectURL(file);
    const audio = new Audio(audioUrl);
    audioElementRef.current = audio;

    // Event Listeners
    audio.addEventListener('loadedmetadata', () => setDuration(audio.duration));
    audio.addEventListener('timeupdate', () => setCurrentTime(audio.currentTime));
    audio.addEventListener('ended', () => setIsPlaying(false));

    // Connect Nodes
    const source = audioCtx.createMediaElementSource(audio);
    source.connect(newAnalyzer);
    newAnalyzer.connect(audioCtx.destination);

    // Play
    audio.play()
      .then(() => setIsPlaying(true))
      .catch(e => console.error("Playback failed:", e));
  };

  // --- Controls ---
  const togglePlay = () => {
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
        <header className="flex justify-between items-center pointer-events-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-cyan-400 to-blue-600 animate-pulse" />
            <div>
              <h1 className="text-xl font-bold tracking-tight">SONIC WAVES</h1>
              <p className="text-xs text-white/50 tracking-wider uppercase">Audio Environment</p>
            </div>
          </div>

          {/* Upload Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="group relative px-6 py-2.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 transition-all overflow-hidden"
          >
            <span className="relative z-10 text-sm font-medium group-hover:text-cyan-300 transition-colors">
              {fileName ? 'Open File' : 'Start Listening'}
            </span>
            {/* Hover Effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/0 via-cyan-500/10 to-cyan-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            onChange={handleFileChange}
            className="hidden"
          />
        </header>

        {/* Center Welcome Message (Only when idle) */}
        {!fileName && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-auto">
            <h2 className="text-5xl md:text-7xl font-light tracking-tighter mb-6 bg-gradient-to-b from-white to-white/20 bg-clip-text text-transparent">
              Feel the <br /> <span className="font-bold">Music</span>
            </h2>
            <p className="text-lg text-white/40 mb-8 max-w-md mx-auto">
              Upload a track to generate a real-time 3D audio landscape.
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-8 py-3 bg-white text-black rounded-full font-bold hover:scale-105 active:scale-95 transition-transform"
            >
              Choose Track
            </button>
          </div>
        )}

        {/* Player Bar (Only when active) */}
        <div className={`transition-all duration-500 transform ${fileName ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0'}`}>
          <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-4 md:p-6 pointer-events-auto max-w-4xl mx-auto flex items-center gap-6">

            {/* Play Button */}
            <button
              onClick={togglePlay}
              className="w-12 h-12 flex-shrink-0 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-full flex items-center justify-center text-black hover:scale-105 active:scale-95 transition-all shadow-[0_0_20px_rgba(6,182,212,0.4)]"
            >
              {isPlaying ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
              )}
            </button>

            {/* Info & Progress */}
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-end mb-2">
                <div className="truncate pr-4">
                  <h3 className="text-white font-medium truncate">{fileName}</h3>
                  <p className="text-xs text-cyan-400">Now Playing</p>
                </div>
                <div className="text-xs font-mono text-white/50 shrink-0">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </div>
              </div>

              {/* Seeker */}
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
                  style={{ width: `${(currentTime / duration) * 100}%` }}
                />
              </div>
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

          {/* If no music, show a floating decorative object */}
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
            autoRotate={!isPlaying || !fileName}
            autoRotateSpeed={0.5}
          />
        </Canvas>
      </div>

    </div>
  );
};

export default AudioVisualizer;

import { Float, OrbitControls, Stars } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Bloom, EffectComposer } from '@react-three/postprocessing';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

// --- Utility: Format Time ---
const formatTime = (seconds) => {
  if (!seconds || isNaN(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// --- Component: Responsive Camera Adjustment ---
const ResponsiveCamera = () => {
  const { camera, size } = useThree();
  const isMobileRef = useRef(size.width < 768);

  useEffect(() => {
    const isMobile = size.width < 768;

    // Only update if crossing the breakpoint to prevent snapping active user adjustments
    if (isMobile !== isMobileRef.current) {
      isMobileRef.current = isMobile;
      const targetZ = isMobile ? 60 : 35;
      const targetY = isMobile ? 30 : 20;

      camera.position.set(0, targetY, targetZ);
      camera.updateProjectionMatrix();
    }
  }, [size.width, camera]); // Only depend on width changing

  return null;
};

// --- Component: Bar Visualizer (Original) ---
const BarVisualizer = ({ analyzer }) => {
  const barsRef = useRef([]);
  const circleRef = useRef();
  const hoveredIndexRef = useRef(null); // Ref for performance, avoids re-renders

  // Configuration
  const barCount = 64;
  const radius = 12;

  useFrame(() => {
    if (!analyzer) return;

    const dataArray = new Uint8Array(analyzer.frequencyBinCount);
    analyzer.getByteFrequencyData(dataArray);

    // Rotate the entire ring slowly (only if not hovering significantly?)
    // Keeping rotation adds life, but we can slow it if desired.
    if (circleRef.current) {
      circleRef.current.rotation.y -= 0.002;
    }

    barsRef.current.forEach((bar, i) => {
      if (!bar) return;

      // Map audio data to scale
      const index = Math.floor((i / barCount) * (dataArray.length / 2));
      const frequencyValue = dataArray[index];

      // Base Audio Scale
      let targetScale = Math.max(0.4, (frequencyValue / 255) * 8);

      // --- Interactive Logic ---
      // If hovered, boost significantly.
      // If close to hovered (optional spread), could boost too.
      if (hoveredIndexRef.current === i) {
        targetScale = Math.max(targetScale, 12); // Boost height on hover
      }

      // Smooth interpolation for height (Lerp)
      // Increasing lerp factor for interaction helps it feel responsive but smooth
      bar.scale.y = THREE.MathUtils.lerp(bar.scale.y, targetScale, 0.15);

      // Color Calculation
      const isHovered = hoveredIndexRef.current === i;
      let hue = 0.5 + (frequencyValue / 255) * 0.4;
      let lightness = 0.3 + (frequencyValue / 255) * 0.4;

      if (isHovered) {
        hue = 0.6; // Cyan-ish
        lightness = 1.0; // White hot
      }

      bar.material.color.setHSL(hue, 0.9, lightness);
      bar.material.emissive.setHSL(hue, isHovered ? 1.0 : 0.8, isHovered ? 0.8 : 0.5);
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
            onPointerOver={(e) => { e.stopPropagation(); hoveredIndexRef.current = i; }}
            onPointerOut={() => { hoveredIndexRef.current = null; }}
          >
            {/* Slimmer bars for a more refined look */}
            <boxGeometry args={[0.3, 1, 0.3]} />
            <meshStandardMaterial
              color="cyan"
              roughness={0.2}
              metalness={0.8}
              toneMapped={false}
              emissiveIntensity={1}
            />
          </mesh>
        );
      })}
    </group>
  );
};

// --- Component: Sphere Visualizer (Pulsing Mesh) ---
const SphereVisualizer = ({ analyzer }) => {
  const meshRef = useRef();

  // Interactive hover state
  const isHoveredRef = useRef(false);

  useFrame((state) => {
    if (!analyzer || !meshRef.current) return;

    const dataArray = new Uint8Array(analyzer.frequencyBinCount);
    analyzer.getByteFrequencyData(dataArray);

    const range = 16;
    let sum = 0;
    for (let i = 0; i < range; i++) sum += dataArray[i];
    const average = sum / range;

    const scaleBase = 1 + (average / 255) * 2.5;
    const targetScale = isHoveredRef.current ? scaleBase * 1.5 : scaleBase;

    meshRef.current.scale.x = THREE.MathUtils.lerp(meshRef.current.scale.x, targetScale, 0.2);
    meshRef.current.scale.y = THREE.MathUtils.lerp(meshRef.current.scale.y, targetScale, 0.2);
    meshRef.current.scale.z = THREE.MathUtils.lerp(meshRef.current.scale.z, targetScale, 0.2);

    meshRef.current.rotation.x += 0.005;
    meshRef.current.rotation.y += 0.005;

    const hue = (state.clock.elapsedTime * 0.05) % 1;
    const lightness = isHoveredRef.current ? 0.8 : 0.5;

    meshRef.current.material.color.setHSL(hue, 0.7, lightness);
    meshRef.current.material.emissive.setHSL(hue, 0.8, 0.5 + (average / 255) * 0.5);
  });

  return (
    <mesh
      ref={meshRef}
      onPointerOver={() => isHoveredRef.current = true}
      onPointerOut={() => isHoveredRef.current = false}
    >
      <icosahedronGeometry args={[4, 5]} />
      <meshStandardMaterial
        color="#ffffff"
        wireframe
        transparent
        opacity={0.8}
        toneMapped={false}
        emissiveIntensity={1}
      />
    </mesh>
  );
};

// --- Component: Wave Visualizer (Circular Time Domain) ---
const WaveVisualizer = ({ analyzer }) => {
  const groupRef = useRef();
  const count = 128; // Number of particles
  const radius = 10;
  const particlesRef = useRef([]);
  const hoveredIndexRef = useRef(null);

  useFrame(() => {
    if (!analyzer) return;
    const dataArray = new Uint8Array(analyzer.fftSize);
    analyzer.getByteTimeDomainData(dataArray); // Time domain for waveform

    particlesRef.current.forEach((mesh, i) => {
      if (!mesh) return;

      // Map time domain (0-255) centered at 128
      const index = Math.floor((i / count) * dataArray.length);
      const value = dataArray[index];
      let displacement = ((value - 128) / 128) * 6; // Amplitude

      // Interaction
      if (hoveredIndexRef.current === i) {
        displacement += 5; // Pop up
      }

      const angle = (i / count) * Math.PI * 2;
      // Radius changes with audio
      const r = radius + displacement;

      mesh.position.x = Math.cos(angle) * r;
      mesh.position.z = Math.sin(angle) * r;
      // Also oscillate Y specifically for wave look
      mesh.position.y = displacement * 1.5;

      // Color logic
      const intensity = Math.abs(displacement) / 4;
      const isHovered = hoveredIndexRef.current === i;

      mesh.material.color.setHSL(0.6 + intensity, 1.0, isHovered ? 1.0 : 0.5);
      mesh.scale.setScalar(isHovered ? 0.4 + intensity : 0.2 + intensity);
      mesh.material.emissive.setHSL(0.6 + intensity, 0.8, 0.5);
    });

    if (groupRef.current) {
      groupRef.current.rotation.y += 0.002;
    }
  });

  return (
    <group ref={groupRef}>
      {[...Array(count)].map((_, i) => (
        <mesh
          key={i}
          ref={el => particlesRef.current[i] = el}
          position={[Math.cos((i / count) * Math.PI * 2) * radius, 0, Math.sin((i / count) * Math.PI * 2) * radius]}
          onPointerOver={(e) => { e.stopPropagation(); hoveredIndexRef.current = i; }}
          onPointerOut={() => hoveredIndexRef.current = null}
        >
          <sphereGeometry args={[0.2, 8, 8]} />
          <meshStandardMaterial
            color="#00ffff"
            emissive="#00ffff"
            emissiveIntensity={1.5}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  )
}


// --- Component: Linear Bar Visualizer (Classic) ---
const LinearBarVisualizer = ({ analyzer }) => {
  const barsRef = useRef([]);
  const groupRef = useRef();
  const hoveredIndexRef = useRef(null);

  // Configuration
  const barCount = 48; // Fewer bars than circular for cleaner simplified look
  const spacing = 1.2;
  const totalWidth = barCount * spacing;

  useFrame(() => {
    if (!analyzer) return;

    const dataArray = new Uint8Array(analyzer.frequencyBinCount);
    analyzer.getByteFrequencyData(dataArray);

    barsRef.current.forEach((bar, i) => {
      if (!bar) return;

      // Linear mapping
      // We skip the very high frequencies which are often empty
      const index = Math.floor((i / barCount) * (dataArray.length * 0.8));
      const frequencyValue = dataArray[index];

      // Scale height
      let targetHeight = Math.max(0.2, (frequencyValue / 255) * 14);

      // Interaction
      if (hoveredIndexRef.current === i) {
        targetHeight = Math.max(targetHeight, 15);
      }

      bar.scale.y = THREE.MathUtils.lerp(bar.scale.y, targetHeight, 0.2);

      // Position: Move up so it grows from bottom
      bar.position.y = bar.scale.y / 2;

      // ColorGradient: Low=Blue, Mid=Cyan, High=White
      const hue = 0.6 - (frequencyValue / 255) * 0.15; // 0.6(Blue) -> 0.45(Cyan)
      const lightness = hoveredIndexRef.current === i ? 1.0 : 0.4 + (frequencyValue / 255) * 0.6; // Get brighter

      bar.material.color.setHSL(hue, 0.9, lightness);
      bar.material.color.setHSL(hue, 0.9, lightness);
      bar.material.emissive.setHSL(hue, 0.8, 0.5);
    });
  });

  return (
    <group ref={groupRef} position={[-totalWidth / 2, -6, 0]}>
      {[...Array(barCount)].map((_, i) => (
        <mesh
          key={i}
          position={[i * spacing, 0, 0]}
          ref={(el) => (barsRef.current[i] = el)}
          onPointerOver={(e) => { e.stopPropagation(); hoveredIndexRef.current = i; }}
          onPointerOut={() => hoveredIndexRef.current = null}
        >
          <boxGeometry args={[0.8, 1, 0.8]} />
          <meshStandardMaterial
            color="cyan"
            roughness={0.2}
            metalness={0.8}
            emissive="cyan"
            emissiveIntensity={1.2}
            toneMapped={false}
          />
        </mesh>
      ))}
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
  const [isSystemActive, setIsSystemActive] = useState(false);

  // New State: Visualizer Mode
  const [visualizerMode, setVisualizerMode] = useState('bars'); // 'bars', 'sphere', 'wave'

  const audioContextRef = useRef(null);
  const audioElementRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const fileInputRef = useRef(null);

  // --- Cleanup Logic ---
  const cleanupAudio = () => {
    setIsPlaying(false);
    setIsMicActive(false);
    setIsSystemActive(false);

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

  // --- Handle System Audio (Screen Share) ---
  const handleSystemAudio = async () => {
    try {
      cleanupAudio();

      // Request screen share with audio
      // 'video: true' is required for getDisplayMedia to work at all
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });

      // Validations
      if (stream.getAudioTracks().length === 0) {
        alert("No audio shared! Please check the 'Share system audio' box in the browser window.");
        stream.getTracks().forEach(track => track.stop());
        return;
      }

      setFileName("System Audio (Screen Share)");
      setInputMode('system');
      setIsSystemActive(true);
      mediaStreamRef.current = stream;

      const { audioCtx, newAnalyzer } = initAudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(newAnalyzer);

      // Handle "Stop Sharing" button in browser UI
      stream.getVideoTracks()[0].onended = () => {
        cleanupAudio();
        // Reset to default
        setFileName(null);
      };

    } catch (err) {
      console.error("System audio cancelled or denied:", err);
    }
  };

  // --- Controls ---
  const togglePlay = () => {
    if (inputMode === 'mic' || inputMode === 'system') {
      // Toggle off by cleaning up
      if (isMicActive || isSystemActive) cleanupAudio();
      else if (inputMode === 'mic') handleMicInput();
      else handleSystemAudio();
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
    if (inputMode === 'mic' || inputMode === 'system') return;
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
        <header className="flex flex-col items-center md:flex-row md:justify-between gap-4 md:gap-6 pointer-events-auto w-full">
          <div className="flex items-center gap-3 self-start md:self-auto">
            <div className={`w-10 h-10 rounded-full bg-gradient-to-tr from-cyan-400 to-blue-600 ${isPlaying || isMicActive || isSystemActive ? 'animate-pulse' : ''}`} />
            <div>
              <h1 className="text-xl font-bold tracking-tight">SONIC WAVES</h1>
              <p className="text-xs text-white/50 tracking-wider uppercase">Audio Environment</p>
            </div>
          </div>

          {/* Visualizer Selector */}
          <div className="flex flex-wrap justify-center gap-2 bg-white/5 backdrop-blur-md rounded-2xl p-1.5 border border-white/10 w-full md:w-auto">
            {['bars', 'linear', 'sphere', 'wave'].map((mode) => (
              <button
                key={mode}
                onClick={() => setVisualizerMode(mode)}
                className={`flex-1 md:flex-none px-3 py-1.5 rounded-xl text-[10px] md:text-xs font-bold uppercase tracking-widest transition-all ${visualizerMode === mode
                  ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20'
                  : 'text-white/60 hover:text-white hover:bg-white/10'
                  }`}
              >
                {mode}
              </button>
            ))}
          </div>

          {/* Input Controls */}
          <div className="flex gap-3 w-full md:w-auto">
            {/* Upload Button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-5 py-2 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 backdrop-blur-md transition-all text-sm font-medium flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
              Upload
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
              {isMicActive ? 'Active' : 'Mic'}
            </button>

            {/* System Audio Button */}
            <button
              onClick={handleSystemAudio}
              className={`px-5 py-2 rounded-full border backdrop-blur-md transition-all text-sm font-medium flex items-center gap-2 ${isSystemActive ? 'bg-purple-500/20 border-purple-500 text-purple-300' : 'bg-white/10 hover:bg-white/20 border-white/10'}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>
              {isSystemActive ? 'Active' : 'System'}
            </button>
          </div>
        </header>

        {/* Center Welcome Message */}
        {!analyzer && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-auto w-full px-4">
            <h2 className="text-4xl md:text-7xl font-light tracking-tighter mb-4 md:mb-6 bg-gradient-to-b from-white to-white/20 bg-clip-text text-transparent">
              Feel the <br /> <span className="font-bold">Music</span>
            </h2>
            <p className="text-lg text-white/40 mb-8 max-w-md mx-auto">
              Select a visualizer style and play music to start the experience.
            </p>
          </div>
        )}

        {/* Player Bar (Only when active) */}
        <div className={`transition-all duration-500 transform ${analyzer ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0'}`}>
          <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-4 md:p-6 pointer-events-auto max-w-4xl mx-auto flex items-center gap-6">

            {/* Play/Stop Button */}
            <button
              onClick={togglePlay}
              className={`w-12 h-12 flex-shrink-0 rounded-full flex items-center justify-center text-black hover:scale-105 active:scale-95 transition-all shadow-[0_0_20px_rgba(6,182,212,0.4)] ${isMicActive ? 'bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.4)]' : isSystemActive ? 'bg-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.4)]' : 'bg-gradient-to-br from-cyan-400 to-blue-600'}`}
            >
              {isPlaying || isMicActive || isSystemActive ? (
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
                  <p className="text-xs text-cyan-400 flex items-center gap-2">
                    <span className="inline-block w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
                    {isMicActive ? 'Live Input' : isSystemActive ? 'System Capture' : 'Now Playing'} • {visualizerMode.toUpperCase()} Mode
                  </p>
                </div>
                {!isMicActive && !isSystemActive && (
                  <div className="text-xs font-mono text-white/50 shrink-0">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </div>
                )}
              </div>

              {/* Seeker (Only for Files) */}
              {!isMicActive && !isSystemActive ? (
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
                  <div className={`absolute inset-0 animate-pulse ${isSystemActive ? 'bg-purple-500/50' : 'bg-red-500/50'}`} style={{ width: '100%' }} />
                </div>
              )}
            </div>

          </div>
        </div>

      </div>

      {/* --- 3D Scene --- */}
      <div className="absolute inset-0 z-0">
        <Canvas camera={{ position: [0, 20, 35], fov: 45 }}>
          <ResponsiveCamera />

          <EffectComposer>
            <Bloom luminanceThreshold={0.2} luminanceSmoothing={0.9} intensity={1.0} radius={0.8} />
          </EffectComposer>

          <color attach="background" args={['#050510']} />
          <fog attach="fog" args={['#050510', 20, 80]} />

          <ambientLight intensity={0.4} />
          <pointLight position={[10, 10, 10]} intensity={1} color="#00ffff" />
          <pointLight position={[-10, 5, -10]} intensity={0.5} color="#ff00ff" />

          <Stars radius={100} depth={50} count={3000} factor={4} saturation={0} fade speed={1.5} />

          {analyzer && (
            <>
              {visualizerMode === 'bars' && <BarVisualizer analyzer={analyzer} />}
              {visualizerMode === 'linear' && <LinearBarVisualizer analyzer={analyzer} />}
              {visualizerMode === 'sphere' && <SphereVisualizer analyzer={analyzer} />}
              {visualizerMode === 'wave' && <WaveVisualizer analyzer={analyzer} />}
            </>
          )}

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
            autoRotate={!isPlaying && !isMicActive && !isSystemActive}
            autoRotateSpeed={0.5}
          />
        </Canvas>
      </div>

    </div>
  );
};

export default AudioVisualizer;

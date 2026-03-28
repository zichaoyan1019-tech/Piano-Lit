/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Shuffle, Check, X, Eye, Music, AlertCircle, SkipForward, SkipBack, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Type } from "@google/genai";

const AUDIO_FILES = [
  // Beethoven
  "Op.2 no.2 I.mp3",
  "Op.2 no.2 II.mp3",
  "Op.2 no.2 III.mp3",
  "Op.2 no.2 IV.mp3",
  "Op.28 I.mp3",
  "Op.28 II.mp3",
  "Op.28 III.mp3",
  "Op.28 IV.mp3",
  "Op.31 no.2 I.mp3",
  "Op.31 no.3 I.mp3",
  // Haydn
  "Hob.XVI37 I.ogg",
  "Hob.XVI37 II.flac",
  "Hob.XVI37 III.ogg",
  "Hob. XVI40 I.mp3",
  "Hob. XVI40 II.mp3",
  "Hob. XVI48 I.mp3",
  "Hob. XVI48 II.mp3",
  "Hob.XVI49 I.ogg",
  "Hob.XVI49 II.ogg",
  "Hob.XVI49 III.ogg",
  "Hob.XVI50.mp3",
  "Hob.XVI50 II.mp3",
  "Hob.XVI52 I.mp3",
  "Hob.XVI52 II.mp3",
  "Hob.XVI52 III.mp3",
  // Mozart
  "K271 I.ogg",
  "K271 II.ogg",
  "K271 III.ogg",
  "K332 I.ogg",
  "K332 II.ogg",
  "K332 III.ogg",
  "K333 I.flac",
  "K333 II.flac",
  "K333 III.flac",
  "K457 I.ogg",
  "K457 II.ogg",
  "K457 III.ogg",
  "K491 I.ogg",
  "K491 II.flac",
  "K491 III.ogg",
  "K503 I.flac",
  "K503 II.flac",
  "K503 III.flac"
];

// Helper to shuffle an array
const shuffleArray = (array: string[]) => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

const METADATA: Record<string, { year: string, features: string[], influences: string[] }> = {
  "Hob.XVI37": {
    year: "1780",
    features: [
      "There is no clear second theme; it moves directly into closing (continuous exposition).",
      "The harmony remains unstable, feeling like a transition until reaching a stable key."
    ],
    influences: [
      "Breaks the standard sonata structure by lacking a clear second theme.",
      "Shows Haydn’s flexible approach to sonata form."
    ]
  },
  "Hob. XVI40": {
    year: "1784",
    features: [
      "The music is more serious and “learned,” less light or playful.",
      "The structure is more developed, with stronger transitions and thematic work."
    ],
    influences: [
      "Shows Haydn’s move toward a more mature and expressive style.",
      "Influenced later Classical sonata development."
    ]
  },
  "Hob. XVI48": {
    year: "1789",
    features: [
      "The writing imitates instrumental styles (e.g., cello or chamber music).",
      "Focus on interaction between voices and texture changes."
    ],
    influences: [
      "Shows the move toward more instrumental-style piano writing.",
      "Influences later composers like Beethoven’s textures."
    ]
  },
  "Hob.XVI49": {
    year: "1789-90",
    features: [
      "The true second theme is delayed and appears later than expected.",
      "Themes are constantly varied, especially in the slow movement."
    ],
    influences: [
      "Breaks the standard sonata form.",
      "Emphasizes variation as a key compositional technique."
    ]
  },
  "Hob.XVI50": {
    year: "1794-5",
    features: [
      "The same material reappears in different places.",
      "Uses recurring gestures as “signposts” to mark structural points."
    ],
    influences: [
      "Moves away from contrasting themes toward unity of material.",
      "Helps listeners follow structure through recognizable signals."
    ]
  },
  "Hob.XVI52": {
    year: "1794",
    features: [
      "Uses recurring gestures as structural signposts.",
      "The slow movement is highly expressive, with dramatic harmonic shifts."
    ],
    influences: [
      "Shows stronger emotional expression, approaching Beethoven’s style.",
      "Show expanded keyboard range and use of new piano capabilities."
    ]
  },
  "K332": {
    year: "1781-3",
    features: [
      "Many new musical ideas appear instead of developing a single motive.",
      "It has an operatic character, with a strong sense of drama and performance."
    ],
    influences: [
      "Shows Mozart’s tendency to rely on multiple melodies rather than motivic development."
    ]
  },
  "K333": {
    year: "1783-4",
    features: [
      "Special attention for articulation, phrasing and slurs in performance."
    ],
    influences: [
      "Highlights the importance of proper articulation in understanding Mozart’s style."
    ]
  },
  "K457": {
    year: "1784",
    features: [
      "One of the few minor-key sonatas, with more tension and dramatic character.",
      "The development section features intense emotions"
    ],
    influences: [
      "Often associated with the death of Mozart’s mother, though not certain."
    ]
  }
};

const normalizeText = (str?: string) => (str || "").toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();

const getMetadata = (filename: string | null) => {
  if (!filename) return null;
  for (const [key, meta] of Object.entries(METADATA)) {
    if (filename.startsWith(key)) return meta;
  }
  return null;
};

interface MistakeRecord {
  track: string;
  details: { label: string; correct: string; user: string }[];
}

export default function App() {
  const [mode, setMode] = useState<'random' | 'sequential'>('random');
  const [playlist, setPlaylist] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const [mistakes, setMistakes] = useState<MistakeRecord[]>([]);
  const [currentTrackMistake, setCurrentTrackMistake] = useState(false);
  const [showMistakesModal, setShowMistakesModal] = useState(false);

  const [currentFile, setCurrentFile] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [nameVerified, setNameVerified] = useState(false);
  const [userInputs, setUserInputs] = useState({
    name: "", year: "", feature1: "", feature2: "", influence1: "", influence2: ""
  });
  const [feedback, setFeedback] = useState<'idle' | 'correct' | 'incorrect'>('idle');
  const [showAnswer, setShowAnswer] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Initialize audio element
    audioRef.current = new Audio();
    
    const handleEnded = () => setIsPlaying(false);
    const handleError = () => {
      setError("无法加载音频文件，请确保文件已放入 public 文件夹中。");
      setIsPlaying(false);
    };

    audioRef.current.addEventListener('ended', handleEnded);
    audioRef.current.addEventListener('error', handleError);

    return () => {
      if (audioRef.current) {
        audioRef.current.removeEventListener('ended', handleEnded);
        audioRef.current.removeEventListener('error', handleError);
        audioRef.current.pause();
      }
    };
  }, []);

  const handleModeSwitch = (newMode: 'random' | 'sequential') => {
    if (mode === newMode) return;
    
    setMode(newMode);
    setCurrentFile(null);
    setIsPlaying(false);
    setFeedback('idle');
    setUserInputs({ name: "", year: "", feature1: "", feature2: "", influence1: "", influence2: "" });
    setShowAnswer(false);
    setMistakes([]);
    setCurrentTrackMistake(false);
    setNameVerified(false);
    
    if (audioRef.current) {
      audioRef.current.pause();
    }

    if (newMode === 'sequential') {
      setPlaylist(shuffleArray(AUDIO_FILES));
      setCurrentIndex(0);
    }
  };

  const playNext = () => {
    if (!audioRef.current) return;
    
    setError(null);
    setFeedback('idle');
    setUserInputs({ name: "", year: "", feature1: "", feature2: "", influence1: "", influence2: "" });
    setShowAnswer(false);
    setCurrentTrackMistake(false);
    setNameVerified(false);

    let nextFile = "";
    
    if (mode === 'random') {
      nextFile = AUDIO_FILES[Math.floor(Math.random() * AUDIO_FILES.length)];
    } else {
      // Sequential mode
      if (playlist.length === 0) {
        const newPlaylist = shuffleArray(AUDIO_FILES);
        setPlaylist(newPlaylist);
        nextFile = newPlaylist[0];
        setCurrentIndex(0);
      } else {
        let nextIndex = currentIndex;
        if (currentFile) {
          nextIndex = currentIndex + 1;
        }
        
        if (nextIndex >= playlist.length) {
          // Reached the end, reshuffle and start over
          const newPlaylist = shuffleArray(AUDIO_FILES);
          setPlaylist(newPlaylist);
          setCurrentIndex(0);
          nextFile = newPlaylist[0];
          setMistakes([]);
        } else {
          setCurrentIndex(nextIndex);
          nextFile = playlist[nextIndex];
        }
      }
    }

    setCurrentFile(nextFile);
    audioRef.current.src = `/${nextFile}`;
    
    const onLoadedMetadata = () => {
      if (!audioRef.current) return;
      const duration = audioRef.current.duration;
      // Start at a random position, leaving at least 10 seconds to play if possible
      const maxStart = Math.max(0, duration - 10);
      audioRef.current.currentTime = Math.random() * maxStart;
      
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(err => {
        console.error("Playback failed:", err);
        setError("播放失败，请点击播放按钮重试。");
      });
      
      audioRef.current.removeEventListener('loadedmetadata', onLoadedMetadata);
    };
    
    audioRef.current.addEventListener('loadedmetadata', onLoadedMetadata);
    audioRef.current.load();
  };

  const playFromBeginning = () => {
    if (!audioRef.current || !currentFile) return;
    audioRef.current.currentTime = 0;
    audioRef.current.play().then(() => {
      setIsPlaying(true);
    }).catch(err => {
      console.error("Playback failed:", err);
      setError("播放失败。");
    });
  };

  const togglePlay = () => {
    if (!audioRef.current || !currentFile) return;
    
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(err => {
        console.error("Playback failed:", err);
        setError("播放失败。");
      });
    }
  };

  const getCorrectAnswer = () => {
    if (!currentFile) return "";
    const lastDotIndex = currentFile.lastIndexOf('.');
    return lastDotIndex !== -1 ? currentFile.substring(0, lastDotIndex) : currentFile;
  };

  const handleViewAnswer = () => {
    setShowAnswer(true);
    if (mode === 'sequential' && !currentTrackMistake && currentFile) {
      const correctName = getCorrectAnswer();
      const meta = getMetadata(currentFile);
      const details = [];
      details.push({ label: "名称", correct: correctName, user: "直接查看答案" });
      if (meta) {
        details.push({ label: "年份", correct: meta.year, user: "直接查看答案" });
        details.push({ label: "特点", correct: `1. ${meta.features[0]}\n2. ${meta.features[1]}`, user: "直接查看答案" });
        details.push({ label: "影响", correct: `1. ${meta.influences[0]}\n2. ${meta.influences[1]}`, user: "直接查看答案" });
      }
      setMistakes(prev => [...prev, { track: correctName, details }]);
      setCurrentTrackMistake(true);
    }
  };

  const checkAnswer = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!currentFile || isChecking) return;

    const correctName = getCorrectAnswer();
    const meta = getMetadata(currentFile);
    const details: { label: string; correct: string; user: string }[] = [];

    if (!nameVerified) {
      if (!userInputs.name.trim()) return;
      if (normalizeText(userInputs.name) !== normalizeText(correctName)) {
        details.push({ label: "名称", correct: correctName, user: userInputs.name });
        setFeedback('incorrect');
        setShowAnswer(true);
        if (mode === 'sequential' && !currentTrackMistake) {
          setMistakes(prev => [...prev, { track: correctName, details }]);
          setCurrentTrackMistake(true);
        }
        return;
      } else {
        if (meta) {
          setNameVerified(true);
          return;
        } else {
          setFeedback('correct');
          setShowAnswer(true);
          return;
        }
      }
    }

    setIsChecking(true);

    if (meta) {
      if (normalizeText(userInputs.year) !== normalizeText(meta.year)) {
        details.push({ label: "年份", correct: meta.year, user: userInputs.year || "(未填写)" });
      }

      const normF1 = normalizeText(userInputs.feature1);
      const normF2 = normalizeText(userInputs.feature2);
      const targetF1 = normalizeText(meta.features[0]);
      const targetF2 = normalizeText(meta.features[1]);

      const f1Correct = normF1 === targetF1 || normF1 === targetF2;
      const f2Correct = normF2 === targetF1 || normF2 === targetF2 || (!targetF2 && !normF2);
      let featuresPass = f1Correct && f2Correct && (normF1 !== normF2 || normF1 === "");

      const normI1 = normalizeText(userInputs.influence1);
      const normI2 = normalizeText(userInputs.influence2);
      const targetI1 = normalizeText(meta.influences[0]);
      const targetI2 = normalizeText(meta.influences[1]);

      const i1Correct = normI1 === targetI1 || normI1 === targetI2;
      const i2Correct = normI2 === targetI1 || normI2 === targetI2 || (!targetI2 && !normI2);
      let influencesPass = i1Correct && i2Correct && (normI1 !== normI2 || normI1 === "");

      // If strict checking fails, try semantic checking with Gemini
      if (!featuresPass || !influencesPass) {
        try {
          const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
          const prompt = `
You are an expert music history grader. Evaluate if the user's answers match the correct answers in meaning.
Minor grammatical errors, missing words, or phrasing differences are acceptable as long as the core meaning is conveyed.
The order of the user's answers does not matter (e.g., User Feature 1 can match Correct Feature 2).
If a user's answer is empty or completely misses the point, it is incorrect. Both features must be present and correct in meaning to get "features_correct": true, UNLESS there is only 1 correct feature provided, in which case only 1 user feature is required. Same for influences.

Correct Features:
- ${meta.features[0] || "(none)"}
- ${meta.features[1] || "(none)"}

User Features:
- ${userInputs.feature1 || "(empty)"}
- ${userInputs.feature2 || "(empty)"}

Correct Influences:
- ${meta.influences[0] || "(none)"}
- ${meta.influences[1] || "(none)"}

User Influences:
- ${userInputs.influence1 || "(empty)"}
- ${userInputs.influence2 || "(empty)"}
`;
          const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  features_correct: { type: Type.BOOLEAN },
                  influences_correct: { type: Type.BOOLEAN }
                },
                required: ["features_correct", "influences_correct"]
              }
            }
          });

          const text = response.text;
          if (text) {
            const result = JSON.parse(text);
            if (!featuresPass && result.features_correct) featuresPass = true;
            if (!influencesPass && result.influences_correct) influencesPass = true;
          }
        } catch (error) {
          console.error("Semantic check failed:", error);
        }
      }

      if (!featuresPass) {
         details.push({ 
           label: "特点", 
           correct: `1. ${meta.features[0]}${meta.features[1] ? `\n2. ${meta.features[1]}` : ''}`, 
           user: `1. ${userInputs.feature1 || "(未填写)"}\n2. ${userInputs.feature2 || "(未填写)"}` 
         });
      }

      if (!influencesPass) {
         details.push({ 
           label: "影响", 
           correct: `1. ${meta.influences[0]}${meta.influences[1] ? `\n2. ${meta.influences[1]}` : ''}`, 
           user: `1. ${userInputs.influence1 || "(未填写)"}\n2. ${userInputs.influence2 || "(未填写)"}` 
         });
      }
    }

    if (details.length === 0) {
      setFeedback('correct');
      setShowAnswer(true);
    } else {
      setFeedback('incorrect');
      if (mode === 'sequential' && !currentTrackMistake) {
        setMistakes(prev => [...prev, { track: correctName, details }]);
        setCurrentTrackMistake(true);
      }
    }
    
    setIsChecking(false);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-stone-200 flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Ambient Background */}
      <div className="ambient-glow"></div>

      <div className="w-full max-w-2xl z-10 flex flex-col items-center">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-serif font-medium tracking-wide text-amber-50/90 mb-3">
            Piano Art History
          </h1>
          <p className="text-amber-500/60 tracking-[0.2em] uppercase text-sm font-medium">
            Ear Training
          </p>
        </div>

        {/* Mode Toggle */}
        <div className="flex bg-white/5 rounded-full p-1 mb-8 border border-white/10 shadow-lg">
          <button
            onClick={() => handleModeSwitch('random')}
            className={`px-6 py-2.5 rounded-full text-sm font-medium transition-all duration-300 ${
              mode === 'random' 
                ? 'bg-amber-500/20 text-amber-400 shadow-[0_0_15px_rgba(217,119,6,0.2)]' 
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            无限随机模式
          </button>
          <button
            onClick={() => handleModeSwitch('sequential')}
            className={`px-6 py-2.5 rounded-full text-sm font-medium transition-all duration-300 ${
              mode === 'sequential' 
                ? 'bg-amber-500/20 text-amber-400 shadow-[0_0_15px_rgba(217,119,6,0.2)]' 
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            不重复套题模式
          </button>
        </div>

        {/* Main Player Card */}
        <div className="glass-panel w-full rounded-[2.5rem] p-8 md:p-12 flex flex-col items-center shadow-2xl relative">
          
          {/* Mistakes Book Button (Sequential Mode) */}
          {mode === 'sequential' && (
            <button
              onClick={() => setShowMistakesModal(true)}
              className="absolute top-8 left-8 text-amber-500/60 hover:text-amber-400 flex items-center gap-2 text-sm transition-colors cursor-pointer bg-black/20 px-3 py-1 rounded-full border border-white/5"
            >
              <BookOpen className="w-4 h-4" />
              <span>错题本</span>
              <span className="font-mono">({mistakes.length})</span>
            </button>
          )}

          {/* Progress Indicator (Sequential Mode) */}
          {mode === 'sequential' && currentFile && (
            <div className="absolute top-8 right-8 text-amber-500/60 font-mono text-sm tracking-widest bg-black/20 px-3 py-1 rounded-full border border-white/5">
              <span>{currentIndex + 1}</span> / <span>{playlist.length}</span>
            </div>
          )}

          {/* Record / Visualizer */}
          <div className="relative w-48 h-48 mb-12 flex items-center justify-center">
            <div className={`absolute inset-0 rounded-full border border-white/10 ${isPlaying ? 'record-spin' : ''}`}>
              <div className="absolute inset-2 rounded-full border border-white/5"></div>
              <div className="absolute inset-4 rounded-full border border-white/5"></div>
              <div className="absolute inset-8 rounded-full border border-white/5"></div>
              <div className="absolute inset-0 bg-gradient-to-tr from-black/40 to-transparent rounded-full"></div>
            </div>
            <div className={`w-16 h-16 rounded-full bg-[#111] border border-white/10 flex items-center justify-center shadow-2xl z-10 ${isPlaying ? 'record-spin' : ''}`}>
              <Music className="w-6 h-6 text-amber-500/50" />
            </div>
            {isPlaying && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1.2, opacity: 0.4 }}
                transition={{ repeat: Infinity, duration: 2, ease: "easeInOut", repeatType: "reverse" }}
                className="absolute inset-0 rounded-full bg-amber-500/20 blur-2xl -z-10"
              />
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-4 md:gap-8 mb-12">
            <button
              onClick={playFromBeginning}
              disabled={!currentFile}
              className="w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center text-stone-400 hover:text-amber-400 hover:bg-white/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              title="从头播放"
            >
              <SkipBack className="w-5 h-5 md:w-6 md:h-6" />
            </button>

            <button
              onClick={togglePlay}
              disabled={!currentFile}
              className="w-20 h-20 md:w-24 md:h-24 bg-amber-600/90 hover:bg-amber-500 text-white rounded-full flex items-center justify-center transition-all shadow-[0_0_40px_rgba(217,119,6,0.3)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-amber-600/90 cursor-pointer shrink-0"
            >
              {isPlaying ? (
                <Pause className="w-8 h-8 md:w-10 md:h-10" />
              ) : (
                <Play className="w-8 h-8 md:w-10 md:h-10 ml-2" />
              )}
            </button>

            <button
              onClick={playNext}
              className="w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center text-stone-400 hover:text-amber-400 hover:bg-white/5 transition-colors cursor-pointer"
              title={mode === 'random' ? "随机抽取" : "下一首"}
            >
              {mode === 'random' ? <Shuffle className="w-5 h-5 md:w-6 md:h-6" /> : <SkipForward className="w-5 h-5 md:w-6 md:h-6" />}
            </button>

            <button
              onClick={handleViewAnswer}
              disabled={!currentFile || showAnswer}
              className="w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center text-stone-400 hover:text-amber-400 hover:bg-white/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              title="查看答案"
            >
              <Eye className="w-5 h-5 md:w-6 md:h-6" />
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 px-4 py-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl flex items-center gap-3 text-sm w-full">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p>{error}</p>
            </motion.div>
          )}

          {/* Answer Section */}
          <div className="w-full max-w-2xl">
            <form onSubmit={checkAnswer} className="relative w-full flex flex-col gap-3">
              <div className="relative w-full">
                <input
                  type="text"
                  value={userInputs.name}
                  onChange={(e) => {
                    setUserInputs({...userInputs, name: e.target.value});
                    setFeedback('idle');
                  }}
                  placeholder="输入曲目名称 (如: K332 I)"
                  disabled={!currentFile || (showAnswer && feedback === 'correct') || nameVerified}
                  className={`w-full bg-transparent border-b-2 px-4 py-4 text-center text-2xl md:text-3xl font-serif focus:outline-none transition-colors placeholder:text-stone-700 disabled:opacity-50 ${nameVerified ? 'border-green-500/50 text-green-400' : 'border-white/10 focus:border-amber-500/50'}`}
                />
                
                <AnimatePresence>
                  {userInputs.name.trim() && feedback === 'idle' && !showAnswer && !nameVerified && (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      type="submit"
                      disabled={isChecking}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {isChecking ? (
                        <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Check className="w-5 h-5 text-amber-400" />
                      )}
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>

              {getMetadata(currentFile) && nameVerified && (
                <motion.div initial={{opacity: 0, height: 0}} animate={{opacity: 1, height: 'auto'}} className="flex flex-col gap-4 w-full mt-4">
                  <input
                    type="text"
                    value={userInputs.year}
                    onChange={(e) => { setUserInputs({...userInputs, year: e.target.value}); setFeedback('idle'); }}
                    placeholder="年份 (如: 1780)"
                    disabled={!currentFile || (showAnswer && feedback === 'correct')}
                    className="w-full bg-transparent border-b border-white/10 px-4 py-2 text-center text-lg font-serif focus:outline-none focus:border-amber-500/50 transition-colors placeholder:text-stone-700 disabled:opacity-50"
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                      <textarea
                        value={userInputs.feature1}
                        onChange={(e) => { setUserInputs({...userInputs, feature1: e.target.value}); setFeedback('idle'); }}
                        placeholder="特点 1 (Features)"
                        disabled={!currentFile || (showAnswer && feedback === 'correct')}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm font-sans focus:outline-none focus:border-amber-500/50 transition-colors placeholder:text-stone-600 disabled:opacity-50 resize-none h-24"
                      />
                      <textarea
                        value={userInputs.feature2}
                        onChange={(e) => { setUserInputs({...userInputs, feature2: e.target.value}); setFeedback('idle'); }}
                        placeholder="特点 2 (Features)"
                        disabled={!currentFile || (showAnswer && feedback === 'correct')}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm font-sans focus:outline-none focus:border-amber-500/50 transition-colors placeholder:text-stone-600 disabled:opacity-50 resize-none h-24"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <textarea
                        value={userInputs.influence1}
                        onChange={(e) => { setUserInputs({...userInputs, influence1: e.target.value}); setFeedback('idle'); }}
                        placeholder="影响 1 (Influence)"
                        disabled={!currentFile || (showAnswer && feedback === 'correct')}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm font-sans focus:outline-none focus:border-amber-500/50 transition-colors placeholder:text-stone-600 disabled:opacity-50 resize-none h-24"
                      />
                      <textarea
                        value={userInputs.influence2}
                        onChange={(e) => { setUserInputs({...userInputs, influence2: e.target.value}); setFeedback('idle'); }}
                        placeholder="影响 2 (Influence)"
                        disabled={!currentFile || (showAnswer && feedback === 'correct')}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm font-sans focus:outline-none focus:border-amber-500/50 transition-colors placeholder:text-stone-600 disabled:opacity-50 resize-none h-24"
                      />
                    </div>
                  </div>
                  
                  <div className="mt-4 flex justify-center">
                    <button
                      type="submit"
                      disabled={isChecking || showAnswer}
                      className="px-6 py-2.5 bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 rounded-full font-medium transition-colors border border-amber-500/30 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                    >
                      {isChecking ? (
                        <><div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" /> 判题中...</>
                      ) : (
                        <><Check className="w-5 h-5" /> 提交附加信息</>
                      )}
                    </button>
                  </div>
                </motion.div>
              )}
            </form>

            {/* Feedback Messages */}
            <div className="mt-8 flex flex-col items-center justify-center min-h-[5rem]">
              <AnimatePresence mode="wait">
                {feedback === 'correct' && (
                  <motion.div
                    key="correct"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="text-green-400 flex items-center gap-2 font-medium text-lg mb-4"
                  >
                    <Check className="w-6 h-6" />
                    回答正确！
                  </motion.div>
                )}
                {feedback === 'incorrect' && !showAnswer && (
                  <motion.div
                    key="incorrect"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="text-red-400 flex items-center gap-2 font-medium text-lg mb-4"
                  >
                    <X className="w-6 h-6" />
                    答案不正确，再试一次？
                  </motion.div>
                )}
                {showAnswer && (
                  <motion.div
                    key="answer"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="w-full text-left bg-black/30 p-6 rounded-2xl border border-white/10 space-y-4"
                  >
                    <div>
                      <span className="text-stone-500 text-xs uppercase tracking-widest block mb-1">正确名称</span>
                      <span className="text-amber-400 font-serif text-2xl tracking-wide">{getCorrectAnswer()}</span>
                    </div>
                    {getMetadata(currentFile) && (
                      <>
                        <div>
                          <span className="text-stone-500 text-xs uppercase tracking-widest block mb-1">年份</span>
                          <span className="text-amber-400 font-serif text-xl tracking-wide">{getMetadata(currentFile)!.year}</span>
                        </div>
                        <div>
                          <span className="text-stone-500 text-xs uppercase tracking-widest block mb-1">特点 Features</span>
                          <ul className="list-disc pl-5 text-amber-400 font-serif text-base space-y-1">
                            <li>{getMetadata(currentFile)!.features[0]}</li>
                            <li>{getMetadata(currentFile)!.features[1]}</li>
                          </ul>
                        </div>
                        <div>
                          <span className="text-stone-500 text-xs uppercase tracking-widest block mb-1">影响 Influence</span>
                          <ul className="list-disc pl-5 text-amber-400 font-serif text-base space-y-1">
                            <li>{getMetadata(currentFile)!.influences[0]}</li>
                            <li>{getMetadata(currentFile)!.influences[1]}</li>
                          </ul>
                        </div>
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Mistakes Modal */}
        <AnimatePresence>
          {showMistakesModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="glass-panel w-full max-w-md rounded-3xl p-8 relative border border-white/10 shadow-2xl"
              >
                <button
                  onClick={() => setShowMistakesModal(false)}
                  className="absolute top-6 right-6 text-stone-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-6 h-6" />
                </button>
                <h2 className="text-2xl font-serif text-amber-400 mb-6 flex items-center gap-3">
                  <BookOpen className="w-6 h-6" />
                  本轮错题本
                </h2>
                {mistakes.length === 0 ? (
                  <p className="text-stone-400 text-center py-8">本轮还没有错题，继续保持！</p>
                ) : (
                  <ul className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                    {mistakes.map((mistake, idx) => (
                      <li key={idx} className="bg-white/5 border border-white/5 rounded-xl p-5 flex flex-col gap-4">
                        <div className="flex items-center gap-3 text-stone-200 font-serif text-xl border-b border-white/10 pb-3">
                          <span className="text-amber-500/50 text-base font-mono">{idx + 1}.</span>
                          <span className="text-amber-400">{mistake.track}</span>
                        </div>
                        <div className="flex flex-col gap-4">
                          {mistake.details.map((detail, dIdx) => (
                            <div key={dIdx} className="text-sm bg-black/20 rounded-lg p-3">
                              <div className="text-stone-400 mb-2 font-medium">[{detail.label}]</div>
                              <div className="text-amber-400/90 mb-2 whitespace-pre-wrap">✓ {detail.correct}</div>
                              <div className="text-red-400/80 line-through whitespace-pre-wrap">✗ {detail.user}</div>
                            </div>
                          ))}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

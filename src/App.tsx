import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Plus, 
  Search, 
  BookOpen, 
  Volume2, 
  Trash2, 
  Loader2, 
  ChevronRight, 
  Languages,
  Sparkles,
  History,
  Rocket,
  Camera,
  CheckCircle2,
  XCircle,
  Trophy,
  Gamepad2,
  Keyboard,
  Mic,
  MicOff,
  Music,
  Ghost,
  Sparkle,
  Star,
  Orbit,
  Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogDescription
} from "@/components/ui/dialog";
import { getWordDetails, WordDetail } from "@/services/gemini";
import { cn } from "@/lib/utils";

interface ExtendedWordDetail extends WordDetail {
  mastered?: boolean;
  lastTested?: number;
  level: number; // 0-5, representing mastery stages
  nextReview: number; // timestamp
  reviewCount: number;
}

const EBBINGHAUS_INTERVALS = [
  0, // Level 0: New
  5 * 60 * 1000, // Level 1: 5 mins
  30 * 60 * 1000, // Level 2: 30 mins
  12 * 60 * 60 * 1000, // Level 3: 12 hours
  24 * 60 * 60 * 1000, // Level 4: 1 day
  4 * 24 * 60 * 60 * 1000, // Level 5: 4 days
  7 * 24 * 60 * 60 * 1000, // Level 6: 7 days
  15 * 24 * 60 * 60 * 1000, // Level 7: 15 days
];

function getNextReview(level: number): number {
  const interval = EBBINGHAUS_INTERVALS[Math.min(level, EBBINGHAUS_INTERVALS.length - 1)];
  return Date.now() + interval;
}

export default function App() {
  const [words, setWords] = useState<ExtendedWordDetail[]>(() => {
    const saved = localStorage.getItem("lexiflow_words_v2");
    const parsed = saved ? JSON.parse(saved) : [];
    // Migrate old data if necessary
    return parsed.map((w: any) => ({
      ...w,
      level: w.level ?? 0,
      nextReview: w.nextReview ?? Date.now(),
      reviewCount: w.reviewCount ?? 0,
    }));
  });
  const [inputValue, setInputValue] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedWord, setSelectedWord] = useState<ExtendedWordDetail | null>(null);
  const [activeTab, setActiveTab] = useState("list");
  
  // Dictation Mode State
  const [isDictating, setIsDictating] = useState(false);
  const [dictationIndex, setDictationIndex] = useState(0);
  const [dictationInput, setDictationInput] = useState("");
  const [dictationResult, setDictationResult] = useState<"correct" | "wrong" | null>(null);
  const [score, setScore] = useState(0);

  // Practice Mission (Matching) State
  const [isPracticing, setIsPracticing] = useState(false);
  const [practicePair, setPracticePair] = useState<{word: string, options: string[], answer: string} | null>(null);
  const [practiceFeedback, setPracticeFeedback] = useState<string | null>(null);
  const [practiceStreak, setPracticeStreak] = useState(0);

  // Speech Recognition State
  const [isListening, setIsListening] = useState(false);
  const [speechFeedback, setSpeechFeedback] = useState<{score: number, message: string} | null>(null);
  const recognitionRef = useRef<any>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem("lexiflow_words_v2", JSON.stringify(words));
  }, [words]);

  const filteredWords = useMemo(() => {
    return words.filter(w => 
      w.word.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.translation.includes(searchQuery)
    );
  }, [words, searchQuery]);

  const masteredCount = words.filter(w => w.mastered).length;
  const progressValue = words.length > 0 ? (masteredCount / words.length) * 100 : 0;

  const handleAddWords = async (text?: string) => {
    const targetText = text || inputValue;
    if (!targetText.trim()) return;

    setIsLoading(true);
    try {
      const details = await getWordDetails(targetText);
      const extendedDetails = details.map(d => ({ 
        ...d, 
        mastered: false,
        level: 0,
        nextReview: Date.now(),
        reviewCount: 0
      }));
      setWords(prev => [...extendedDetails, ...prev]);
      setInputValue("");
      if (extendedDetails.length > 0) {
        setSelectedWord(extendedDetails[0]);
      }
    } catch (error) {
      console.error("Error adding words:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(",")[1];
      try {
        const details = await getWordDetails({ base64, mimeType: file.type });
        const extendedDetails = details.map(d => ({ 
          ...d, 
          mastered: false,
          level: 0,
          nextReview: Date.now(),
          reviewCount: 0
        }));
        setWords(prev => [...extendedDetails, ...prev]);
        if (extendedDetails.length > 0) {
          setSelectedWord(extendedDetails[0]);
        }
      } catch (error) {
        console.error("OCR Error:", error);
      } finally {
        setIsLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const toggleMastery = (word: string) => {
    setWords(prev => prev.map(w => 
      w.word === word ? { 
        ...w, 
        mastered: !w.mastered,
        level: !w.mastered ? 7 : 0, // Max level if mastered
        nextReview: !w.mastered ? Date.now() + 30 * 24 * 60 * 60 * 1000 : Date.now()
      } : w
    ));
  };

  const updateWordProgress = (word: string, success: boolean) => {
    setWords(prev => prev.map(w => {
      if (w.word === word) {
        const newLevel = success ? Math.min(w.level + 1, 7) : Math.max(w.level - 1, 0);
        return {
          ...w,
          level: newLevel,
          nextReview: getNextReview(newLevel),
          reviewCount: w.reviewCount + 1,
          mastered: newLevel >= 7
        };
      }
      return w;
    }));
  };

  const startPractice = () => {
    const available = words.filter(w => !w.mastered);
    if (available.length < 2) return;
    
    setIsPracticing(true);
    generatePracticePair(available);
  };

  const generatePracticePair = (available: ExtendedWordDetail[]) => {
    const target = available[Math.floor(Math.random() * available.length)];
    const other = available.filter(w => w.word !== target.word)[Math.floor(Math.random() * (available.length - 1))];
    
    const options = [target.translation, other.translation].sort(() => Math.random() - 0.5);
    setPracticePair({
      word: target.word,
      options,
      answer: target.translation
    });
    setPracticeFeedback(null);
  };

  const handlePracticeAnswer = (option: string) => {
    if (!practicePair) return;
    
    const isCorrect = option === practicePair.answer;
    setPracticeFeedback(isCorrect ? "correct" : "wrong");
    
    if (isCorrect) {
      setScore(prev => prev + 50);
      setPracticeStreak(prev => prev + 1);
      updateWordProgress(practicePair.word, true);
    } else {
      setPracticeStreak(0);
      updateWordProgress(practicePair.word, false);
    }

    setTimeout(() => {
      const available = words.filter(w => !w.mastered);
      if (available.length >= 2) {
        generatePracticePair(available);
      } else {
        setIsPracticing(false);
      }
    }, 1000);
  };

  const removeWord = (wordToRemove: string) => {
    setWords(prev => prev.filter(w => w.word !== wordToRemove));
    if (selectedWord?.word === wordToRemove) {
      setSelectedWord(null);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && ('WebkitSpeechRecognition' in window || 'speechRecognition' in window)) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript.toLowerCase().trim();
        const confidence = event.results[0][0].confidence;
        handleSpeechResult(transcript, confidence);
      };

      recognitionRef.current.onerror = () => {
        setIsListening(false);
        setSpeechFeedback({ score: 0, message: "信号丢失，请再试一次" });
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  const handleSpeechResult = (transcript: string, confidence: number) => {
    if (!selectedWord) return;
    
    const target = selectedWord.word.toLowerCase();
    const isCorrect = transcript === target || transcript.includes(target);
    
    let score = Math.round(confidence * 100);
    if (!isCorrect) score = Math.max(0, score - 40);

    let message = "";
    let voiceMsg = "";

    if (score > 85) {
      message = "完美的发音！你简直就是外星语专家！";
      voiceMsg = "Perfect pronunciation! You are a space language expert!";
      setScore(prev => prev + 100);
      updateWordProgress(selectedWord.word, true);
    } else if (score > 60) {
      message = "读得真棒！声音很有磁性，再大声一点就更完美了。";
      voiceMsg = "Great job! Your voice is amazing, just a bit louder next time.";
      setScore(prev => prev + 50);
    } else {
      message = "很有勇气的尝试！跟我再读一遍： " + selectedWord.word;
      voiceMsg = "Brave try! Let's practice together: " + selectedWord.word;
    }

    setSpeechFeedback({ score, message });
    playAudio(voiceMsg, true); // Use a slightly different voice or speed if possible
    
    setTimeout(() => setSpeechFeedback(null), 4000);
  };

  const startListening = () => {
    if (!recognitionRef.current) {
      alert("您的浏览器不支持语音识别，请使用 Chrome 浏览器。");
      return;
    }
    setSpeechFeedback(null);
    setIsListening(true);
    recognitionRef.current.start();
  };

  const playAudio = (text: string, isFeedback = false) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    if (isFeedback) {
      utterance.pitch = 1.2;
      utterance.rate = 0.9;
    }
    window.speechSynthesis.speak(utterance);
  };

  // Dictation Logic
  const startDictation = () => {
    const unmastered = words.filter(w => !w.mastered);
    if (unmastered.length === 0) return;
    setIsDictating(true);
    setDictationIndex(0);
    setScore(0);
    setDictationInput("");
    setDictationResult(null);
  };

  const checkDictation = () => {
    const currentWord = words.filter(w => !w.mastered)[dictationIndex];
    if (dictationInput.trim().toLowerCase() === currentWord.word.toLowerCase()) {
      setDictationResult("correct");
      setScore(prev => prev + 1);
      // Auto mastered if correct in dictation? Maybe not, let user decide.
    } else {
      setDictationResult("wrong");
    }

    setTimeout(() => {
      const nextIndex = dictationIndex + 1;
      const unmastered = words.filter(w => !w.mastered);
      if (nextIndex < unmastered.length) {
        setDictationIndex(nextIndex);
        setDictationInput("");
        setDictationResult(null);
      } else {
        setIsDictating(false);
      }
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/30 overflow-x-hidden">
      {/* Space Background Elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-900/20 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-900/20 blur-[120px] rounded-full animate-pulse" style={{ animationDelay: '2s' }} />
        <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] bg-cyan-900/10 blur-[100px] rounded-full" />
        
        {/* Animated Planets */}
        <motion.div 
          animate={{ y: [0, -20, 0], rotate: 360 }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute top-[15%] left-[15%] w-24 h-24 rounded-full bg-gradient-to-tr from-blue-600 to-cyan-400 opacity-20 blur-sm"
        />
        <motion.div 
          animate={{ y: [0, 30, 0], rotate: -360 }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-[20%] right-[25%] w-32 h-32 rounded-full bg-gradient-to-tr from-purple-600 to-pink-400 opacity-10 blur-sm"
        />

        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-30" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-background/40 backdrop-blur-xl">
        <div className="container mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-indigo-600 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(56,189,248,0.4)]">
              <Rocket size={24} className="text-primary-foreground animate-pulse" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-white via-blue-100 to-blue-300">
                星际词典
              </h1>
              <p className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold">LexiFlow Space</p>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="hidden md:flex flex-col items-end gap-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-muted-foreground">探索进度</span>
                <span className="text-xs font-mono text-primary">{Math.round(progressValue)}%</span>
              </div>
              <Progress value={progressValue} className="w-32 h-1.5 bg-white/5" />
            </div>
            <div className="relative w-48 hidden lg:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
              <Input 
                placeholder="搜索星系..." 
                className="pl-9 bg-white/5 border-white/5 focus-visible:ring-primary/50 h-9 text-sm rounded-full"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-7xl relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Mission Control */}
          <div className="lg:col-span-4 space-y-6">
            <Card className="border-white/5 bg-white/5 backdrop-blur-md shadow-2xl overflow-hidden">
              <CardHeader className="pb-4 border-b border-white/5">
                <CardTitle className="text-base flex items-center gap-2 text-primary">
                  <Zap size={18} />
                  发射中心
                </CardTitle>
                <CardDescription className="text-muted-foreground">输入单词或拍照识别</CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="flex gap-2">
                  <Input 
                    placeholder="输入新单词..." 
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddWords()}
                    disabled={isLoading}
                    className="bg-white/5 border-white/5 focus-visible:ring-primary/50"
                  />
                  <Button 
                    onClick={() => handleAddWords()} 
                    disabled={isLoading || !inputValue.trim()}
                    className="bg-primary hover:bg-primary/80 text-primary-foreground font-bold shadow-[0_0_15px_rgba(56,189,248,0.3)]"
                  >
                    {isLoading ? <Loader2 className="animate-spin" size={18} /> : "解析"}
                  </Button>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <Button 
                    variant="outline" 
                    className="border-white/5 bg-white/5 hover:bg-white/10 text-xs h-10"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isLoading}
                  >
                    <Camera size={16} className="mr-2 text-primary" />
                    拍照识词
                  </Button>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*" 
                    onChange={handleFileUpload}
                  />
                  <Button 
                    variant="outline" 
                    className="border-white/5 bg-white/5 hover:bg-white/10 text-xs h-10"
                    onClick={startDictation}
                    disabled={words.filter(w => !w.mastered).length === 0}
                  >
                    <Keyboard size={16} className="mr-2 text-accent" />
                    手动听写
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-4 bg-white/5 border border-white/5 p-1 rounded-xl">
                <TabsTrigger value="list" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg transition-all font-bold">
                  <Orbit size={16} className="mr-2" /> 星图
                </TabsTrigger>
                <TabsTrigger value="training" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white rounded-lg transition-all font-bold">
                  <Zap size={16} className="mr-2" /> 训练
                </TabsTrigger>
                <TabsTrigger value="mastered" className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground rounded-lg transition-all font-bold">
                  <Trophy size={16} className="mr-2" /> 勋章
                </TabsTrigger>
              </TabsList>

              <TabsContent value="list" className="mt-0">
                <Card className="border-white/5 bg-white/5 backdrop-blur-md">
                  <ScrollArea className="h-[calc(100vh-480px)] min-h-[400px] px-4">
                    <div className="py-4 space-y-2">
                      {filteredWords.filter(w => !w.mastered).length === 0 ? (
                        <div className="text-center py-20 text-muted-foreground space-y-4">
                          <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto">
                            <Star size={32} className="text-white/10" />
                          </div>
                          <p className="text-sm">所有星球已探索完毕</p>
                        </div>
                      ) : (
                        filteredWords.filter(w => !w.mastered).map((w) => (
                          <motion.div
                            key={w.word}
                            layout
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className={cn(
                              "group flex items-center justify-between p-4 rounded-2xl cursor-pointer transition-all border border-white/5 relative overflow-hidden",
                              selectedWord?.word === w.word 
                                ? "bg-primary/10 border-primary/30 shadow-[0_0_20px_rgba(56,189,248,0.1)]" 
                                : "hover:bg-white/5"
                            )}
                            onClick={() => setSelectedWord(w)}
                          >
                            <div className="absolute bottom-0 left-0 h-0.5 bg-primary/30" style={{ width: `${(w.level / 7) * 100}%` }} />
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-base tracking-tight">{w.word}</span>
                                <Badge variant="outline" className="text-[10px] h-4 px-1 border-primary/20 text-primary/70">Lv.{w.level}</Badge>
                              </div>
                              <span className="text-xs text-muted-foreground">{w.translation}</span>
                            </div>
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-primary hover:bg-primary/20"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleMastery(w.word);
                                }}
                              >
                                <CheckCircle2 size={16} />
                              </Button>
                            </div>
                          </motion.div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </Card>
              </TabsContent>

              <TabsContent value="training" className="mt-0">
                <Card className="border-white/5 bg-white/5 backdrop-blur-md p-4 space-y-6">
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-primary flex items-center gap-2">
                      <Zap size={14} /> 记忆流量池
                    </h3>
                    <div className="grid grid-cols-2 gap-4 h-40">
                      <div className="bg-white/5 rounded-xl p-3 border border-white/5 flex flex-col">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">待学习</span>
                        <div className="flex-1 flex flex-wrap gap-1 content-start overflow-hidden">
                          {words.filter(w => w.level === 0).slice(0, 12).map(w => (
                            <div key={w.word} className="w-2 h-2 rounded-full bg-primary/40 animate-pulse" />
                          ))}
                          {words.filter(w => w.level === 0).length > 12 && <span className="text-[8px] text-muted-foreground">...</span>}
                        </div>
                        <span className="text-xs font-mono text-primary mt-auto">{words.filter(w => w.level === 0).length}</span>
                      </div>
                      <div className="bg-white/5 rounded-xl p-3 border border-white/5 flex flex-col">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">掌握中</span>
                        <div className="flex-1 flex flex-wrap gap-1 content-start overflow-hidden">
                          {words.filter(w => w.level > 0 && w.level < 7).slice(0, 12).map(w => (
                            <div key={w.word} className="w-2 h-2 rounded-full bg-accent/40" />
                          ))}
                        </div>
                        <span className="text-xs font-mono text-accent mt-auto">{words.filter(w => w.level > 0 && w.level < 7).length}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-white/5">
                    <Button 
                      className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold h-12 rounded-xl shadow-[0_0_20px_rgba(37,99,235,0.3)]"
                      onClick={startPractice}
                      disabled={words.filter(w => !w.mastered).length < 2}
                    >
                      开启匹配练习
                    </Button>
                    <p className="text-[10px] text-center text-muted-foreground mt-2">
                      匹配练习将帮助你巩固记忆，提升掌握等级
                    </p>
                  </div>
                </Card>
              </TabsContent>

              <TabsContent value="mastered" className="mt-0">
                <Card className="border-white/5 bg-white/5 backdrop-blur-md">
                  <ScrollArea className="h-[calc(100vh-480px)] min-h-[400px] px-4">
                    <div className="py-4 space-y-2">
                      {words.filter(w => w.mastered).length === 0 ? (
                        <div className="text-center py-20 text-muted-foreground">
                          <p className="text-sm">还没有获得任何勋章</p>
                        </div>
                      ) : (
                        words.filter(w => w.mastered).map((w) => (
                          <div
                            key={w.word}
                            className="flex items-center justify-between p-4 rounded-2xl bg-accent/10 border border-accent/20"
                          >
                            <div className="flex flex-col gap-1">
                              <span className="font-bold text-base line-through text-muted-foreground">{w.word}</span>
                              <span className="text-xs text-accent font-bold">已掌握</span>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-muted-foreground hover:text-white"
                              onClick={() => toggleMastery(w.word)}
                            >
                              <History size={16} />
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Right Column: Exploration Deck */}
          <div className="lg:col-span-8">
            <AnimatePresence mode="wait">
              {isPracticing && practicePair ? (
                <motion.div
                  key="practice"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="h-full min-h-[600px]"
                >
                  <Card className="h-full border-white/5 bg-white/5 backdrop-blur-xl flex flex-col items-center justify-center p-12 space-y-12 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent" />
                    
                    <div className="text-center space-y-4">
                      <div className="flex items-center justify-center gap-2">
                        <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">匹配练习</Badge>
                        {practiceStreak > 1 && (
                          <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 animate-bounce">
                            {practiceStreak} 连击 🔥
                          </Badge>
                        )}
                      </div>
                      <h2 className="text-6xl font-black tracking-tighter text-white">{practicePair.word}</h2>
                      <p className="text-muted-foreground">选择正确的翻译以获得积分</p>
                    </div>

                    <div className="grid grid-cols-1 gap-4 w-full max-w-md">
                      {practicePair.options.map((option) => (
                        <Button
                          key={option}
                          variant="outline"
                          className={cn(
                            "h-20 text-xl font-bold rounded-2xl border-white/10 bg-white/5 hover:bg-white/10 transition-all",
                            practiceFeedback === "correct" && option === practicePair.answer && "border-green-500 bg-green-500/20 text-green-400",
                            practiceFeedback === "wrong" && option !== practicePair.answer && "border-red-500 bg-red-500/20 text-red-400"
                          )}
                          onClick={() => handlePracticeAnswer(option)}
                          disabled={!!practiceFeedback}
                        >
                          {option}
                        </Button>
                      ))}
                    </div>

                    <div className="flex flex-col items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Trophy size={16} className="text-yellow-500" />
                        <span className="font-mono text-xl font-bold text-white">{score}</span>
                      </div>
                      <Button 
                        variant="ghost" 
                        className="text-muted-foreground hover:text-white"
                        onClick={() => setIsPracticing(false)}
                      >
                        结束练习
                      </Button>
                    </div>

                    {/* Fun Feedback Messages */}
                    <AnimatePresence>
                      {practiceFeedback === "correct" && (
                        <motion.div
                          initial={{ opacity: 0, y: 20, scale: 0.5 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, scale: 1.5 }}
                          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                        >
                          <div className="text-6xl font-black text-green-400 drop-shadow-[0_0_20px_rgba(74,222,128,0.5)]">
                            {["太棒了!", "星际能量+50", "完美匹配!", "继续保持!"][Math.floor(Math.random() * 4)]}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Card>
                </motion.div>
              ) : isDictating ? (
                <motion.div
                  key="dictation"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="h-full min-h-[600px]"
                >
                  <Card className="h-full border-white/5 bg-white/5 backdrop-blur-xl flex flex-col items-center justify-center p-12 space-y-8 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-accent to-transparent" />
                    
                    <div className="text-center space-y-2">
                      <Badge className="bg-accent/20 text-accent border-accent/30">听写挑战中</Badge>
                      <h2 className="text-4xl font-black">听音辨词</h2>
                      <p className="text-muted-foreground">得分: <span className="text-accent font-mono">{score}</span></p>
                    </div>

                    <div className="w-32 h-32 bg-accent/20 rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(99,102,241,0.2)] border border-accent/30">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="w-full h-full rounded-full hover:bg-accent/10"
                        onClick={() => playAudio(words.filter(w => !w.mastered)[dictationIndex].word)}
                      >
                        <Volume2 size={48} className="text-accent" />
                      </Button>
                    </div>

                    <div className="w-full max-w-md space-y-4">
                      <div className="relative">
                        <Input 
                          placeholder="在这里输入你听到的单词..." 
                          className={cn(
                            "h-16 text-2xl text-center font-bold bg-white/5 border-white/5 rounded-2xl transition-all",
                            dictationResult === "correct" && "border-green-500 bg-green-500/10",
                            dictationResult === "wrong" && "border-red-500 bg-red-500/10"
                          )}
                          value={dictationInput}
                          onChange={(e) => setDictationInput(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && checkDictation()}
                          autoFocus
                        />
                        <AnimatePresence>
                          {dictationResult && (
                            <motion.div 
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="absolute -bottom-8 left-0 w-full text-center"
                            >
                              {dictationResult === "correct" ? (
                                <span className="text-green-400 font-bold flex items-center justify-center gap-1">
                                  <CheckCircle2 size={16} /> 太棒了！完全正确
                                </span>
                              ) : (
                                <span className="text-red-400 font-bold flex items-center justify-center gap-1">
                                  <XCircle size={16} /> 加油，再试一次
                                </span>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                      <Button 
                        className="w-full h-12 bg-accent hover:bg-accent/80 text-accent-foreground font-bold rounded-xl"
                        onClick={checkDictation}
                      >
                        确认提交
                      </Button>
                      <Button 
                        variant="ghost" 
                        className="w-full text-muted-foreground hover:text-white"
                        onClick={() => setIsDictating(false)}
                      >
                        退出挑战
                      </Button>
                    </div>
                  </Card>
                </motion.div>
              ) : selectedWord ? (
                <motion.div
                  key={selectedWord.word}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="h-full"
                >
                  <Card className="border-white/5 bg-white/5 backdrop-blur-xl overflow-hidden shadow-2xl min-h-[600px] flex flex-col">
                    <div className="h-1.5 bg-gradient-to-r from-primary via-blue-500 to-accent w-full" />
                    
                    <div className="p-10 flex-1 space-y-12">
                      <div className="flex items-start justify-between">
                        <div className="space-y-4">
                          <div className="flex items-center gap-3">
                            <h2 className="text-7xl font-black tracking-tighter text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">
                              {selectedWord.word}
                            </h2>
                            <div className="flex gap-2">
                              <Button 
                                variant="secondary" 
                                size="icon" 
                                className="h-12 w-12 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5"
                                onClick={() => playAudio(selectedWord.word)}
                              >
                                <Volume2 size={24} className="text-primary" />
                              </Button>
                              <Button 
                                variant="secondary" 
                                size="icon" 
                                className={cn(
                                  "h-12 w-12 rounded-2xl border border-white/5 transition-all",
                                  isListening ? "bg-red-500/20 text-red-400 animate-pulse" : "bg-white/5 hover:bg-white/10 text-accent"
                                )}
                                onClick={startListening}
                                disabled={isListening}
                              >
                                {isListening ? <MicOff size={24} /> : <Mic size={24} />}
                              </Button>
                            </div>
                          </div>
                          
                          <AnimatePresence>
                            {speechFeedback && (
                              <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                className="bg-white/5 border border-white/10 p-4 rounded-2xl flex items-center gap-4"
                              >
                                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-lg">
                                  {speechFeedback.score}
                                </div>
                                <p className="text-sm font-bold text-blue-200">{speechFeedback.message}</p>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          <div className="flex items-center gap-4">
                            <span className="font-mono text-xl text-muted-foreground bg-white/5 px-3 py-1 rounded-lg border border-white/5">
                              {selectedWord.phonetic}
                            </span>
                            <Badge className="bg-primary/20 text-primary border-primary/30 px-4 py-1.5 text-base font-bold">
                              {selectedWord.translation}
                            </Badge>
                          </div>
                        </div>
                        
                        <div className="flex flex-col items-end gap-2">
                          <Button
                            onClick={() => toggleMastery(selectedWord.word)}
                            className={cn(
                              "h-14 px-8 rounded-2xl font-black text-lg transition-all shadow-lg",
                              selectedWord.mastered 
                                ? "bg-accent hover:bg-accent/80 text-accent-foreground" 
                                : "bg-white text-black hover:bg-gray-200"
                            )}
                          >
                            {selectedWord.mastered ? (
                              <><Trophy className="mr-2" /> 已掌握</>
                            ) : (
                              <><CheckCircle2 className="mr-2" /> 标记掌握</>
                            )}
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-red-400 hover:text-red-300 hover:bg-red-400/10"
                            onClick={() => removeWord(selectedWord.word)}
                          >
                            <Trash2 size={14} className="mr-2" /> 移除此单词
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <section className="space-y-4 p-6 rounded-3xl bg-white/5 border border-white/5">
                          <h4 className="text-xs font-black uppercase tracking-[0.2em] text-primary flex items-center gap-2">
                            <div className="w-1.5 h-1.5 bg-primary rounded-full shadow-[0_0_8px_rgba(56,189,248,0.8)]" />
                            星际释义
                          </h4>
                          <p className="text-xl leading-relaxed text-gray-200 font-medium">
                            {selectedWord.definition}
                          </p>
                        </section>

                        <section className="space-y-4 p-6 rounded-3xl bg-white/5 border border-white/5">
                          <h4 className="text-xs font-black uppercase tracking-[0.2em] text-accent flex items-center gap-2">
                            <div className="w-1.5 h-1.5 bg-accent rounded-full shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
                            例句航线
                          </h4>
                          <div className="space-y-4">
                            <p className="text-xl italic leading-relaxed text-gray-300">
                              "{selectedWord.example}"
                            </p>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-xs text-muted-foreground hover:text-white p-0"
                              onClick={() => playAudio(selectedWord.example)}
                            >
                              <Volume2 size={14} className="mr-2" /> 播放例句读音
                            </Button>
                          </div>
                        </section>
                      </div>
                    </div>

                    <div className="p-8 border-t border-white/5 bg-black/20 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex -space-x-2">
                          {[1,2,3].map(i => (
                            <div key={i} className="w-8 h-8 rounded-full border-2 border-black bg-gray-800 flex items-center justify-center overflow-hidden">
                              <img src={`https://picsum.photos/seed/avatar${i}/32/32`} alt="user" referrerPolicy="no-referrer" />
                            </div>
                          ))}
                        </div>
                        <span className="text-xs text-muted-foreground font-bold">已有 1,240 名宇航员掌握了此词</span>
                      </div>
                      <p className="text-[10px] text-gray-600 font-mono uppercase tracking-widest">
                        AI Orbital Engine v2.0
                      </p>
                    </div>
                  </Card>
                </motion.div>
              ) : (
                <div className="h-full min-h-[600px] flex flex-col items-center justify-center text-center space-y-6 bg-white/5 rounded-[40px] border-2 border-dashed border-white/5 p-12 backdrop-blur-sm">
                  <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center text-primary shadow-[0_0_50px_rgba(56,189,248,0.1)] border border-primary/20">
                    <Orbit size={48} className="animate-spin-slow" />
                  </div>
                  <div className="space-y-3 max-w-sm">
                    <h3 className="text-2xl font-black">准备好探索了吗？</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      从左侧星图中选择一个单词开始探索，或者使用拍照功能快速识别课本上的单词。
                    </p>
                  </div>
                  <Button 
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-white text-black font-black px-8 h-12 rounded-2xl hover:bg-gray-200"
                  >
                    立即开启探索
                  </Button>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>

      {/* Space Footer */}
      <footer className="py-20 border-t border-white/5 bg-black/40 mt-20 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        <div className="container mx-auto px-4 text-center space-y-8">
          <div className="flex items-center justify-center gap-3">
            <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center border border-white/5">
              <Rocket size={28} className="text-primary" />
            </div>
            <div className="text-left">
              <span className="block text-xl font-black tracking-tight">星际词典</span>
              <span className="block text-[10px] text-primary font-bold tracking-widest uppercase">LexiFlow Space</span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground max-w-lg mx-auto leading-relaxed">
            专为小小宇航员设计的单词探索站。通过 AI 视觉识别与智能听写，让每一个单词都成为你通往星辰大海的阶梯。
          </p>
          <div className="flex items-center justify-center gap-8 pt-4">
            {["家长中心", "学习报告", "隐私协议", "联系指挥部"].map(link => (
              <a key={link} href="#" className="text-xs font-bold text-muted-foreground hover:text-primary transition-colors">{link}</a>
            ))}
          </div>
          <div className="pt-8 text-[10px] font-mono text-gray-700 uppercase tracking-[0.4em]">
            &copy; 2026 LexiFlow Space Mission Control
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 12s linear infinite;
        }
      `}</style>
    </div>
  );
}

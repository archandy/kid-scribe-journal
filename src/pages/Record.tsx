import { useState, useRef, useEffect } from "react";
import { Mic, Square, Loader2, Settings as SettingsIcon, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import ReviewSheet from "@/components/ReviewSheet";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import LanguageSelector from "@/components/LanguageSelector";

const Record = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [stepAnswers, setStepAnswers] = useState<string[]>(["", "", ""]);
  const [currentTranscript, setCurrentTranscript] = useState("");
  const [showReview, setShowReview] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  
  const navigate = useNavigate();
  const { language, t } = useLanguage();

  const PROMPTS = [
    t('record.prompt1'),
    t('record.prompt2'),
    t('record.prompt3')
  ];

  const getLanguageCode = () => {
    const languageMap: Record<string, string> = {
      'en': 'en-US',
      'ja': 'ja-JP',
      'ko': 'ko-KR'
    };
    return languageMap[language] || 'en-US';
  };
  
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    // Check authentication
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/auth');
      } else {
        setIsCheckingAuth(false);
      }
    };
    
    checkAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate('/auth');
      }
    });

    return () => {
      subscription.unsubscribe();
      if (timerRef.current) clearInterval(timerRef.current);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (recognitionRef.current) recognitionRef.current.stop();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, [navigate]);

  const startRecording = async () => {
    try {
      // Check for Web Speech API support
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      
      if (!SpeechRecognition) {
        toast.error("Speech recognition is not supported in your browser. Please use Chrome, Edge, or Safari.");
        return;
      }

      // Get microphone for visualization
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      streamRef.current = stream;

      // Set up audio visualization
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Set up speech recognition
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = getLanguageCode();

      let finalTranscript = '';

      recognition.onresult = (event: any) => {
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcriptPiece = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcriptPiece + ' ';
          } else {
            interimTranscript += transcriptPiece;
          }
        }

        setCurrentTranscript(finalTranscript + interimTranscript);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'no-speech') {
          toast.error("No speech detected. Please try speaking.");
        } else if (event.error === 'not-allowed') {
          toast.error("Microphone access denied. Please check permissions.");
        } else {
          toast.error("Error during speech recognition.");
        }
      };

      recognition.onend = () => {
        // Clean up microphone stream and audio context
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
        if (audioContextRef.current) {
          audioContextRef.current.close();
          audioContextRef.current = null;
        }
        
        if (finalTranscript.trim()) {
          const trimmedTranscript = finalTranscript.trim();
          setCurrentTranscript(trimmedTranscript);
          
          // Save answer for current step
          const newAnswers = [...stepAnswers];
          newAnswers[currentStep] = trimmedTranscript;
          setStepAnswers(newAnswers);
          
          // Move to next step or show review
          if (currentStep < 2) {
            setTimeout(() => {
              setCurrentStep(currentStep + 1);
              setCurrentTranscript("");
            }, 1000);
          } else {
            setShowReview(true);
          }
        } else {
          toast.error("No speech was detected. Please try again.");
          setCurrentTranscript('');
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
      
      setIsRecording(true);
      setRecordingTime(0);
      setCurrentTranscript('');
      
      // Start timer
      timerRef.current = window.setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      // Start visualization
      visualize();

      toast.success(`Recording Step ${currentStep + 1} - ${PROMPTS[currentStep]}`);
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error("Could not access microphone. Please check permissions.");
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current && isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }

      // Clean up media stream immediately
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      // Close audio context immediately
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }

      toast.success("Processing your answer...");
    }
  };

  const resetSteps = () => {
    setCurrentStep(0);
    setStepAnswers(["", "", ""]);
    setCurrentTranscript("");
    setShowReview(false);
    setRecordingTime(0);
  };

  const visualize = () => {
    if (!analyserRef.current || !canvasRef.current) return;
    
    const analyser = analyserRef.current;
    const canvas = canvasRef.current;
    const canvasCtx = canvas.getContext("2d");
    if (!canvasCtx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      canvasCtx.fillStyle = "hsl(var(--background))";
      canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = (dataArray[i] / 255) * canvas.height * 0.8;
        
        const gradient = canvasCtx.createLinearGradient(0, canvas.height - barHeight, 0, canvas.height);
        gradient.addColorStop(0, "hsl(var(--accent))");
        gradient.addColorStop(1, "hsl(var(--accent-glow))");
        
        canvasCtx.fillStyle = gradient;
        canvasCtx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

        x += barWidth + 1;
      }
    };

    draw();
  };


  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      toast.success("Signed out successfully");
      navigate('/auth');
    } catch (error) {
      console.error("Sign out error:", error);
      toast.error("Failed to sign out");
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle flex flex-col">
      {/* Header */}
      <header className="p-4 border-b border-border bg-card/50 backdrop-blur-sm flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-hero bg-clip-text text-transparent">
            {t('app.title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('app.subtitle')}
          </p>
        </div>
        <div className="flex gap-2">
          <LanguageSelector />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/settings')}
            className="rounded-full"
          >
            <SettingsIcon className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSignOut}
            className="rounded-full"
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 space-y-8">
        {/* Step Progress */}
        <div className="flex items-center gap-2">
          {PROMPTS.map((_, index) => (
            <div
              key={index}
              className={cn(
                "h-2 w-12 rounded-full transition-all",
                index <= currentStep ? "bg-primary" : "bg-muted"
              )}
            />
          ))}
        </div>

        {/* Current Step Prompt */}
        <div className="text-center space-y-2">
          <p className="text-sm text-muted-foreground">{t('record.step')} {currentStep + 1} {t('record.of')} 3</p>
          <h2 className="text-3xl font-bold bg-gradient-hero bg-clip-text text-transparent">
            {PROMPTS[currentStep]}
          </h2>
        </div>

        {/* Waveform Canvas */}
        {isRecording && (
          <div className="w-full max-w-md animate-slide-up">
            <canvas
              ref={canvasRef}
              width={400}
              height={120}
              className="w-full h-32 rounded-lg shadow-medium"
            />
          </div>
        )}

        {/* Current Transcript */}
        {currentTranscript && (
          <div className="w-full max-w-md p-4 bg-card/50 backdrop-blur-sm rounded-lg border border-border">
            <p className="text-sm text-foreground">{currentTranscript}</p>
          </div>
        )}

        {/* Completed Steps Preview */}
        {currentStep > 0 && !isRecording && (
          <div className="w-full max-w-md space-y-2">
            {stepAnswers.slice(0, currentStep).map((answer, index) => (
              answer && (
                <div key={index} className="p-3 bg-card/30 rounded-lg border border-border/50">
                  <p className="text-xs text-muted-foreground mb-1">{PROMPTS[index]}</p>
                  <p className="text-sm text-foreground line-clamp-2">{answer}</p>
                </div>
              )
            ))}
          </div>
        )}

        {/* Record Button */}
        <div className="relative">
          {!isRecording ? (
            <Button
              size="lg"
              onClick={startRecording}
              className={cn(
                "h-24 w-24 rounded-full bg-gradient-accent shadow-accent-glow",
                "hover:shadow-accent-glow hover:scale-105",
                "transition-all duration-300"
              )}
            >
              <Mic className="h-10 w-10" />
            </Button>
          ) : (
            <Button
              size="lg"
              onClick={stopRecording}
              className={cn(
                "h-24 w-24 rounded-full bg-destructive shadow-strong",
                "animate-pulse-glow",
                "hover:scale-105 transition-transform"
              )}
            >
              <Square className="h-10 w-10" />
            </Button>
          )}
        </div>

        {!isRecording && currentStep < 3 && (
          <p className="text-sm text-muted-foreground text-center max-w-xs">
            {currentStep === 0 
              ? t('record.tapToStart')
              : t('record.tapToContinue')}
          </p>
        )}

        {/* Timer */}
        {isRecording && (
          <div className="text-center">
            <div className="text-2xl font-bold text-foreground">
              {formatTime(recordingTime)}
            </div>
          </div>
        )}
      </main>

      {/* Review Sheet */}
      {showReview && stepAnswers.every(a => a) && (
        <ReviewSheet
          open={showReview}
          onOpenChange={setShowReview}
          stepAnswers={stepAnswers}
          prompts={PROMPTS}
          duration={recordingTime}
          onSaved={() => {
            resetSteps();
          }}
        />
      )}
    </div>
  );
};

export default Record;

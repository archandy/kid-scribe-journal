import { useState, useRef, useEffect } from "react";
import { Mic, Square, Loader2, Settings as SettingsIcon, LogOut, BookOpen } from "lucide-react";
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
  const [stepAnswers, setStepAnswers] = useState<string[]>(["", ""]);
  const [currentTranscript, setCurrentTranscript] = useState("");
  const [showReview, setShowReview] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  
  const navigate = useNavigate();
  const { language, t } = useLanguage();

  const PROMPTS = [
    t('record.prompt1'),
    t('record.prompt2')
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

  // Detect mobile device
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

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
    console.log('=== START RECORDING CALLED ===');
    console.log('Current step:', currentStep);
    console.log('Is recording:', isRecording);
    console.log('Recognition ref exists:', !!recognitionRef.current);
    console.log('Stream ref exists:', !!streamRef.current);
    console.log('Audio context ref exists:', !!audioContextRef.current);
    
    try {
      // Clean up any existing recognition first
      if (recognitionRef.current) {
        try {
          console.log('Stopping existing recognition');
          recognitionRef.current.stop();
          recognitionRef.current = null;
        } catch (e) {
          console.log('Cleanup error:', e);
        }
      }

      // Clean up any existing streams/contexts before starting new recording
      if (streamRef.current) {
        console.log('Cleaning up existing stream');
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (audioContextRef.current) {
        console.log('Closing existing audio context');
        await audioContextRef.current.close();
        audioContextRef.current = null;
      }

      // Wait for cleanup to complete on mobile
      console.log('Waiting for cleanup...');
      await new Promise(resolve => setTimeout(resolve, 300));
      console.log('Cleanup complete');

      // Check for Web Speech API support
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      
      if (!SpeechRecognition) {
        toast.error("Speech recognition is not supported in your browser. Please use Chrome, Edge, or Safari.");
        return;
      }

      // Only set up visualization on desktop to avoid resource conflicts on mobile
      if (!isMobile) {
        console.log('Setting up audio visualization for desktop...');
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          } 
        });
        console.log('Microphone access granted for visualization');
        streamRef.current = stream;

        // Set up audio visualization
        const audioContext = new AudioContext();
        
        // Resume AudioContext if suspended (important for mobile compatibility)
        if (audioContext.state === 'suspended') {
          await audioContext.resume();
        }
        
        audioContextRef.current = audioContext;
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analyserRef.current = analyser;
      } else {
        console.log('Skipping visualization on mobile to avoid conflicts');
      }

      // Set up speech recognition
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognition.lang = getLanguageCode();
      
      console.log('Starting speech recognition with lang:', getLanguageCode());

      let finalTranscript = '';
      let lastInterimTranscript = '';

      recognition.onstart = () => {
        console.log('=== RECOGNITION STARTED ===');
      };

      recognition.onresult = (event: any) => {
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcriptPiece = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcriptPiece + ' ';
            console.log('Final transcript piece:', transcriptPiece);
          } else {
            interimTranscript += transcriptPiece;
            console.log('Interim transcript piece:', transcriptPiece);
          }
        }

        lastInterimTranscript = interimTranscript;
        const currentText = finalTranscript + interimTranscript;
        console.log('Current combined transcript:', currentText);
        setCurrentTranscript(currentText);
      };

      recognition.onerror = (event: any) => {
        console.error('=== SPEECH RECOGNITION ERROR ===');
        console.error('Error type:', event.error);
        console.error('Error message:', event.message);
        console.error('Is mobile:', isMobile);
        if (event.error === 'no-speech') {
          console.log('No speech detected - stopping recording');
          // Stop recording immediately
          setIsRecording(false);
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
            animationRef.current = null;
          }
          // Clean up resources
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
          }
          if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
          }
          // Stop recognition
          if (recognitionRef.current) {
            try {
              recognitionRef.current.stop();
            } catch (e) {
              console.log('Stop error:', e);
            }
            recognitionRef.current = null;
          }
          toast.error("No speech was detected. Please try again.");
          setCurrentTranscript('');
        } else if (event.error === 'not-allowed') {
          toast.error("Microphone access denied. Please check permissions.");
        } else if (event.error === 'aborted') {
          console.log('Recognition aborted - this is normal when stopping');
        } else {
          toast.error(`Error during speech recognition: ${event.error}`);
        }
      };

      recognition.onend = () => {
        console.log('=== RECOGNITION ENDED ===');
        console.log('Recognition ended - Final:', finalTranscript, 'Interim:', lastInterimTranscript);
        
        // Capture complete transcript including interim results FIRST
        const completeTranscript = (finalTranscript + lastInterimTranscript).trim();
        console.log('Complete transcript:', completeTranscript);
        
        // Save the transcript before any cleanup
        if (completeTranscript) {
          setCurrentTranscript(completeTranscript);
          
          // Save answer for current step
          const newAnswers = [...stepAnswers];
          newAnswers[currentStep] = completeTranscript;
          setStepAnswers(newAnswers);
        }
        
        // NOW clean up audio resources after capturing transcript
        setTimeout(() => {
          console.log('Cleaning up audio resources...');
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
          }
          if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
          }
          
          // Clear recognition reference to allow fresh start
          recognitionRef.current = null;
          console.log('Cleanup complete');
          
          // Move to next step or show review after cleanup
          if (completeTranscript) {
            if (currentStep < 1) {
              console.log('Moving to next step...');
              setTimeout(() => {
                setCurrentStep(currentStep + 1);
                setCurrentTranscript("");
              }, 500);
            } else {
              console.log('Showing review...');
              setShowReview(true);
            }
          } else {
            console.error('No transcript captured');
            // Stop recording and reset state
            setIsRecording(false);
            if (timerRef.current) {
              clearInterval(timerRef.current);
              timerRef.current = null;
            }
            toast.error("No speech was detected. Please try again.");
            setCurrentTranscript('');
          }
        }, 200); // Delay cleanup to ensure transcript is captured
      };

      recognitionRef.current = recognition;
      
      // Small delay to ensure mic is ready (especially important on mobile)
      await new Promise(resolve => setTimeout(resolve, 100));
      
      try {
        recognition.start();
        console.log('Recognition started successfully');
      } catch (error) {
        console.error('Failed to start recognition:', error);
        toast.error("Failed to start recording. Please try again.");
        return;
      }
      
      setIsRecording(true);
      setRecordingTime(0);
      setCurrentTranscript('');
      
      // Start timer
      timerRef.current = window.setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      // Start visualization (only on desktop)
      if (!isMobile) {
        visualize();
      }

      toast.success(`Recording Step ${currentStep + 1} - ${PROMPTS[currentStep]}`);
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error("Could not access microphone. Please check permissions.");
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current && isRecording) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.log('Stop recognition error:', e);
      }
      
      setIsRecording(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }

      // Don't clean up audio resources here - let recognition.onend handle it
      // This ensures transcript is captured before cleanup

      toast.success("Processing your answer...");
    }
  };

  const resetSteps = () => {
    setCurrentStep(0);
    setStepAnswers(["", ""]);
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
            onClick={() => navigate('/notes')}
            className="rounded-full"
          >
            <BookOpen className="h-5 w-5" />
          </Button>
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
          <p className="text-sm text-muted-foreground">{t('record.step')} {currentStep + 1} {t('record.of')} 2</p>
          <h2 className="text-3xl font-bold bg-gradient-hero bg-clip-text text-transparent">
            {PROMPTS[currentStep]}
          </h2>
        </div>

        {/* Waveform Canvas - only show on desktop */}
        {isRecording && !isMobile && (
          <div className="w-full max-w-md animate-slide-up">
            <canvas
              ref={canvasRef}
              width={400}
              height={120}
              className="w-full h-32 rounded-lg shadow-medium"
            />
          </div>
        )}
        
        {/* Recording indicator for mobile */}
        {isRecording && isMobile && (
          <div className="w-full max-w-md flex justify-center animate-slide-up">
            <div className="flex items-center gap-3 px-6 py-4 bg-card/50 backdrop-blur-sm rounded-full border border-border">
              <div className="h-3 w-3 rounded-full bg-destructive animate-pulse" />
              <span className="text-sm font-medium">Recording...</span>
            </div>
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

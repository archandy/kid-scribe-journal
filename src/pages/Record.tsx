import { useState, useRef, useEffect } from "react";
import { Mic, Square, Loader2, Settings as SettingsIcon, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import ReviewSheet from "@/components/ReviewSheet";
import NotesList from "@/components/NotesList";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const Record = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [showReview, setShowReview] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  
  const navigate = useNavigate();
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);

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
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl, navigate]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Check supported MIME types
      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
      ];
      
      let selectedMimeType = '';
      for (const type of mimeTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          selectedMimeType = type;
          break;
        }
      }

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: selectedMimeType || undefined,
      });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: selectedMimeType });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        
        stream.getTracks().forEach(track => track.stop());
        
        // Start transcription
        setIsTranscribing(true);
        setShowReview(true);
        
        try {
          await transcribeAudio(blob);
        } catch (error) {
          console.error("Transcription error:", error);
          toast.error("Failed to transcribe audio. You can still save it locally.");
          setIsTranscribing(false);
        }
      };

      // Set up audio visualization
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;
      
      visualize();

      mediaRecorder.start();
      setIsRecording(true);
      
      timerRef.current = window.setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      toast.success("Recording started");
    } catch (error) {
      console.error("Error starting recording:", error);
      toast.error("Failed to access microphone. Please check permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    }
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

  const transcribeAudio = async (blob: Blob) => {
    // Simulate transcription - will be replaced with real OpenAI Whisper API
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const sampleTranscript = "This is a simulated transcript. The audio was successfully recorded! To enable real transcription with OpenAI Whisper, you'll need to add an edge function that calls the Whisper API.";
      setTranscript(sampleTranscript);
    } catch (error) {
      console.error("Transcription error:", error);
      toast.error("Transcription failed");
    } finally {
      setIsTranscribing(false);
    }
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
            Kids Journal
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Capture moments, preserve memories
          </p>
        </div>
        <div className="flex gap-2">
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

        {/* Timer */}
        {isRecording && (
          <div className="text-center animate-slide-up">
            <div className="text-5xl font-bold text-foreground tracking-tight">
              {formatTime(recordingTime)}
            </div>
            <p className="text-sm text-muted-foreground mt-2">Recording in progress</p>
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

        {!isRecording && (
          <p className="text-sm text-muted-foreground text-center max-w-xs">
            Tap the microphone to start recording a voice note about your children
          </p>
        )}
      </main>

      {/* Notes List */}
      {!isRecording && !showReview && (
        <div className="p-6">
          <NotesList />
        </div>
      )}

      {/* Review Sheet */}
      {showReview && audioBlob && (
        <ReviewSheet
          open={showReview}
          onOpenChange={setShowReview}
          audioBlob={audioBlob}
          audioUrl={audioUrl}
          transcript={transcript}
          isTranscribing={isTranscribing}
          duration={recordingTime}
          onSaved={() => {
            setShowReview(false);
            setRecordingTime(0);
            setAudioBlob(null);
            setTranscript("");
            if (audioUrl) {
              URL.revokeObjectURL(audioUrl);
              setAudioUrl(null);
            }
          }}
        />
      )}
    </div>
  );
};

export default Record;

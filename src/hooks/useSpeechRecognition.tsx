import { useEffect, useState, useCallback, useRef } from 'react';

// Define types for our timestamped words
export interface TimestampedWord {
  word: string;
  timestamp: number;
  isFinal: boolean;
  source: 'mic' | 'speaker';  // Add this new field
}

interface UseSpeechRecognitionReturn {
  isRecording: boolean;
  transcription: TimestampedWord[];
  startRecording: () => void;
  stopRecording: () => void;
  clearTranscription: () => void;
  error: string | null;
  isSupported: boolean;
  audioBlob: Blob | null;
  exportTranscript: () => void;
  exportAudio: () => void;
}

export const useSpeechRecognition = (): UseSpeechRecognitionReturn => {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [transcription, setTranscription] = useState<TimestampedWord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState<boolean>(true);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const startTimeRef = useRef<number>(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const restartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize speech recognition
  useEffect(() => {
    // Check if the browser supports SpeechRecognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setIsSupported(false);
      setError('Speech recognition is not supported in this browser.');
      return;
    }
    
    // Create recognition instance
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = true;
    recognitionRef.current.lang = 'en-US';
    
    // Set up event handlers
    recognitionRef.current.onstart = () => {
      console.log('Speech recognition started');
      setIsRecording(true);
      startTimeRef.current = Date.now();
      setError(null);
    };
    
    recognitionRef.current.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error);
      setError(`Error: ${event.error}`);
      
      // Try to restart if recording was intended to continue
      if (isRecording && event.error !== 'not-allowed') {
        if (restartTimeoutRef.current) {
          clearTimeout(restartTimeoutRef.current);
        }
        
        restartTimeoutRef.current = setTimeout(() => {
          if (isRecording && recognitionRef.current) {
            try {
              console.log('Attempting to restart speech recognition after error');
              recognitionRef.current.start();
            } catch (e) {
              console.error('Failed to restart recognition after error:', e);
            }
          }
        }, 1000);
      }
    };
    
    recognitionRef.current.onend = () => {
      console.log('Speech recognition ended');
      
      // Try to restart if recording was intended to continue
      if (isRecording && recognitionRef.current) {
        if (restartTimeoutRef.current) {
          clearTimeout(restartTimeoutRef.current);
        }
        
        restartTimeoutRef.current = setTimeout(() => {
          if (isRecording && recognitionRef.current) {
            try {
              console.log('Attempting to restart speech recognition after end');
              recognitionRef.current.start();
            } catch (e) {
              console.error('Failed to restart recognition after end:', e);
              setIsRecording(false);
            }
          }
        }, 300); // Shorter timeout for normal end events
      }
    };
    
    recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
      const currentTranscript = Array.from(event.results)
        .slice(-1)[0][0].transcript;

      const words = currentTranscript.trim().split(' ');
      const relativeStartTime = event.timeStamp - startTimeRef.current;
      
      // Fix: Define wordCount before using it
      const wordCount = words.length;
      
      // For demo purposes, alternate between mic and speaker
      // In a real implementation, this would need actual audio source detection
      const wordsWithTimestamps = words.map((word: string, index: number) => {
        const timestamp = relativeStartTime + (index / wordCount) * (Date.now() - startTimeRef.current - relativeStartTime);
        
        // Fix: Ensure source is explicitly typed as 'mic' | 'speaker'
        const source: 'mic' | 'speaker' = index % 2 === 0 ? 'mic' : 'speaker'; // Simulate alternating sources
        
        return {
          word,
          timestamp,
          isFinal: event.results[event.resultIndex].isFinal,
          source
        };
      });
      
      setTranscription(prevTranscription => {
        const finalResults = prevTranscription.filter(item => item.isFinal);
        if (event.results[event.resultIndex].isFinal) {
          return [...finalResults, ...wordsWithTimestamps];
        }
        return [...finalResults, ...wordsWithTimestamps];
      });
    };
    
    // Register service worker for background operation
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js')
        .then(registration => {
          console.log('ServiceWorker registration successful with scope: ', registration.scope);
        })
        .catch(err => {
          console.error('ServiceWorker registration failed: ', err);
        });
    }
    
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          console.error('Error stopping recognition on cleanup:', e);
        }
      }
      
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
      }
    };
  }, []);
  
  // Keep service worker alive with periodic messages
  useEffect(() => {
    let keepAliveInterval: ReturnType<typeof setInterval> | null = null;
    
    if (isRecording && 'serviceWorker' in navigator) {
      keepAliveInterval = setInterval(() => {
        navigator.serviceWorker.ready.then(registration => {
          registration.active?.postMessage({ type: 'PING' });
        });
      }, 25000); // Every 25 seconds
    }
    
    return () => {
      if (keepAliveInterval) clearInterval(keepAliveInterval);
    };
  }, [isRecording]);
  
  // Set up audio recording
  useEffect(() => {
    const setupMediaRecorder = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        mediaRecorderRef.current = new MediaRecorder(stream);
        
        mediaRecorderRef.current.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };
        
        mediaRecorderRef.current.onstop = () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          setAudioBlob(audioBlob);
        };
        
      } catch (err) {
        console.error("Error accessing microphone:", err);
        setError(`Microphone access error: ${err instanceof Error ? err.message : String(err)}`);
      }
    };
    
    setupMediaRecorder();
    
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);
  
  const startRecording = useCallback(() => {
    setError(null);
    audioChunksRef.current = []; // Clear previous audio chunks
    
    // Start speech recognition
    if (!recognitionRef.current) {
      setError('Speech recognition is not initialized.');
      return;
    }
    
    try {
      recognitionRef.current.start();
      startTimeRef.current = Date.now();
      
      // Start audio recording
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'inactive') {
        mediaRecorderRef.current.start(1000); // Collect data every second
      }
    } catch (err) {
      console.error('Error starting recording:', err);
      setError('Failed to start recording.');
    }
  }, []);
  
  const stopRecording = useCallback(() => {
    // Stop speech recognition
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (err) {
        console.error('Error stopping speech recognition:', err);
      }
    }
    
    // Stop audio recording
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    
    // Clear restart timeout
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }
    
    setIsRecording(false);
  }, []);
  
  const clearTranscription = useCallback(() => {
    setTranscription([]);
    setAudioBlob(null);
    audioChunksRef.current = [];
  }, []);
  
  const formatTranscriptText = useCallback(() => {
    // Group words by time
    const sortedWords = [...transcription].sort((a, b) => a.timestamp - b.timestamp);
    
    // Format as text with timestamps
    return sortedWords.map(item => 
      `[${formatTimestamp(item.timestamp)}] ${item.word}`
    ).join(' ');
  }, [transcription]);
  
  const formatTimestamp = (timestamp: number): string => {
    const totalSeconds = Math.floor(timestamp / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const milliseconds = Math.floor((timestamp % 1000) / 10);
    
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
  };
  
  const exportTranscript = useCallback(() => {
    const text = formatTranscriptText();
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcript-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [formatTranscriptText]);
  
  const exportAudio = useCallback(() => {
    if (!audioBlob) {
      setError('No audio recording available to export.');
      return;
    }
    
    const url = URL.createObjectURL(audioBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recording-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [audioBlob]);
  
  return {
    isRecording,
    transcription,
    startRecording,
    stopRecording,
    clearTranscription,
    error,
    isSupported,
    audioBlob,
    exportTranscript,
    exportAudio,
  };
};

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mic, Square, Trash2, FileText } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { TimestampedWord } from '@/hooks/useSpeechRecognition';

interface MeetingTranscriptionProps {
  isActive: boolean;
}

export interface MeetingTranscriptItem {
  word: string;
  timestamp: number;
  isFinal: boolean;
  source: 'mic' | 'speaker';
}

const MeetingTranscription: React.FC<MeetingTranscriptionProps> = ({ isActive }) => {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [transcription, setTranscription] = useState<MeetingTranscriptItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const startTimeRef = useRef<number>(0);
  
  // Initialize speech recognition
  useEffect(() => {
    // Check if the browser supports SpeechRecognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
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
      console.log('Meeting transcription started');
      setIsRecording(true);
      startTimeRef.current = Date.now();
      setError(null);
    };
    
    recognitionRef.current.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'no-speech') {
        // This is a common error, don't show it to the user
        return;
      }
      setError(`Error: ${event.error}`);
    };
    
    recognitionRef.current.onend = () => {
      console.log('Speech recognition ended');
      
      // If we're still supposed to be recording, restart
      if (isRecording) {
        console.log('Restarting speech recognition...');
        try {
          recognitionRef.current?.start();
        } catch (err) {
          console.error('Error restarting speech recognition:', err);
        }
      } else {
        setIsRecording(false);
      }
    };
    
    recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
      const currentTranscript = Array.from(event.results)
        .slice(-1)[0][0].transcript;

      const words = currentTranscript.trim().split(' ');
      const relativeStartTime = event.timeStamp - startTimeRef.current;
      
      const wordCount = words.length;
      
      // For demo purposes, we're using 'mic' as the source
      // In a real implementation, you'd detect the audio source
      const wordsWithTimestamps = words.map((word: string, index: number) => {
        const timestamp = relativeStartTime + (index / wordCount) * (Date.now() - startTimeRef.current - relativeStartTime);
        
        // Source is 'mic' since this is from the local user
        const source: 'mic' | 'speaker' = 'mic';
        
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
    
    return () => {
      // Clean up
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (err) {
          // Ignore errors on cleanup
        }
      }
    };
  }, [isRecording]);
  
  // Start/stop recording based on isActive prop
  useEffect(() => {
    if (isActive && !isRecording && recognitionRef.current) {
      try {
        recognitionRef.current.start();
        startTimeRef.current = Date.now();
        
        // Simulate remote participant speech for testing
        simulateRemoteSpeech();
      } catch (err) {
        console.error('Error starting meeting transcription:', err);
        setError('Failed to start transcription.');
      }
    } else if (!isActive && isRecording && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
        setIsRecording(false);
      } catch (err) {
        console.error('Error stopping meeting transcription:', err);
      }
    }
  }, [isActive, isRecording]);
  
  // Simulate remote participant speech
  const simulateRemoteSpeech = () => {
    const remotePhrases = [
      "Hello, can you hear me?",
      "I think we should consider the second option.",
      "What do others think about this approach?",
      "Let me share my screen to demonstrate.",
      "That's a good point, I agree with that."
    ];
    
    // Add random phrases from "speaker" at random intervals
    let count = 0;
    const addRemoteSpeech = () => {
      if (count < 5 && isRecording) {
        const phrase = remotePhrases[count];
        const words = phrase.split(' ');
        
        const timestamp = Date.now() - startTimeRef.current;
        
        // Add each word with a small delay
        words.forEach((word, index) => {
          setTimeout(() => {
            setTranscription(prev => [
              ...prev, 
              {
                word,
                timestamp: timestamp + index * 300, // 300ms between words
                isFinal: true,
                source: 'speaker'
              }
            ]);
          }, index * 300);
        });
        
        count++;
        
        // Schedule next phrase
        setTimeout(addRemoteSpeech, 5000 + Math.random() * 5000);
      }
    };
    
    // Start after a short delay
    setTimeout(addRemoteSpeech, 3000);
  };
  
  const startRecording = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
        startTimeRef.current = Date.now();
      } catch (err) {
        console.error('Error starting recording:', err);
        setError('Failed to start recording.');
      }
    }
  };
  
  const stopRecording = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
        setIsRecording(false);
      } catch (err) {
        console.error('Error stopping recording:', err);
      }
    }
  };
  
  const clearTranscription = () => {
    setTranscription([]);
  };
  
  const formatTimestamp = (timestamp: number): string => {
    const totalSeconds = Math.floor(timestamp / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const milliseconds = Math.floor((timestamp % 1000) / 10);
    
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
  };
  
  const exportTranscript = () => {
    // Sort words by timestamp
    const sortedTranscription = [...transcription].sort((a, b) => a.timestamp - b.timestamp);
    
    // Format as text with timestamps and source
    const text = sortedTranscription.map(item => 
      `[${item.source}] ${formatTimestamp(item.timestamp)}: ${item.word}`
    ).join('\n');
    
    // Create and download file
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meeting-transcript-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-xl">Meeting Transcription</CardTitle>
        <div className="flex items-center space-x-2">
          {isRecording && (
            <div className="flex items-center mr-2">
              <span className="h-3 w-3 rounded-full bg-red-500 animate-pulse mr-2"></span>
              <span className="text-sm text-gray-500">Recording</span>
            </div>
          )}
          <Button 
            variant={isRecording ? "destructive" : "default"}
            onClick={isRecording ? stopRecording : startRecording}
            size="sm"
          >
            {isRecording ? <Square className="mr-2 h-4 w-4" /> : <Mic className="mr-2 h-4 w-4" />}
            {isRecording ? "Stop" : "Start"} Recording
          </Button>
          <Button 
            variant="outline"
            onClick={clearTranscription}
            disabled={transcription.length === 0}
            size="sm"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Clear
          </Button>
          <Button 
            variant="outline"
            onClick={exportTranscript}
            disabled={transcription.length === 0}
            size="sm"
          >
            <FileText className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        <div className="bg-gray-50 rounded-lg p-4 h-40 overflow-y-auto mb-2">
          {transcription.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-400 italic">
              No transcription yet. Start recording to capture meeting audio.
            </div>
          ) : (
            <div className="overflow-y-auto h-full space-y-2 text-left">
              {transcription
                .sort((a, b) => a.timestamp - b.timestamp)
                .map((item, index) => (
                  <span 
                    key={`${item.timestamp}-${index}`} 
                    className={`inline-block mr-2 ${!item.isFinal ? 'text-blue-500' : ''} ${
                      item.source === 'speaker' ? 'text-purple-600' : 'text-green-600'
                    }`}
                  >
                    <span className="text-sm text-gray-500">
                      [{item.source}] {formatTimestamp(item.timestamp)}:
                    </span>{' '}
                    {item.word}{' '}
                  </span>
                ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default MeetingTranscription; 
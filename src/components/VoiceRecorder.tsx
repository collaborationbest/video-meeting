
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Mic, Square, Trash2, AlertCircle, FileText, FileAudio } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import AudioVisualizer from './AudioVisualizer';
import TranscriptionDisplay from './TranscriptionDisplay';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';

const VoiceRecorder: React.FC = () => {
  const {
    isRecording,
    transcription,
    startRecording,
    stopRecording,
    clearTranscription,
    error,
    isSupported,
    audioBlob,
    exportTranscript,
    exportAudio
  } = useSpeechRecognition();

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <Card className="w-full">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-xl">Voice Recorder & Transcriber</CardTitle>
          <div className="flex items-center space-x-2">
            {isRecording && (
              <div className="flex items-center mr-2">
                <span className="h-3 w-3 rounded-full bg-red-500 animate-pulse-recording mr-2"></span>
                <span className="text-sm text-gray-500">Recording</span>
              </div>
            )}
            <Button 
              variant={isRecording ? "destructive" : "default"}
              onClick={isRecording ? stopRecording : startRecording}
              disabled={!isSupported}
            >
              {isRecording ? <Square className="mr-2 h-4 w-4" /> : <Mic className="mr-2 h-4 w-4" />}
              {isRecording ? "Stop" : "Start"} Recording
            </Button>
            <Button 
              variant="outline"
              onClick={clearTranscription}
              disabled={transcription.length === 0}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Clear
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {!isSupported && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Browser Not Supported</AlertTitle>
              <AlertDescription>
                Your browser doesn't support speech recognition. Please use Chrome, Edge, or Safari.
              </AlertDescription>
            </Alert>
          )}

          <AudioVisualizer isRecording={isRecording} />
          
          <div className="bg-gray-50 rounded-lg p-4 h-64 overflow-y-auto">
            <TranscriptionDisplay transcription={transcription} />
          </div>
          
          <div className="flex justify-end space-x-2 pt-4">
            <Button 
              variant="outline"
              onClick={exportTranscript}
              disabled={transcription.length === 0}
            >
              <FileText className="mr-2 h-4 w-4" />
              Export Transcript
            </Button>
            <Button 
              variant="outline"
              onClick={exportAudio}
              disabled={!audioBlob}
            >
              <FileAudio className="mr-2 h-4 w-4" />
              Export Audio
            </Button>
          </div>
        </CardContent>
      </Card>
      
      <Card className="w-full">
        <CardContent className="pt-6">
          <h3 className="font-medium text-lg mb-2">Instructions:</h3>
          <ul className="list-disc pl-5 space-y-1 text-sm text-gray-600">
            <li>Click "Start Recording" to begin capturing audio from your microphone.</li>
            <li>Allow microphone permissions when prompted by your browser.</li>
            <li>Speak clearly to see your words transcribed in real-time.</li>
            <li>The transcription will continue even if you switch to another tab or window.</li>
            <li>Each word will be timestamped based on when it was detected.</li>
            <li>Blue text indicates interim results that might change.</li>
            <li>Click "Stop Recording" to end the session.</li>
            <li>Use "Clear" to reset the transcription.</li>
            <li>Export your transcript as a text file or the audio as a webm file.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};

export default VoiceRecorder;

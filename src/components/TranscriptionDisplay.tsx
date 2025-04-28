
import React from 'react';
import { TimestampedWord } from '@/hooks/useSpeechRecognition';

interface TranscriptionDisplayProps {
  transcription: TimestampedWord[];
}

const TranscriptionDisplay: React.FC<TranscriptionDisplayProps> = ({ transcription }) => {
  const formatTimestamp = (timestamp: number): string => {
    const totalSeconds = Math.floor(timestamp / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const milliseconds = Math.floor((timestamp % 1000) / 10);
    
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
  };

  if (transcription.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 italic">
        No transcription yet. Start recording to see text appear here.
      </div>
    );
  }

  return (
    <div className="overflow-y-auto h-full space-y-4 text-left">
      {transcription.map((item, index) => (
        <span 
          key={`${item.timestamp}-${index}`} 
          className={`inline-block mr-2 ${!item.isFinal ? 'text-blue-500' : ''} ${
            item.source === 'speaker' ? 'text-purple-600' : 'text-green-600'
          }`}
        >
          <span className="text-sm text-gray-500">
            [{item.source}] {formatTimestamp(item.timestamp)}
          </span>{' '}
          {item.word}{' '}
        </span>
      ))}
    </div>
  );
};

export default TranscriptionDisplay;

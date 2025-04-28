
import React from 'react';
import VoiceRecorder from '@/components/VoiceRecorder';
import { Button } from '@/components/ui/button';
import { Video } from 'lucide-react';
import { Link } from 'react-router-dom';

const Index = () => {
  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <header className="mb-12 text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Speech-to-Text Transcriber</h1>
          <p className="text-gray-600">Record and transcribe speech with accurate word timestamps</p>
          
          <div className="mt-6">
            <Link to="/meeting">
              <Button className="gap-2">
                <Video size={18} />
                Join Video Meeting
              </Button>
            </Link>
          </div>
        </header>
        
        <VoiceRecorder />
        
        <footer className="mt-16 text-center text-gray-500 text-sm">
          <p>© 2025 Speech-to-Text Transcriber</p>
        </footer>
      </div>
    </div>
  );
};

export default Index;


import React from 'react';
import VideoMeeting from '@/components/VideoMeeting';

const Meeting = () => {
  return (
    <div className="min-h-screen bg-gray-100 py-6 px-4">
      <div className="max-w-6xl mx-auto">
        <header className="mb-6 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Video Meeting</h1>
          <p className="text-gray-600">Connect with others through video and audio</p>
        </header>
        
        <VideoMeeting />
        
        <footer className="mt-8 text-center text-gray-500 text-sm">
          <p>© 2025 Speech-to-Text Transcriber</p>
        </footer>
      </div>
    </div>
  );
};

export default Meeting;

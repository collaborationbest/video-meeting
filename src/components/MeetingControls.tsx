
import React from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Phone, Video, VideoOff } from 'lucide-react';

interface MeetingControlsProps {
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  toggleAudio: () => void;
  toggleVideo: () => void;
  leaveRoom: () => void;
}

const MeetingControls: React.FC<MeetingControlsProps> = ({
  isAudioEnabled,
  isVideoEnabled,
  toggleAudio,
  toggleVideo,
  leaveRoom
}) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white shadow-lg p-4">
      <div className="max-w-3xl mx-auto flex items-center justify-center space-x-4">
        <Button
          onClick={toggleAudio}
          variant={isAudioEnabled ? "outline" : "destructive"}
          className="rounded-full w-12 h-12 p-0"
          title={isAudioEnabled ? "Mute" : "Unmute"}
        >
          {isAudioEnabled ? <Mic /> : <MicOff />}
        </Button>
        
        <Button
          onClick={toggleVideo}
          variant={isVideoEnabled ? "outline" : "destructive"}
          className="rounded-full w-12 h-12 p-0"
          title={isVideoEnabled ? "Turn off camera" : "Turn on camera"}
        >
          {isVideoEnabled ? <Video /> : <VideoOff />}
        </Button>
        
        <Button
          onClick={leaveRoom}
          variant="destructive"
          className="rounded-full w-12 h-12 p-0"
          title="Leave meeting"
        >
          <Phone className="rotate-135" />
        </Button>
      </div>
    </div>
  );
};

export default MeetingControls;

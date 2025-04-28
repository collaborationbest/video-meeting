import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AlertCircle, Mic, MicOff, Video, VideoOff } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useNavigate } from 'react-router-dom';
import { useWebRTC } from '@/hooks/useWebRTC';
import MeetingControls from './MeetingControls';
import { Input } from '@/components/ui/input';
import MeetingTranscription from './MeetingTranscription';

const VideoMeeting: React.FC = () => {
  const navigate = useNavigate();
  const [roomIdInput, setRoomIdInput] = useState<string>('');
  const {
    localStream,
    remoteStreams,
    startLocalStream,
    stopLocalStream,
    joinRoom,
    leaveRoom,
    isAudioEnabled,
    isVideoEnabled,
    toggleAudio,
    toggleVideo,
    roomId,
    error,
    participants
  } = useWebRTC();
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  
  useEffect(() => {
    // Start local stream when component mounts
    startLocalStream();
    
    return () => {
      // Clean up when component unmounts
      stopLocalStream();
      leaveRoom();
    };
  }, []);
  
  useEffect(() => {
    // Attach local stream to video element when available
    if (localStream && localVideoRef.current) {
      try {
        console.log('Local stream available:', localStream.getTracks().map(track => ({
          kind: track.kind,
          enabled: track.enabled,
          readyState: track.readyState
        })));
        
        // Always set the srcObject to ensure the video is updated
        console.log('Setting video srcObject');
        localVideoRef.current.srcObject = localStream;
        
        // Add event listeners for debugging
        localVideoRef.current.onloadedmetadata = () => {
          console.log('Local video metadata loaded');
          // Force play the video
          localVideoRef.current?.play().catch(err => {
            console.error('Error playing video:', err);
          });
        };
        
        localVideoRef.current.onplay = () => {
          console.log('Local video started playing');
        };
        
        localVideoRef.current.onerror = (error) => {
          console.error('Local video error:', error);
        };
        
        // Force play after a short delay to ensure everything is ready
        setTimeout(() => {
          if (localVideoRef.current) {
            localVideoRef.current.play().catch(err => {
              console.error('Error playing video after delay:', err);
            });
          }
        }, 1000);
      } catch (err) {
        console.error('Error attaching stream to video element:', err);
      }
    }
  }, [localStream]);

  // Function to handle going back to the home page
  const handleBack = () => {
    navigate('/');
  };

  // Function to handle joining a meeting with a specific room ID
  const handleJoinMeeting = () => {
    if (roomIdInput.trim()) {
      joinRoom(roomIdInput.trim());
    } else {
      joinRoom();
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      {!roomId && (
        <div className="flex flex-col items-center gap-4 mb-4">
          <div className="flex gap-2 w-full max-w-md">
            <Input
              placeholder="Enter Room ID to join existing meeting"
              value={roomIdInput}
              onChange={(e) => setRoomIdInput(e.target.value)}
              className="flex-1"
            />
            <Button onClick={handleJoinMeeting} variant="default" className="w-40">
              Join Meeting
            </Button>
          </div>
          <div className="flex gap-4">
            <Button onClick={() => joinRoom()} variant="outline" className="w-40">
              Create New Meeting
            </Button>
            <Button onClick={handleBack} variant="ghost" className="w-40">
              Back to Home
            </Button>
          </div>
        </div>
      )}
      
      {roomId && (
        <>
          <Card className="p-4 bg-white mb-6">
            <div className="text-center mb-2">
              <span className="font-medium">Room ID:</span> {roomId}
            </div>
            <div className="text-center">
              <span className="font-medium">Participants:</span> {participants.length + 1} {/* +1 to include the local user */}
            </div>
          </Card>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Local video */}
            <div className="relative">
              <div className="bg-black rounded-lg aspect-video overflow-hidden">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                  style={{ transform: 'scaleX(-1)' }}
                />
                {!localStream && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                    <p className="text-white">Loading camera...</p>
                  </div>
                )}
              </div>
              <div className="absolute bottom-2 left-2 bg-gray-800 text-white px-2 py-1 rounded text-sm">
                You {!isAudioEnabled && "(Muted)"}
              </div>
            </div>
            
            {/* Remote videos */}
            {remoteStreams.map((stream, index) => (
              <RemoteVideo key={index} stream={stream} participantIndex={index} />
            ))}
            
            {/* Empty placeholders to fill the grid */}
            {remoteStreams.length < 2 && Array.from({ length: 2 - remoteStreams.length }).map((_, index) => (
              <div key={`empty-${index}`} className="bg-gray-200 rounded-lg aspect-video flex items-center justify-center">
                <p className="text-gray-500">Waiting for participants...</p>
              </div>
            ))}
          </div>
          
          {/* Meeting Transcription */}
          <div className="my-6">
            <MeetingTranscription isActive={!!roomId} />
          </div>
          
          <MeetingControls
            isAudioEnabled={isAudioEnabled}
            isVideoEnabled={isVideoEnabled}
            toggleAudio={toggleAudio}
            toggleVideo={toggleVideo}
            leaveRoom={leaveRoom}
          />
        </>
      )}
    </div>
  );
};

// Component for rendering remote videos
const RemoteVideo: React.FC<{ stream: MediaStream; participantIndex: number }> = ({
  stream,
  participantIndex
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);
  
  return (
    <div className="relative">
      <div className="bg-black rounded-lg aspect-video overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />
      </div>
      <div className="absolute bottom-2 left-2 bg-gray-800 text-white px-2 py-1 rounded text-sm">
        Participant {participantIndex + 1}
      </div>
    </div>
  );
};

export default VideoMeeting;

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from "@/components/ui/use-toast";

// Configure STUN servers for WebRTC to work over NAT
const configuration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' }
  ]
};

interface Participant {
  id: string;
  connection: RTCPeerConnection;
  stream?: MediaStream;
}

export const useWebRTC = () => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<MediaStream[]>([]);
  const [isAudioEnabled, setIsAudioEnabled] = useState<boolean>(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState<boolean>(true);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);

  const userId = useRef<string>(Math.random().toString(36).substring(2, 10));
  const wsRef = useRef<WebSocket | null>(null);

  const setupPeerConnection = useCallback((peerConnection: RTCPeerConnection, peerId: string) => {
    console.log(`Setting up peer connection for ${peerId}`);

    // Add local tracks to the connection
    if (localStream) {
      localStream.getTracks().forEach(track => {
        console.log(`Adding ${track.kind} track to peer connection for ${peerId}`);
        if (localStream) {
          peerConnection.addTrack(track, localStream);
        }
      });
    } else {
      console.warn('No local stream available when setting up peer connection');
    }

    // Handle incoming streams
    peerConnection.ontrack = (event) => {
      console.log(`Received track from ${peerId}:`, event.streams.length ? 'stream available' : 'no stream');
      const [remoteStream] = event.streams;

      if (remoteStream) {
        console.log(`Processing remote stream from ${peerId} with ${remoteStream.getTracks().length} tracks`);
        setRemoteStreams(prev => {
          // Check if we already have this stream
          const exists = prev.some(stream =>
            stream.id === remoteStream.id ||
            stream.getTracks().some(t => remoteStream.getTracks().some(rt => rt.id === t.id))
          );

          if (!exists) {
            console.log(`Adding new remote stream from ${peerId}`);
            return [...prev, remoteStream];
          }
          return prev;
        });
      }
    };

    // Log connection state changes
    peerConnection.oniceconnectionstatechange = () => {
      console.log(`ICE connection state changed for ${peerId}: ${peerConnection.iceConnectionState}`);

      // If the connection failed or disconnected, attempt to reconnect
      if (peerConnection.iceConnectionState === 'failed' ||
        peerConnection.iceConnectionState === 'disconnected') {
        console.log(`Attempting to restart ICE for ${peerId}`);
        peerConnection.restartIce();
      }
    };

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        console.log(`Sending ICE candidate to ${peerId}`);
        wsRef.current.send(JSON.stringify({
          type: 'ice-candidate',
          candidate: event.candidate,
          target: peerId,
          from: userId.current,
          roomId
        }));
      } else if (!event.candidate) {
        console.log(`Finished generating ICE candidates for ${peerId}`);
      }
    };

    // Add the new participant if not already in the list
    setParticipants(prev => {
      if (!prev.some(p => p.id === peerId)) {
        console.log(`Adding new participant: ${peerId}`);
        return [...prev, { id: peerId, connection: peerConnection }];
      }
      return prev;
    });

    return peerConnection;
  }, [localStream, roomId, wsRef, setRemoteStreams, setParticipants]);

  // Initialize WebSocket connection
  const initializeWebSocket = useCallback(() => {
    console.log('Initializing WebSocket, current state:', wsRef.current ? wsRef.current.readyState : 'no connection');

    // Close existing connection if any
    if (wsRef.current) {
      console.log('Closing existing WebSocket connection');
      wsRef.current.close();
      wsRef.current = null;
    }

    console.log('Creating new WebSocket connection to ws://localhost:8081');
    const ws = new WebSocket('wss://video-meeting-backend.vercel.app');
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected to signaling server');
      setError(null);
      const roomid = localStorage.getItem('meeting_roomId');
      console.log('roomid', roomid);
      // If we have a roomId, rejoin the room
      if (roomid) {
        console.log(`Joining room: ${roomid}`);
        ws.send(JSON.stringify({
          type: 'join',
          roomId: roomid,
          userId: userId.current
        }));

        // Also request current participants list
        console.log('Requesting participants list');
        setTimeout(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'get-participants',
              roomId: roomid,
              userId: userId.current
            }));
          }
        }, 1000);
      }
    };

    ws.onmessage = async (event) => {
      const data = JSON.parse(event.data);
      console.log('WebSocket message received:', data.type);

      switch (data.type) {
        case 'joined':
          console.log(`User ${data.userId} joined room ${data.roomId}`);
          // Update participants count
          setParticipants(prev => {
            if (!prev.some(p => p.id === data.userId)) {
              console.log(`Adding ${data.userId} to participants list`);
              return [...prev, { id: data.userId, connection: new RTCPeerConnection(configuration) }];
            }
            return prev;
          });

          // Create new peer connection for the joined user
          if (data.userId !== userId.current) {
            console.log(`Creating peer connection for joined user: ${data.userId}`);
            const peerConnection = new RTCPeerConnection(configuration);
            setupPeerConnection(peerConnection, data.userId);

            // Create and send offer
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);

            ws.send(JSON.stringify({
              type: 'offer',
              offer,
              target: data.userId,
              from: userId.current,
              roomId
            }));
          }
          break;

        case 'participants': {
          console.log('Received participants list:', data.participants);
          // Update participants list from server response
          const existingParticipants = participants.map(p => p.id);
          const newParticipants = data.participants.filter(id =>
            id !== userId.current && !existingParticipants.includes(id)
          );

          // Add any new participants to the list
          if (newParticipants.length > 0) {
            console.log('Adding new participants:', newParticipants);
            setParticipants(prev => [
              ...prev,
              ...newParticipants.map(id => ({
                id,
                connection: new RTCPeerConnection(configuration)
              }))
            ]);

            // Create connections for new participants
            newParticipants.forEach(async (id) => {
              console.log(`Creating connection for existing participant: ${id}`);
              const peerConnection = new RTCPeerConnection(configuration);
              setupPeerConnection(peerConnection, id);

              // Create and send offer
              const offer = await peerConnection.createOffer();
              await peerConnection.setLocalDescription(offer);

              ws.send(JSON.stringify({
                type: 'offer',
                offer,
                target: id,
                from: userId.current,
                roomId
              }));
            });
          }
          break;
        }

        case 'offer':
          if (data.target === userId.current) {
            console.log(`Received offer from ${data.from}`);
            const peerConnection = new RTCPeerConnection(configuration);
            const streamConnection = setupPeerConnection(peerConnection, data.from);

            await streamConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
            const answer = await streamConnection.createAnswer();
            await streamConnection.setLocalDescription(answer);

            ws.send(JSON.stringify({
              type: 'answer',
              answer,
              target: data.from,
              from: userId.current,
              roomId
            }));
          }
          break;

        case 'answer':
          if (data.target === userId.current) {
            console.log(`Received answer from ${data.from}`);
            const participant = participants.find(p => p.id === data.from);
            if (participant) {
              await participant.connection.setRemoteDescription(
                new RTCSessionDescription(data.answer)
              );
              console.log(`Set remote description for ${data.from}`);
            } else {
              console.warn(`No participant found for ${data.from}`);
            }
          }
          break;

        case 'ice-candidate':
          if (data.target === userId.current) {
            console.log(`Received ICE candidate from ${data.from}`);
            const participant = participants.find(p => p.id === data.from);
            if (participant && data.candidate) {
              try {
                await participant.connection.addIceCandidate(
                  new RTCIceCandidate(data.candidate)
                );
                console.log(`Added ICE candidate for ${data.from}`);
              } catch (err) {
                console.error(`Error adding ICE candidate for ${data.from}:`, err);

                // If the connection isn't ready for candidates yet, buffer them
                if (participant.connection.remoteDescription === null) {
                  console.log(`Remote description not set yet for ${data.from}, cannot add ICE candidate`);
                }
              }
            } else {
              console.warn(`Couldn't process ICE candidate. Participant: ${!!participant}, Candidate: ${!!data.candidate}`);
            }
          }
          break;

        case 'left': {
          console.log(`User ${data.userId} left room ${data.roomId}`);
          // Find the participant that left
          const leavingParticipant = participants.find(p => p.id === data.userId);

          // Close their connection
          if (leavingParticipant) {
            console.log(`Closing connection for user ${data.userId}`);
            leavingParticipant.connection.close();
          }

          // Remove the participant from the list
          setParticipants(prev => prev.filter(p => p.id !== data.userId));

          // Remove their streams
          setRemoteStreams(prev => {
            // Find streams that belong to the leaving participant
            // This is a best-effort approach since streams may not be explicitly tied to participants
            const remainingStreams = [...prev];
            console.log(`Filtering remote streams after ${data.userId} left, before: ${remainingStreams.length}`);

            // Since we can't directly map streams to participants, we'll remove all inactive streams
            const filteredStreams = remainingStreams.filter(stream => {
              const hasActiveTracks = stream.getTracks().some(track => track.readyState === 'live');
              return hasActiveTracks;
            });

            console.log(`After filtering: ${filteredStreams.length} streams remain`);
            return filteredStreams;
          });
          break;
        }
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      console.error('WebSocket readyState:', ws.readyState);
      setError('Connection error. Please try again.');
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected, readyState:', ws.readyState);
      // Only attempt to reconnect if we're still in a room
      if (roomId) {
        console.log('Attempting to reconnect...');
        setTimeout(initializeWebSocket, 3000);
      }
    };
  }, [participants, roomId, setupPeerConnection]);

  // Initialize local media stream
  const startLocalStream = useCallback(async () => {
    try {
      setError(null);

      // Only create a new stream if we don't have one or if the current one is inactive
      if (!localStream || localStream.getTracks().some(track => track.readyState === 'ended')) {
        console.log('Requesting media devices...');
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: "user"
          }
        });

        console.log('Media devices granted, stream created:', {
          videoTracks: stream.getVideoTracks().length,
          audioTracks: stream.getAudioTracks().length
        });

        // Stop any existing tracks before setting new stream
        if (localStream) {
          console.log('Stopping existing stream tracks');
          localStream.getTracks().forEach(track => track.stop());
        }

        // Verify the stream has video tracks
        const videoTracks = stream.getVideoTracks();
        if (videoTracks.length === 0) {
          throw new Error('No video track found in the stream');
        }

        // Verify the video track is enabled and working
        videoTracks.forEach(track => {
          console.log('Video track state:', {
            enabled: track.enabled,
            readyState: track.readyState,
            label: track.label
          });

          if (!track.enabled) {
            track.enabled = true;
          }

          // Add event listeners to track
          track.onended = () => {
            console.log('Video track ended');
            setError('Camera stream ended unexpectedly');
          };

          track.onmute = () => {
            console.log('Video track muted');
          };

          track.onunmute = () => {
            console.log('Video track unmuted');
          };
        });

        setLocalStream(stream);
        setIsAudioEnabled(true);
        setIsVideoEnabled(true);

        // Log stream information for debugging
        console.log('Local stream initialized with tracks:', stream.getTracks().map(track => ({
          kind: track.kind,
          enabled: track.enabled,
          readyState: track.readyState,
          label: track.label
        })));
      }
    } catch (err) {
      console.error('Error accessing media devices:', err);
      setError(`Could not access camera or microphone: ${err instanceof Error ? err.message : String(err)}`);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not access camera or microphone. Please check your permissions and make sure your camera is working."
      });
    }
  }, [localStream]);

  // Stop local media stream
  const stopLocalStream = useCallback(() => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
  }, [localStream]);

  // Toggle audio on/off
  const toggleAudio = useCallback(() => {
    if (localStream) {
      const audioTracks = localStream.getAudioTracks();
      const enabled = !isAudioEnabled;

      audioTracks.forEach(track => {
        track.enabled = enabled;
      });

      setIsAudioEnabled(enabled);
    }
  }, [localStream, isAudioEnabled]);

  // Toggle video on/off
  const toggleVideo = useCallback(() => {
    if (localStream) {
      const videoTracks = localStream.getVideoTracks();
      const enabled = !isVideoEnabled;

      videoTracks.forEach(track => {
        track.enabled = enabled;
      });

      setIsVideoEnabled(enabled);
    }
  }, [localStream, isVideoEnabled]);

  // Join a meeting room
  const joinRoom = useCallback(async (specificRoomId?: string) => {
    try {
      setError(null);

      // Always initialize a new stream when joining a room
      console.log('Initializing local stream before joining room...');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user"
        }
      });

      // Stop any existing tracks
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }

      // Set the new stream
      setLocalStream(stream);
      setIsAudioEnabled(true);
      setIsVideoEnabled(true);

      // Use provided room ID or generate a new one
      const newRoomId = specificRoomId || Math.random().toString(36).substring(2, 8);
      setRoomId(newRoomId);

      // Save to localStorage
      localStorage.setItem('meeting_roomId', newRoomId);

      // Initialize WebSocket connection
      await new Promise<void>((resolve) => {
        // Clean up any existing WebSocket
        if (wsRef.current) {
          console.log('Cleaning up existing WebSocket before joining room');
          wsRef.current.close();
          wsRef.current = null;
        }

        console.log('Starting new WebSocket for room:', newRoomId);
        // Initialize new WebSocket with a slight delay to ensure clean state
        setTimeout(() => {
          initializeWebSocket();
          resolve();
        }, 500);
      });

      console.log('Successfully joined room with stream:', {
        roomId: newRoomId,
        videoTracks: stream.getVideoTracks().length,
        audioTracks: stream.getAudioTracks().length
      });

    } catch (err) {
      console.error('Error joining room:', err);
      setError(`Failed to join meeting: ${err instanceof Error ? err.message : String(err)}`);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to join the meeting. Please check your camera and microphone permissions."
      });
    }
  }, [initializeWebSocket]);

  // Leave the meeting room
  const leaveRoom = useCallback(() => {
    // Notify other participants
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'leave',
        roomId,
        userId: userId.current
      }));
    }

    // Close all peer connections
    participants.forEach(participant => {
      participant.connection.close();
    });

    // Close WebSocket connection
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setParticipants([]);
    setRemoteStreams([]);
    setRoomId(null);
    stopLocalStream();

    // Remove from localStorage
    localStorage.removeItem('meeting_roomId');

    toast({
      title: "Left meeting",
      description: "You have left the meeting successfully."
    });
  }, [participants, stopLocalStream, roomId]);

  // Clean up when component unmounts
  useEffect(() => {
    return () => {
      console.log('Component unmounting, cleaning up connections');

      // Clean up peer connections
      participants.forEach(participant => {
        participant.connection.close();
      });

      // Only close WebSocket if we're actually unmounting, not during re-renders
      if (wsRef.current) {
        console.log('Closing WebSocket connection on unmount');
        wsRef.current.close();
      }

      // Clean up media stream
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [participants, localStream]);

  return {
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
  };
};


import React, { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  isRecording: boolean;
}

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ isRecording }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Set up audio context and analyser
  useEffect(() => {
    if (!isRecording) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      
      // Clean up the old stream if it exists
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      
      return;
    }
    
    const setupAudio = async () => {
      try {
        // Get microphone access
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        
        // Initialize audio context
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        audioContextRef.current = new AudioContext();
        
        // Create analyser
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 256;
        
        // Connect microphone to analyser
        sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
        sourceRef.current.connect(analyserRef.current);
        
        // Set up data array
        const bufferLength = analyserRef.current.frequencyBinCount;
        dataArrayRef.current = new Uint8Array(bufferLength);
        
        // Start visualization
        visualize();
      } catch (err) {
        console.error('Error accessing microphone:', err);
      }
    };
    
    setupAudio();
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      
      // Clean up audio resources
      if (sourceRef.current) {
        sourceRef.current.disconnect();
        sourceRef.current = null;
      }
      
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      
      // Stop all tracks in the stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, [isRecording]);
  
  const visualize = () => {
    if (!canvasRef.current || !analyserRef.current || !dataArrayRef.current) return;
    
    const canvas = canvasRef.current;
    const canvasCtx = canvas.getContext('2d');
    if (!canvasCtx) return;
    
    const WIDTH = canvas.width;
    const HEIGHT = canvas.height;
    
    // Clear canvas
    canvasCtx.clearRect(0, 0, WIDTH, HEIGHT);
    
    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);
      
      if (!analyserRef.current || !dataArrayRef.current) return;
      
      // Get audio data
      analyserRef.current.getByteFrequencyData(dataArrayRef.current);
      
      // Clear canvas
      canvasCtx.fillStyle = 'rgb(255, 255, 255)';
      canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);
      
      // Draw visualization
      const barWidth = (WIDTH / dataArrayRef.current.length) * 2.5;
      let x = 0;
      
      for (let i = 0; i < dataArrayRef.current.length; i++) {
        const barHeight = (dataArrayRef.current[i] / 255) * HEIGHT * 0.7;
        
        // Use gradient colors based on frequency
        const hue = (i / dataArrayRef.current.length) * 220 + 180; // Blue to green range
        canvasCtx.fillStyle = `hsl(${hue}, 70%, 60%)`;
        
        // Draw bar
        canvasCtx.fillRect(x, HEIGHT - barHeight, barWidth, barHeight);
        
        x += barWidth + 1;
      }
    };
    
    draw();
  };
  
  return (
    <div className="audio-visualizer w-full h-24 rounded-lg overflow-hidden bg-white">
      <canvas 
        ref={canvasRef} 
        width={1000} 
        height={96}
        className="w-full h-full"
      />
    </div>
  );
};

export default AudioVisualizer;

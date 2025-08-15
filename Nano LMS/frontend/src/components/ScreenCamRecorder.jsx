import React, { useState, useRef, useCallback, useEffect } from 'react';
import { api } from '../services/api';
import toast from 'react-hot-toast';

const ScreenCamRecorder = ({ courseId, lessonId, onUploaded }) => {
  const [status, setStatus] = useState('idle'); // idle, requesting, recording, uploading, done, error
  const [recording, setRecording] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [recordingData, setRecordingData] = useState(null);
  const [showCropSelector, setShowCropSelector] = useState(false);
  const [cropSelection, setCropSelection] = useState(null);
  const [settings, setSettings] = useState({
    includeSystemAudio: false,
    webcamSize: 25, // percentage
    micSource: 'default',
    webcamShape: 'circle', // 'circle' or 'rectangle'
    screenCrop: null // { x, y, width, height } for cropping
  });

  const mediaRecorderRef = useRef(null);
  const canvasRef = useRef(null);
  const screenStreamRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const chunksRef = useRef([]);
  const animationFrameRef = useRef(null);
  const startTimeRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Check browser support
  const isSupported = () => {
    return !!(navigator.mediaDevices && 
              navigator.mediaDevices.getDisplayMedia && 
              navigator.mediaDevices.getUserMedia && 
              window.MediaRecorder);
  };

  const isSafari = () => {
    return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  };

  // Cleanup function
  const cleanup = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }

    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }

    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach(track => track.stop());
      cameraStreamRef.current = null;
    }

    chunksRef.current = [];
  }, []);

    // Draw video streams to canvas
  const drawToCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (!screenStreamRef.current || !cameraStreamRef.current) return;

    const screenVideo = document.createElement('video');
    const cameraVideo = document.createElement('video');

    screenVideo.srcObject = screenStreamRef.current;
    cameraVideo.srcObject = cameraStreamRef.current;

    screenVideo.onloadedmetadata = () => {
      canvas.width = screenVideo.videoWidth;
      canvas.height = screenVideo.videoHeight;
    };

    cameraVideo.onloadedmetadata = () => {
      // Calculate webcam position and size
      const webcamWidth = (canvas.width * settings.webcamSize) / 100;
      const webcamHeight = (webcamWidth * cameraVideo.videoHeight) / cameraVideo.videoWidth;
      const webcamX = canvas.width - webcamWidth - 20;
      const webcamY = canvas.height - webcamHeight - 20;

      const draw = () => {
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw screen (with cropping if specified)
        if (settings.screenCrop) {
          // Apply screen cropping
          const { x, y, width, height } = settings.screenCrop;
          const scaleX = canvas.width / window.innerWidth;
          const scaleY = canvas.height / window.innerHeight;
          
          const cropX = x * scaleX;
          const cropY = y * scaleY;
          const cropWidth = width * scaleX;
          const cropHeight = height * scaleY;
          
          ctx.drawImage(screenVideo, cropX, cropY, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height);
        } else {
          // Draw full screen
          ctx.drawImage(screenVideo, 0, 0, canvas.width, canvas.height);
        }

        // Draw webcam with shape selection
        ctx.save();
        ctx.beginPath();
        
        if (settings.webcamShape === 'circle') {
          // Draw circular webcam
          const centerX = webcamX + webcamWidth / 2;
          const centerY = webcamY + webcamHeight / 2;
          const radius = Math.min(webcamWidth, webcamHeight) / 2;
          
          ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        } else {
          // Draw rectangular webcam with rounded corners
          ctx.roundRect(webcamX, webcamY, webcamWidth, webcamHeight, 10);
        }
        
        ctx.clip();
        ctx.drawImage(cameraVideo, webcamX, webcamY, webcamWidth, webcamHeight);
        ctx.restore();

        if (recording) {
          animationFrameRef.current = requestAnimationFrame(draw);
        }
      };

      screenVideo.play();
      cameraVideo.play();
      draw();
    };
  }, [recording, settings.webcamSize, settings.webcamShape, settings.screenCrop]);

  // Screen crop selection
  const selectScreenArea = async () => {
    try {
      setStatus('requesting');
      setError('');

      // Request screen share for selection
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: false
      });

      // Create a temporary video element to show the screen
      const video = document.createElement('video');
      video.srcObject = screenStream;
      video.style.position = 'fixed';
      video.style.top = '0';
      video.style.left = '0';
      video.style.width = '100vw';
      video.style.height = '100vh';
      video.style.zIndex = '9999';
      video.style.objectFit = 'contain';
      video.style.backgroundColor = 'rgba(0,0,0,0.8)';
      document.body.appendChild(video);

      // Create crop overlay
      const overlay = document.createElement('div');
      overlay.style.position = 'fixed';
      overlay.style.top = '0';
      overlay.style.left = '0';
      overlay.style.width = '100vw';
      overlay.style.height = '100vh';
      overlay.style.zIndex = '10000';
      overlay.style.cursor = 'crosshair';
      overlay.style.backgroundColor = 'rgba(0,0,0,0.3)';
      document.body.appendChild(overlay);

      let isSelecting = false;
      let startX, startY, endX, endY;
      let selectionBox = null;

      const createSelectionBox = () => {
        selectionBox = document.createElement('div');
        selectionBox.style.position = 'fixed';
        selectionBox.style.border = '2px dashed #00ff00';
        selectionBox.style.backgroundColor = 'rgba(0,255,0,0.1)';
        selectionBox.style.zIndex = '10001';
        selectionBox.style.pointerEvents = 'none';
        document.body.appendChild(selectionBox);
      };

      const updateSelectionBox = () => {
        if (!selectionBox) return;
        const left = Math.min(startX, endX);
        const top = Math.min(startY, endY);
        const width = Math.abs(endX - startX);
        const height = Math.abs(endY - startY);
        
        selectionBox.style.left = left + 'px';
        selectionBox.style.top = top + 'px';
        selectionBox.style.width = width + 'px';
        selectionBox.style.height = height + 'px';
      };

      overlay.addEventListener('mousedown', (e) => {
        isSelecting = true;
        startX = e.clientX;
        startY = e.clientY;
        endX = startX;
        endY = startY;
        createSelectionBox();
        updateSelectionBox();
      });

      overlay.addEventListener('mousemove', (e) => {
        if (!isSelecting) return;
        endX = e.clientX;
        endY = e.clientY;
        updateSelectionBox();
      });

      overlay.addEventListener('mouseup', () => {
        if (!isSelecting) return;
        isSelecting = false;
        
        // Calculate crop area
        const left = Math.min(startX, endX);
        const top = Math.min(startY, endY);
        const width = Math.abs(endX - startX);
        const height = Math.abs(endY - startY);
        
        if (width > 50 && height > 50) {
          setCropSelection({ x: left, y: top, width, height });
          setSettings(prev => ({ ...prev, screenCrop: { x: left, y: top, width, height } }));
        }
        
        // Cleanup
        document.body.removeChild(video);
        document.body.removeChild(overlay);
        if (selectionBox) document.body.removeChild(selectionBox);
        screenStream.getTracks().forEach(track => track.stop());
        setShowCropSelector(false);
        setStatus('idle');
      });

      video.play();

    } catch (err) {
      console.error('Crop selection error:', err);
      setError(err.message);
      setStatus('error');
      setShowCropSelector(false);
    }
  };

  // Start recording
  const startRecording = async () => {
    try {
      setStatus('requesting');
      setError('');

      // Request screen share
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: settings.includeSystemAudio
      });

      // Request camera and mic
      const cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 360 },
        audio: true
      });

      screenStreamRef.current = screenStream;
      cameraStreamRef.current = cameraStream;

      // Handle screen share stop
      screenStream.getVideoTracks()[0].onended = () => {
        if (recording) {
          stopRecording();
        }
      };

      // Create canvas stream
      const canvas = canvasRef.current;
      const canvasStream = canvas.captureStream(30);

      // Combine audio tracks
      const audioTracks = [];
      audioTracks.push(...cameraStream.getAudioTracks()); // Mic audio
      if (settings.includeSystemAudio && screenStream.getAudioTracks().length > 0) {
        audioTracks.push(...screenStream.getAudioTracks()); // System audio
      }

      // Create final stream
      const finalStream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...audioTracks
      ]);

      // Determine MIME type
      const mimeTypes = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm'
      ];
      
      const mimeType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type)) || 'video/webm';

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(finalStream, {
        mimeType,
        videoBitsPerSecond: 5000000 // 5 Mbps
      });

      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        setError('Recording failed: ' + event.error);
        setStatus('error');
        cleanup();
      };

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      startTimeRef.current = Date.now();

      mediaRecorder.ondataavailable = (event) => {
        console.log('Data available:', event.data.size, 'bytes');
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const duration = (Date.now() - startTimeRef.current) / 1000;
        const blob = new Blob(chunksRef.current, { type: mimeType });
        
        console.log('Recording stopped:', {
          chunks: chunksRef.current.length,
          totalSize: chunksRef.current.reduce((sum, chunk) => sum + chunk.size, 0),
          blobSize: blob.size,
          duration,
          mimeType
        });
        
        setRecordingData({
          blob,
          duration,
          size: blob.size,
          mimeType,
          width: canvas.width,
          height: canvas.height
        });
        
        setStatus('done');
        setRecording(false);
      };

      // Start drawing to canvas first
      drawToCanvas();
      
      // Start recording
      mediaRecorder.start(1000); // 1 second chunks
      setRecording(true);
      setStatus('recording');

    } catch (err) {
      console.error('Recording error:', err);
      setError(err.message);
      setStatus('error');
      cleanup();
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
    }
    cleanup();
  };

  // Upload recording
  const uploadRecording = async (filename) => {
    if (!recordingData) return;

    try {
      setStatus('uploading');
      setProgress(0);

      const formData = new FormData();
      formData.append('file', recordingData.blob, filename);
      formData.append('courseId', courseId);
      if (lessonId) formData.append('lessonId', lessonId);
      formData.append('title', filename);
      formData.append('durationSec', Math.round(recordingData.duration));
      formData.append('width', recordingData.width);
      formData.append('height', recordingData.height);
      formData.append('mimeType', recordingData.mimeType);

      abortControllerRef.current = new AbortController();

      // Debug logging
      console.log('Uploading recording:', {
        courseId,
        lessonId,
        duration: recordingData.duration,
        size: recordingData.size,
        mimeType: recordingData.mimeType,
        token: localStorage.getItem('token') ? 'Present' : 'Missing'
      });

      const response = await api.post('/upload/lesson-media', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setProgress(percentCompleted);
        },
        signal: abortControllerRef.current.signal
      });

      if (onUploaded) {
        onUploaded(response.data);
      }

      toast.success('Recording uploaded successfully!');
      setStatus('done');
      setRecordingData(null);

    } catch (err) {
      if (err.name === 'AbortError') {
        toast.error('Upload cancelled');
      } else {
        console.error('Upload error:', err);
        toast.error(err.response?.data?.message || 'Upload failed');
        setError(err.message);
        setStatus('error');
      }
    }
  };

  // Cancel upload
  const cancelUpload = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Format duration
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Check for max duration/size
  const isOverLimit = () => {
    if (!recordingData) return false;
    const maxDuration = 45 * 60; // 45 minutes
    const maxSize = 1.5 * 1024 * 1024 * 1024; // 1.5 GB
    return recordingData.duration > maxDuration || recordingData.size > maxSize;
  };

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  // Safari fallback
  if (isSafari()) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-yellow-800 mb-2">
          Screen Recording Not Supported
        </h3>
        <p className="text-yellow-700 mb-3">
          Safari doesn't support screen recording. Please use Chrome, Firefox, or Edge, 
          or record using QuickTime and upload manually.
        </p>
        <div className="text-sm text-yellow-600">
          <p>Alternative: Use QuickTime Screen Recording</p>
          <ol className="list-decimal list-inside mt-2 space-y-1">
            <li>Open QuickTime Player</li>
            <li>File → New Screen Recording</li>
            <li>Record your screen and camera</li>
            <li>Save and upload the file manually</li>
          </ol>
        </div>
      </div>
    );
  }

  // Browser not supported
  if (!isSupported()) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-red-800 mb-2">
          Browser Not Supported
        </h3>
        <p className="text-red-700">
          Your browser doesn't support screen recording. Please use a modern browser 
          like Chrome, Firefox, or Edge.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Screen & Camera Recorder
      </h3>

                   {/* Settings */}
             <div className="space-y-4 mb-6">
               <div className="flex items-center space-x-4">
                 <label className="flex items-center">
                   <input
                     type="checkbox"
                     checked={settings.includeSystemAudio}
                     onChange={(e) => setSettings(prev => ({ ...prev, includeSystemAudio: e.target.checked }))}
                     className="rounded border-gray-300"
                   />
                   <span className="ml-2 text-sm text-gray-700">Include system audio</span>
                 </label>
               </div>

               <div>
                 <label className="block text-sm font-medium text-gray-700 mb-2">
                   Webcam Size: {settings.webcamSize}%
                 </label>
                 <input
                   type="range"
                   min="20"
                   max="35"
                   value={settings.webcamSize}
                   onChange={(e) => setSettings(prev => ({ ...prev, webcamSize: parseInt(e.target.value) }))}
                   className="w-full"
                 />
               </div>

               <div>
                 <label className="block text-sm font-medium text-gray-700 mb-2">
                   Webcam Shape
                 </label>
                 <div className="flex space-x-4">
                   <label className="flex items-center">
                     <input
                       type="radio"
                       name="webcamShape"
                       value="circle"
                       checked={settings.webcamShape === 'circle'}
                       onChange={(e) => setSettings(prev => ({ ...prev, webcamShape: e.target.value }))}
                       className="rounded border-gray-300"
                     />
                     <span className="ml-2 text-sm text-gray-700">Circle</span>
                   </label>
                   <label className="flex items-center">
                     <input
                       type="radio"
                       name="webcamShape"
                       value="rectangle"
                       checked={settings.webcamShape === 'rectangle'}
                       onChange={(e) => setSettings(prev => ({ ...prev, webcamShape: e.target.value }))}
                       className="rounded border-gray-300"
                     />
                     <span className="ml-2 text-sm text-gray-700">Rectangle</span>
                   </label>
                 </div>
               </div>

               <div>
                 <label className="block text-sm font-medium text-gray-700 mb-2">
                   Screen Area Selection
                 </label>
                 <div className="space-y-2">
                   <button
                     type="button"
                     onClick={selectScreenArea}
                     disabled={showCropSelector}
                     className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                   >
                     {showCropSelector ? 'Selecting...' : 'Select Screen Area'}
                   </button>
                   {cropSelection && (
                     <div className="text-sm text-gray-600">
                       Selected: {cropSelection.width}×{cropSelection.height} at ({cropSelection.x}, {cropSelection.y})
                       <button
                         type="button"
                         onClick={() => {
                           setCropSelection(null);
                           setSettings(prev => ({ ...prev, screenCrop: null }));
                         }}
                         className="ml-2 text-red-600 hover:text-red-700"
                       >
                         Clear
                       </button>
                     </div>
                   )}
                 </div>
               </div>
             </div>

      {/* Recording Controls */}
      <div className="space-y-4 mb-6">
        {!recording && status === 'idle' && (
          <button
            onClick={startRecording}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Start Recording
          </button>
        )}

        {recording && (
          <button
            onClick={stopRecording}
            className="w-full bg-red-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-red-700 transition-colors"
          >
            Stop Recording
          </button>
        )}

        {/* Status */}
        <div className="text-center">
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
            status === 'idle' ? 'bg-gray-100 text-gray-800' :
            status === 'requesting' ? 'bg-yellow-100 text-yellow-800' :
            status === 'recording' ? 'bg-red-100 text-red-800' :
            status === 'uploading' ? 'bg-blue-100 text-blue-800' :
            status === 'done' ? 'bg-green-100 text-green-800' :
            'bg-red-100 text-red-800'
          }`}>
            {status === 'idle' && 'Ready to record'}
            {status === 'requesting' && 'Requesting permissions...'}
            {status === 'recording' && 'Recording...'}
            {status === 'uploading' && 'Uploading...'}
            {status === 'done' && 'Recording complete'}
            {status === 'error' && 'Error occurred'}
          </span>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}
      </div>

      {/* Hidden Canvas */}
      <canvas
        ref={canvasRef}
        style={{ display: 'none' }}
      />

      {/* Recording Preview */}
      {recordingData && (
        <div className="border border-gray-200 rounded-lg p-4 mb-6">
          <h4 className="font-medium text-gray-900 mb-3">Recording Preview</h4>
          
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span>Duration: {formatDuration(recordingData.duration)}</span>
              <span>Size: {formatFileSize(recordingData.size)}</span>
            </div>
            
            <div className="flex justify-between text-sm">
              <span>Resolution: {recordingData.width}×{recordingData.height}</span>
              <span>Format: {recordingData.mimeType}</span>
            </div>

            {isOverLimit() && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-700 text-sm">
                  ⚠️ Recording exceeds limits (45 min / 1.5 GB). Consider splitting into smaller recordings.
                </p>
              </div>
            )}

            {/* Upload Section */}
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Recording filename"
                defaultValue={`recording_${new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-')}.webm`}
                className="w-full p-2 border border-gray-300 rounded-lg"
                id="recording-filename"
              />
              
              {status === 'done' && (
                <button
                  onClick={() => {
                    const filename = document.getElementById('recording-filename').value;
                    uploadRecording(filename);
                  }}
                  className="w-full bg-green-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-green-700 transition-colors"
                >
                  Upload Recording
                </button>
              )}

              {status === 'uploading' && (
                <div className="space-y-2">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>{progress}% uploaded</span>
                    <button
                      onClick={cancelUpload}
                      className="text-red-600 hover:text-red-700"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

                   {/* Instructions */}
             <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
               <p className="font-medium mb-2">Instructions:</p>
               <ul className="list-disc list-inside space-y-1">
                 <li>Configure webcam shape (circle/rectangle) and size</li>
                 <li>Optionally select a specific screen area to record</li>
                 <li>Click "Start Recording" to begin screen and camera capture</li>
                 <li>Your webcam will appear in the bottom-right corner</li>
                 <li>Click "Stop Recording" when finished</li>
                 <li>Review the recording details and upload</li>
                 <li>Maximum duration: 45 minutes, Maximum size: 1.5 GB</li>
               </ul>
             </div>
    </div>
  );
};

export default ScreenCamRecorder;

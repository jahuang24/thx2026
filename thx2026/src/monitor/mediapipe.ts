import {
  FaceLandmarker,
  FilesetResolver,
  HandLandmarker,
  PoseLandmarker
} from '@mediapipe/tasks-vision';
import { RollingFeatureEngine, type FeatureOutputFrame, type NormalizedLandmark } from './features';

interface LandmarkerBundle {
  faceLandmarker: FaceLandmarker;
  handLandmarker: HandLandmarker;
  poseLandmarker: PoseLandmarker;
}

export interface MonitorSessionOptions {
  subjectId: string;
  videoElement: HTMLVideoElement;
  debugCanvas?: HTMLCanvasElement | null;
  shouldShowDebugOverlay: () => boolean;
  targetFps?: number;
  onFrame: (frame: FeatureOutputFrame) => void;
}

export interface MonitorSession {
  stop: () => void;
  stream: MediaStream;
}

const VISION_WASM_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm';
let bundlePromise: Promise<LandmarkerBundle> | null = null;

function normalizeErrorMessage(error: unknown) {
  if (typeof window !== 'undefined') {
    const hasMediaDevices = !!navigator.mediaDevices?.getUserMedia;
    if (!hasMediaDevices) {
      return 'Camera API unavailable in this browser/context. Use https://localhost and allow camera access.';
    }
  }
  if (error instanceof DOMException && error.name === 'NotAllowedError') {
    return 'Camera permission denied. Allow webcam access and retry.';
  }
  if (error instanceof DOMException && error.name === 'NotFoundError') {
    return 'No camera was found on this device.';
  }
  if (error instanceof DOMException && error.name === 'NotReadableError') {
    return 'Camera is already in use by another app. Close other camera apps and retry.';
  }
  if (error instanceof DOMException && error.name === 'SecurityError') {
    return 'Secure context required for camera access. Use https://localhost or http://localhost.';
  }
  if (error instanceof Error) {
    if (error.message.toLowerCase().includes('fetch') || error.message.toLowerCase().includes('network')) {
      return 'Failed to load MediaPipe model assets. Check internet/firewall/ad-blockers and retry.';
    }
    return error.message || 'Monitor setup failed unexpectedly.';
  }
  if (typeof error === 'string' && error.trim().length > 0) {
    return error;
  }
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const maybeMessage = String((error as { message?: unknown }).message ?? '').trim();
    if (maybeMessage) {
      return maybeMessage;
    }
  }
  return 'Monitor setup failed unexpectedly.';
}

async function getLandmarkerBundle() {
  if (!bundlePromise) {
    bundlePromise = (async () => {
      const fileset = await FilesetResolver.forVisionTasks(VISION_WASM_BASE);
      const faceLandmarker = await FaceLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'
        },
        numFaces: 1,
        runningMode: 'VIDEO'
      });
      const poseLandmarker = await PoseLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'
        },
        runningMode: 'VIDEO',
        numPoses: 1
      });
      const handLandmarker = await HandLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'
        },
        runningMode: 'VIDEO',
        numHands: 2
      });
      return { faceLandmarker, poseLandmarker, handLandmarker };
    })();
  }
  try {
    return await bundlePromise;
  } catch (error) {
    bundlePromise = null;
    throw error;
  }
}

function drawDebugOverlay(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  pose: NormalizedLandmark[] | undefined,
  face: NormalizedLandmark[] | undefined
) {
  const context = canvas.getContext('2d');
  if (!context) {
    return;
  }
  if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.lineWidth = 1;
  context.strokeStyle = 'rgba(26, 86, 219, 0.4)';
  context.fillStyle = 'rgba(26, 86, 219, 0.45)';

  if (face && face.length > 0) {
    for (const point of face.slice(0, 60)) {
      context.beginPath();
      context.arc(point.x * canvas.width, point.y * canvas.height, 1.5, 0, Math.PI * 2);
      context.fill();
    }
  }

  if (pose && pose.length > 24) {
    const keypoints = [pose[0], pose[11], pose[12], pose[23], pose[24]];
    context.strokeStyle = 'rgba(14, 116, 144, 0.5)';
    context.beginPath();
    keypoints.forEach((point, index) => {
      const x = point.x * canvas.width;
      const y = point.y * canvas.height;
      if (index === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
    });
    context.stroke();
  }
}

export async function startMonitorSession(options: MonitorSessionOptions): Promise<MonitorSession> {
  let stream: MediaStream | null = null;
  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Camera API unavailable in this browser/context. Use https://localhost and allow camera access.');
    }
    stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } },
      audio: false
    });

    options.videoElement.srcObject = stream;
    options.videoElement.playsInline = true;
    options.videoElement.muted = true;
    await options.videoElement.play();

    const { faceLandmarker, handLandmarker, poseLandmarker } = await getLandmarkerBundle();
    const featureEngine = new RollingFeatureEngine();
    let rafId = 0;
    let running = true;
    let lastProcessedMs = 0;
    const frameIntervalMs = 1000 / (options.targetFps ?? 12);

    const loop = () => {
      if (!running) {
        return;
      }
      rafId = window.requestAnimationFrame(loop);

      const nowPerformanceMs = performance.now();
      if (nowPerformanceMs - lastProcessedMs < frameIntervalMs) {
        return;
      }
      if (options.videoElement.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA) {
        return;
      }
      lastProcessedMs = nowPerformanceMs;

      const faceResult = faceLandmarker.detectForVideo(options.videoElement, nowPerformanceMs) as {
        faceLandmarks?: NormalizedLandmark[][];
      };
      const handResult = handLandmarker.detectForVideo(options.videoElement, nowPerformanceMs) as {
        landmarks?: NormalizedLandmark[][];
      };
      const poseResult = poseLandmarker.detectForVideo(options.videoElement, nowPerformanceMs) as {
        landmarks?: NormalizedLandmark[][];
      };

      const face = faceResult.faceLandmarks?.[0];
      const pose = poseResult.landmarks?.[0];
      const hands = handResult.landmarks;

      const processed = featureEngine.ingest({
        ts: Date.now(),
        subjectId: options.subjectId,
        faceLandmarks: face,
        poseLandmarks: pose,
        handLandmarks: hands
      });
      options.onFrame(processed);

      if (options.shouldShowDebugOverlay() && options.debugCanvas) {
        drawDebugOverlay(options.debugCanvas, options.videoElement, pose, face);
      } else if (options.debugCanvas) {
        const context = options.debugCanvas.getContext('2d');
        context?.clearRect(0, 0, options.debugCanvas.width, options.debugCanvas.height);
      }
    };

    rafId = window.requestAnimationFrame(loop);

    if (!stream) {
      throw new Error('Camera stream failed to initialize.');
    }
    const activeStream = stream;

    const stop = () => {
      running = false;
      window.cancelAnimationFrame(rafId);
      activeStream.getTracks().forEach((track) => track.stop());
      options.videoElement.pause();
      options.videoElement.srcObject = null;
      if (options.debugCanvas) {
        const context = options.debugCanvas.getContext('2d');
        context?.clearRect(0, 0, options.debugCanvas.width, options.debugCanvas.height);
      }
    };

    return { stop, stream: activeStream };
  } catch (error) {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    throw new Error(normalizeErrorMessage(error));
  }
}

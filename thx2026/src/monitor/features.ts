import type { MonitorEvent, MonitorEventType, RollingMetricsSnapshot } from '../types/monitor';

export interface NormalizedLandmark {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

export interface FeatureInputFrame {
  ts: number;
  subjectId: string;
  faceLandmarks?: NormalizedLandmark[];
  poseLandmarks?: NormalizedLandmark[];
  handLandmarks?: NormalizedLandmark[][];
}

export interface FeatureOutputFrame {
  metrics: RollingMetricsSnapshot;
  events: MonitorEvent[];
  noSubjectDetected: boolean;
}

interface WeightedSample {
  ts: number;
  value: number;
}

interface BooleanSample {
  ts: number;
  value: boolean;
}

const EVENT_COOLDOWN_MS: Record<MonitorEventType, number> = {
  HAND_TO_MOUTH: 1800,
  HAND_TO_TEMPLE: 1800,
  FORWARD_LEAN: 6000,
  POSTURE_DROP: 10000,
  MAJOR_POSTURE_SHIFT: 7000,
  PROLONGED_EYE_CLOSURE: 20000,
  RESTLESSNESS_SPIKE: 15000,
  NO_SUBJECT: 10000
};

const TWO_MINUTES_MS = 120000;
const ONE_MINUTE_MS = 60000;
const FACE_GRACE_MS = 1200;
const POSTURE_DROP_DELTA_Y = 0.1;
const POSTURE_DROP_CONFIRM_MS = 1800;
const POSTURE_DROP_CANCEL_MS = 4500;
const POSTURE_DROP_STILLNESS_MAX = 0.14;
const POSTURE_DROP_RECOVERY_DELTA_Y = 0.04;
const POSTURE_CHANGE_VELOCITY = 0.02;
const POSTURE_CHANGE_DELTA = 0.015;
const POSTURE_CHANGE_REFRACTORY_MS = 850;
const MAJOR_POSTURE_SHIFT_VELOCITY = 0.09;
const MAJOR_POSTURE_SHIFT_DELTA = 0.065;

function distance(a: NormalizedLandmark, b: NormalizedLandmark) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function midpoint(a: NormalizedLandmark, b: NormalizedLandmark): NormalizedLandmark {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function createEvent(subjectId: string, ts: number, type: MonitorEventType, detail?: string): MonitorEvent {
  return {
    id: `${type}-${subjectId}-${ts}-${Math.random().toString(36).slice(2, 7)}`,
    ts,
    subjectId,
    type,
    detail
  };
}

function sumSamples(samples: WeightedSample[], windowMs: number, nowTs: number) {
  return samples
    .filter((sample) => nowTs - sample.ts <= windowMs)
    .reduce((total, sample) => total + sample.value, 0);
}

function averageSamples(samples: WeightedSample[], windowMs: number, nowTs: number) {
  const inWindow = samples.filter((sample) => nowTs - sample.ts <= windowMs);
  if (inWindow.length === 0) {
    return 0;
  }
  return inWindow.reduce((total, sample) => total + sample.value, 0) / inWindow.length;
}

function countTrue(samples: BooleanSample[], windowMs: number, nowTs: number) {
  const inWindow = samples.filter((sample) => nowTs - sample.ts <= windowMs);
  if (inWindow.length === 0) {
    return 0;
  }
  const closed = inWindow.filter((sample) => sample.value).length;
  return closed / inWindow.length;
}

export class RollingFeatureEngine {
  private lastTs: number | null = null;
  private previousShoulderMid: NormalizedLandmark | null = null;
  private previousPoseNose: NormalizedLandmark | null = null;
  private handToMouthPrevious = false;
  private handToTemplePrevious = false;
  private forwardLeanPrevious = false;
  private eyeClosedSamples: BooleanSample[] = [];
  private movementSamples: WeightedSample[] = [];
  private forwardLeanSamples: WeightedSample[] = [];
  private postureChangeTimestamps: number[] = [];
  private handToMouthTimestamps: number[] = [];
  private handToTempleTimestamps: number[] = [];
  private latestNoSubjectTs = 0;
  private latestEventTs: Partial<Record<MonitorEventType, number>> = {};
  private latestFaceLandmarks: NormalizedLandmark[] | null = null;
  private latestFaceTs = 0;
  private postureDropCandidate: { armedAt: number; shoulderY: number } | null = null;
  private lastPostureChangeTs = 0;

  reset() {
    this.lastTs = null;
    this.previousShoulderMid = null;
    this.previousPoseNose = null;
    this.handToMouthPrevious = false;
    this.handToTemplePrevious = false;
    this.forwardLeanPrevious = false;
    this.eyeClosedSamples = [];
    this.movementSamples = [];
    this.forwardLeanSamples = [];
    this.postureChangeTimestamps = [];
    this.handToMouthTimestamps = [];
    this.handToTempleTimestamps = [];
    this.latestNoSubjectTs = 0;
    this.latestEventTs = {};
    this.latestFaceLandmarks = null;
    this.latestFaceTs = 0;
    this.postureDropCandidate = null;
    this.lastPostureChangeTs = 0;
  }

  ingest(frame: FeatureInputFrame): FeatureOutputFrame {
    const nowTs = frame.ts;
    const events: MonitorEvent[] = [];
    const dtSeconds = this.lastTs === null ? 0 : Math.max(0, (nowTs - this.lastTs) / 1000);
    this.lastTs = nowTs;
    this.prune(nowTs);

    const hasFace = !!frame.faceLandmarks?.length;
    const hasPose = !!frame.poseLandmarks?.length;
    const hasHands = !!frame.handLandmarks?.length;
    const noSubjectDetected = !hasFace && !hasPose && !hasHands;

    if (noSubjectDetected) {
      if (nowTs - this.latestNoSubjectTs > EVENT_COOLDOWN_MS.NO_SUBJECT) {
        this.latestNoSubjectTs = nowTs;
        events.push(createEvent(frame.subjectId, nowTs, 'NO_SUBJECT', 'No subject detected in camera view.'));
      }
      const metrics = this.snapshot(nowTs);
      return { metrics, events, noSubjectDetected: true };
    }

    const face = frame.faceLandmarks;
    const pose = frame.poseLandmarks;
    const hands = frame.handLandmarks ?? [];

    if (face && face.length > 387) {
      this.latestFaceLandmarks = face;
      this.latestFaceTs = nowTs;
      const leftEyeOpen = distance(face[159], face[145]);
      const leftEyeWidth = Math.max(distance(face[33], face[133]), 0.001);
      const rightEyeOpen = distance(face[386], face[374]);
      const rightEyeWidth = Math.max(distance(face[362], face[263]), 0.001);
      const openness = ((leftEyeOpen / leftEyeWidth) + (rightEyeOpen / rightEyeWidth)) / 2;
      const isClosed = openness < 0.2;
      this.eyeClosedSamples.push({ ts: nowTs, value: isClosed });
      if (isClosed && this.shouldEmit('PROLONGED_EYE_CLOSURE', nowTs)) {
        const perclos = countTrue(this.eyeClosedSamples, ONE_MINUTE_MS, nowTs);
        if (perclos >= 0.3) {
          events.push(
            createEvent(
              frame.subjectId,
              nowTs,
              'PROLONGED_EYE_CLOSURE',
              `Eye closure ratio elevated (${(perclos * 100).toFixed(0)}%).`
            )
          );
        }
      }

    }

    const referenceFace =
      face && face.length > 387
        ? face
        : this.latestFaceLandmarks && nowTs - this.latestFaceTs <= FACE_GRACE_MS
          ? this.latestFaceLandmarks
          : null;

    if (referenceFace) {
      const mouth = midpoint(referenceFace[13], referenceFace[14]);
      const leftTemple = referenceFace[127];
      const rightTemple = referenceFace[356];
      const faceWidth = distance(referenceFace[33], referenceFace[263]);
      const mouthProximityThreshold = Math.max(0.11, Math.min(0.18, faceWidth * 0.62));
      const templeProximityThreshold = Math.max(0.1, Math.min(0.16, faceWidth * 0.48));
      const handContactPoints = hands.flatMap((hand) =>
        [hand[4], hand[8], hand[12], hand[16], hand[20], hand[0]].filter(
          (point): point is NormalizedLandmark => !!point
        )
      );

      const handToMouth = handContactPoints.some((point) => distance(point, mouth) <= mouthProximityThreshold);
      const handToTemple = handContactPoints.some(
        (point) =>
          distance(point, leftTemple) <= templeProximityThreshold ||
          distance(point, rightTemple) <= templeProximityThreshold
      );

      if (handToMouth && !this.handToMouthPrevious && this.shouldEmit('HAND_TO_MOUTH', nowTs)) {
        this.handToMouthTimestamps.push(nowTs);
        events.push(
          createEvent(
            frame.subjectId,
            nowTs,
            'HAND_TO_MOUTH',
            `Hand moved into mouth proximity (threshold ${mouthProximityThreshold.toFixed(2)}).`
          )
        );
      }
      if (handToTemple && !this.handToTemplePrevious && this.shouldEmit('HAND_TO_TEMPLE', nowTs)) {
        this.handToTempleTimestamps.push(nowTs);
        events.push(createEvent(frame.subjectId, nowTs, 'HAND_TO_TEMPLE', 'Hand moved into temple proximity.'));
      }
      this.handToMouthPrevious = handToMouth;
      this.handToTemplePrevious = handToTemple;
    } else {
      this.handToMouthPrevious = false;
      this.handToTemplePrevious = false;
    }

    if (pose && pose.length > 24) {
      const nose = pose[0];
      const leftShoulder = pose[11];
      const rightShoulder = pose[12];
      const leftHip = pose[23];
      const rightHip = pose[24];
      const shoulderMid = midpoint(leftShoulder, rightShoulder);
      const hipMid = midpoint(leftHip, rightHip);
      const forwardLean = nose.y >= shoulderMid.y + 0.05 || shoulderMid.y >= hipMid.y - 0.06;

      if (forwardLean && dtSeconds > 0) {
        this.forwardLeanSamples.push({ ts: nowTs, value: dtSeconds });
      }
      if (forwardLean && !this.forwardLeanPrevious && this.shouldEmit('FORWARD_LEAN', nowTs)) {
        events.push(createEvent(frame.subjectId, nowTs, 'FORWARD_LEAN', 'Forward lean posture detected.'));
      }
      this.forwardLeanPrevious = forwardLean;

      if (this.previousShoulderMid && dtSeconds > 0) {
        const shoulderDelta = distance(shoulderMid, this.previousShoulderMid);
        const postureVelocity = shoulderDelta / dtSeconds;
        const normalizedMovement = clamp01(postureVelocity * 4);
        this.movementSamples.push({ ts: nowTs, value: normalizedMovement });

        const postureShiftDetected =
          postureVelocity >= POSTURE_CHANGE_VELOCITY || shoulderDelta >= POSTURE_CHANGE_DELTA;
        const postureShiftCooledDown = nowTs - this.lastPostureChangeTs >= POSTURE_CHANGE_REFRACTORY_MS;
        if (postureShiftDetected && postureShiftCooledDown) {
          this.postureChangeTimestamps.push(nowTs);
          this.lastPostureChangeTs = nowTs;
        }

        const majorPostureShiftDetected =
          postureVelocity >= MAJOR_POSTURE_SHIFT_VELOCITY || shoulderDelta >= MAJOR_POSTURE_SHIFT_DELTA;
        if (majorPostureShiftDetected && this.shouldEmit('MAJOR_POSTURE_SHIFT', nowTs)) {
          events.push(
            createEvent(
              frame.subjectId,
              nowTs,
              'MAJOR_POSTURE_SHIFT',
              `Abrupt major posture shift detected (delta ${shoulderDelta.toFixed(3)}, velocity ${postureVelocity.toFixed(3)}).`
            )
          );
        }

        const dropDeltaY = shoulderMid.y - this.previousShoulderMid.y;
        const droppedSuddenly = dropDeltaY >= POSTURE_DROP_DELTA_Y;
        if (droppedSuddenly) {
          this.postureDropCandidate = { armedAt: nowTs, shoulderY: shoulderMid.y };
        }

        if (this.postureDropCandidate) {
          const elapsed = nowTs - this.postureDropCandidate.armedAt;
          const recentMovement = averageSamples(this.movementSamples, 2000, nowTs);
          const recovered = shoulderMid.y < this.postureDropCandidate.shoulderY - POSTURE_DROP_RECOVERY_DELTA_Y;
          const timedOut = elapsed > POSTURE_DROP_CANCEL_MS;
          const confirmedStillness = elapsed >= POSTURE_DROP_CONFIRM_MS && recentMovement <= POSTURE_DROP_STILLNESS_MAX;

          if (confirmedStillness && this.shouldEmit('POSTURE_DROP', nowTs)) {
            events.push(
              createEvent(
                frame.subjectId,
                nowTs,
                'POSTURE_DROP',
                `Sudden posture drop with sustained stillness (movement ${recentMovement.toFixed(2)}).`
              )
            );
            this.postureDropCandidate = null;
          } else if (recovered || timedOut) {
            this.postureDropCandidate = null;
          }
        }
      }

      if (this.previousPoseNose && dtSeconds > 0) {
        const noseDelta = distance(nose, this.previousPoseNose) / dtSeconds;
        const compositeMovement = clamp01(noseDelta * 2.5);
        this.movementSamples.push({ ts: nowTs, value: compositeMovement });
      }

      this.previousShoulderMid = shoulderMid;
      this.previousPoseNose = nose;
    }

    const metrics = this.snapshot(nowTs);
    if (
      metrics.movementLevel >= 0.75 &&
      metrics.postureChangeRate >= 8 &&
      this.shouldEmit('RESTLESSNESS_SPIKE', nowTs)
    ) {
      events.push(createEvent(frame.subjectId, nowTs, 'RESTLESSNESS_SPIKE', 'Movement and posture shifts spiked.'));
    }

    return { metrics, events, noSubjectDetected: false };
  }

  private shouldEmit(type: MonitorEventType, nowTs: number) {
    const lastEmittedTs = this.latestEventTs[type] ?? 0;
    if (nowTs - lastEmittedTs < EVENT_COOLDOWN_MS[type]) {
      return false;
    }
    this.latestEventTs[type] = nowTs;
    return true;
  }

  private prune(nowTs: number) {
    this.eyeClosedSamples = this.eyeClosedSamples.filter((sample) => nowTs - sample.ts <= TWO_MINUTES_MS);
    this.movementSamples = this.movementSamples.filter((sample) => nowTs - sample.ts <= TWO_MINUTES_MS);
    this.forwardLeanSamples = this.forwardLeanSamples.filter((sample) => nowTs - sample.ts <= TWO_MINUTES_MS);
    this.postureChangeTimestamps = this.postureChangeTimestamps.filter((ts) => nowTs - ts <= TWO_MINUTES_MS);
    this.handToMouthTimestamps = this.handToMouthTimestamps.filter((ts) => nowTs - ts <= TWO_MINUTES_MS);
    this.handToTempleTimestamps = this.handToTempleTimestamps.filter((ts) => nowTs - ts <= TWO_MINUTES_MS);
  }

  private snapshot(nowTs: number): RollingMetricsSnapshot {
    const handToMouthPerMin = this.handToMouthTimestamps.filter((ts) => nowTs - ts <= ONE_MINUTE_MS).length;
    const handToTemplePerMin = this.handToTempleTimestamps.filter((ts) => nowTs - ts <= ONE_MINUTE_MS).length;
    const forwardLeanSecondsPerMin = sumSamples(this.forwardLeanSamples, ONE_MINUTE_MS, nowTs);
    const postureChangeRate = this.postureChangeTimestamps.filter((ts) => nowTs - ts <= ONE_MINUTE_MS).length;
    const movementLevel = averageSamples(this.movementSamples, 20000, nowTs);
    const perclos = countTrue(this.eyeClosedSamples, ONE_MINUTE_MS, nowTs);

    return {
      perclos: clamp01(perclos),
      handToMouthPerMin,
      handToTemplePerMin,
      forwardLeanSecondsPerMin: Number(forwardLeanSecondsPerMin.toFixed(2)),
      postureChangeRate,
      movementLevel: Number(clamp01(movementLevel).toFixed(2))
    };
  }
}

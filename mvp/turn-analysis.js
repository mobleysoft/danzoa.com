/*
 * Pirouette/turn technique analyzer -- core signal-processing engine.
 *
 * Honest scope note: full "record a student on video, get form-correction
 * notes" requires either a trained pose-estimation model or a human
 * reviewer. No ML model is bundled or fetched here (no runtime dependency,
 * per sovereignty doctrine, and no key/model available in this
 * environment to fake one honestly). What IS real and built: a frame-
 * brightness-centroid rotation tracker -- given a sequence of grayscale
 * video frames (as 2D brightness arrays), it computes the dancer's real
 * rotation angle over time using image moments (intensity-weighted
 * centroid vs. frame center), counts full turns, and measures rotational
 * speed consistency -- the single most diagnosable pirouette fault
 * (uneven rotation speed / wobble) without needing a trained model.
 * This is a genuine, narrower slice of the spec, not the full spec
 * faked as complete.
 */

function frameCentroidAngle(frame) {
  // frame: 2D array of brightness values 0-255 (grayscale).
  const h = frame.length;
  const w = frame[0].length;
  const cx0 = w / 2, cy0 = h / 2;
  let sumW = 0, sumX = 0, sumY = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const wgt = frame[y][x];
      sumW += wgt;
      sumX += wgt * x;
      sumY += wgt * y;
    }
  }
  if (sumW === 0) return null;
  const cx = sumX / sumW;
  const cy = sumY / sumW;
  return Math.atan2(cy - cy0, cx - cx0); // radians, -PI..PI
}

function unwrap(prev, curr) {
  let d = curr - prev;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

function analyzeRotationFrames(frames, fps = 30) {
  if (!frames || frames.length < 2) {
    throw new Error('Need at least 2 frames to measure rotation');
  }
  const angles = frames.map(frameCentroidAngle);
  if (angles.some(a => a === null)) {
    throw new Error('One or more frames had zero total brightness -- cannot locate a centroid');
  }

  const deltas = [];
  for (let i = 1; i < angles.length; i++) {
    deltas.push(unwrap(angles[i - 1], angles[i]));
  }

  const totalRotationRad = deltas.reduce((a, b) => a + b, 0);
  const totalRotationDeg = totalRotationRad * (180 / Math.PI);
  const fullTurns = totalRotationDeg / 360;

  const angularVelocityDegPerSec = deltas.map(d => (d * 180 / Math.PI) * fps);
  const mean = angularVelocityDegPerSec.reduce((a, b) => a + b, 0) / angularVelocityDegPerSec.length;
  const variance = angularVelocityDegPerSec.reduce((a, b) => a + (b - mean) ** 2, 0) / angularVelocityDegPerSec.length;
  const stdDev = Math.sqrt(variance);
  // Coefficient of variation is a scale-independent consistency metric.
  const consistencyCV = mean !== 0 ? Math.abs(stdDev / mean) : Infinity;

  let feedback;
  if (Math.abs(fullTurns) < 0.5) {
    feedback = 'Less than half a turn detected -- check framing, or this may not be a turn attempt.';
  } else if (consistencyCV < 0.15) {
    feedback = 'Rotation speed is consistent through the turn -- good spot/control technique.';
  } else if (consistencyCV < 0.35) {
    feedback = 'Some rotation-speed unevenness detected -- likely a spotting or preparation timing issue.';
  } else {
    feedback = 'High rotation-speed variability -- turn is decelerating/accelerating unevenly, common sign of losing the spot or insufficient turnout on preparation.';
  }

  return {
    frameCount: frames.length,
    totalRotationDeg: round2(totalRotationDeg),
    fullTurns: round2(fullTurns),
    meanAngularVelocityDegPerSec: round2(mean),
    stdDevAngularVelocity: round2(stdDev),
    consistencyCV: round2(consistencyCV),
    feedback
  };
}

function round2(n) { return Math.round(n * 100) / 100; }

if (typeof module !== 'undefined') {
  module.exports = { analyzeRotationFrames, frameCentroidAngle };
}

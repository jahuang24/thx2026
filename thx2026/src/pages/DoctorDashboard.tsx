import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertList } from '../components/AlertList';
import { RoomRow } from '../components/RoomRow';
import { StatusPill } from '../components/StatusPill';
import { StatCard } from '../components/StatCard';
import { alerts as seedAlerts, beds, rooms } from '../data/mock';
import { normalizeBedId, normalizeRoomId } from '../services/patientApi';
import { realtimeBus } from '../services/realtime';
import { store } from '../services/store';
import { fetchPatients, getCachedPatients, type PatientRecord } from '../services/patientApi';
import { shortestPath, type Coordinate, type GraphMap, type GraphNodeId } from '../decision_support';
import type { Room, RoomStatus } from '../types';

type FloorplanSlot = {
  roomId: string;
  label: string;
  points: [number, number][];
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const statusFills: Record<RoomStatus, { color: string; opacity: number }> = {
  READY: { color: '#e1f4e7', opacity: 1 },
  NOT_READY: { color: '#f59e0b', opacity: 0.75 },
  CLEANING: { color: '#14b8a6', opacity: 0.75 },
  NEEDS_MAINTENANCE: { color: '#f43f5e', opacity: 0.75 },
  OCCUPIED: { color: '#dce5ef', opacity: 1 }
};

export function DoctorDashboard() {
  const navigate = useNavigate();
  const [liveAlerts, setLiveAlerts] = useState(seedAlerts);
  const [patients, setPatients] = useState<PatientRecord[]>([]);
  const [hoveredRoomId, setHoveredRoomId] = useState<string | null>(null);
  const floorplanRef = useRef<HTMLDivElement | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const isPanning = useRef(false);
  const lastPointer = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const unsubscribe = realtimeBus.on('newAlert', ({ alert }) => {
      setLiveAlerts((prev) => [alert as typeof prev[number], ...prev]);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const cached = getCachedPatients();
      if (cached?.length) {
        setPatients(cached);
      }
      const result = await fetchPatients({ force: true });
      if (active) setPatients(result);
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  const derivedBeds = useMemo(() => {
    const occupiedByBed = new Map<string, string>();
    const occupiedByRoom = new Map<string, string[]>();
    patients.forEach((patient) => {
      const normalizedRoom = normalizeRoomId(patient.roomId);
      const normalizedBed = normalizeBedId(patient.bedId, normalizedRoom);

      if (normalizedBed) {
        occupiedByBed.set(normalizedBed, patient.id);
        return;
      }

      if (normalizedRoom) {
        const list = occupiedByRoom.get(normalizedRoom) ?? [];
        list.push(patient.id);
        occupiedByRoom.set(normalizedRoom, list);
      }
    });

    const nextBeds = beds.map((bed) => ({
      ...bed,
      occupied: occupiedByBed.has(bed.id),
      patientId: occupiedByBed.get(bed.id) ?? null
    }));

    occupiedByRoom.forEach((patientIds, roomId) => {
      patientIds.forEach((patientId) => {
        const target = nextBeds.find((bed) => bed.roomId === roomId && !bed.occupied);
        if (target) {
          target.occupied = true;
          target.patientId = patientId;
        }
      });
    });

    return nextBeds;
  }, [patients]);

  const roomOccupancy = useMemo(() => {
    const occupancy = new Map<string, { occupied: number; total: number }>();
    derivedBeds.forEach((bed) => {
      const entry = occupancy.get(bed.roomId) ?? { occupied: 0, total: 0 };
      entry.total += 1;
      if (bed.occupied) entry.occupied += 1;
      occupancy.set(bed.roomId, entry);
    });
    return occupancy;
  }, [derivedBeds]);

  const derivedRooms = useMemo<Room[]>(() => {
    return rooms.map((room): Room => {
      const occupancy = roomOccupancy.get(room.id);
      const isFull = occupancy ? occupancy.occupied >= occupancy.total && occupancy.total > 0 : false;
      return {
        ...room,
        status: isFull ? 'OCCUPIED' : 'READY',
        maintenanceFlags: [],
        readinessReasons: []
      };
    });
  }, [roomOccupancy]);

  const stats = useMemo(() => {
    const readyRooms = derivedRooms.filter((room) => room.status === 'READY').length;
    const cleaningRooms = derivedRooms.filter((room) => room.status === 'CLEANING').length;
    const occupiedBeds = derivedBeds.filter((bed) => bed.occupied).length;
    const occupancyRate = Math.round((occupiedBeds / derivedBeds.length) * 100);

    return {
      occupancyRate,
      readyRooms,
      cleaningRooms,
      openAlerts: store.alerts.filter((alert) => alert.status === 'OPEN').length
    };
  }, [derivedBeds, derivedRooms]);

  const floorplanRooms: FloorplanSlot[] = useMemo(
    () => [
      { roomId: 'room-401', label: '401', points: [[0.524578, 0.346939], [0.524578, 0.260544], [0.333456, 0.261224], [0.380044, 0.346939]] },
      { roomId: 'room-402', label: '402', points: [[0.526412, 0.260544], [0.526412, 0.347619], [0.668012, 0.347619], [0.668012, 0.260544]] },
      { roomId: 'room-403', label: '403', points: [[0.669479, 0.260544], [0.669479, 0.347619], [0.811079, 0.347619], [0.811079, 0.260544]] },
      { roomId: 'room-404', label: '404', points: [[0.812546, 0.260544], [0.812546, 0.347619], [0.954879, 0.347619], [0.954879, 0.260544]] },
      { roomId: 'room-405', label: '405', points: [[0.330888, 0.266667], [0.245415, 0.42381], [0.290536, 0.508844], [0.376009, 0.35102]] },
      { roomId: 'room-406', label: '406', points: [[0.396185, 0.382993], [0.396185, 0.492517], [0.524945, 0.492517], [0.524945, 0.382993]] },
      { roomId: 'room-407', label: '407', points: [[0.526412, 0.382993], [0.526412, 0.492517], [0.668012, 0.492517], [0.668012, 0.382993]] },
      { roomId: 'room-408', label: '408', points: [[0.669479, 0.382993], [0.669479, 0.492517], [0.811079, 0.492517], [0.811079, 0.382993]] },
      { roomId: 'room-409', label: '409', points: [[0.812913, 0.382993], [0.812913, 0.492517], [0.954512, 0.492517], [0.954512, 0.382993]] },
      { roomId: 'room-410', label: '410', points: [[0.392517, 0.387075], [0.309611, 0.540816], [0.337858, 0.595238], [0.392517, 0.495238]] },
      { roomId: 'room-411', label: '411', points: [[0.243947, 0.427211], [0.158474, 0.585034], [0.203595, 0.669388], [0.289068, 0.512245]] },
      { roomId: 'room-412', label: '412', points: [[0.308144, 0.543537], [0.220836, 0.704762], [0.24945, 0.758503], [0.336757, 0.597279]] },
      { roomId: 'room-413', label: '413', points: [[0.15774, 0.588435], [0.069332, 0.751701], [0.114453, 0.836054], [0.202861, 0.672789]] },
      { roomId: 'room-414', label: '414', points: [[0.219736, 0.708163], [0.132795, 0.868707], [0.161042, 0.922449], [0.248349, 0.761905]] }
    ],
    []
  );

  // Corridor graph for precise routing along hall centerlines.
  const corridorGraph: GraphMap = useMemo(() => {
    const nodes: GraphMap['nodes'] = {
      tail: { id: 'tail', x: 0.22, y: 0.9 },
      mid1: { id: 'mid1', x: 0.28, y: 0.74 },
      mid2: { id: 'mid2', x: 0.36, y: 0.57 },
      elbow: { id: 'elbow', x: 0.46, y: 0.34 },
      top1: { id: 'top1', x: 0.62, y: 0.32 },
      top2: { id: 'top2', x: 0.78, y: 0.32 },
      top3: { id: 'top3', x: 0.93, y: 0.32 },
      rightLower: { id: 'rightLower', x: 0.93, y: 0.4 }
    };

    const edge = (from: GraphNodeId, to: GraphNodeId) => ({ from, to, weight: 1, bidirectional: true });
    const edges = [
      edge('tail', 'mid1'),
      edge('mid1', 'mid2'),
      edge('mid2', 'elbow'),
      edge('elbow', 'top1'),
      edge('top1', 'top2'),
      edge('top2', 'top3'),
      edge('top3', 'rightLower')
    ];

    return { kind: 'graph', nodes, edges };
  }, []);

  const nearestCorridorNode = (point: { x: number; y: number }) => {
    let best: { id: GraphNodeId; dist: number } | null = null;
    Object.values(corridorGraph.nodes).forEach((node) => {
      const typed = node as { id: GraphNodeId; x?: number; y?: number };
      if (typed.x === undefined || typed.y === undefined) return;
      const dx = point.x - typed.x;
      const dy = point.y - typed.y;
      const d = dx * dx + dy * dy;
      if (!best || d < best.dist) best = { id: typed.id, dist: d };
    });
    return best?.id ?? null;
  };

  const labels = useMemo(() => {
    return floorplanRooms.map((slot) => {
      const centroid = slot.points.reduce(
        (acc, point) => [acc[0] + point[0], acc[1] + point[1]],
        [0, 0]
      );
      return {
        roomId: slot.roomId,
        label: slot.label,
        x: centroid[0] / slot.points.length,
        y: centroid[1] / slot.points.length
      };
    });
  }, [floorplanRooms]);

  const hoveredRoom = useMemo(
    () => (hoveredRoomId ? derivedRooms.find((room) => room.id === hoveredRoomId) : null),
    [derivedRooms, hoveredRoomId]
  );

  const hoveredLabel = useMemo(
    () => (hoveredRoomId ? labels.find((label) => label.roomId === hoveredRoomId) : null),
    [hoveredRoomId, labels]
  );

  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

  const clampPan = (nextPan: { x: number; y: number }, nextZoom: number) => {
    if (!floorplanRef.current) return nextPan;
    const rect = floorplanRef.current.getBoundingClientRect();
    const contentWidth = rect.width * nextZoom;
    const contentHeight = rect.height * nextZoom;
    const minX = Math.min(0, rect.width - contentWidth);
    const minY = Math.min(0, rect.height - contentHeight);
    return {
      x: clamp(nextPan.x, minX, 0),
      y: clamp(nextPan.y, minY, 0)
    };
  };
  const MIN_ZOOM = 0.7;
  const MAX_ZOOM = 3.5;

  // Path selection state
  const [startNodeId, setStartNodeId] = useState<GraphNodeId | null>(null);
  const [endNodeId, setEndNodeId] = useState<GraphNodeId | null>(null);
  const [pathCoords, setPathCoords] = useState<Coordinate[]>([]);
  const [pathError, setPathError] = useState<string | null>(null);
  const [pathMode, setPathMode] = useState(false);

  const zoomAt = (nextZoom: number, anchor?: { x: number; y: number }) => {
    const clampedZoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
    if (!floorplanRef.current) return;
    const rect = floorplanRef.current.getBoundingClientRect();
    const anchorX = anchor?.x ?? rect.width / 2;
    const anchorY = anchor?.y ?? rect.height / 2;
    const scaleFactor = clampedZoom / zoom;
    const nextPan = {
      x: anchorX - (anchorX - pan.x) * scaleFactor,
      y: anchorY - (anchorY - pan.y) * scaleFactor
    };
    setZoom(clampedZoom);
    setPan(clampPan(nextPan, clampedZoom));
  };

  const handleWheel: React.WheelEventHandler<HTMLDivElement> = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!floorplanRef.current) return;
    const rect = floorplanRef.current.getBoundingClientRect();
    const cursorX = event.clientX - rect.left;
    const cursorY = event.clientY - rect.top;

    if (event.ctrlKey) {
      const delta = -event.deltaY;
      const nextZoom = zoom * (1 + delta / 350);
      zoomAt(nextZoom, { x: cursorX, y: cursorY });
      return;
    }

    setPan((prev) =>
      clampPan(
        {
          x: prev.x - event.deltaX,
          y: prev.y - event.deltaY
        },
        zoom
      )
    );
  };

  const handlePointerDown: React.PointerEventHandler<HTMLDivElement> = (event) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest?.('[data-room-hit]')) {
      // clicks on room polygons are used for navigation; don't start panning
      return;
    }
    if (pathMode) {
      // allow click to be handled by onClick for pathing; avoid initiating pan when in path mode
      return;
    }
    isPanning.current = true;
    lastPointer.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove: React.PointerEventHandler<HTMLDivElement> = (event) => {
    if (!isPanning.current) return;
    const dx = event.clientX - lastPointer.current.x;
    const dy = event.clientY - lastPointer.current.y;
    lastPointer.current = { x: event.clientX, y: event.clientY };
    setPan((prev) => clampPan({ x: prev.x + dx, y: prev.y + dy }, zoom));
  };

  const handlePointerUp: React.PointerEventHandler<HTMLDivElement> = (event) => {
    if (!isPanning.current) return;
    isPanning.current = false;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const handleFloorplanClick: React.MouseEventHandler<HTMLDivElement> = (event) => {
    if (!pathMode) return; // ignore when not in Find Path mode
    if (!floorplanRef.current) return;
    const rect = floorplanRef.current.getBoundingClientRect();
    const x = clamp01((event.clientX - rect.left - pan.x) / (rect.width * zoom));
    const y = clamp01((event.clientY - rect.top - pan.y) / (rect.height * zoom));
    const nearest = nearestCorridorNode({ x, y });
    if (!nearest) return;

    // toggle selection: first click sets start, second sets destination, third resets
    if (!startNodeId) {
      setStartNodeId(nearest);
      setEndNodeId(null);
      setPathCoords([]);
      setPathError(null);
      return;
    }
    if (!endNodeId) {
      setEndNodeId(nearest);
      const res = shortestPath(corridorGraph, startNodeId, nearest);
      if (!res.reachable) {
        setPathError(res.reason ?? 'No path found');
        setPathCoords([]);
      } else {
        setPathError(null);
        const coords = (res.path as GraphNodeId[]).map((id) => {
          const node = corridorGraph.nodes[id];
          return { x: node.x ?? 0, y: node.y ?? 0 };
        });
        setPathCoords(coords);
      }
      return;
    }

    // Third click resets to start a new selection cycle
    setStartNodeId(nearest);
    setEndNodeId(null);
    setPathCoords([]);
    setPathError(null);
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Occupancy"
          value={`${stats.occupancyRate}%`}
          hint="Live bed utilization"
          accent="bg-slateBlue-600/10 text-slateBlue-700"
          icon={<span className="text-lg">▣</span>}
        />
        <StatCard
          label="Rooms Ready"
          value={`${stats.readyRooms}`}
          hint="Immediate placement"
          accent="bg-forest-500/10 text-forest-600"
          icon={<span className="text-lg">✓</span>}
        />
        <StatCard
          label="Rooms Cleaning"
          value={`${stats.cleaningRooms}`}
          hint="EVS in progress"
          accent="bg-teal-500/10 text-teal-700"
          icon={<span className="text-lg">✧</span>}
        />
        <StatCard
          label="Open Alerts"
          value={`${stats.openAlerts}`}
          hint="Operational safety" 
          accent="bg-rose-500/10 text-rose-600"
          icon={<span className="text-lg">!</span>}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[2.3fr_1fr]">
        <section className="space-y-3">
          <div className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-panel">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-display font-semibold text-ink-900">Unit Floorplan</h2>
              <div className="flex items-center gap-3 text-xs font-semibold text-ink-500">
                <span className="text-ink-400">Click a room to open</span>
                <div className="h-4 w-px bg-ink-100" aria-hidden />
                <button
                  type="button"
                  onClick={() => {
                    setPathMode((prev) => !prev);
                    setStartNodeId(null);
                    setEndNodeId(null);
                    setPathCoords([]);
                    setPathError(null);
                  }}
                  className={`rounded-full border px-3 py-1 transition ${
                    pathMode
                      ? 'border-ink-400 bg-ink-50 text-ink-800 shadow-sm'
                      : 'border-ink-200 bg-white text-ink-500 hover:bg-ink-50'
                  }`}
                  aria-pressed={pathMode}
                >
                  {pathMode ? 'Find Path: On' : 'Find Path: Off'}
                </button>
              </div>
            </div>
            <div
              ref={floorplanRef}
              className="mt-4 relative aspect-[2726/1470] w-full overflow-hidden rounded-2xl bg-white/70 overscroll-none"
              onWheel={handleWheel}
              onWheelCapture={handleWheel}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
              onClick={handleFloorplanClick}
              style={{ touchAction: 'none' }}
            >
              <div className="absolute right-4 top-4 z-30 flex items-center gap-2 rounded-full border border-white/70 bg-white/90 p-1 shadow-panel">
                <button
                  type="button"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => zoomAt(zoom * 0.9)}
                  className="h-9 w-9 rounded-full text-lg font-semibold text-ink-900 hover:bg-ink-100/70"
                  aria-label="Zoom out"
                >
                  −
                </button>
                <button
                  type="button"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => zoomAt(zoom * 1.1)}
                  className="h-9 w-9 rounded-full text-lg font-semibold text-ink-900 hover:bg-ink-100/70"
                  aria-label="Zoom in"
                >
                  +
                </button>
                <button
                  type="button"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => {
                    setStartNodeId(null);
                    setEndNodeId(null);
                    setPathCoords([]);
                    setPathError(null);
                  }}
                  className="h-9 px-3 rounded-full text-xs font-semibold text-ink-900 hover:bg-ink-100/70"
                  aria-label="Clear path"
                >
                  Clear
                </button>
              </div>
              <div
                className="absolute inset-0"
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  transformOrigin: '0 0'
                }}
              >
                <img
                  src="/Floorplan.png"
                  alt="Hospital floorplan"
                  className="absolute inset-0 h-full w-full object-contain"
                />
                <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1 1" preserveAspectRatio="none">
                  {/* Draw computed path */}
                  {pathCoords.length > 1 && (
                    <polyline
                      points={pathCoords.map((c) => `${c.x},${c.y}`).join(' ')}
                      fill="none"
                      stroke="#0f172a"
                      strokeWidth="0.006"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      vectorEffect="non-scaling-stroke"
                    />
                  )}

                  {/* Start & end markers */}
                  {startNodeId && corridorGraph.nodes[startNodeId] && (
                    <circle
                      cx={corridorGraph.nodes[startNodeId].x}
                      cy={corridorGraph.nodes[startNodeId].y}
                      r={0.006}
                      fill="#10b981"
                      stroke="#0f172a"
                      strokeWidth="0.0025"
                      vectorEffect="non-scaling-stroke"
                    />
                  )}
                  {endNodeId && corridorGraph.nodes[endNodeId] && (
                    <circle
                      cx={corridorGraph.nodes[endNodeId].x}
                      cy={corridorGraph.nodes[endNodeId].y}
                      r={0.006}
                      fill="#ef4444"
                      stroke="#0f172a"
                      strokeWidth="0.0025"
                      vectorEffect="non-scaling-stroke"
                    />
                  )}

                  {floorplanRooms.map((slot) => {
                    const room = derivedRooms.find((item) => item.id === slot.roomId);
                    if (!room) return null;
                    const points = slot.points.map((point) => `${point[0]},${point[1]}`).join(' ');
                    const occupancy = roomOccupancy.get(room.id);
                    const isPartial =
                      occupancy &&
                      occupancy.total > 0 &&
                      occupancy.occupied > 0 &&
                      occupancy.occupied < occupancy.total;
                    const fill = isPartial
                      ? { color: '#fef0e0', opacity: 0.95 }
                      : statusFills[room.status];
                    return (
                      <g
                        key={room.id}
                        data-room-hit
                        className="cursor-pointer"
                        onClick={() => navigate(`/rooms/${room.id}`)}
                        onPointerEnter={() => setHoveredRoomId(room.id)}
                        onPointerLeave={() => setHoveredRoomId(null)}
                      >
                        <polygon
                          points={points}
                          fill="transparent"
                          stroke="transparent"
                          strokeWidth="0.025"
                          vectorEffect="non-scaling-stroke"
                        />
                        <polygon
                          points={points}
                          fill={fill.color}
                          fillOpacity={fill.opacity}
                          stroke="rgba(255,255,255,0.75)"
                          strokeWidth="0.003"
                          vectorEffect="non-scaling-stroke"
                        />
                      </g>
                    );
                  })}
                </svg>
                <div className="pointer-events-none absolute inset-0">
                  {labels.map((label) => (
                    <span
                      key={label.roomId}
                      className="absolute -translate-x-1/2 -translate-y-1/2 text-xs font-semibold text-ink-950"
                      style={{ left: `${label.x * 100}%`, top: `${label.y * 100}%` }}
                    >
                      {label.label}
                    </span>
                  ))}
                </div>
                {hoveredRoom && hoveredLabel && (
                  <div
                    className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-[110%] rounded-2xl border border-white/70 bg-white/95 p-3 text-xs text-ink-700 shadow-xl"
                    style={{ left: `${hoveredLabel.x * 100}%`, top: `${hoveredLabel.y * 100}%` }}
                  >
                    <p className="text-sm font-semibold text-ink-900">Room {hoveredRoom.roomNumber}</p>
                    <p className="text-xs text-ink-500">{hoveredRoom.type.replace('_', ' ')} • {hoveredRoom.unitId}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <StatusPill status={hoveredRoom.status} />
                      <span className="text-[11px] text-ink-400">Click to open</span>
                    </div>
                  </div>
                )}
                {pathError && (
                  <div className="absolute left-4 bottom-4 z-30 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-700 shadow-sm">
                    {pathError}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-display font-semibold text-ink-900">Unit Rooms</h2>
            <button className="rounded-full border border-ink-200 px-3 py-1 text-xs font-semibold text-ink-700">
              Filter
            </button>
          </div>
          <div className="space-y-3">
            {derivedRooms.map((room) => (
              <RoomRow key={room.id} room={room} beds={derivedBeds} patients={patients as any} />
            ))}
          </div>
        </section>

        <div className="space-y-4">
          <section className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-panel">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-display font-semibold text-ink-900">Live Alerts</h2>
              <span className="text-xs text-ink-400">Updated in real-time</span>
            </div>
            <div className="mt-4 max-h-[360px] overflow-y-auto pr-2 scrollbar-thin">
              <AlertList alerts={liveAlerts} />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

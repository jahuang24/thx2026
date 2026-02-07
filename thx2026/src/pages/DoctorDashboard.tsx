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
      // Main east–west hallway (measured from Floorplan.png at 2726×1470px)
      { roomId: 'room-401', label: '401', points: [[0.357347, 0.350680], [0.357347, 0.255782], [0.525017, 0.255782], [0.525017, 0.350680]] },
      { roomId: 'room-402', label: '402', points: [[0.526206, 0.255782], [0.526206, 0.350680], [0.667809, 0.350680], [0.667809, 0.255782]] },
      { roomId: 'room-403', label: '403', points: [[0.668998, 0.255782], [0.668998, 0.350680], [0.811041, 0.350680], [0.811041, 0.255782]] },
      { roomId: 'room-404', label: '404', points: [[0.812230, 0.255782], [0.812230, 0.350680], [0.954842, 0.350680], [0.954842, 0.255782]] },
      // Diagonal branch kept from prior layout; update once we re-digitize that wing
      { roomId: 'room-405', label: '405', points: [[0.330888, 0.266667], [0.245415, 0.42381], [0.290536, 0.508844], [0.376009, 0.35102]] },
      { roomId: 'room-406', label: '406', points: [[0.396036, 0.379592], [0.396036, 0.496599], [0.525017, 0.496599], [0.525017, 0.379592]] },
      { roomId: 'room-407', label: '407', points: [[0.526206, 0.379592], [0.526206, 0.496599], [0.667809, 0.496599], [0.667809, 0.379592]] },
      { roomId: 'room-408', label: '408', points: [[0.668998, 0.379592], [0.668998, 0.496599], [0.811041, 0.496599], [0.811041, 0.379592]] },
      { roomId: 'room-409', label: '409', points: [[0.812596, 0.379592], [0.812596, 0.496599], [0.954420, 0.496599], [0.954420, 0.379592]] },
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
    // centerline points extracted from Floorplan.png (white corridor run midpoints)
    const centerline: Array<{ id: GraphNodeId; x: number; y: number }> = [
      { id: 'c0', x: 0.118122, y: 0.841156 },
      { id: 'c1', x: 0.191489, y: 0.725170 },
      { id: 'c2', x: 0.264857, y: 0.589116 },
      { id: 'c3', x: 0.338225, y: 0.453061 },
      { id: 'c4', x: 0.411592, y: 0.364626 },
      { id: 'c5', x: 0.484960, y: 0.364626 },
      { id: 'c6', x: 0.558327, y: 0.364626 },
      { id: 'c7', x: 0.631695, y: 0.364626 },
      { id: 'c8', x: 0.705062, y: 0.364626 },
      { id: 'c9', x: 0.778430, y: 0.364626 },
      { id: 'c10', x: 0.851798, y: 0.364626 },
      { id: 'c11', x: 0.925165, y: 0.364626 }
    ];

    const nodes: GraphMap['nodes'] = Object.fromEntries(
      centerline.map((pt) => [pt.id, { id: pt.id, x: pt.x, y: pt.y }])
    );

    const edges: GraphMap['edges'] = centerline.slice(1).map((pt, idx) => ({
      from: centerline[idx].id,
      to: pt.id,
      weight: 1,
      bidirectional: true
    }));

    return { kind: 'graph', nodes, edges };
  }, []);

  type CorridorAnchor = {
    point: Coordinate;
    edge: [GraphNodeId, GraphNodeId];
  };

  const distance = (a: Coordinate, b: Coordinate) => Math.hypot(a.x - b.x, a.y - b.y);

  const projectToSegment = (p: Coordinate, a: Coordinate, b: Coordinate) => {
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const apx = p.x - a.x;
    const apy = p.y - a.y;
    const abLen2 = abx * abx + aby * aby || 1e-9;
    const t = Math.min(1, Math.max(0, (apx * abx + apy * aby) / abLen2));
    return { x: a.x + abx * t, y: a.y + aby * t };
  };

  const nearestCorridorAnchor = (point: Coordinate): CorridorAnchor | null => {
    let bestAnchor: CorridorAnchor | null = null;
    let bestDist2 = Number.POSITIVE_INFINITY;
    for (const edge of corridorGraph.edges) {
      const from = corridorGraph.nodes[edge.from];
      const to = corridorGraph.nodes[edge.to];
      if (from?.x === undefined || from?.y === undefined || to?.x === undefined || to?.y === undefined) continue;
      const projected = projectToSegment(point, { x: from.x, y: from.y }, { x: to.x, y: to.y });
      const dx = point.x - projected.x;
      const dy = point.y - projected.y;
      const dist2 = dx * dx + dy * dy;
      if (dist2 < bestDist2) {
        bestDist2 = dist2;
        bestAnchor = { point: projected, edge: [edge.from, edge.to] };
      }
    }
    return bestAnchor;
  };

  const anchorEdges = (id: GraphNodeId, anchor: CorridorAnchor) => {
    const [aId, bId] = anchor.edge;
    const aNode = corridorGraph.nodes[aId];
    const bNode = corridorGraph.nodes[bId];
    const edges: GraphMap['edges'] = [];
    if (aNode?.x !== undefined && aNode?.y !== undefined) {
      edges.push({
        from: id,
        to: aId,
        weight: distance(anchor.point, { x: aNode.x, y: aNode.y }),
        bidirectional: true
      });
    }
    if (bNode?.x !== undefined && bNode?.y !== undefined) {
      edges.push({
        from: id,
        to: bId,
        weight: distance(anchor.point, { x: bNode.x, y: bNode.y }),
        bidirectional: true
      });
    }
    return edges;
  };

  const buildCorridorPath = (start: CorridorAnchor, end: CorridorAnchor) => {
    const startId: GraphNodeId = '__start_click__';
    const endId: GraphNodeId = '__end_click__';
    const nodes: GraphMap['nodes'] = {
      ...corridorGraph.nodes,
      [startId]: { id: startId, x: start.point.x, y: start.point.y },
      [endId]: { id: endId, x: end.point.x, y: end.point.y }
    };
    const edges: GraphMap['edges'] = [
      ...corridorGraph.edges,
      ...anchorEdges(startId, start),
      ...anchorEdges(endId, end)
    ];
    const graph: GraphMap = { kind: 'graph', nodes, edges };
    const res = shortestPath(graph, startId, endId);
    if (!res.reachable) {
      return { coords: [] as Coordinate[], error: res.reason ?? 'No path found' };
    }
    const coords = (res.path as GraphNodeId[])
      .map((nodeId) => {
        const node = graph.nodes[nodeId];
        if (node?.x === undefined || node?.y === undefined) return null;
        return { x: node.x, y: node.y };
      })
      .filter(Boolean) as Coordinate[];
    return { coords, error: null as string | null };
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
  const [startAnchor, setStartAnchor] = useState<CorridorAnchor | null>(null);
  const [endAnchor, setEndAnchor] = useState<CorridorAnchor | null>(null);
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

  const selectPathPoint = (clientX: number, clientY: number) => {
    if (!floorplanRef.current) return;
    const rect = floorplanRef.current.getBoundingClientRect();
    const x = clamp01((clientX - rect.left - pan.x) / (rect.width * zoom));
    const y = clamp01((clientY - rect.top - pan.y) / (rect.height * zoom));
    const anchor = nearestCorridorAnchor({ x, y });
    if (!anchor) return;

    // first click sets start
    if (!startAnchor) {
      setStartAnchor(anchor);
      setEndAnchor(null);
      setPathCoords([]);
      setPathError(null);
      return;
    }

    // second click sets end and computes path
    if (!endAnchor) {
      setEndAnchor(anchor);
      const { coords, error } = buildCorridorPath(startAnchor, anchor);
      if (error) {
        setPathError(error);
        setPathCoords([]);
      } else {
        setPathError(null);
        setPathCoords(coords);
      }
      return;
    }

    // third click starts over with new start
    setStartAnchor(anchor);
    setEndAnchor(null);
    setPathCoords([]);
    setPathError(null);
  };

  const handleFloorplanClick: React.MouseEventHandler<HTMLDivElement> = (event) => {
    if (!pathMode) return; // ignore when not in Find Path mode
    selectPathPoint(event.clientX, event.clientY);
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
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPathMode((prev) => !prev);
                      setStartAnchor(null);
                      setEndAnchor(null);
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
                  <button
                    type="button"
                    onClick={() => {
                      setPathMode(false);
                      setStartAnchor(null);
                      setEndAnchor(null);
                      setPathCoords([]);
                      setPathError(null);
                    }}
                    className="rounded-full border px-3 py-1 text-ink-900 transition hover:bg-ink-100/70"
                    aria-label="Clear path"
                  >
                    Clear
                  </button>
                </div>
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

                  {/* Draw computed path on top of rooms */}
                  {pathCoords.length > 1 && (
                    <>
                      {/* ultra-thick black stroke with white underlay for maximum contrast */}
                      <polyline
                        points={pathCoords.map((c) => `${c.x},${c.y}`).join(' ')}
                        fill="none"
                        stroke="white"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        vectorEffect="non-scaling-stroke"
                        style={{ pointerEvents: 'none', strokeOpacity: 0.9 }}
                      />
                      <polyline
                        points={pathCoords.map((c) => `${c.x},${c.y}`).join(' ')}
                        fill="none"
                        stroke="#111827"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        vectorEffect="non-scaling-stroke"
                        style={{ pointerEvents: 'none', strokeOpacity: 0.98 }}
                      />
                    </>
                  )}

                  {/* Only show start and end markers; no intermediate dots */}

                  {/* Start & end markers (snapped to corridor nodes) */}
                  {pathMode && startAnchor && (
                    <circle
                      cx={startAnchor.point.x}
                      cy={startAnchor.point.y}
                      r={0.010}
                      fill="#10b981"
                      stroke="#0f172a"
                      strokeWidth="0.0025"
                      vectorEffect="non-scaling-stroke"
                      style={{ pointerEvents: 'none' }}
                    />
                  )}
                  {pathMode && endAnchor && (
                    <circle
                      cx={endAnchor.point.x}
                      cy={endAnchor.point.y}
                      r={0.010}
                      fill="#ef4444"
                      stroke="#0f172a"
                      strokeWidth="0.0025"
                      vectorEffect="non-scaling-stroke"
                      style={{ pointerEvents: 'none' }}
                    />
                  )}
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

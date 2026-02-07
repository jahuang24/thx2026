import type {
  Coordinate,
  GraphMap,
  GraphNodeId,
  GridMap,
  MapInput,
  PathResult
} from './types';

interface AStarNode<T> {
  id: string;
  state: T;
  g: number; // cost so far
  f: number; // g + heuristic
  parent?: string;
}

class MinHeap<T extends { f: number; id: string }> {
  private data: T[] = [];

  push(item: T) {
    this.data.push(item);
    this.bubbleUp(this.data.length - 1);
  }

  pop(): T | undefined {
    if (this.data.length === 0) return undefined;
    const top = this.data[0];
    const end = this.data.pop()!;
    if (this.data.length > 0) {
      this.data[0] = end;
      this.bubbleDown(0);
    }
    return top;
  }

  get size() {
    return this.data.length;
  }

  private bubbleUp(idx: number) {
    while (idx > 0) {
      const parent = Math.floor((idx - 1) / 2);
      if (this.data[idx].f >= this.data[parent].f) break;
      [this.data[idx], this.data[parent]] = [this.data[parent], this.data[idx]];
      idx = parent;
    }
  }

  private bubbleDown(idx: number) {
    const length = this.data.length;
    while (true) {
      const left = 2 * idx + 1;
      const right = 2 * idx + 2;
      let smallest = idx;
      if (left < length && this.data[left].f < this.data[smallest].f) smallest = left;
      if (right < length && this.data[right].f < this.data[smallest].f) smallest = right;
      if (smallest === idx) break;
      [this.data[idx], this.data[smallest]] = [this.data[smallest], this.data[idx]];
      idx = smallest;
    }
  }
}

const coordKey = (c: Coordinate) => `${c.x},${c.y}`;

function manhattan(a: Coordinate, b: Coordinate) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function euclidean(a: Coordinate, b: Coordinate) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function shortestPath(
  map: MapInput,
  start: Coordinate | GraphNodeId,
  goal: Coordinate | GraphNodeId
): PathResult {
  if (map.kind === 'grid') {
    return shortestPathGrid(map, start as Coordinate, goal as Coordinate);
  }
  return shortestPathGraph(map, start as GraphNodeId, goal as GraphNodeId);
}

function shortestPathGrid(map: GridMap, start: Coordinate, goal: Coordinate): PathResult<Coordinate> {
  if (!inBounds(map, start) || !inBounds(map, goal)) {
    return { path: [], cost: Infinity, reachable: false, reason: 'invalid start or goal' };
  }
  if (coordKey(start) === coordKey(goal)) {
    return { path: [start], cost: 0, reachable: true };
  }

  const open = new MinHeap<AStarNode<Coordinate>>();
  const startNode: AStarNode<Coordinate> = {
    id: coordKey(start),
    state: start,
    g: 0,
    f: manhattan(start, goal),
    parent: undefined
  };
  open.push(startNode);

  const gScore = new Map<string, number>([[startNode.id, 0]]);
  const cameFrom = new Map<string, string>();

  const closed = new Set<string>();

  while (open.size > 0) {
    const current = open.pop()!;
    if (current.id === coordKey(goal)) {
      return reconstructPathGrid(cameFrom, current.id, current.g, goal);
    }
    if (closed.has(current.id)) continue;
    closed.add(current.id);

    for (const neighbor of neighbors(map, current.state)) {
      const neighborId = coordKey(neighbor.coord);
      if (neighbor.blocked) continue;
      const tentativeG = current.g + neighbor.cost;
      const existingG = gScore.get(neighborId);
      if (existingG === undefined || tentativeG < existingG) {
        cameFrom.set(neighborId, current.id);
        gScore.set(neighborId, tentativeG);
        const h = manhattan(neighbor.coord, goal);
        open.push({
          id: neighborId,
          state: neighbor.coord,
          g: tentativeG,
          f: tentativeG + h,
          parent: current.id
        });
      }
    }
  }

  return { path: [], cost: Infinity, reachable: false, reason: 'unreachable' };
}

function reconstructPathGrid(
  cameFrom: Map<string, string>,
  goalId: string,
  cost: number,
  goal: Coordinate
): PathResult<Coordinate> {
  const path: Coordinate[] = [];
  let currentId: string | undefined = goalId;
  while (currentId) {
    const [x, y] = currentId.split(',').map(Number);
    path.push({ x, y });
    currentId = cameFrom.get(currentId);
  }
  path.reverse();
  // ensure goal at end when no cameFrom for start==goal handled earlier
  if (coordKey(path[path.length - 1]) !== coordKey(goal)) {
    path.push(goal);
  }
  return { path, cost, reachable: true };
}

function inBounds(map: GridMap, coord: Coordinate): boolean {
  return coord.x >= 0 && coord.y >= 0 && coord.x < map.width && coord.y < map.height;
}

function neighbors(map: GridMap, coord: Coordinate) {
  const dirs = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 }
  ];
  const result: { coord: Coordinate; cost: number; blocked: boolean }[] = [];
  for (const d of dirs) {
    const next = { x: coord.x + d.x, y: coord.y + d.y };
    if (!inBounds(map, next)) continue;
    const cell = map.cells[next.y]?.[next.x];
    const restricted = cell?.restricted || map.restrictedCells?.has(coordKey(next));
    if (!cell || !cell.walkable || restricted) {
      result.push({ coord: next, cost: Infinity, blocked: true });
      continue;
    }
    const weight = cell.weight ?? 1;
    result.push({ coord: next, cost: weight, blocked: false });
  }
  return result;
}

function shortestPathGraph(map: GraphMap, start: GraphNodeId, goal: GraphNodeId): PathResult<GraphNodeId> {
  if (!map.nodes[start] || !map.nodes[goal]) {
    return { path: [], cost: Infinity, reachable: false, reason: 'invalid start or goal' };
  }
  if (start === goal) return { path: [start], cost: 0, reachable: true };

  const adj = buildAdjacency(map);

  const heuristic = (a: GraphNodeId, b: GraphNodeId) => {
    const na = map.nodes[a];
    const nb = map.nodes[b];
    if (na?.x !== undefined && na?.y !== undefined && nb?.x !== undefined && nb?.y !== undefined) {
      return euclidean({ x: na.x, y: na.y }, { x: nb.x, y: nb.y });
    }
    return 0; // Dijkstra fallback
  };

  const open = new MinHeap<AStarNode<GraphNodeId>>();
  open.push({ id: start, state: start, g: 0, f: heuristic(start, goal) });

  const gScore = new Map<string, number>([[start, 0]]);
  const cameFrom = new Map<string, string>();
  const closed = new Set<string>();

  while (open.size > 0) {
    const current = open.pop()!;
    if (current.id === goal) {
      return reconstructPathGraph(cameFrom, current.id, start, current.g);
    }
    if (closed.has(current.id)) continue;
    closed.add(current.id);

    for (const edge of adj.get(current.id) || []) {
      if (edge.restricted || map.restrictedNodes?.has(edge.to) || map.nodes[edge.to]?.restricted) {
        continue;
      }
      const tentativeG = current.g + edge.weight;
      const existingG = gScore.get(edge.to);
      if (existingG === undefined || tentativeG < existingG) {
        cameFrom.set(edge.to, current.id);
        gScore.set(edge.to, tentativeG);
        const f = tentativeG + heuristic(edge.to, goal);
        open.push({ id: edge.to, state: edge.to, g: tentativeG, f, parent: current.id });
      }
    }
  }

  return { path: [], cost: Infinity, reachable: false, reason: 'unreachable' };
}

function buildAdjacency(map: GraphMap) {
  const adj = new Map<GraphNodeId, { to: GraphNodeId; weight: number; restricted?: boolean }[]>();
  for (const edge of map.edges) {
    const weight = edge.weight ?? 1;
    adj.set(edge.from, [...(adj.get(edge.from) || []), { to: edge.to, weight, restricted: edge.restricted }]);
    const bidirectional = edge.bidirectional ?? true;
    if (bidirectional) {
      adj.set(edge.to, [...(adj.get(edge.to) || []), { to: edge.from, weight, restricted: edge.restricted }]);
    }
  }
  return adj;
}

function reconstructPathGraph(
  cameFrom: Map<string, string>,
  goalId: string,
  startId: string,
  cost: number
): PathResult<GraphNodeId> {
  const path: GraphNodeId[] = [];
  let currentId: string | undefined = goalId;
  while (currentId) {
    path.push(currentId);
    currentId = cameFrom.get(currentId);
  }
  path.reverse();
  if (path[0] !== startId) path.unshift(startId);
  return { path, cost, reachable: true };
}

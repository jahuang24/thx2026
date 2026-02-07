# Decision Support: Bed Recommendation + Pathfinding

Minimal, self-contained module for recommending beds given patient needs and a floor map.

## Quick use
```ts
import { recommendBeds, demoBeds, demoGridMap, demoPatients, nurseStart } from './decision_support';

const { recommendations, excluded } = recommendBeds(
  demoPatients.high_icu,
  demoBeds,
  nurseStart,
  demoGridMap
);
console.log(recommendations[0]);
console.log(excluded);
```

Run the demo script (requires `npx ts-node`):
```bash
npx ts-node src/decision_support/demo_cli.ts
```

## Key functions
- `shortestPath(map, start, goal)` — A* on grid or graph, handles blocked/restricted nodes and weighted traversal.
- `recommendBeds(patient, beds, startLocation, map, config?, k=3)` — filters hard constraints, scores candidates, returns explainable recommendations and excluded list.

Defaults are tuned to be interpretable; override weights/behavior via `RecommendationConfig`.

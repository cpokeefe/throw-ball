/**
 * Map Generation Strategy Selector
 *
 * Set MAPGEN_STRATEGY to a number 0–5 to choose which algorithm builds the map:
 *
 *   0 = Original generator (the existing room+hallway approach in map/generator.ts)
 *
 *   1 = Cellular Automata Caves
 *       Random noise smoothed by cellular automata rules into organic, naturalistic
 *       cave systems. Rounded chambers connected by winding passages. Like a
 *       limestone cavern carved by underground rivers.
 *
 *   2 = Symmetric Sports Arena
 *       A purpose-built competitive arena with left-right mirror symmetry.
 *       Central divider with gaps, symmetric pillars for cover, defensive
 *       structures near goals, and lane walls. Fair by design.
 *
 *   3 = Worm Colony Tunneling
 *       Agent-based generation: multiple autonomous "worm" entities carve
 *       tunnels through solid rock, occasionally excavating larger chambers.
 *       Overlapping paths create natural intersections. Biologically inspired.
 *
 *   4 = Island Archipelago
 *       Inverted paradigm: starts with wide open floor and drops wall
 *       "islands" (circles, rectangles, L-shapes, crosses, diamonds) as
 *       obstacles. Open arena feel with scattered cover.
 *
 *   5 = Fractal Recursive Subdivision
 *       BSP-inspired hierarchical room structure. Recursively partitions
 *       the map with walls that have doorways, creating rooms within rooms.
 *       Variable depth produces dramatic size variety — grand halls next
 *       to tiny closets.
 */

import { GameMap } from "../types";
import { generateMap as generateMapOriginal } from "../map/generator";
import { generateCaves } from "./mapgen1_caves";
import { generateArena } from "./mapgen2_arena";
import { generateWormColony } from "./mapgen3_worms";
import { generateArchipelago } from "./mapgen4_archipelago";
import { generateFractalRooms } from "./mapgen5_fractal";

export const MAPGEN_STRATEGY: 0 | 1 | 2 | 3 | 4 | 5 = 0;

const strategies: Record<number, (seed: number, width?: number, height?: number) => GameMap> = {
  0: generateMapOriginal,
  1: generateCaves,
  2: generateArena,
  3: generateWormColony,
  4: generateArchipelago,
  5: generateFractalRooms,
};

export function generateMap(seed: number, width?: number, height?: number): GameMap {
  const strategy = strategies[MAPGEN_STRATEGY] ?? strategies[0];
  return strategy(seed, width, height);
}

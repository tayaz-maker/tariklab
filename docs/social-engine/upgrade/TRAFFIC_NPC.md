# Mandatory traffic, pedestrians and animation redesign

World position, velocity, heading, isometric projection and sprite frame orientation MUST be separate, documented quantities. Heading must match actual road tangent; fix wrong atlas direction mapping rather than rotating mismatched sprites. Render interpolation cannot alter physics.

Vehicles: directed lane graph, turn radius, lane offsets, intersection priorities, traffic signals, legal routing, safe braking, obstacle anticipation, coherent steering and speed. Test four directions, 8 turns, parked cars, crossroads, player driving, collision, crossing pedestrians, save/load. No sideways cars, wall clipping, overlaps, impossible corner cutting or abrupt teleporting.

NPCs: per-agent stable seeded schedule offset, varied speed/destination/animation phase, idle and social behavior, local avoidance, sidewalk routing, legal crossings, doorway queue/occupancy, stuck recovery. No synchronized crowd clones or identical loops. Distinguish full near-field actors from cheap background simulation. Never render all 1,000 citizens every frame.

Record videos of 60-second junction traffic, 30-person crowd, and 100-NPC stress scene. Assert orientation/movement agreement, collision-free paths, destination diversity, no long-term deadlock, bounded frame time and stable save/load. Use deterministic replay seeds and real visual review.

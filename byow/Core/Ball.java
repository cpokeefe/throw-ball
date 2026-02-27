package byow.Core;

import byow.TileEngine.TETile;
import java.io.Serializable;
import java.util.ArrayDeque;
import java.util.TreeSet;

/** Sets ball's initial location and saves its temporary location */
public class Ball implements Serializable {
    private Map map;
    public Coordinate location;

    public Ball(Map map) {
        this.map = map;
        this.location =  startingLocation();
    }
    private Coordinate startingLocation() {
        //find middle coordinate of map
        Coordinate at = new Coordinate(Engine.WIDTH / 2, Engine.HEIGHT / 2);
        //treat map as graph where each point has 8 connections that are adjacent to it
        //Use BFS traversal to find first open space closest to middle for ball to spawn
        ArrayDeque<Coordinate> q = new ArrayDeque<>();
        TreeSet<Coordinate> visited = new TreeSet<>();
        q.add(at);
        while (!q.isEmpty()) {
            //remove first element of queue
            at = q.poll();
            //process node
            if (map.getTile(at.x(), at.y()) == map.getFloorTile()) {
                map.setTile(at.x(), at.y(), map.getBallTile());
                return at;
            }
            //add node to visited already
            visited.add(at);
            //add node's children that have not already been in visited
            for (int x = at.x() - 1; x <= at.x() + 1; x++) {
                for (int y = at.y() - 1; y <= at.y() + 1; y++) {
                    if (!visited.contains(new Coordinate(x, y))) {
                        q.add(new Coordinate(x, y));
                    }
                }
            }
        }
        return null;
    }
}

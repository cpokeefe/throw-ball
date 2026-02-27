package byow.Tests;

import byow.Core.*;
import byow.TileEngine.TERenderer;
import byow.TileEngine.TETile;
import byow.TileEngine.Tileset;
import edu.princeton.cs.algs4.StdDraw;
import org.junit.Test;

import java.util.Random;

public class MapGeneratorTests {
    @Test
    public void roomGenerationTest() {
        int width = 4 * 16;
        int height = 4 * 9;
        TERenderer ter = new TERenderer();
        ter.initialize(width, height);

        MapGenerator mapGenerator = new MapGenerator(new Random(3), width, height, 4, 15, 4, 4);
        ter.renderFrame(mapGenerator.makeUniformMap().displayGrid());
        StdDraw.pause(1000000);
    }

    @Test
    public void cycleRoomGenerationTest() {
        int width = 4 * 20;
        int height = 4 * 9;
        TERenderer ter = new TERenderer();
        ter.initialize(width, height);
        MapGenerator mapGenerator = new MapGenerator(new Random());
        for (int i = 0; i < 1000; i++) {
            ter.renderFrame(mapGenerator.makeUniformMap().displayGrid());
            StdDraw.pause(3000);
        }
    }

    @Test
    public void shortestPathFullSizeTest() {
        MapGenerator mapGenerator = new MapGenerator(new Random());
        Map seedMap = mapGenerator.makeUniformMap();
        CPU bruh = new CPU(seedMap, 0, null);
        Ball b = new Ball(seedMap);

        TERenderer ter = new TERenderer();
        ter.initialize(80, 30);

        Coordinate start = bruh.location;
        Coordinate end = b.location;
        for (Coordinate c : bruh.shortestPath(start, end, 80,30)) {
            //seedMap.grid[c.x()][c.y()] = Tileset.FLOWER;
        }

        //ter.renderFrame(seedMap.grid);
        StdDraw.pause(50000);
    }
}

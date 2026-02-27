package byow.Tests;

import byow.Core.*;
import byow.TileEngine.TERenderer;
import byow.TileEngine.TETile;
import byow.TileEngine.Tileset;
import edu.princeton.cs.algs4.StdDraw;
import org.junit.Test;

import java.util.Random;


public class PathTest {
    @Test
    public void pathTest() {
        MapGenerator mapGenerator = new MapGenerator(new Random());
        Map seedMap = mapGenerator.makeUniformMap();
        CPU bruh = new CPU(seedMap, 0, null);

        TERenderer ter = new TERenderer();
        int width = 80;
        int height = 30;
        ter.initialize(width, height);
        TETile[][] square = new TETile[width][height];
        //seedMap.grid = square;
        for (int x = 0; x < square.length; x++) {
            for (int y = 0; y < square[0].length; y++) {
                square[x][y] = Tileset.FLOOR;
            }
        }
        for (int x = 0; x < square.length; x++) {
            square[x][0] = Tileset.WALL;
            square[x][square[0].length-1] = Tileset.WALL;
        }
        for (int x = 0; x < square[0].length; x++) {
            square[0][x] = Tileset.WALL;
            square[square.length-1][x] = Tileset.WALL;
        }
        square[3][4] = Tileset.WALL;
        square[3][5] = Tileset.WALL;
        square[2][5] = Tileset.WALL;
        square[1][5] = Tileset.WALL;

        Coordinate start = new Coordinate(1,1);
        Coordinate end = new Coordinate(15,35);
        //System.out.println(bruh.shortestPath(start, end, 10,10));
        for (Coordinate c : bruh.shortestPath(start, end, width,height)) {
            square[c.x()][c.y()] = Tileset.FLOWER;
        }

        ter.renderFrame(square);
        StdDraw.pause(50000);
    }
}

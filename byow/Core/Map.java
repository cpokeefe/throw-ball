package byow.Core;

import byow.TileEngine.TETile;
import byow.TileEngine.Tileset;

import java.io.Serializable;
import java.util.ArrayList;

/**
 * Object returned by MapGenerator.
 * Easy access to backing grid, rooms, and tile types
 */
public class Map implements Serializable {
    private TETile[][] grid;
    public final int WIDTH;
    public final int HEIGHT;
    private ArrayList<Coordinate> rooms;
    private TETile floorTile;
    private TETile wallTile;
    private TETile voidTile;
    private TETile ballTile;

    public Map(TETile[][] grid, ArrayList<Coordinate> rooms, TETile floorTile, TETile wallTile, TETile voidTile, TETile ballTile) {
        this.grid = grid;
        WIDTH = grid.length;
        HEIGHT = grid[0].length;
        this.rooms = rooms;
        this.floorTile = floorTile;
        this.wallTile = wallTile;
        this.voidTile = voidTile;
        this.ballTile = ballTile;
    }
    public void setTile(int x, int y, TETile tileType) {
        grid[x][y] = tileType;
    }
    public TETile[][] displayGrid() {
        return grid;
    }
    public ArrayList<Coordinate> getRooms() {
        return rooms;
    }
    public TETile getTile(int x, int y) { return grid[x][y]; }
    public TETile getFloorTile() {
        return floorTile;
    }
    public TETile getWallTile() {
        return wallTile;
    }
    public TETile getVoidTile() {
        return voidTile;
    }
    public TETile getBallTile() {
        return ballTile;
    }

}
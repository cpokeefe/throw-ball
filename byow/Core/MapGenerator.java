package byow.Core;

import byow.TileEngine.TETile;
import byow.TileEngine.Tileset;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.Random;

/**
 * Generates and returns a random map based on a given seed.
 * Maps must have at least MORE THAN 5 rooms.
 * (https://edstem.org/us/courses/40399/discussion/3279716?comment=7529824)
 *
 */
public class MapGenerator implements Serializable {
    /** The grid size */
    private final int gridSize;
    /** Width of the map */
    private final int width;
    /** Height of the map */
    private final int height;
    /** Max number of rooms */
    private final int roomsMaxNumber;
    /** The average rooms x width radii */
    private final double averageRoomWidth;
    /** The average rooms y width radii */
    private final double averageRoomHeight;
    /** The pseudorandom number generator */
    private final Random random;


    /** The buffer between rooms measured by number of grid spaces */
    private int gridBuffer = 3;
    /** The buffer around the perimeter of the screen measured by number of grid spaces*/
    private int perimeterBuffer = 1;
    /** List of all center coordinates (upper left) of rooms. Each index represents the room number. */
    private ArrayList<Coordinate> rooms;
    /** The TETile[][] of a specific MapGenerator object */
    private TETile[][] map;

    /** The tile that makes up the Floor */
    private final TETile floorTile = Tileset.FLOOR;
    /** The tile that makes up the Wall */
    private final TETile wallTile = Tileset.WALL;
    /** The tile that makes up the Void */
    private final TETile voidTile = Tileset.NOTHING;
    /** The tile that makes up the Ball */
    private final TETile ballTile = Tileset.BALL;

    /**
     * Super-basic constructor for MapGenerator objects.
     * Sets immutable instance variables to default values.
     * @param random The random number generator
     */
    public MapGenerator(Random random) {
        this(random, Engine.WIDTH, Engine.HEIGHT, 4, 15, 4, 4);
    }
    /**
     * Basic constructor for MapGenerator objects.
     * Sets immutable instance variables to default values.
     * @param random The random number generator
     * @param width The width of the map
     * @param height The height of the map
     */
    public MapGenerator(Random random, int width, int height) {
        this(random, width, height, 4, 15, 4, 4);
    }

    /**
     * Full constructor for MapGenerator objects.
     * Sets immutable instance variables to default values.
     * @param random The random number
     * @param width The width of the map
     * @param height The height of the map
     * @param gridSize The size of each grid
     * @param roomsMaxNumber The max number of rooms
     */
    public MapGenerator(Random random, int width, int height, int gridSize, int roomsMaxNumber, double averageRoomWidth, double averageRoomHeight) {
        this.random = random;
        this.width = width;
        this.height = height;
        this.gridSize = gridSize;
        this.gridBuffer = gridBuffer * gridSize;
        this.perimeterBuffer = perimeterBuffer * gridSize;
        this.roomsMaxNumber = roomsMaxNumber;
        this.averageRoomWidth = averageRoomWidth;
        this.averageRoomHeight = averageRoomHeight;

        this.rooms = new ArrayList<>();
        this.map = new TETile[width][height];
    }

    /**
     * Returns a uniform map. The main method which calls other methods.
     */
    public Map makeUniformMap() {
        rooms = new ArrayList<>();
        initializeMap();
        assignUniformRooms();
        // Iterate through each room
        generateRooms();
        // Iterate and add hallways between EVERY room
        for (int i = 0; i < rooms.size() - 1; i++) {
            generateHallway(rooms.get(i), rooms.get(i + 1), false);
        }
        // Makes sure each room has two exits
//        for (int i = 0; i < rooms.size(); i++) {
//            generateHallway(rooms.get(i), rooms.get((i + 2) % rooms.size()), true);
//        }
        // Makes sure the rooms on the far left and far right have more than one exit
        for (int i = 0; i < rooms.size(); i++) {
            Coordinate room = rooms.get(i);
//            System.out.println("Working left and right");
            if (room.x() < 15 || room.x() > width - 15) {
                int otherRoom = RandomUtils.uniform(random, 0, rooms.size());
//                while (otherRoom != i) {
//                    otherRoom = RandomUtils.uniform(random, 0, rooms.size());
//                }
                generateHallway(room, rooms.get(otherRoom), true);
            }
        }
        generatePerimeter();
        generateVoid();

        return new Map(map, rooms, floorTile, wallTile, voidTile, ballTile);
    }

    /**
     * Mutates the TETile[][] map instance variable and fills it up with walls
     */
    private void initializeMap() {
        for (int x = 0; x < map.length; x++) {
            for (int y = 0; y < map[0].length; y++) {
                map[x][y] = wallTile;
            }
        }
    }

    /**
     * Selects which grid space will be a room based on a uniform distribution.
     * Selects up to the specified max amount of rooms.
     * Selected grid spaces must not be within 1 grid space of another selected grid space,
     * horizontally and vertically and diagonally.
     */
    private void assignUniformRooms() {
        int numberOfRooms = (int) (RandomUtils.gaussian(random, 0.8, 0.2, 0.7, 1) * roomsMaxNumber);

        for (int i = 0; i < numberOfRooms; i++) {
            boolean assigned = false;
            int runTimeBound = 10000;
            while (!assigned && runTimeBound > 0) {
                int x = RandomUtils.uniform(random, perimeterBuffer, width - perimeterBuffer);
                int y = RandomUtils.uniform(random, perimeterBuffer, height - perimeterBuffer);

                if (!adjacentRoom(x, y, gridBuffer)) {
                    rooms.add(new Coordinate(x, y));
                    assigned = true;
                }

                runTimeBound--;
            }
        }
//        System.out.println(rooms); Use this to print room center locations!
    }

    /**
     * Returns true if the given x and y coordinates of a grid space
     * is adjacent by the given grid length to another grid space.
     * In all directions horizontally, vertically, and diagonally.
     */
    private boolean adjacentRoom(int xGrid, int yGrid, int gridBuffer) {
        for (Coordinate room : rooms) {
            if (room.x() >= xGrid - gridBuffer && room.x() <= xGrid + gridBuffer) {
                if (room.y() >= yGrid - gridBuffer && room.y() <= yGrid + gridBuffer) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Generate a random sized rectangular room in the specified grid space.
     * Rooms can be up to 1 grid space larger than the specified grid spaces.
     */
    private void generateRooms() {
        for (Coordinate room : rooms) {
            int roomWidth = (int) RandomUtils.gaussian(random, averageRoomWidth, 1, 2, 8);
            int roomHeight = (int) RandomUtils.gaussian(random, averageRoomHeight, 1, 2, 8);
            for (int x = room.x() - roomWidth; x < room.x() + roomWidth; x++) {
                for (int y = room.y() - roomHeight; y < room.y() + roomHeight; y++) {
                    if (x >= 0 && y >= 0 && x < width && y < height) {
                        map[x][y] = floorTile;
                    }
                }
            }
        }
    }

    /**
     * Generate a hallway between two given rooms.
     * Each generated hallway will attempt to create a path from
     */
    private void generateHallway(Coordinate room, Coordinate otherRoom, boolean secondExit) {
        int xHead = room.x();
        int yHead = room.y();
        Direction direction;
        int distance;

        // Add initial up and down directions (ensures rooms have 2 exits)
        if (secondExit) {
            // Room above the middle
            if (yHead > (Engine.HEIGHT / 2) + Engine.INFO_SPACE) {
                direction = Direction.SOUTH;
            // Room below the middle
            } else {
                direction = Direction.NORTH;
            }

            // FIX THIS
            distance = RandomUtils.uniform(random, 5, 7);

            generateDirectionalFloor(xHead, yHead, distance, direction);
            xHead += distance * direction.xDir();
            yHead += distance * direction.yDir();

            // Also make a turn in hopes for better rooms
            // On the left side
            if (xHead < Engine.WIDTH / 2) {
                direction = Direction.EAST;
            } else {
                // On the right side
                direction = Direction.WEST;
            }

            generateDirectionalFloor(xHead, yHead, distance, direction);
            xHead += distance * direction.xDir();
            yHead += distance * direction.yDir();
        }

        while(!(xHead == otherRoom.x() && yHead == otherRoom.y())) {
            // On the same column as the other room
            if (xHead == otherRoom.x()) {
                if (yHead < otherRoom.y()) {
                    direction = Direction.NORTH;
                } else {
                    direction = Direction.SOUTH;
                }
            // On the same row as the other room
            } else if (yHead == otherRoom.y()){
                if (xHead < otherRoom.x()) {
                    direction = Direction.EAST;
                } else {
                    direction = Direction.WEST;
                }
            } else {
                // To the left of the other room
                if (xHead < otherRoom.x()) {
                    // Below the other room
                    if (yHead < otherRoom.y()) {
                        direction = getRandomDirection(Direction.NORTH, Direction.EAST);
                    // Above the other room
                    } else {
                        direction = getRandomDirection(Direction.SOUTH, Direction.EAST);
                    }
                // To the right of the other room
                } else {
                    // Below the other room
                    if (yHead < otherRoom.y()) {
                        direction = getRandomDirection(Direction.NORTH, Direction.WEST);
                        // Above the other room
                    } else {
                        direction = getRandomDirection(Direction.SOUTH, Direction.WEST);
                    }
                }
            }
            if (direction == Direction.NORTH || direction == Direction.SOUTH) {
                distance = (int) RandomUtils.gaussian(random, 10, 3, 0, Math.abs(otherRoom.y() - yHead) + 1);
            } else {
                distance = (int) RandomUtils.gaussian(random, 10, 3, 0, Math.abs(otherRoom.x() - xHead) + 1);
            }

            generateDirectionalFloor(xHead, yHead, distance, direction);
            xHead += distance * direction.xDir();
            yHead += distance * direction.yDir();
        }
    }

    /**
     * Generates floor in a given direction a given amount starting
     * from the given x, y coordinate
     */
    private void generateDirectionalFloor(int xPos, int yPos, int distance, Direction direction) {
        for (int i = 0; i < distance; i++) {
            map[xPos + (i * direction.xDir())][yPos + (i * direction.yDir())] = floorTile;
        }
    }

    /**
     * Returns one of two given direction based on a coin flip
     */
    private Direction getRandomDirection(Direction heads, Direction tails) {
        if (RandomUtils.bernoulli(random)) {
            return heads;
        } else {
            return tails;
        }
    }

    /** Generates a 1 tile wide periemter of WALL to ensure no rooms or hallways
     *  are clipping out of the map border
     */
    private void generatePerimeter() {
        for (int x = 0; x < width; x++) {
            map[x][0] = wallTile;
            map[x][height-1] = wallTile;
        }
        for (int y = 0; y < height; y++) {
            map[0][y] = wallTile;
            map[width-1][y] = wallTile;
        }
    }

    /**
     * Generates voids based on these conditions:
     * If: a wall is adjacent to a floor do not turn it into a void
     * Else: turn that wall into a void
     */
    private void generateVoid() {
        for (int x = 0; x < width; x++) {
            for (int y = 0; y < height; y++) {
                if (!adjacentTile(x, y)) {
                    map[x][y] = voidTile;
                }
            }
        }
    }

    /**
     * Returns true if a specified tileType is adjacent to given tile.
     * Adjacent tiles include horizonal, vertical, and diagonal tiles.
     */
    private boolean adjacentTile(int xTile, int yTile) {
        for (int x = xTile - 1; x <= xTile + 1; x++) {
            for (int y = yTile - 1; y <= yTile + 1; y++) {
                if (x >= 0 && y >= 0 && x < width && y < height && (map[x][y].getTileType() == floorTile.getTileType())) {
                    return true;
                }
            }
        }
        return false;
    }
}

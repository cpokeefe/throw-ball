package byow.Core;

import java.io.Serializable;
import java.util.Random;

/** Helper class for determining where to go next for MapGeneration, and Player/Ball movement */
public enum Direction implements Serializable {
    NORTH(0, 1), EAST(1, 0), SOUTH(0, -1), WEST(-1, 0);

    Direction (int xDir, int yDir) {
        this.xDir = xDir;
        this.yDir = yDir;
    }

    public static Direction flip(Direction d) {
        switch (d) {
            case NORTH:
                return SOUTH;
            case SOUTH:
                return NORTH;
            case EAST:
                return WEST;
            case WEST:
                return EAST;
        }
        return null;
    }

    public static Direction randomDirection() {
        int rand = new Random().nextInt(0, 4);
        if (rand == 0) {
            return NORTH;
        }
        if (rand == 1) {
            return EAST;
        }
        if (rand == 2) {
            return SOUTH;
        }
        if (rand == 3) {
            return WEST;
        }
        throw new IllegalArgumentException("CHARLIE ERROR");
    }
    public static Direction randomXDirection(Random random) {
        int rand = RandomUtils.uniform(random, 0, 2);
        if (rand == 0) {
            return EAST;
        }
        if (rand == 1) {
            return WEST;
        }
        return null;
    }
    public static Direction randomYDirection(Random random) {
        int rand = RandomUtils.uniform(random, 0, 2);
        if (rand == 0) {
            return NORTH;
        }
        if (rand == 1) {
            return SOUTH;
        }
        throw new IllegalArgumentException("CHARLIE ERROR");
    }

    public int xDir() {
        return xDir;
    }
    public int yDir() {
        return yDir;
    }

    private final int xDir, yDir;
}

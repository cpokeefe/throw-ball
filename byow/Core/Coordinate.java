package byow.Core;

import java.io.Serializable;

/** Represents an object's x and y grid location. */
public class Coordinate implements Comparable<Coordinate>, Serializable {
    private int x;
    private int y;

    public Coordinate(int x, int y) {
        this.x = x;
        this.y = y;
    }

    public int x() {
        return x;
    }
    public int y() {
        return y;
    }

    @Override
    public boolean equals(Object other) {
        if (other instanceof Coordinate) {
            return x == ((Coordinate) other).x && y == ((Coordinate) other).y;
        }
        throw new IllegalArgumentException("Object must be a coordinate");

    }
    @Override
    public int compareTo(Coordinate other) {
        if (this.x - other.x == 0) {
            return this.y - other.y;
        }
        return this.x - other.x;
    }
    @Override
    public String toString() {
        return "(" + this.x + ", " + this.y + ")";
    }
}
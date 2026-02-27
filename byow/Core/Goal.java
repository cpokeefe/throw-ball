package byow.Core;

import byow.TileEngine.TETile;

import java.io.Serializable;

/** Saves goal location and array of goal tiles */
public class Goal implements Serializable {
    /** The middle coordinate of a 1 x 3 tile goal*/
    public Coordinate location;
    /** All 3 coordinate of a 1 x 3 tile goal in ascending order */
    private Coordinate[] fullLocation;

    public Goal(Coordinate location) {
        this.location = location;
        fullLocation = new Coordinate[]{new Coordinate(location.x(), location.y()-1), location, new Coordinate(location.x(), location.y()+1)};
    }
    public Coordinate[] getFullLocation() {
        return fullLocation;
    }

}

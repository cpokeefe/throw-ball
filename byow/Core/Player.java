package byow.Core;

import byow.TileEngine.TERenderer;
import byow.TileEngine.TETile;
import edu.princeton.cs.algs4.StdDraw;

import java.awt.*;
import java.io.Serializable;
import java.util.ArrayList;
import java.util.Random;

public class Player implements Serializable {
    /** Number corresponding to given player. */
    protected final int number;
    protected Color color = null;
    protected final Map map;
    /** Array of different icon orientations [player without ball, player with ball, player with ball (no steps)][north, east, south, west] */
    protected final TETile[][] playerTiles = new TETile[3][4];
    /** Goal the player is trying to score on. */
    protected Goal goal;
    protected TETile goalTile;
    protected Random rand;

    /** mutable variables */
    public Coordinate location;
    public Direction lastMoved = null;
    public boolean hasBall;
    public int stepsLeft;
    private Engine engine;

    public Player(Map map, int playerNumber, Engine engine) {
        this.number = playerNumber;
        if (playerNumber == 1) {
            this.color = Color.GREEN.brighter();
        } else if (playerNumber == 2) {
            this.color = Color.MAGENTA;
        }
        determineTETiles(this.color);
        this.map = map;
        Coordinate[] locations = startingLocations();
        this.location = locations[0];
        map.setTile(location.x(), location.y(), currentPlayerTile());
        this.goal = new Goal(locations[1]);
        this.stepsLeft = Game.STEPS;
        this.engine = engine;
        this.rand = engine.getRandom();
    }

    public boolean move(Direction direction, Ball ball) {
        //check to see if player can move
        if (stepsLeft != 0) {
            //check if player is not going to hit a wall
            if (map.getTile(location.x() + direction.xDir(),location.y() + direction.yDir()) == map.getFloorTile()) {
                //set old tile as floor
                map.setTile(location.x(), location.y(), map.getFloorTile());
                //reassign location
                location = new Coordinate(location.x() + direction.xDir(), location.y() + direction.yDir());
                //change last moved in case of toss
                lastMoved = direction;
                //set new tile as player
                if (hasBall) {
                    ball.location = location;
                    stepsLeft--;
                }
                map.setTile(location.x(), location.y(), currentPlayerTile());
                return true;
            }
        } else {
            //change direction player is facing
            lastMoved = direction;
            map.setTile(location.x(), location.y(), currentPlayerTile());
        }
        return false;
    }
    public boolean grab(Ball ball) {
        //search in all adjacent tiles for ball
        for (int x = location.x()-1; x <= location.x()+1; x++) {
            for (int y = location.y()-1; y <= location.y()+1; y++) {
                if (map.getTile(x, y) == map.getBallTile()) {
                    map.setTile(x, y, map.getFloorTile());
                    hasBall = true;
                    map.setTile(location.x(), location.y(), currentPlayerTile());
                    ball.location = location;
                    return true;
                }
            }
        }
        return false;
    }
    public boolean toss(Direction dir, Ball ball, TERenderer ter, Game game) {
        //if we are standing right next to an obstacle and just moved in that direction, toss cannot be performed
        if (map.getTile(location.x() + dir.xDir(), location.y() + dir.yDir()) == map.getFloorTile()) {
            //change player to ball-less icon
            hasBall = false;
            map.setTile(location.x(), location.y(), currentPlayerTile());
            if (dir == Direction.NORTH || dir == Direction.SOUTH) {
                //find where ball lands
                int y = location.y();
                while (map.getTile(location.x(), y + dir.yDir()) == map.getFloorTile()) {
                    y += dir.yDir();
                    //sick animation
                    animateEntity(map.getBallTile(), location.x(), y, ter);
                }
                map.setTile(location.x(), y, map.getBallTile());
                ball.location = new Coordinate(location.x(), y);
            } else {
                int x = location.x();
                while (map.getTile(x + dir.xDir(), location.y()) == map.getFloorTile()) {
                    x += dir.xDir();
                    animateEntity(map.getBallTile(), x, location.y(), ter);
                }
                //check if ball was scored to end game
                Coordinate check = new Coordinate(x + dir.xDir(), location.y());
                for (Coordinate c : goal.getFullLocation()) {
                    if (c.equals(check)) {
                        game.incrementScore(number);
                        return true;
                    }
                }
                map.setTile(x, location.y(), map.getBallTile());
                ball.location = new Coordinate(x, location.y());
            }
            stepsLeft = Game.STEPS;
            return true;
        }
        return false;
    }
    public boolean punch(Player other, Ball ball, TERenderer ter, Game game) {
        for (int x = location.x()-1; x <= location.x()+1; x++) {
            for (int y = location.y()-1; y <= location.y()+1; y++) {
                if (map.getTile(x, y).getTileType() == TETile.TileType.HOLDING_BALL) {
                    if (RandomUtils.bernoulli(rand)) {
                        //50% chance you force them to throw it in a random direction (unless they can't throw it anywhere)
//                        ArrayList<Direction> dirs = new ArrayList<>(List.of(new Direction[]{Direction.NORTH, Direction.EAST, Direction.SOUTH, Direction.WEST}));
                        Direction[] dirs = new Direction[]{Direction.NORTH, Direction.EAST, Direction.SOUTH, Direction.WEST};
                        RandomUtils.shuffle(rand, dirs);
                        for (Direction d : dirs) {
                            if (other.toss(d, ball, ter, game)) {
                                return true;
                            }
                        }
                    }
                    //50% chance you steal the ball from other player
                    hasBall = true;
                    map.setTile(location.x(), location.y(), currentPlayerTile());
                    ball.location = location;
                    other.hasBall = false;
                    map.setTile(other.location.x(), other.location.y(), other.currentPlayerTile());
                    other.stepsLeft = Game.STEPS;
                    return true;
                }
            }
        }
        return false;
    }
    public void fly(Direction direction, TERenderer ter) {
        if (!hasBall) {
            //check if player is not going to hit a wall
            while (map.getTile(location.x() + direction.xDir(),location.y() + direction.yDir()) == map.getFloorTile()) {
                //edit lastMoved so that getPlayerTile() returns proper orientation
                lastMoved = direction;
                //set old tile as floor
                map.setTile(location.x(), location.y(), map.getFloorTile());
                //reassign location
                location = new Coordinate(location.x() + direction.xDir(), location.y() + direction.yDir());
                //animation
                animateEntity(currentPlayerTile(), location.x(), location.y(), ter);
            }
            map.setTile(location.x(), location.y(), currentPlayerTile());
        }
    }

    protected void determineTETiles(Color iconColor) {
        Color backColor = Color.BLACK;
        Color backColorBall = new Color(255, 255, 0, 70);
        Color backColorBallLast = new Color(255, 0, 0, 70);

        playerTiles[0][0] = new TETile('^', iconColor, Color.BLACK, "p" + number, TETile.TileType.PLAYER_NO_BALL);
        playerTiles[0][1] = new TETile('>', iconColor, Color.BLACK, "p" + number, TETile.TileType.PLAYER_NO_BALL);
        playerTiles[0][2] = new TETile('v', iconColor, Color.BLACK, "p" + number, TETile.TileType.PLAYER_NO_BALL);
        playerTiles[0][3] = new TETile('<', iconColor, Color.BLACK, "p" + number, TETile.TileType.PLAYER_NO_BALL);
        playerTiles[1][0] = new TETile('^', iconColor, backColorBall, "p" + number + " holding ball", TETile.TileType.HOLDING_BALL);
        playerTiles[1][1] = new TETile('>', iconColor, backColorBall, "p" + number + " holding ball", TETile.TileType.HOLDING_BALL);
        playerTiles[1][2] = new TETile('v', iconColor, backColorBall, "p" + number + " holding ball", TETile.TileType.HOLDING_BALL);
        playerTiles[1][3] = new TETile('<', iconColor, backColorBall, "p" + number + " holding ball", TETile.TileType.HOLDING_BALL);
        playerTiles[2][0] = new TETile('^', iconColor, backColorBallLast, "p" + number + " holding ball", TETile.TileType.HOLDING_BALL);
        playerTiles[2][1] = new TETile('>', iconColor, backColorBallLast, "p" + number + " holding ball", TETile.TileType.HOLDING_BALL);
        playerTiles[2][2] = new TETile('v', iconColor, backColorBallLast, "p" + number + " holding ball", TETile.TileType.HOLDING_BALL);
        playerTiles[2][3] = new TETile('<', iconColor, backColorBallLast, "p" + number + " holding ball", TETile.TileType.HOLDING_BALL);
        goalTile = new TETile('▒', iconColor, backColor, "goal", TETile.TileType.WALL);
    }
    private Coordinate[] startingLocations() {
        ArrayList<Coordinate> rooms = map.getRooms();
        //use two element array to store both player and goal location
        Coordinate[] finale = new Coordinate[2];
        //proceed from left to right and top to bottom to spawn player 1 at leftmost/topmost location
        boolean breakOuter = false;
        for (int x = 0; x < map.WIDTH; x++) {
            for (int y = map.HEIGHT; y >= 0; y--) {
                if (rooms.contains(new Coordinate(x, y))) {
                    if (map.getTile(x,y).getTileType() != TETile.TileType.PLAYER_NO_BALL) {
                        finale[0] = new Coordinate(x, y);
                        lastMoved = Direction.EAST;
                    } else {
                        int ex = x;
                        while (map.getTile(ex, y).getTileType() != TETile.TileType.WALL) {
                            ex--;
                        }
                        finale[1] = new Coordinate(ex, y);
                    }
                    breakOuter = true;
                    break;
                }
                if (breakOuter) {
                    break;
                }
            }
        }
        //this time procced from right to left and bottom to top to spawn player 2 at rightmost/bottomost location
        breakOuter = false;
        for (int x = map.WIDTH; x >= 0; x--) {
            for (int y = 0; y < map.HEIGHT; y++) {
                if (rooms.contains(new Coordinate(x, y))) {
                    if (finale[0] == null) {
                        finale[0] = new Coordinate(x, y);
                        lastMoved = Direction.WEST;
                    } else {
                        int ex = x;
                        while (map.getTile(ex, y).getTileType() != TETile.TileType.WALL) {
                            ex++;
                        }
                        finale[1] = new Coordinate(ex, y);
                    }
                    breakOuter = true;
                    break;
                }
            }
            if (breakOuter) {
                break;
            }
        }
        //paint goal tiles
        map.setTile(finale[1].x(), finale[1].y() - 1, goalTile);
        map.setTile(finale[1].x(), finale[1].y(), goalTile);
        map.setTile(finale[1].x(), finale[1].y() + 1, goalTile);
        return finale;
    }
    protected TETile currentPlayerTile() {
        int ballNumber = 0;
        if (hasBall && stepsLeft == 0) {
            ballNumber = 2;
        } else if (hasBall) {
            ballNumber = 1;
        }
        if (lastMoved == Direction.NORTH) {
            return playerTiles[ballNumber][0];
        } else if (lastMoved == Direction.EAST) {
            return playerTiles[ballNumber][1];
        } else if (lastMoved == Direction.SOUTH) {
            return playerTiles[ballNumber][2];
        } else if (lastMoved == Direction.WEST) {
            return playerTiles[ballNumber][3];
        }
        return null;
    }
    private void animateEntity(TETile tile, int x, int y, TERenderer ter) {
        // With out HUD the player can throw/fly fast. No HUD at all
        // With HUD the player can throw/fly fast as you want as long as you are okay with flickering
        // At 10 (really slow) the HUD is smooth and no flickering but the player is SLOW
        // At 10 (slow) the HUD flicker noticeably and the player is slow
        // At 1 (FAST and good) the HUD flickers like a strobe light. Not great

        if (true) {
            // No HUD
            map.setTile(x, y, tile);
            ter.renderFrame(map.displayGrid());
            StdDraw.pause(1);
            map.setTile(x, y, map.getFloorTile());
            ter.renderFrame(map.displayGrid());
        } else {
            // With HUD
            map.setTile(x, y, tile);
            StdDraw.pause(10); // Helps with graphical flickering
            ter.renderFrame(map.displayGrid());
            engine.hud();

            map.setTile(x, y, map.getFloorTile());
            StdDraw.pause(10); // Helps with graphical flickering
            ter.renderFrame(map.displayGrid());
            engine.hud();
        }

    }

    public int getPlayerNumber() {
        return this.number;
    }
    public Color getPlayerColor() {
        return this.color;
    }
}




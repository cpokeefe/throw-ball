package byow.Core;

import byow.TileEngine.TERenderer;
import byow.TileEngine.TETile;

import java.awt.*;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collections;

import static java.util.Arrays.fill;

/** CPU that "determines move" whenever a player moves or tosses
 * - Follows this algorithm:
 * - IF has ball 2 spaces directly in front of goal, randomly oscilate up and down until no steps left
 * - IF has ball with no steps left, throw ball towards goal
 * - IF has ball, move towards goal until no steps left
 * - IF ball/player with ball is adjacent to CPU grab/punch it
 * - ELSE move towards ball or player with ball
 */
public class CPU extends Player {
    public CPU(Map map, int playerNumber, Engine engine) {
        super(map, playerNumber, engine);
        this.color = new Color(200, 200, 230);
        determineTETiles(this.color);
        //revise starting player icon
        map.setTile(location.x(), location.y(), currentPlayerTile());
        //revise goals
        repaintGoals();
    }
    public void determineInput(Player p, Ball ball, TERenderer ter, Game game) {
        //twoSpacesInFrontOfGoal
        Coordinate tSiFoG = new Coordinate(goal.location.x() + -2 * towardsGoal().xDir(), goal.location.y());
        if (!hasBall) {
            if (grab(ball)) {
                return;
            }
            if (punch(p, ball, ter, game)) {
                return;
            }
            moveTowardsLocation(ball.location, ball);
        } else {
            if (stepsLeft == 0) {
                if (location.equals(new Coordinate(tSiFoG.x(), tSiFoG.y()+1)) || location.equals(tSiFoG) || location.equals(new Coordinate(tSiFoG.x(), tSiFoG.y()-1))) {
                    move(towardsGoal(), ball);
                } else {
                    moveTowardsLocation(tSiFoG, ball);
                }
                //TODO sus coding BELOW need to code something better to prevent infinite loops
                // This only account for infinite loops in x direction- y direction ones can happen to
                // need to do something like check to see if were adjacent to hall ways or something
                // SEEDS THAT CAUSE INFINITE LOOPS: 634
//                if (lastMoved == Direction.EAST && !inLineWithGoal() && toss(Direction.randomYDirection(), ball, ter, game)) {
//                    return;
//                } else if (lastMoved == Direction.WEST && !inLineWithGoal() && toss(Direction.randomYDirection(), ball, ter, game)) {
//                    return;
//                }
                toss(lastMoved, ball, ter, game);
            } else {
                moveTowardsLocation(tSiFoG, ball);
            }
        }
    }
    private void moveTowardsLocation(Coordinate destination, Ball ball) {
        Coordinate next = shortestPath(location, destination, map.WIDTH, map.HEIGHT).get(0);
        //when location = tSiFoG
        if (location.equals(destination)) {
            move(Direction.randomYDirection(this.rand), ball);
        } else if (next.y() - location.y() == 1) {
            move(Direction.NORTH, ball);
        } else if (next.x() - location.x() == 1) {
            move(Direction.EAST, ball);
        } else if (next.y() - location.y() == -1) {
            move(Direction.SOUTH, ball);
        } else {
            move(Direction.WEST, ball);
        }
    }

    public ArrayList<Coordinate> shortestPath(Coordinate start, Coordinate destination, int width, int height) {
        if (start.equals(destination)) {
            ArrayList edgeCase = new ArrayList();
            edgeCase.add(start);
            return edgeCase;
        }

        int[] distances = new int[width * height];
        fill(distances, Integer.MAX_VALUE);
        int[] parents = new int[width * height];
        fill(parents, -1);

        ArrayDeque<Coordinate> q = new ArrayDeque<>();
        distances[getIndex(start, height)] = 0;
        parents[getIndex(start, height)] = getIndex(start, height);
        q.add(start);
        while (!q.isEmpty()) {
            Coordinate current = q.poll();
            for (Coordinate child : floorNeighbors(current)) {
                int currIndex = getIndex(current, height);
                int childIndex = getIndex(child, height);
                if (distances[currIndex] + 1 < distances[childIndex]) {
                    distances[childIndex] = distances[currIndex] + 1;
                    parents[childIndex] = currIndex;
                    q.add(child);
                }
            }
        }
        ArrayList<Coordinate> finale = new ArrayList<>();
        for (int n = getIndex(destination, height); n != getIndex(start, height); n = parents[n]) {
            finale.add(getCoordinate(n, height));
        }
        //finale.add(start); list excludes start!
        Collections.reverse(finale);
        return finale;
    }
    private int getIndex(Coordinate c, int height) {
        return c.x() * height + c.y();
    }
    private Coordinate getCoordinate(int n, int height) {
        return new Coordinate(n / height, n % height);
    }
    private ArrayList<Coordinate> floorNeighbors(Coordinate c) {
        ArrayList<Coordinate> finale = new ArrayList<>();
        if (map.getTile(c.x()+1, c.y()).getTileType() != TETile.TileType.WALL) {
            finale.add(new Coordinate(c.x()+1, c.y()));
        }
        if (map.getTile(c.x()-1, c.y()).getTileType() != TETile.TileType.WALL) {
            finale.add(new Coordinate(c.x()-1, c.y()));
        }
        if (map.getTile(c.x(), c.y()+1).getTileType() != TETile.TileType.WALL) {
            finale.add(new Coordinate(c.x(), c.y()+1));
        }
        if (map.getTile(c.x(), c.y()-1).getTileType() != TETile.TileType.WALL) {
            finale.add(new Coordinate(c.x(), c.y()-1));
        }
        return finale;
    }

    private boolean inLineWithGoal() {
        int x = location.x();
        while (map.getTile(x, location.y()).tileType != TETile.TileType.WALL) {
            x = x + towardsGoal().xDir();
        }
        if (map.getTile(x, location.y()) == goalTile) {
            return true;
        }
        return false;
    }
    private Direction towardsGoal() {
        if (map.WIDTH / 2 - goal.location.x() > 0) {
            return Direction.WEST;
        } else {
            return Direction.EAST;
        }
    }

    @Override
    protected void determineTETiles(Color iconColor) {
        Color backColor = Color.BLACK;
        Color backColorBall = new Color(255, 255, 0, 70);
        Color backColorBallLast = new Color(255, 0, 0, 70);

        playerTiles[0][0] = new TETile('^', iconColor, Color.BLACK, "CPU", TETile.TileType.PLAYER_NO_BALL);
        playerTiles[0][1] = new TETile('>', iconColor, Color.BLACK, "CPU", TETile.TileType.PLAYER_NO_BALL);
        playerTiles[0][2] = new TETile('v', iconColor, Color.BLACK, "CPU", TETile.TileType.PLAYER_NO_BALL);
        playerTiles[0][3] = new TETile('<', iconColor, Color.BLACK, "CPU", TETile.TileType.PLAYER_NO_BALL);
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
    private void repaintGoals() {
        for (int x = 0; x < map.WIDTH; x++) {
            for (int y = 0; y < map.HEIGHT; y++) {
                if (map.getTile(x, y).description().equals("goal") && Math.abs(x - location.x()) > map.WIDTH / 2) {
                    map.setTile(x, y, goalTile);
                    map.setTile(x, y + 1, goalTile);
                    map.setTile(x, y + 2, goalTile);
                    return;
                }
            }
        }
    }
}

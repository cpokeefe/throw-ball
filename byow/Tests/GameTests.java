package byow.Tests;

import byow.Core.*;
import byow.TileEngine.TERenderer;
import edu.princeton.cs.algs4.StdDraw;
import org.junit.Test;

import java.util.Random;

public class GameTests {
//    @Test
//    public void gameTest() {
//        TERenderer ter = new TERenderer();
//        ter.initialize(80, 30);
//        MapGenerator mapGenerator = new MapGenerator(new Random());
//        Map seedMap = mapGenerator.makeUniformMap();
//        Player one = new Player(seedMap, 1);
//        //Player two = new Player(seedMap, 2);
//        AI two = new AI(seedMap, 0);
//        Ball ball = new Ball(seedMap);
//        ter.renderFrame(seedMap.displayGrid());
//        boolean p1flyCall = false;
//        boolean p2flyCall = false;
//        while (true) {
//            if (StdDraw.hasNextKeyTyped()) {
//                char keyTyped = StdDraw.nextKeyTyped();
//                switch (keyTyped) {
//                    case 'w':
//                        if (p1flyCall) {
//                            one.fly(Direction.NORTH, ter);
//                            p1flyCall = false;
//                        } else {
//                            one.move(Direction.NORTH, ball);
//                        }
//                        two.determineInput(one, ball, ter);
//                        break;
//                    case 'd':
//                        if (p1flyCall) {
//                            one.fly(Direction.EAST, ter);
//                            p1flyCall = false;
//                        } else {
//                            one.move(Direction.EAST, ball);
//                        }
//                        two.determineInput(one, ball, ter);
//                        break;
//                    case 's':
//                        if (p1flyCall) {
//                            one.fly(Direction.SOUTH, ter);
//                            p1flyCall = false;
//                        } else {
//                            one.move(Direction.SOUTH, ball);
//                        }
//                        two.determineInput(one, ball, ter);
//                        break;
//                    case 'a':
//                        if (p1flyCall) {
//                            one.fly(Direction.WEST, ter);
//                            p1flyCall = false;
//                        } else {
//                            one.move(Direction.WEST, ball);
//                        }
//                        two.determineInput(one, ball, ter);
//                        break;
//                    case 'c':
//                        if (one.hasBall) {
//                            one.toss(one.lastMoved, ball, ter);
//                        } else if ((two.hasBall && one.punch(two, ball, ter)) || one.grab(ball) || p1flyCall) {
//                            p1flyCall = false;
//                        } else {
//                            p1flyCall = true;
//                        }
//                        break;
//                    case 'i':
//                        if (p2flyCall) {
//                            two.fly(Direction.NORTH, ter);
//                            p2flyCall = false;
//                        } else {
//                            two.move(Direction.NORTH, ball);
//                        }
//                        break;
//                    case 'l':
//                        if (p2flyCall) {
//                            two.fly(Direction.EAST, ter);
//                            p2flyCall = false;
//                        } else {
//                            two.move(Direction.EAST, ball);
//                        }
//                        break;
//                    case 'k':
//                        if (p2flyCall) {
//                            two.fly(Direction.SOUTH, ter);
//                            p2flyCall = false;
//                        } else {
//                            two.move(Direction.SOUTH, ball);
//                        }
//                        break;
//                    case 'j':
//                        if (p2flyCall) {
//                            two.fly(Direction.WEST, ter);
//                            p2flyCall = false;
//                        } else {
//                            two.move(Direction.WEST, ball);
//                        }
//                        break;
//                    case 'n':
//                        if (two.hasBall) {
//                            two.toss(two.lastMoved, ball, ter);
//                        } else if ((one.hasBall && two.punch(one, ball, ter)) || two.grab(ball) || p2flyCall) {
//                            p2flyCall = false;
//                        } else {
//                            p2flyCall = true;
//                        }
//                        break;
//                }
//             ter.renderFrame(seedMap.displayGrid());
//            }
//        }
//    }
//
//    @Test
//    public void AITest() {
//        TERenderer ter = new TERenderer();
//        ter.initialize(80, 30);
//        MapGenerator mapGenerator = new MapGenerator(new Random());
//        Map seedMap = mapGenerator.makeUniformMap();
//        Player one = new Player(seedMap, 1);
//        AI two = new AI(seedMap, 0);
//        Ball ball = new Ball(seedMap);
//        int counter = -10;
//        boolean up = false;
//        while (true) {
//            if (counter < 0) {
//                one.move(Direction.SOUTH, ball);
//                counter++;
//                up = false;
//            }
//            if (counter > 0) {
//                one.move(Direction.NORTH, ball);
//                counter--;
//                up = true;
//            }
//            if (counter == 0) {
//                if (up) {
//                    counter = -10;
//                } else {
//                    counter = 10;
//                }
//            }
//
//
//            two.determineInput(one, ball, ter);
//            ter.renderFrame(seedMap.displayGrid());
//            StdDraw.pause(100);
//        }
//    }
//
//    @Test
//    public void weirdScreenTest() {
//        TERenderer ter = new TERenderer();
//        ter.initialize(80, 30);
//        MapGenerator mapGenerator = new MapGenerator(new Random());
//        Map seedMap = mapGenerator.makeUniformMap();
//        Player one = new Player(seedMap, 1);
//        AI two = new AI(seedMap, 0);
//        Ball ball = new Ball(seedMap);
//        while (true) {
//            one.move(Direction.WEST, ball);
//            two.determineInput(one, ball, ter);
//            ter.renderFrame(seedMap.displayGrid());
//            StdDraw.pause(100);
//            one.move(Direction.SOUTH, ball);
//            two.determineInput(one, ball, ter);
//            ter.renderFrame(seedMap.displayGrid());
//            StdDraw.pause(100);
//            one.move(Direction.EAST, ball);
//            two.determineInput(one, ball, ter);
//            ter.renderFrame(seedMap.displayGrid());
//            StdDraw.pause(100);
//            one.move(Direction.NORTH, ball);
//            two.determineInput(one, ball, ter);
//            ter.renderFrame(seedMap.displayGrid());
//            StdDraw.pause(100);
//        }
//    }
}

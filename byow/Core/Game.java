package byow.Core;

import byow.TileEngine.TERenderer;
import edu.princeton.cs.algs4.StdDraw;

import java.awt.*;
import java.io.*;

/**
 * Creates a specific game that can be played.
 * Handles the keybinding logic of the specific game mode.
 * Handles multiple game modes.
 *
 * Running its play method will return:
 * The keys pressed???
 * If during the playing of the game did the player quit???
 *
 *
 */
public class Game implements Serializable {
    /** Customizable score that game ends at */
    public static final int SCORE = 3;
    /** Customizable amount of steps that can be taken with ball */
    public static final int STEPS = 5;

    /** Keeps track of which game mode to play. Default is 1v1 */
    private GameMode gameMode;

    /** Parent engine */
    private Engine engine;
    /** The map of the game */
    private Map map;
    /** TERenderer ???*/
    private TERenderer ter;

    private Player one;
    private int p1Score = 0;
    private Player two = null;
    private int p2Score = 0;
    private Ball ball;

    private boolean p1flyCall = false;
    private boolean p2flyCall = false;

    private boolean colonPressed = false;
    public boolean endGame;
    public boolean exitGame;

    public Game(TERenderer ter, Map map, GameMode gameMode, Engine engine) {
        this.ter = ter;
        this.map = map;
        this.gameMode = gameMode;
        this.engine = engine;
        endGame = false;
        one = new Player(map, 1, engine);
        switch (gameMode) {
            case PRACTICE:
                break;
            case ONEvONE:
                two = new Player(map, 2, engine);
                break;
            case ONEvCPU:
                two = new CPU(map, 2, engine);
                break;
        }
        ball = new Ball(map);
    }
    public Game(TERenderer ter, Map map, GameMode gameMode, Engine engine, int p1Score, int p2Score, boolean flipGoals) {
        this.ter = ter;
        this.map = map;
        this.gameMode = gameMode;
        this.engine = engine;
        endGame = false;
        if (!flipGoals) {
            one = new Player(map, 1, engine);
        }
        switch (gameMode) {
            case PRACTICE:
                break;
            case ONEvONE:
                two = new Player(map, 2, engine);
                break;
            case ONEvCPU:
                two = new CPU(map, 2, engine);
                break;
        }
        if (flipGoals) {
            one = new Player(map, 1, engine);
        }
        ball = new Ball(map);
        this.p1Score = p1Score;
        this.p2Score = p2Score;
    }

    public void play(char keyTyped) {
        //ter.renderFrame(map.displayGrid());
        switch (gameMode) {
            case PRACTICE:
                practice(keyTyped);
                break;
            case ONEvONE:
                oneVOne(keyTyped);
                break;
            case ONEvCPU:
                oneVAI(keyTyped);
                break;
        }
    }
    public void practice(char keyTyped) {
        quitGameCheck(keyTyped);
        switch (keyTyped) {
            case 'w':
                if (p1flyCall) {
                    one.fly(Direction.NORTH, ter);
                    p1flyCall = false;
                } else {
                    one.move(Direction.NORTH, ball);
                }
                break;
            case 'd':
                if (p1flyCall) {
                    one.fly(Direction.EAST, ter);
                    p1flyCall = false;
                } else {
                    one.move(Direction.EAST, ball);
                }
                break;
            case 's':
                if (p1flyCall) {
                    one.fly(Direction.SOUTH, ter);
                    p1flyCall = false;
                } else {
                    one.move(Direction.SOUTH, ball);
                }
                break;
            case 'a':
                if (p1flyCall) {
                    one.fly(Direction.WEST, ter);
                    p1flyCall = false;
                } else {
                    one.move(Direction.WEST, ball);
                }
                break;
            case 'q':
                if (p1flyCall) {
                    p1flyCall = false;
                } else {
                    p1flyCall = true;
                }
                break;
            case 'e':
                if (!colonPressed) {
                    if (one.hasBall) {
                        one.toss(one.lastMoved, ball, ter, this);
                    } else {
                        one.grab(ball);
                    }
                    p1flyCall = false;
                }
                break;
        }
    }
    public void oneVOne(char keyTyped) {
        if (quitGameCheck(keyTyped)) {
            return;
        }
        switch (keyTyped) {
            case 'w':
                if (p1flyCall) {
                    one.fly(Direction.NORTH, ter);
                    p1flyCall = false;
                } else {
                    one.move(Direction.NORTH, ball);
                }
                break;
            case 'd':
                if (p1flyCall) {
                    one.fly(Direction.EAST, ter);
                    p1flyCall = false;
                } else {
                    one.move(Direction.EAST, ball);
                }
                break;
            case 's':
                if (p1flyCall) {
                    one.fly(Direction.SOUTH, ter);
                    p1flyCall = false;
                } else {
                    one.move(Direction.SOUTH, ball);
                }
                break;
            case 'a':
                if (p1flyCall) {
                    one.fly(Direction.WEST, ter);
                    p1flyCall = false;
                } else {
                    one.move(Direction.WEST, ball);
                }
                break;
            case 'q':
                if (!colonPressed) {
                    if (p1flyCall) {
                        p1flyCall = false;
                    } else {
                        p1flyCall = true;
                    }
                }
                break;
            case 'e':
                if (!colonPressed) {
                    if (one.hasBall) {
                        one.toss(one.lastMoved, ball, ter, this);
                    } else if (two.hasBall) {
                        one.punch(two, ball, ter, this);
                    } else {
                        one.grab(ball);
                    }
                    p1flyCall = false;
                }
                break;
            case 'i':
                if (p2flyCall) {
                    two.fly(Direction.NORTH, ter);
                    p2flyCall = false;
                } else {
                    two.move(Direction.NORTH, ball);
                }
                break;
            case 'l':
                if (p2flyCall) {
                    two.fly(Direction.EAST, ter);
                    p2flyCall = false;
                } else {
                    two.move(Direction.EAST, ball);
                }
                break;
            case 'k':
                if (p2flyCall) {
                    two.fly(Direction.SOUTH, ter);
                    p2flyCall = false;
                } else {
                    two.move(Direction.SOUTH, ball);
                }
                break;
            case 'j':
                if (p2flyCall) {
                    two.fly(Direction.WEST, ter);
                    p2flyCall = false;
                } else {
                    two.move(Direction.WEST, ball);
                }
                break;
            case 'u':
                if (p2flyCall) {
                    p2flyCall = false;
                } else {
                    p2flyCall = true;
                }
                break;
            case 'o':
                if (two.hasBall) {
                    two.toss(two.lastMoved, ball, ter, this);
                } else if (one.hasBall) {
                    two.punch(one, ball, ter, this);
                } else {
                    two.grab(ball);
                }
                p2flyCall = false;
                break;
            default:
                break;
        }
    }
    public void oneVAI(char keyTyped) {
        if (quitGameCheck(keyTyped)) {
            return;
        }
        switch (keyTyped) {
            case 'w':
                if (p1flyCall) {
                    one.fly(Direction.NORTH, ter);
                    p1flyCall = false;
                } else {
                    one.move(Direction.NORTH, ball);
                }
                ((CPU) two).determineInput(one, ball, ter, this);
                break;
            case 'd':
                if (p1flyCall) {
                    one.fly(Direction.EAST, ter);
                    p1flyCall = false;
                } else {
                    one.move(Direction.EAST, ball);
                }
                ((CPU) two).determineInput(one, ball, ter, this);
                break;
            case 's':
                if (p1flyCall) {
                    one.fly(Direction.SOUTH, ter);
                    p1flyCall = false;
                } else {
                    one.move(Direction.SOUTH, ball);
                }
                ((CPU) two).determineInput(one, ball, ter, this);
                break;
            case 'a':
                if (p1flyCall) {
                    one.fly(Direction.WEST, ter);
                    p1flyCall = false;
                } else {
                    one.move(Direction.WEST, ball);
                }
                ((CPU) two).determineInput(one, ball, ter, this);
                break;
            case 'q':
                if (!colonPressed) {
                    if (p1flyCall) {
                        p1flyCall = false;
                    } else {
                        p1flyCall = true;
                    }
                }
                break;
            case 'e':
                if (!colonPressed) {
                    if (one.hasBall) {
                        one.toss(one.lastMoved, ball, ter, this);
                        ((CPU) two).determineInput(one, ball, ter, this);
                        if (gameHasBeenReset()) {
                            map.setTile(two.location.x(), two.location.y(), map.getFloorTile());
                            return;
                        }
                    } else if (two.hasBall) {
                        one.punch(two, ball, ter, this);
                    } else {
                        one.grab(ball);
                    }
                    p1flyCall = false;
                }
                break;
        }
    }

    private boolean quitGameCheck(char keyTyped) {
        if (keyTyped == ':') {
            System.out.println("Colon pressed");
            colonPressed = true;
        } else if (colonPressed) {
            if (Character.toUpperCase(keyTyped) == 'Q') {
                System.out.println("Saving and quitting game");
                this.endGame = true;
                this.exitGame = true;
                return true;
            } else if (Character.toUpperCase(keyTyped) == 'E') {
                System.out.println("Saving game and returning to title screen.");
                this.endGame = true;
                return true;
            }
            colonPressed = false;
        }
        return false;
    }
    public void incrementScore(int playerNumber) {
        if (gameMode == GameMode.PRACTICE) {
            map.setTile(one.location.x(), one.location.y(), map.getFloorTile());
            goalSound();
            engine.resetGame(ter, map, gameMode, p1Score, p2Score);
        } else if (playerNumber == 1) {
            p1Score++;
            goalSound();
            if (p1Score == SCORE) {
                engine.win(playerNumber);
            } else {
                map.setTile(one.location.x(), one.location.y(), map.getFloorTile());
                map.setTile(two.location.x(), two.location.y(), map.getFloorTile());
                System.out.println("reset game, load, p1");
                engine.resetGame(ter, map, gameMode, p1Score, p2Score);
            }
        } else if (playerNumber == 2) {
            p2Score++;
            goalSound();
            if (p2Score == SCORE) {
                engine.win(playerNumber);
            } else {
                map.setTile(one.location.x(), one.location.y(), map.getFloorTile());
                map.setTile(two.location.x(), two.location.y(), map.getFloorTile());
                engine.resetGame(ter, map, gameMode, p1Score, p2Score);
            }
        }
    }
    private void goalSound() {
        try {
            AudioPlayer score = new AudioPlayer(System.getProperty("user.dir") + "/403010__inspectorj__ui-confirmation-alert-b2.wav");
            score.clip.start();
            engine.hud();
            StdDraw.setFont(Engine.FONT_BIG);
            StdDraw.setPenColor(Color.white);
            StdDraw.text((Engine.WIDTH) / 2, (Engine.INFO_SPACE + Engine.HUD_SPACE + Engine.HEIGHT) / 2, "GOOALLL!!!");
            StdDraw.show();
            StdDraw.pause(1500);
            score.clip.stop();
        }
        catch (Exception ex) {
            System.out.println("Error with playing sound.");
            ex.printStackTrace();
        }
    }

    private boolean gameHasBeenReset() {
        int count = 0;
        for (int x = 0; x < map.WIDTH; x++) {
            for (int y = 0; y < map.HEIGHT; y++) {
                if (map.getTile(x, y).description().equals("CPU")) {
                    count++;
                }
            }
        }
        if (count > 1) {
            return true;
        }
        return false;
    }

    public Map getMap() {
        return this.map;
    }
    public Player getPlayerOne() {
        return this.one;
    }
    public int getPlayerOneScore() {
        return this.p1Score;
    }
    public Player getPlayerTwo() {
        return this.two;
    }
    public int getPlayerTwoScore() {
        return this.p2Score;
    }

}

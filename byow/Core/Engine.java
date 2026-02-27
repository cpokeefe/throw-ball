package byow.Core;

import byow.TileEngine.TERenderer;
import byow.TileEngine.TETile;
import edu.princeton.cs.algs4.StdDraw;
import org.checkerframework.checker.units.qual.C;

import java.awt.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Random;

import static java.lang.Long.parseLong;

public class Engine {
    public TERenderer ter;
    /** Space at the top */
    public static final int HUD_SPACE = 6;
    /** Space at the bottom */
    public static final int INFO_SPACE = 2;
    /* Feel free to change the width and height. */
    public static final int WIDTH = 80; //80 was given, 90 for fullscreen
    public static final int HEIGHT = 30; //30 was given, 40 for fullscreen
    public static final Font FONT_BIG = new Font("Monaco", Font.BOLD, 50);
    public static final Font FONT_LARGE = new Font("Monaco", Font.BOLD, 30);
    public static final Font FONT_MEDIUM = new Font("Monaco", Font.BOLD, 20);
    /** The path for the loaded game */
    private static final Path LOAD_PATH = Paths.get(System.getProperty("user.dir"), ".load.txt");
    /** The file of the loaded game */
    public static final File LOAD_FILE = LOAD_PATH.toFile();
    /** The path for the replay game memory */
    private static final Path REPLAY_PATH = Paths.get(System.getProperty("user.dir"), ".replay.txt");
    /** The file of the replay game memory */
    public static final File REPLAY_FILE = REPLAY_PATH.toFile();
    /** Error screen animation time */
    public static final int ANIMATION_PAUSE = 3000;

    /**
     * Is the game that is called from the engine
     * Can set the parameters of this game object and then
     * play the game with its .play() method
     */
    private static Game game;
    /**
     * Keeps track of what gameMode the player has selected.
     * The default game mode is ONEvONE
     */
    private GameMode currGameMode = GameMode.ONEvONE;
    /**
     * Keeps track which screen should be displayed.
     * The default screen is the TITLE screen.
     */
    private Screen currScreen = Screen.TITLE;
    /**
     * Keeps track of the users key presses.
     * All characters should be UPPER CASE.
     */
    private String keyPresses = "";
    private String seed = "";

    private boolean gameEnd = true;
    private static boolean countdown = true;
    //public static boolean flipGoals;
    public boolean flipGoals; //TODO need static?
    private boolean pause;
    private Random rand;

    /**
     * Method used for autograding and testing your code. The input string will be a series
     * of characters (for example, "n123sswwdasdassadwas", "n123sss:q", "lwww". The engine should
     * behave exactly as if the user typed these characters into the engine using
     * interactWithKeyboard.
     */
    public TETile[][] interactWithInputString(String input) {
        //for autograder
        if (ter == null) {
            ter = new TERenderer();
            ter.initialize(WIDTH, HEIGHT + HUD_SPACE + INFO_SPACE, 0, 2);
        }

        flipGoals = false;

        String restOfInput = null;
        TETile[][] finalWorldFrame;

        if (input.charAt(0) == 'X') {
            // Allows for changing game modes
            switch (input.charAt(1)) {
                case '1':
                    currGameMode = GameMode.ONEvONE;
                    break;
                case '2':
                    currGameMode = GameMode.ONEvCPU;
                    break;
                case '3':
                    currGameMode = GameMode.PRACTICE;
                    break;
                default:
                    break;
            }

            // Copied from below :D
            String manyDigitSeed = validSeedCheck(input.substring(input.indexOf("N") + 1, input.indexOf("S")));
            long seed = parseLong(manyDigitSeed);
            MapGenerator mapGenerator = new MapGenerator(new Random(seed), WIDTH, HEIGHT);
            game = new Game(ter, mapGenerator.makeUniformMap(), currGameMode, this);
            restOfInput = input.substring(input.indexOf("S") + 1);

        } else if (input.charAt(0) == 'N') {
            // Create a new game
            String manyDigitSeed = validSeedCheck(input.substring(input.indexOf("N") + 1, input.indexOf("S")));
            long seed = parseLong(manyDigitSeed);
            MapGenerator mapGenerator = new MapGenerator(new Random(seed), WIDTH, HEIGHT);
            game = new Game(ter, mapGenerator.makeUniformMap(), currGameMode, this);
            restOfInput = input.substring(input.indexOf("S") + 1);
        } else if (input.charAt(0) == 'L') {
            String loadedString = readContentsAsString(LOAD_FILE).toUpperCase();
            String manyDigitSeed = validSeedCheck(loadedString.substring(input.indexOf("N") + 1, loadedString.indexOf("S")));
            long seed = parseLong(manyDigitSeed);
            MapGenerator mapGenerator = new MapGenerator(new Random(seed), WIDTH, HEIGHT);
            game = new Game(ter, mapGenerator.makeUniformMap(), currGameMode, this);

            String previousMovements = loadedString.substring(loadedString.indexOf('S'), loadedString.length() - 2);
            restOfInput = previousMovements + input.substring(1);
        }
        // You save and quit after making/loading a game
        if (input.contains(":")) {
//            System.out.println("Rest: " + restOfInput);   DEBUG
            restOfInput = restOfInput.substring(0, restOfInput.length() - 2);
        }
        // You just quit after making/loading a game
        for (int i = 0; i < restOfInput.length(); i++) {
            game.play(Character.toLowerCase(restOfInput.charAt(i)));
        }

        finalWorldFrame = game.getMap().displayGrid();
        return finalWorldFrame;
    }
    public void interactWithKeyboard() {
        ter = new TERenderer();
        ter.initialize(WIDTH, HEIGHT + HUD_SPACE + INFO_SPACE, 0, 2);
        StdDraw.enableDoubleBuffering();
        long seed = 0L; // Will be updated in the seed screen!

        // MUSIC
        try {
            AudioPlayer titleMusic = new AudioPlayer(System.getProperty("user.dir") + "/Ronald Jenkees - Try The Bass.wav");
            titleMusic.clip.start();
        }
        catch (Exception ex) {
            System.out.println("Error with playing sound.");
            ex.printStackTrace();
        }

        /*
        New logic to allow for multiple screens and switching between.
        Change the instance of the Engine object called "currScreen"
        Move keyboard input logic into its own function just like the titleScreen()
         */
        titleScreen('z');
        while (true) {
            if (StdDraw.hasNextKeyTyped()) {
                char keyTyped = StdDraw.nextKeyTyped();

                switch (currScreen) {
                    case TITLE:
                        keyPresses += keyTyped;
                        titleScreen(keyTyped);
                        break;
                    case SEED:
                        keyPresses += keyTyped;
                        seedScreen(keyTyped);
                        break;
                    case GAME:
                        keyPresses += keyTyped;
                        gameScreen(keyTyped);
                        break;
                    case REPLAY:
                        replayScreen(keyTyped);
                        break;
                    case GAMEMODE:
                        keyPresses += keyTyped;
                        gameModeScreen(keyTyped);
                        break;
                    default:
                        break;
                }

                // Saves game and quits
                if (game != null && game.endGame && game.exitGame) {
                    System.out.println("Key Presses: " + keyPresses);
                    writeContents(REPLAY_FILE, keyPresses);
                    writeContents(LOAD_FILE, keyPresses);
                    System.exit(0);
                    // Just saves game
                } else if (game != null && game.endGame) {
                    currScreen = Screen.TITLE;
                    System.out.println(keyPresses);
                    writeContents(REPLAY_FILE, keyPresses);
                    writeContents(LOAD_FILE, keyPresses);

                    keyPresses = "";
                    this.seed = "";
                    game = null;
                    titleScreen('z');
                }
            }
            // Here call the HUD
            if (!gameEnd && game != null) {
                hud();
            }
        }
    }

    private void titleScreen(char keyTyped) {
        // Draws the title screen. Am wondering if I should only call these lines once instead of
        // all the time in my current idea
        System.out.println("In the title screen");
        System.out.println("Game: " + game);

        StdDraw.clear(Color.BLACK);
        StdDraw.setPenColor(Color.WHITE);

        StdDraw.setFont(FONT_BIG);
        StdDraw.text(WIDTH / 2, ((HEIGHT + HUD_SPACE + INFO_SPACE) / 2) + 4, "Throw Ball");

        StdDraw.setFont(FONT_MEDIUM);
        String[] options = new String[]{"New Game (N)", "Load Game (L)", "Replay Game (R)", "Switch Game Mode (X)", "Quit (Q)"};
        for (int i = 0; i < options.length; i++) {
            int yOffset = ((HEIGHT + HUD_SPACE + INFO_SPACE) / 2) + 4 - (i * 2) - 4;
            StdDraw.text(WIDTH / 2, yOffset, options[i]);
        }
        
        StdDraw.text(WIDTH / 2, 3, "Current Game Mode: " + currGameMode);

        StdDraw.show();

        switch (Character.toLowerCase(keyTyped)) {
            case 'n':
                game = null;
                currScreen = Screen.SEED;
                seedScreen(' ');
                break;
            case 'l':
                String loadedGame = readContentsAsString(LOAD_FILE).toUpperCase();
                //chop 'l' off of keyPresses
                keyPresses = keyPresses.substring(0, keyPresses.length() - 1);
                // This handles when nothing is saved AND
                // When the saved previous game is a game that was won. No need to load a game that already ended
                if (loadedGame.equals("") || (!keyPresses.equals("") && keyPresses.charAt(keyPresses.length() -2) != ':')) {
                    currScreen = Screen.TITLE;
                    titleScreen('z');
                    return;
                }
                interactWithInputString(loadedGame); // This should update the engines game + others!
                currScreen = Screen.GAME;
                keyPresses = loadedGame.substring(0, loadedGame.length() - 2);
                gameScreen(' ');
                break;
            case 'r':
                keyPresses = keyPresses.substring(0, keyPresses.length() - 1);
                currScreen = Screen.REPLAY;
                replayScreen('z');
                break;
            case 'x':
                currScreen = Screen.GAMEMODE;
                gameModeScreen(' ');
                break;
//            case 's':
//                currScreen = Screen.SETTINGS;
//                settingsScreen(' ');
//                break;
            case 'q':
                System.exit(0);
                break;
            default:
                if (keyPresses.length() <= 1) {
                    keyPresses = "";
                } else {
                    keyPresses = keyPresses.substring(0, keyPresses.length() - 1);
                }
                break;
        }
    }
    private void seedScreen(char keyTyped) {
        keyTyped = Character.toUpperCase(keyTyped);

        StdDraw.clear(Color.BLACK);
        StdDraw.setPenColor(Color.WHITE);

        StdDraw.setFont(FONT_MEDIUM);
        StdDraw.text(WIDTH / 2, ((HEIGHT + HUD_SPACE + INFO_SPACE) / 2) + 4, "Enter seed ending with an 'S'");
        if (seed.equals("")) {
            StdDraw.text(WIDTH / 2, (HEIGHT + HUD_SPACE + INFO_SPACE) / 2, "_____");
        } else {
            StdDraw.text(WIDTH / 2, (HEIGHT + HUD_SPACE + INFO_SPACE) / 2, seed);
        }
        StdDraw.show();

        if (Character.isDigit(keyTyped)) {
            seed = seed + keyTyped;
            StdDraw.clear(Color.BLACK);
            StdDraw.setPenColor(Color.WHITE);

            StdDraw.setFont(FONT_MEDIUM);
            StdDraw.text(WIDTH / 2, ((HEIGHT + HUD_SPACE + INFO_SPACE) / 2) + 4, "Enter seed ending with an 'S'");
            StdDraw.text(WIDTH / 2, (HEIGHT + HUD_SPACE + INFO_SPACE) / 2, seed);

            StdDraw.show();
        } else {
            // It is a letter
            if (keyTyped == 'S') {
                if (seed.equals("")) {
                    StdDraw.clear(Color.BLACK);
                    StdDraw.setPenColor(Color.WHITE);

                    StdDraw.setFont(FONT_MEDIUM);
                    StdDraw.text(WIDTH / 2, ((HEIGHT + HUD_SPACE + INFO_SPACE) / 2) + 4, "Cannot enter an empty seed!");
                    StdDraw.show();

                    StdDraw.pause(ANIMATION_PAUSE);

                    StdDraw.clear(Color.BLACK);
                    StdDraw.setPenColor(Color.WHITE);

                    StdDraw.setFont(FONT_MEDIUM);
                    StdDraw.text(WIDTH / 2, ((HEIGHT + HUD_SPACE + INFO_SPACE) / 2) + 4, "You cannot enter an empty seed.");
                    StdDraw.text(WIDTH / 2, (HEIGHT + HUD_SPACE + INFO_SPACE) / 2, seed);
                    StdDraw.show();
                } else {
                    currScreen = Screen.GAME;
                    gameScreen(' ');
                }
            }
            // Makes sure letters do not interfere with the seed
            // Only N2342324S  X1N2342S are okay
            // No N2SBJKJ234234S X109232S is bad!
            keyPresses = keyPresses.toUpperCase();
            if (keyPresses.charAt(0) == 'X') {
                if ((keyPresses.length() > 3 && currScreen == Screen.SEED) || (keyPresses.length() > 3 && seed.equals(""))) {
                    keyPresses = keyPresses.substring(0, keyPresses.length() - 1);
                }
            } else {
                if ((keyPresses.length() > 1 && currScreen == Screen.SEED) || (keyPresses.length() > 1 && seed.equals(""))) {
                    keyPresses = keyPresses.substring(0, keyPresses.length() - 1);
                }
            }

        }
        System.out.println("keyPresses: " + keyPresses);

    }
    public void gameScreen(char keyTyped) {
        // Run this once if the game has not been made already!
        if (game == null) {
            flipGoals = false;
            validSeedCheck();
            rand = new Random(parseLong(seed));
            MapGenerator mapGenerator = new MapGenerator(rand);
            game = new Game(ter, mapGenerator.makeUniformMap(), currGameMode, this); // FIXME: be able to handle other gamemodes!
            countdown = true;
        }
        if (countdown) {
            displayCountdown();
            countdown = false;
        }
        gameEnd = false;
        game.play(Character.toLowerCase(keyTyped));
        if (gameEnd) {
            titleScreen('z');
            gameEnd = false;
            seed = "";
        } else {
            StdDraw.pause(10); // Helps with graphical flickering
            ter.renderFrame(game.getMap().displayGrid());
            hud();
        }
    }
    /** Exception: has another while (true) */
    private void replayScreen(char keyTyped) {
        int stepTime = 100; // In milliseconds
        String keyPressesLoaded = readContentsAsString(REPLAY_FILE).toUpperCase();
        this.keyPresses = keyPressesLoaded;
        keyPresses = keyPresses.toUpperCase();
        System.out.println(keyPresses);

        if (keyPresses.equals("")) {
            currScreen = Screen.TITLE;
            titleScreen('z');
            return;
        }

        if (keyPresses.charAt(0) == 'X') {
            switch (keyPresses.charAt(1)) {
                case '1':
                    currGameMode = GameMode.ONEvONE;
                    break;
                case '2':
                    currGameMode = GameMode.ONEvCPU;
                    break;
                case '3':
                    currGameMode = GameMode.PRACTICE;
                    break;
                default:
                    break;
            }
        }

        seed = keyPresses.substring(keyPresses.indexOf("N") + 1, keyPresses.indexOf("S"));
        String movements = keyPresses.substring(keyPresses.indexOf("S") + 1);
        if (movements.contains(":Q") || movements.contains(":E")) {
            movements = movements.substring(0, movements.length() - 2);
        }
//
//        // FIXME: remove this duplicated code???
//        if (keyPresses == "") {
//            currScreen = Screen.TITLE;
//            titleScreen('z');
//            return;
//        }

        pause = false;
        boolean end = false;
        int i = 0; // Goes through the saved replay string starting at 0
        Boolean[] colonPressed = new Boolean[1];
        colonPressed[0] = false; // Allows for mutation

        while (!end) {
            if (StdDraw.hasNextKeyTyped()) {
                char keyTypedReplay = Character.toLowerCase(StdDraw.nextKeyTyped());
                end = quitReplayCheck(keyTypedReplay, colonPressed);
                switch(keyTypedReplay) {
                    case ' ':
//                        System.out.println("how???" + keyTypedReplay);
                        if (pause) {
                            pause = false;
                        } else {
                            pause = true;
                            hud();
                            StdDraw.show();
                        }
                        break;
                    case 'a':
                        // FIXME: does not work :(
                        // Do not know how to travel back in time :(
//                        pause = true;
//                        gameScreen(keyPresses.charAt(i));
//                        if (i != 0) {
//                            i--;
//                        }
                    case 'd':
                        pause = true;
                        gameScreen(movements.charAt(i));
                        i++;
                        break;
                    default:
                        break;
                }
            }
            if (i >= movements.length()) {
                end = true;
            }
            if (!end && !pause) {
                gameScreen(movements.charAt(i));
                i++;
                StdDraw.pause(stepTime);
            }

        }

        currScreen = Screen.TITLE;
        this.keyPresses = ""; // "maybe have "N"
        seed = "";
        game = null;
        StdDraw.pause(500); // End at the end
        titleScreen('z');
    }

    private boolean quitReplayCheck(char keyTyped, Boolean[] colonPressed) {
//        System.out.println(colonPressed[0]);
        if (keyTyped == ':') {
            colonPressed[0] = true;
        } else if (colonPressed[0]) {
            if (Character.toUpperCase(keyTyped) == 'Q') {
                // Just quits the game
                System.exit(0);
            } else if (Character.toUpperCase(keyTyped) == 'E') {
                // Just returns to the title screen
                return true;
            }
            colonPressed[0] = false;
        }
        return false;
    }
    private void gameModeScreen(char keyTyped) {
        StdDraw.clear(Color.black);
        StdDraw.setFont(FONT_MEDIUM);
        StdDraw.setPenColor(Color.white);
        StdDraw.text(WIDTH / 2, ((HEIGHT + HUD_SPACE + INFO_SPACE) / 2) + 4, "Change Game Mode");
        String[] options = new String[]{"One v One (1)", "One v CPU (2)", "Practice (3)"};
        for (int i = 0; i < options.length; i++) {
            int yOffset = ((HEIGHT + HUD_SPACE + INFO_SPACE) / 2) + 4 - (i * 2) - 4;
            StdDraw.text(WIDTH / 2, yOffset, options[i]);
        }

        StdDraw.text(WIDTH / 2, 3, "Current Game Mode: " + currGameMode);

        StdDraw.show();

        switch (keyTyped) {
            case '1':
                // ONEvONE
                currGameMode = GameMode.ONEvONE;
                currScreen = Screen.TITLE;
                keyPresses += '1'; // Must do this for a weird reason having to do with the titleScreen...
                titleScreen(' ');
                break;
            case '2':
                // ONEvCPU
                currGameMode = GameMode.ONEvCPU;
                currScreen = Screen.TITLE;
                keyPresses += '2';
                titleScreen(' ');
                break;
            case '3':
                // PRACTICE
                currGameMode = GameMode.PRACTICE;
                currScreen = Screen.TITLE;
                keyPresses += '3';
                titleScreen(' ');
                break;
            default:
                // Gets rid of excess keyPresses
                if (keyPresses.length() > 1) {
                    keyPresses = keyPresses.substring(0, keyPresses.length() - 1);
                }
                break;
        }

        writeContents(REPLAY_FILE, "");
        writeContents(LOAD_FILE, "");

        if (keyPresses.length() == 3) {
            keyPresses = "X" + keyPresses.charAt(2);
        }
        System.out.println("Key Presses: " + keyPresses);
    }
    private void settingsScreen(char keyTyped) {
        StdDraw.clear(Color.black);
        StdDraw.setFont(FONT_MEDIUM);
        StdDraw.setPenColor(Color.white);
        StdDraw.text(WIDTH / 2, ((HEIGHT + HUD_SPACE + INFO_SPACE) / 2) + 4, "Change Game Mode");
        String[] options = new String[]{"Controls (1)", "Color (2)", "Rules (3)"};
        for (int i = 0; i < options.length; i++) {
            int yOffset = ((HEIGHT + HUD_SPACE + INFO_SPACE) / 2) + 4 - (i * 2) - 4;
            StdDraw.text(WIDTH / 2, yOffset, options[i]);
        }

        StdDraw.show();

        switch (keyTyped) {
            case '1':
                // Controls
                currScreen = Screen.CONTROLS;
                keyPresses += '1'; // Must do this for a weird reason having to do with the titleScreen...
                titleScreen(' ');
                break;
            case '2':
                // Color
                currScreen = Screen.COLOR;
                keyPresses += '2';
                titleScreen(' ');
                break;
            case '3':
                // Rules
                currScreen = Screen.RULES;
                keyPresses += '3';
                titleScreen(' ');
                break;
            default:
                // Gets rid of excess keyPresses
                if (keyPresses.length() > 1) {
                    keyPresses = keyPresses.substring(0, keyPresses.length() - 1);
                }
                break;
        }

        writeContents(REPLAY_FILE, "");
        writeContents(LOAD_FILE, "");

        if (keyPresses.length() == 3) {
            keyPresses = "S" + keyPresses.charAt(2);
        }
        System.out.println("Key Presses: " + keyPresses);

    }

    public void resetGame(TERenderer ter, Map map, GameMode gameMode, int p1Score, int p2Score) {
        countdown = true;
        flipGoals = !flipGoals;
        game = new Game(ter, map, gameMode, this, p1Score, p2Score, flipGoals);
        gameScreen(' '); // This calls countdown to start immediately after scoring!
    }
    public void win(int player) {
        System.out.println("winner");
        String toDraw = "Player " + player + " wins!";
        StdDraw.clear(Color.BLACK);
        StdDraw.setPenColor(Color.WHITE);
        StdDraw.setFont(FONT_BIG);
        StdDraw.text(WIDTH / 2, (HEIGHT + HUD_SPACE + INFO_SPACE) / 2, toDraw);
        StdDraw.show();
        StdDraw.pause(ANIMATION_PAUSE);
        currScreen = Screen.TITLE;
        gameEnd = true;
        game = null;
        writeContents(REPLAY_FILE, keyPresses);
        keyPresses = "";
        writeContents(LOAD_FILE, keyPresses); // Does this work???
    }

    /** 3 2 1 GOOOOOOOOO */
    private void displayCountdown() {
        for (int i = 3; i >= 0; i--) {
            // Something to do with how tiles are drawn :(
            StdDraw.setFont(); // This fixes the tiles graphical issues
            ter.renderFrame(game.getMap().displayGrid());
            if (game.getPlayerOneScore() > 0 || game.getPlayerTwoScore() > 0) {
                hud();
                StdDraw.setPenColor(Color.white);
                StdDraw.setFont(FONT_BIG);
                StdDraw.text(WIDTH / 2, ((HEIGHT + HUD_SPACE + INFO_SPACE) / 2) + 4, "Switching Sides");
            }
            StdDraw.setPenColor(Color.white);
            StdDraw.setFont(FONT_BIG);
            if (i > 0) {
                StdDraw.text(WIDTH / 2, (HEIGHT + HUD_SPACE + INFO_SPACE) / 2, Integer.toString(i));
            } else {
                StdDraw.text(WIDTH / 2, (HEIGHT + HUD_SPACE + INFO_SPACE) / 2, "GOOOOO!");
            }
            StdDraw.show();
            // plays countdown sound
            try {
                if (i == 0) {
                    AudioPlayer countdown = new AudioPlayer(System.getProperty("user.dir") + "/196106__aiwha__ding.wav");
                    countdown.clip.start();
                    StdDraw.pause(1000);
                    countdown.clip.stop();
                } else {
                    AudioPlayer countdown = new AudioPlayer(System.getProperty("user.dir") + "/320905__suzenako__the-ding.wav");
                    countdown.clip.start();
                    StdDraw.pause(1000);
                    countdown.clip.stop();
                }



            }
            catch (Exception ex) {
                System.out.println("320905__suzenako__the-ding.wav");
                ex.printStackTrace();
                StdDraw.pause(1000);
            }

            // Empties the keyTyped queue
            while(StdDraw.hasNextKeyTyped()) {
                StdDraw.nextKeyTyped();
            }
        }

        // Resets back to game screen
        StdDraw.setFont(); // This "greys" the game screen!
        ter.renderFrame(game.getMap().displayGrid());
        hud();

        // My failed attempt at a 3 2 1 animation.
        // The animation was that the numbers would grow larger with time
//        for (int i = 3; i > 0; i--) {
//            System.out.println("for loop: " + i);
//            int j = 50;
//            while (j > 0) {
//                System.out.println("while: " + j);
//                ter.renderFrame(game.getMap().displayGrid());
//                hud();
//
//                StdDraw.setPenColor(Color.white);
//                int size = (int) (Math.log(-(j - 55)) * 0.25);
//                if (size >= 1) {
//                    size = 1;
//                }
//                Font smallToBig = new Font("Monaco", Font.BOLD, (int) (size * 50));
//                StdDraw.setFont(smallToBig);
//                StdDraw.text(WIDTH / 2, (HEIGHT + HUD_SPACE) / 2, Integer.toString(i));
//                StdDraw.show();
//                StdDraw.pause(10);
//                j--;
//                StdDraw.setFont(); // Resets font back to same...
//            }
//        }
//        ter.renderFrame(game.getMap().displayGrid());
//        hud();
    }

    /** Includes both the game rendering and the HUD around the edges */
    public void hud() {
        // Clears the HUD screen
        StdDraw.setPenColor(Color.black);
        StdDraw.filledRectangle(WIDTH / 2, HEIGHT + (HUD_SPACE / 2) + INFO_SPACE, WIDTH / 2, HUD_SPACE / 2);

        infoBar();

        // Scoreboard design
        playerHud(game.getPlayerOne(), 2);
        if (game.getPlayerTwo() != null) {
            StdDraw.setPenColor(Color.white);
            StdDraw.setFont(FONT_MEDIUM);
            StdDraw.text((WIDTH / 2), INFO_SPACE + HEIGHT + ((HUD_SPACE / 2) + 2), "First to");
            StdDraw.setFont(FONT_LARGE);
            StdDraw.text((WIDTH / 2), HEIGHT + (HUD_SPACE / 2) + INFO_SPACE, Integer.toString(game.SCORE) + "!");

            playerScoreBar(game.getPlayerOne(), game.getPlayerOneScore(), Game.SCORE);
            playerHud(game.getPlayerTwo(), WIDTH - 17);
            playerScoreBar(game.getPlayerTwo(), game.getPlayerTwoScore(), Game.SCORE);
        }

        StdDraw.setFont(FONT_MEDIUM); // Makes sure the game is in correct "font size"
        StdDraw.show(); // Final show()
    }
    private void infoBar() {
        // Clears the infoBar space
        StdDraw.setPenColor(Color.black);
        StdDraw.filledRectangle(WIDTH / 2, INFO_SPACE / 2, WIDTH / 2, INFO_SPACE / 2);

        // Show what tile the mouse is currently hovering over
        StdDraw.setFont(FONT_MEDIUM);
        StdDraw.setPenColor(Color.gray);
        int mouseX = (int) StdDraw.mouseX();
        int mouseY = ((int) StdDraw.mouseY()) - INFO_SPACE;
        if (mouseX >= 0 && mouseX < WIDTH && mouseY >= INFO_SPACE && mouseY < HEIGHT) {
            TETile hoveredTile = game.getMap().getTile(mouseX, mouseY);
            StdDraw.text(4, INFO_SPACE / 2, hoveredTile.description());
        }

        // Exit quit shortcuts
        StdDraw.text(WIDTH - 10, INFO_SPACE / 2,"To Exit (:E)   To Quit (:Q)");

        // Replay short cuts
        if (currScreen == Screen.REPLAY) {
            if (pause) {
                StdDraw.setPenColor(Color.red);
            }
            StdDraw.text(WIDTH / 2, INFO_SPACE / 2, "To Pause/Start (SPACE)   To Advance by 1 Action (D)");
        }
    }
    private void playerHud(Player player, int xOffset) {
        // Player one's score + STEPS left + If they have ball
        StdDraw.setFont(FONT_LARGE);
        StdDraw.setPenColor(player.getPlayerColor());
        String playerName = "Player " + player.getPlayerNumber();
        if (player instanceof CPU) {
            playerName = "CPU";
        }
        StdDraw.text(8 + xOffset, HEIGHT + HUD_SPACE + INFO_SPACE - 2, playerName);

        StdDraw.setFont(FONT_MEDIUM);
        if (player.hasBall) {
            StdDraw.setPenColor(Color.yellow);
        } else {
            StdDraw.setPenColor(Color.gray);
        }
        StdDraw.rectangle(2 + xOffset, HEIGHT + HUD_SPACE + INFO_SPACE - 4, 2.825, 0.75);
        StdDraw.text(2 + xOffset, HEIGHT + HUD_SPACE + INFO_SPACE - 4, "Has Ball" );

        if (player.stepsLeft == 0) {
            StdDraw.setPenColor(Color.red);
        } else {
            StdDraw.setPenColor(Color.gray);
        }
        StdDraw.rectangle(10 + xOffset, HEIGHT + HUD_SPACE + INFO_SPACE - 4, 4.5, 0.75);
        StdDraw.text(10 + xOffset, HEIGHT + HUD_SPACE + INFO_SPACE - 4, "Steps Left: " + player.stepsLeft);
    }
    private void playerScoreBar(Player player, int playerScore, int gameScore) {
        double backCenterDist = 10;   // Measuring from center of game to center of text
        double backWidth = 8;           // The "radial" width horizontally of the backing rounded rectangle
        double backHeight = 1;          // The "radial" heigth vertically of the backing rounded rectangle
        double barHeight = 0.75;        // The "radial" heigth vertically of the progress bar rounded rectangle
        double goalTextCenterDist = backCenterDist + backWidth + 2; // Measuring from center of game to center of text
        double scoreTextCenterDist = backCenterDist - backWidth - 2; // Measuring from center of game to center of text


        int flip = 1;
        if (player.getPlayerNumber() == 2) {
            flip = -1;
        }

        StdDraw.setPenColor(Color.white);
        StdDraw.setFont(FONT_LARGE);
        StdDraw.text((WIDTH / 2) - (goalTextCenterDist * flip), HEIGHT + (HUD_SPACE / 2) + INFO_SPACE, Integer.toString(playerScore));

        drawRoundedRectangle((WIDTH / 2) - (backCenterDist * flip), HEIGHT + (HUD_SPACE / 2) + INFO_SPACE, backWidth, backHeight);
        StdDraw.setPenColor(player.getPlayerColor());
        StdDraw.filledCircle((WIDTH / 2) - ((backWidth + backCenterDist - 1) * flip), HEIGHT + (HUD_SPACE / 2) + INFO_SPACE, barHeight);
        if (playerScore > 0) {
            // FIXME? maybe made this an animation???
            // xPos = (Left coordinate of entire backing) + (Proportional) + (Nice 0.25)
            double xPos = (WIDTH / 2) + ((backCenterDist + backWidth) * -flip) + (((backWidth * ((double) playerScore / (double) gameScore)) + 0.25) * flip);
            double halfWidth = backWidth * ((double) playerScore / gameScore);
            drawRoundedRectangle(xPos, HEIGHT + (HUD_SPACE / 2) + INFO_SPACE, halfWidth, barHeight);
        }

    }
    private void drawRoundedRectangle(double x, double y, double halfWidth, double halfHeight) {
        StdDraw.filledRectangle(x, y, halfWidth - halfHeight, halfHeight);
        StdDraw.filledCircle(x - halfWidth + halfHeight, y, halfHeight);
        StdDraw.filledCircle(x + halfWidth - halfHeight, y, halfHeight);
    }

    public Random getRandom() {
        return this.rand;
    }

    private void validSeedCheck() {
        //make sure error doesn't happen in 3rd if
        if (seed.length() == 1) {
            return;
        //checks if seed has more digits than biggest long
        }
        if (seed.length() > Long.toString(Long.MAX_VALUE).length()) {
            seed = seed.substring(0, seed.length() - 1);
            validSeedCheck();
        //checks if seed that has same number of digits without first digit is not bigger than biggest long without first digit (first digit of biggest long is 9)
        } else if (parseLong(seed.substring(1)) > Long.MAX_VALUE % Math.pow(10, Long.toString(Long.MAX_VALUE).length() - 1)) {
            seed = seed.substring(0, seed.length() - 1);
            validSeedCheck();
        }
    }

    private String validSeedCheck(String s) {
        //make sure error doesn't happen in 3rd if
        if (s.length() < 2) {
            return s;
        //checks if seed has more digits than biggest long
        } else if (s.length() > Long.toString(Long.MAX_VALUE).length()) {
            s = s.substring(0, s.length() - 1);
            return validSeedCheck(s);
            //checks if seed that has same number of digits without first digit is not bigger than biggest long without first digit (first digit of biggest long is 9)
        } else if (parseLong(s.substring(1)) > Long.MAX_VALUE % Math.pow(10, Long.toString(Long.MAX_VALUE).length() - 1)) {
            s = s.substring(0, s.length() - 1);
            return validSeedCheck(s);
        } else {
            return s;
        }
    }
    public enum Screen {
        TITLE, SEED, GAME, REPLAY, GAMEMODE, SETTINGS, CONTROLS, COLOR, RULES
        // Add customization, replay, etc...
    }

    /* =================================== Utils =================================== */

    /** Return the entire contents of FILE as a String.  FILE must
     *  be a normal file.  Throws IllegalArgumentException
     *  in case of problems. */
    static String readContentsAsString(File file) {
        return new String(readContents(file), StandardCharsets.UTF_8);
    }

    static byte[] readContents(File file) {
        if (!file.isFile()) {
            throw new IllegalArgumentException("must be a normal file");
        }
        try {
            return Files.readAllBytes(file.toPath());
        } catch (IOException excp) {
            throw new IllegalArgumentException(excp);
        }
    }

    /** Write the result of concatenating the bytes in CONTENTS to FILE,
     *  creating or overwriting it as needed.  Each object in CONTENTS may be
     *  either a String or a byte array.  Throws IllegalArgumentException
     *  in case of problems. */
    static void writeContents(File file, Object... contents) {
        try {
            if (file.isDirectory()) {
                throw
                        new IllegalArgumentException("cannot overwrite directory");
            }
            BufferedOutputStream str =
                    new BufferedOutputStream(Files.newOutputStream(file.toPath()));
            for (Object obj : contents) {
                if (obj instanceof byte[]) {
                    str.write((byte[]) obj);
                } else {
                    str.write(((String) obj).getBytes(StandardCharsets.UTF_8));
                }
            }
            str.close();
        } catch (IOException | ClassCastException excp) {
            throw new IllegalArgumentException(excp);
        }
    }
}

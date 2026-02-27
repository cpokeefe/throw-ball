package byow.Tests;

import byow.Core.AudioPlayer;
import edu.princeton.cs.algs4.StdDraw;

public class MusicTest {
    public static void main(String[] args) {
        try {
            AudioPlayer audioPlayer = new AudioPlayer(System.getProperty("user.dir") + "/685934__timouse__techno-beat-cargo.wav");
            audioPlayer.clip.start();
            StdDraw.pause(1000);
            audioPlayer.clip.stop();
            //audioPlayer.clip.close();
        }
        catch (Exception ex) {
            System.out.println("Error with playing sound.");
            ex.printStackTrace();
        }
        while (true) {
        }
    }
}

package byow.Core;

import javax.sound.sampled.*;
import java.io.File;
import java.io.IOException;

/** Creates object that plays music from file */
public class AudioPlayer {
    public Clip clip;
    private AudioInputStream audioInputStream;
    private String filePath;
    public AudioPlayer(String filePath)
            throws UnsupportedAudioFileException,
            IOException, LineUnavailableException
    {
        this.filePath = filePath;
        // create AudioInputStream object
        audioInputStream = AudioSystem.getAudioInputStream(new File(filePath).getAbsoluteFile());
        // create clip reference
        clip = AudioSystem.getClip();
        // open audioInputStream to the clip
        clip.open(audioInputStream);
        clip.loop(Clip.LOOP_CONTINUOUSLY);
    }
}

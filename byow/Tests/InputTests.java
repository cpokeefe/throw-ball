package byow.Tests;

import byow.Core.Main;
import edu.princeton.cs.algs4.StdDraw;
import org.junit.Test;

public class InputTests {
    @Test
    public void simultaneuosInputTest() {
        while (true) {
            boolean pressed = false;
            StdDraw.hasNextKeyTyped();
            if (StdDraw.isKeyPressed(65)) {
                System.out.print("A");
                pressed = true;
            }

            if (StdDraw.isKeyPressed(66)) {
                System.out.print("B");
                pressed = true;
            }



            if (!pressed) {
                System.out.println("No Specific Key pressed, " + System.currentTimeMillis());
            } else {
                System.out.println("");
            }

            StdDraw.pause(100);

//            StdDraw.nextKeyTyped();

//            if (StdDraw.hasNextKeyTyped()) {
//                System.out.println(StdDraw.nextKeyTyped() + " " + StdDraw.isKeyPressed(65));
//            } else {
//                System.out.println("No Key pressed, " + System.currentTimeMillis());
//            }
//            StdDraw.pause(100);
        }
    }

    @Test
    public void keyUpKeyDownTest() {
        boolean canMove = true;
        while(true) {
            if (StdDraw.hasNextKeyTyped()) {
                if (StdDraw.isKeyPressed(65)) {
                    canMove = false;
                    StdDraw.nextKeyTyped(); // SKIPS OVER HELD KEY
                    System.out.println("Skips over held key" + " " + System.currentTimeMillis());
                } else {
                    canMove = true;
                    StdDraw.pause(100);
                }

                if (canMove) {
                    System.out.println(StdDraw.nextKeyTyped() + " " + System.currentTimeMillis());
                }
            }



//            System.out.println("In while(true)");

        }
    }

    @Test
    public void multipleInputsTest() {
        String[] input = new String[2];
        input[0] = "-s";
        input[1] = "n1392967723524655428sddsaawws:q";
        Main.main(input);
    }
}

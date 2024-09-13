package com.kirishogi;

import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Make the app fullscreen
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS, WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS);

        // Make the status bar transparent
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE |
            View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
        );
    }
}
